from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal

from app.db.session import get_db
from app.models.models import Product, ProductVariant, ProductAttribute, ProductAttributeValue, ProductImage, Category, User
from app.api.v1.endpoints.auth import get_current_user, get_admin_user
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


@router.get("/")
async def list_products(
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
    category_slug: Optional[str] = None,
    search: Optional[str] = None,
    featured: Optional[bool] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    query = (
        select(Product)
        .options(selectinload(Product.images), selectinload(Product.variants))
        .where(Product.is_active == True)
        .order_by(Product.sort_order, Product.id)
    )
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
        active_variants = [v for v in p.variants if v.is_active]
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
        })
    return {"items": items, "total": total, "page": page, "limit": limit}


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
    is_featured: bool = False
    sort_order: int = 0
    attributes: List[AttributeIn] = []
    variants: List[VariantIn] = []


@router.post("/", status_code=201)
async def create_product(
    payload: CreateProductIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
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
        for var in payload.variants:
           db.add(ProductVariant(
                product_id=product.id,
                sku=var.sku,
                selected_attributes=var.selected_attributes,
                retail_price=var.price,
                trade_price=var.trade_price,
                cost_price=var.cost_price,
                compare_price=var.compare_price,
                stock_qty=var.stock_qty,
                width_ft=var.width_ft,
                height_ft=var.height_ft,
                weight_kg=var.weight_kg,
                low_stock_threshold=var.low_stock_threshold,
                track_inventory=True,
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
    current_user: User = Depends(get_admin_user),
):
    result = await db.execute(
        select(Product).options(selectinload(Product.variants))
        .where(Product.id == product_id)
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(404, "Product not found")

    # Update basic fields
    allowed_fields = {"name", "slug", "description", "short_description",
                      "category_id", "hsn_code", "gst_rate", "price_type",
                      "is_active", "is_featured", "sort_order"}
    for k, v in payload.items():
        if k in allowed_fields:
            setattr(product, k, v)

    # Update variants pricing if provided
    if "variants" in payload:
        for var_data in payload["variants"]:
            # Match by SKU
            existing = next((v for v in product.variants if v.sku == var_data.get("sku")), None)
            if existing:
                existing.retail_price = var_data.get("price", existing.retail_price)
                existing.trade_price = var_data.get("trade_price") or existing.trade_price
                existing.cost_price = var_data.get("cost_price") or existing.cost_price
                existing.compare_price = var_data.get("compare_price") or existing.compare_price
                existing.stock_qty = var_data.get("stock_qty", existing.stock_qty)
            else:
                # New variant — add it
                db.add(ProductVariant(
                    product_id=product.id,
                    sku=var_data.get("sku"),
                    selected_attributes=var_data.get("selected_attributes", {}),
                    retail_price=var_data.get("price"),
                    trade_price=var_data.get("trade_price"),
                    cost_price=var_data.get("cost_price"),
                    compare_price=var_data.get("compare_price"),
                    stock_qty=var_data.get("stock_qty", 0),
                    track_inventory=True, is_active=True,
                ))

    await db.commit()
    return {"message": "Product updated", "id": product.id}

@router.delete("/{product_id}", status_code=204)
async def delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
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
    current_user: User = Depends(get_admin_user),
):
    result = await db.execute(
        select(Product)
        .options(
            selectinload(Product.variants),
            selectinload(Product.attributes).selectinload(ProductAttribute.values)
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
    "hsn_code": product.hsn_code,
    "gst_rate": float(product.gst_rate),

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
        }
        for v in product.variants
    ]
}
