import os
import uuid
from fastapi import UploadFile, File
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
from app.api.v1.endpoints.shared_auth import get_acting_staff_user, ActingUser
from app.db.session import get_db
from app.models.models import Product, ProductVariant, ProductAttribute, ProductAttributeValue, ProductImage, Category, User
from app.api.v1.endpoints.shared_auth import get_acting_staff_user, ActingUser
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from app.core.security import decode_token
import traceback



router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


async def get_optional_user(token: Optional[str] = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> Optional[User]:
    """Returns user if logged in, else None."""
    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    result = await db.execute(select(User).where(User.id == int(payload.get("sub"))))
    return result.scalar_one_or_none()


def effective_price(variant, user):
    if user and user.is_trade_approved and variant.trade_price:
        return variant.trade_price
    return variant.retail_price

@router.get("/admin/ids")
async def list_product_ids(
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(get_acting_staff_user),
):
    result = await db.execute(select(Product.id).order_by(Product.id))
    ids = result.scalars().all()
    return {"ids": ids}


@router.get("/")
async def list_products(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[ActingUser] = Depends(get_optional_user),
    category_slug: Optional[str] = None,
    search: Optional[str] = None,
    include_inactive :bool =Query(False),
    featured: Optional[bool] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    query = (
        select(Product)
        .options(selectinload(Product.images), selectinload(Product.variants),selectinload(Product.variants))
        .order_by(Product.sort_order, Product.id)
    )
    if not include_inactive:
        query = query.where(Product.is_active == True)
    if category_slug:
        query = query.join(Category).where(Category.slug == category_slug)
    if search:
        query = query.where(Product.name.ilike(f"%{search}%"))
    if featured is not None:
        query = query.where(Product.is_featured == featured)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar()
    result = await db.execute(query.offset((page - 1) * limit).limit(limit))
    products = result.scalars().all()

    items = []
    for p in products:
        primary_image = next((img.url for img in p.images if img.is_primary), None)
        if not primary_image and p.images:
            primary_image = p.images[0].url
        active_variants = [v for v in p.variants if v.is_active or include_inactive]
        prices = [effective_price(v, current_user) for v in active_variants]
        min_price = min(prices, default=None)
        items.append({
            "id": p.id,
            "name": p.name,
            "slug": p.slug,
            "short_description": p.short_description,
            "price_type": p.price_type,
            "is_featured": p.is_featured,
            "is_active": p.is_active,
            "primary_image": primary_image,
            "min_price": min_price,
            "is_trade_price": bool(current_user and current_user.is_trade_approved),
        
    "variants": [
        {
            "id": v.id, 
            "sku": v.sku,
            "selected_attributes": v.selected_attributes,
            "cost_price": str(v.cost_price) if v.cost_price else None,
            "retail_price": str(v.retail_price),
            "stock_qty": v.stock_qty,
        } 
    for v in p.variants if v.is_active or include_inactive],
        }),
    return {"items": items, "total": total, "page": page, "limit": limit}

# Add this in products.py BEFORE the /{slug} route (line 111)
@router.get("/admin/")
async def list_products_admin(
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(get_acting_staff_user),
    search: Optional[str] = None,
    include_inactive: bool = Query(False),
    limit: int = Query(50, le=200),
    page: int = Query(1, ge=1),
):
    query = select(Product).options(
        selectinload(Product.images),
        selectinload(Product.variants)
    )
    if not include_inactive:
        query = query.where(Product.is_active == True)
    if search:
        query = query.where(Product.name.ilike(f"%{search}%"))
    
    query = query.order_by(Product.name).offset((page - 1) * limit).limit(limit)
    result = await db.execute(query)
    products = result.scalars().all()

    API_BASE = ""
    items = []
    for p in products:
        primary_image = next((f"{API_BASE}{img.url}" for img in p.images if img.is_primary), None)
        total_stock = sum(v.stock_qty or 0 for v in p.variants)
        min_price = min((v.retail_price for v in p.variants if v.retail_price), default=None)
        items.append({
            "id": p.id,
            "name": p.name,
            "slug": p.slug,
            "price_type": p.price_type,
            "is_active": p.is_active,
            "is_featured": p.is_featured,
            "primary_image": primary_image,
            "min_price": str(min_price) if min_price else None,
            "variants": [{"id": v.id, "sku": v.sku, "stock_qty": v.stock_qty, "is_active": v.is_active, "retail_price": str(v.retail_price) if v.retail_price else None, "selected_attributes": v.selected_attributes, "image_url": v.image_url} for v in p.variants],
        })
    return {"items": items, "total": len(items)}

@router.get("/{slug}")
async def get_product(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    result = await db.execute(
        select(Product)
        .options(
            selectinload(Product.attributes).selectinload(ProductAttribute.values),
            selectinload(Product.variants),
            selectinload(Product.images),
            selectinload(Product.category),
        )
        .where(Product.slug == slug, Product.is_active == True)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    is_trade = bool(current_user and current_user.is_trade_approved)

    # Build variants with correct pricing
    variants = []
    for v in product.variants:
        if not v.is_active:
            continue
        ep = effective_price(v, current_user)
        variants.append({
            "id": v.id, "sku": v.sku,
            "selected_attributes": v.selected_attributes,
            "price": ep,
            "retail_price": v.retail_price,
            "trade_price": v.trade_price,
            "compare_price": v.compare_price,
            "width_ft": v.width_ft, "height_ft": v.height_ft,
            "stock_qty": v.stock_qty,
            "is_trade_price": is_trade and v.trade_price is not None,
            "image_url": v.image_url,
        })

    return {
        "id": product.id, "name": product.name, "slug": product.slug,
        "description": product.description,
        "short_description": product.short_description,
        "hsn_code": product.hsn_code, "gst_rate": product.gst_rate,
        "price_type": product.price_type,
        "attributes": [{"id": a.id, "name": a.name, "display_name": a.display_name,
                        "values": [{"id": av.id, "value": av.value} for av in sorted(a.values, key=lambda x: x.sort_order)]}
                       for a in sorted(product.attributes, key=lambda x: x.sort_order)],
        "variants": variants,
        "images": [{"id": i.id, "url": i.url, "alt_text": i.alt_text, "is_primary": i.is_primary} for i in product.images],
        "is_trade_price": is_trade,
    }


# ── Admin: create product ─────────────────

class AttributeValueIn(BaseModel):
    value: str
    sort_order: int = 0

class AttributeIn(BaseModel):
    name: str
    display_name: str
    sort_order: int = 0
    values: List[AttributeValueIn]

class VariantIn(BaseModel):
    sku: str
    selected_attributes: dict
    price: Decimal               # retail price
    trade_price: Optional[Decimal] = None
    cost_price: Optional[Decimal] = None
    compare_price: Optional[Decimal] = None
    stock_qty: int = 0
    width_ft: Optional[Decimal] = None
    height_ft: Optional[Decimal] = None
    weight_kg: Optional[Decimal] = None
    low_stock_threshold: int = 5

class CreateProductIn(BaseModel):
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    category_id: Optional[int] = None
    hsn_code: Optional[str] = None
    gst_rate: Decimal = Decimal("18.00")
    price_type: str = "fixed"
    item_type: str = "product"  
    is_featured: bool = False
    sort_order: int = 0
    attributes: List[AttributeIn] = []
    variants: List[VariantIn] = []


@router.post("/", status_code=201)
async def create_product(
    payload: CreateProductIn,
    db: AsyncSession = Depends(get_db),
     current_user: ActingUser = Depends(get_acting_staff_user),
):

    from slugify import slugify
    slug = payload.slug or slugify(payload.name)
    try:
    # Ensure unique slug
        existing = await db.execute(select(Product).where(Product.slug == slug))
        if existing.scalar_one_or_none():
            slug = f"{slug}-{str(hash(payload.name))[-4:]}"

        product = Product(
            name=payload.name, slug=slug,
            description=payload.description,
            short_description=payload.short_description,
            category_id=payload.category_id,
            hsn_code=payload.hsn_code,
            gst_rate=payload.gst_rate,
            price_type=payload.price_type,
            item_type=payload.item_type,  
            is_featured=payload.is_featured,
            sort_order=payload.sort_order,
            is_active=True,
        )
        db.add(product)
        await db.flush()

        # Attributes
        for attr in payload.attributes:
            a = ProductAttribute(product_id=product.id, name=attr.name,
                                display_name=attr.display_name, sort_order=attr.sort_order)
            db.add(a)
            await db.flush()
            for i, val in enumerate(attr.values):
                db.add(ProductAttributeValue(attribute_id=a.id, value=val.value, sort_order=val.sort_order or i))

        # Variants
        seen_skus = set()
        for var in payload.variants:
            if var.sku in seen_skus:
                raise HTTPException(400, f"Duplicate SKU in request: {var.sku}")
            seen_skus.add(var.sku)

            existing_sku = await db.execute(select(ProductVariant).where(ProductVariant.sku == var.sku))
            if existing_sku.scalar_one_or_none():
                raise HTTPException(400, f"SKU already exists: {var.sku}")

            db.add(ProductVariant(
                product_id=product.id,
                sku=var.sku,
                selected_attributes=var.selected_attributes,
                retail_price=var.price,
                trade_price=var.trade_price,
                cost_price=var.cost_price,
                compare_price=var.compare_price,
                width_ft=var.width_ft,
                height_ft=var.height_ft,
                weight_kg=var.weight_kg,
                low_stock_threshold=var.low_stock_threshold,
                track_inventory=(payload.item_type == "product"),
                stock_qty=var.stock_qty if payload.item_type == "product" else 0,
                is_active=True,
            ))

        await db.commit()
        await db.refresh(product)
        return {"id": product.id, "slug": product.slug, "message": "Product created"}
    except Exception as e:
        await db.rollback()
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

@router.patch("/{product_id}")
async def update_product(
    product_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
     current_user: ActingUser = Depends(get_acting_staff_user),
):
    result = await db.execute(
        select(Product).options(selectinload(Product.variants))
        .where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(404, "Product not found")

    allowed_fields = {"name", "slug", "description", "short_description",
                      "category_id", "hsn_code", "gst_rate", "price_type",
                      "item_type", "is_active", "is_featured", "sort_order"}   # ← add item_type here too
    for k, v in payload.items():
        if k in allowed_fields:
            setattr(product, k, v)

    if "variants" in payload:
        for var_data in payload["variants"]:
            variant_id = var_data.get("id")
            existing = next((v for v in product.variants if v.id == variant_id), None) if variant_id \
                       else next((v for v in product.variants if v.sku == var_data.get("sku")), None)

            if existing:
                existing.retail_price = var_data.get("price", existing.retail_price)
                existing.trade_price = var_data.get("trade_price") or existing.trade_price
                existing.cost_price = var_data.get("cost_price") or existing.cost_price
                existing.compare_price = var_data.get("compare_price") or existing.compare_price
                existing.stock_qty = var_data.get("stock_qty", existing.stock_qty)
            else:
                new_sku = var_data.get("sku")
                if not new_sku:
                    continue
                sku_check = await db.execute(select(ProductVariant).where(ProductVariant.sku == new_sku))
                if sku_check.scalar_one_or_none():
                    continue
                db.add(ProductVariant(
                    product_id=product.id,
                    sku=new_sku,
                    selected_attributes=var_data.get("selected_attributes", {}),
                    retail_price=var_data.get("price"),
                    trade_price=var_data.get("trade_price"),
                    cost_price=var_data.get("cost_price"),
                    compare_price=var_data.get("compare_price"),
                    stock_qty=var_data.get("stock_qty", 0) if product.item_type == "product" else 0,
                    track_inventory=(product.item_type == "product"),   # ← now respects parent
                    is_active=True,
                ))

    await db.commit()
    return {"message": "Product updated", "id": product.id}


@router.delete("/{product_id}", status_code=204)
async def delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(get_acting_staff_user),
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    await db.delete(product)


@router.get("/admin/{product_id}")
async def get_product_admin(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(get_acting_staff_user),
):
    result = await db.execute(
        select(Product)
        .options(
            selectinload(Product.variants),selectinload(Product.images),
            selectinload(Product.attributes).selectinload(ProductAttribute.values),selectinload(Product.category),
        )
        .where(Product.id == product_id)
    )

    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(404, "Product not found")

    return {
    "id": product.id,
    "name": product.name,
    "description": product.description,
    "short_description": product.short_description,
    "is_active": product.is_active,
    "is_featured": product.is_featured,
    "price_type": product.price_type,
    "category_id": product.category_id,
    "category": {"id": product.category.id, "name": product.category.name} if product.category else None,
    "hsn_code": product.hsn_code,
    "gst_rate": float(product.gst_rate),

     "images": [
        {
            "id": img.id,
            "url": img.url,
            "alt_text": img.alt_text,
            "is_primary": img.is_primary,
        }
        for img in product.images
    ],

    "attributes": [
        {
            "name": a.name,
            "display_name": a.display_name,
            "values": [
                {"value": v.value}
                for v in a.values
            ]
        }
        for a in product.attributes
    ],

    "variants": [
        {
            "id": v.id,
            "sku": v.sku,
            "selected_attributes": v.selected_attributes,
            "retail_price": float(v.retail_price or 0),
            "trade_price": float(v.trade_price or 0),
            "cost_price": float(v.cost_price or 0),
            "compare_price": float(v.compare_price or 0),
            "stock_qty": v.stock_qty,
            "weight_kg": float(v.weight_kg) if v.weight_kg else None,
            "image_url": v.image_url,
        }
        for v in product.variants
    ]
}

@router.get("/variants/search")
async def search_variants(q: str, limit: int = 8, db=Depends(get_db)):
    result = await db.execute(
        select(ProductVariant)
        .options(selectinload(ProductVariant.product))
        .join(Product)
        .where(
            ProductVariant.is_active == True,
            (Product.name.ilike(f"%{q}%")) | (ProductVariant.sku.ilike(f"%{q}%"))
        )
        .limit(limit)
    )
    variants = result.scalars().all()
    return [{"id": v.id, "sku": v.sku, "retail_price": float(v.retail_price),
             "stock_qty": v.stock_qty, "selected_attributes": v.selected_attributes,
             "product": {"name": v.product.name, "gst_rate": float(v.product.gst_rate),
                         "hsn_code": v.product.hsn_code}} for v in variants] 


 
@router.get("/{product_id}/avg-cost")
async def get_product_avg_cost(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(get_acting_staff_user),
):
    """
    Calculate weighted average cost per variant from received purchases.
 
    Formula:
        avg_cost = SUM(unit_price × received_qty) / SUM(received_qty)
        for PurchaseItems where:
          - variant belongs to this product
          - received_qty > 0
          - purchase status = 'received'
    """
    from app.models.accounting import Purchase, PurchaseItem, PurchaseStatus
    from app.models.models import ProductVariant
 
    # get all variants for this product
    var_result = await db.execute(
        select(ProductVariant).where(ProductVariant.product_id == product_id)
    )
    variants = var_result.scalars().all()
    variant_ids = [v.id for v in variants]
 
    if not variant_ids:
        return []
 
    # get all received purchase items for these variants
    items_result = await db.execute(
        select(PurchaseItem)
        .join(Purchase, PurchaseItem.purchase_id == Purchase.id)
        .where(
            PurchaseItem.variant_id.in_(variant_ids),
            PurchaseItem.received_qty > 0,
            Purchase.status == PurchaseStatus.received,
        )
    )
    purchase_items = items_result.scalars().all()
 
    # group by variant_id and compute weighted avg
    from collections import defaultdict
    from decimal import Decimal
 
    totals: dict = defaultdict(lambda: {"cost_sum": Decimal("0"), "qty_sum": Decimal("0"), "purchase_count": 0})
 
    for item in purchase_items:
        vid = item.variant_id
        totals[vid]["cost_sum"]      += item.unit_price * item.received_qty
        totals[vid]["qty_sum"]       += item.received_qty
        totals[vid]["purchase_count"] += 1
 
    # build response per variant
    variant_map = {v.id: v for v in variants}
    result = []
 
    for v in variants:
        vid = v.id
        data = totals.get(vid)
        if data and data["qty_sum"] > 0:
            avg = (data["cost_sum"] / data["qty_sum"]).quantize(Decimal("0.01"))
        else:
            avg = None
 
        result.append({
            "variant_id":      vid,
            "sku":             v.sku,
            "stock_qty":       v.stock_qty,
            "cost_price":      float(v.cost_price) if v.cost_price else None,  # static field
            "avg_cost":        float(avg) if avg is not None else None,         # calculated
            "total_received":  float(data["qty_sum"]) if data else 0,
            "purchase_count":  data["purchase_count"] if data else 0,
            "selected_attributes": v.selected_attributes,
        })
 
    return result


class StaffVariantOut(BaseModel):
    variant_id: int
    product_name: str
    sku: str
    selected_attributes: dict
    retail_price: Decimal
    stock_qty: int
    primary_image: Optional[str] = None
 
 
@router.get("/staff-picker", response_model=List[StaffVariantOut])
async def staff_product_picker(
    q: str = Query("", description="Search by product name or SKU"),
    limit: int = Query(20, le=50),
    db: AsyncSession = Depends(get_db),
    _: ActingUser = Depends(get_acting_staff_user),
):
    """
    Product/variant search for staff building a manual invoice.
    Deliberately excludes cost_price and trade_price — only what's
    needed to pick an item and see its retail price and stock.
    """
    query = (
        select(ProductVariant)
        .join(Product)
        .options(selectinload(ProductVariant.product).selectinload(Product.images))
        .where(ProductVariant.is_active == True, Product.is_active == True)
    )
    if q:
        like = f"%{q}%"
        query = query.where((Product.name.ilike(like)) | (ProductVariant.sku.ilike(like)))
 
    result = await db.execute(query.limit(limit))
    variants = result.scalars().all()
 
    out = []
    for v in variants:
        primary = next((img.url for img in v.product.images if img.is_primary), None)
        if not primary and v.product.images:
            primary = v.product.images[0].url
        out.append(StaffVariantOut(
            variant_id=v.id,
            product_name=v.product.name,
            sku=v.sku,
            selected_attributes=v.selected_attributes or {},
            retail_price=v.retail_price,
            stock_qty=v.stock_qty,
            primary_image=primary,
        ))
    return out


UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

@router.post("/variants/{variant_id}/image")
async def upload_variant_image(
    variant_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(get_acting_staff_user),
):
    result = await db.execute(select(ProductVariant).where(ProductVariant.id == variant_id))
    variant = result.scalar_one_or_none()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")

    os.makedirs(os.path.join(UPLOAD_DIR, "variants"), exist_ok=True)
    ext = os.path.splitext(file.filename)[1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, "variants", filename)
    with open(filepath, "wb") as f:
        f.write(await file.read())

    variant.image_url = f"/uploads/variants/{filename}"
    await db.commit()
    return {"image_url": variant.image_url}
