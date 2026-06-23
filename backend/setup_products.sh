#!/bin/bash
# ============================================================
# GlassStore — Trade Pricing + Add Product Page
# Run from ecommerce_calude/
#   bash setup_products.sh
# ============================================================

set -e
echo "=========================================="
echo "  Trade Pricing + Product Form Setup"
echo "=========================================="

# ════════════════════════════════════════════
# 1. BACKEND — patch models/models.py
#    Add is_trade_approved to User
#    Add retail_price + trade_price to ProductVariant
# ════════════════════════════════════════════

cd backend

# Patch User model — add is_trade_approved field
python << 'PYEOF'
path = "app/models/models.py"
with open(path, "r") as f:
    content = f.read()

# Add is_trade_approved after is_verified
old = "    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)"
new = """    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_trade_approved: Mapped[bool] = mapped_column(Boolean, default=False)"""

if "is_trade_approved" not in content:
    content = content.replace(old, new)
    with open(path, "w") as f:
        f.write(content)
    print("✓ Added is_trade_approved to User model")
else:
    print("✓ is_trade_approved already exists")
PYEOF

# Patch ProductVariant — add retail_price + trade_price
python << 'PYEOF'
path = "app/models/models.py"
with open(path, "r") as f:
    content = f.read()

old = "    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))   # base price or per-sqft rate\n    compare_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))  # MRP/strikethrough\n    cost_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))     # internal cost"

new = """    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))            # retail price (default/public)
    trade_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))    # approved buyer price
    compare_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))  # MRP/strikethrough
    cost_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))     # internal cost"""

if "trade_price" not in content:
    content = content.replace(old, new)
    with open(path, "w") as f:
        f.write(content)
    print("✓ Added trade_price to ProductVariant model")
else:
    print("✓ trade_price already exists")
PYEOF

echo "✓ Models patched"

# ════════════════════════════════════════════
# 2. BACKEND — admin users endpoint
#    List users, approve/revoke trade status
# ════════════════════════════════════════════

cat > app/api/v1/endpoints/users.py << 'PYEOF'
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.db.session import get_db
from app.models.models import User
from app.api.v1.endpoints.auth import get_current_user, get_admin_user

router = APIRouter()


@router.get("/")
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
    search: Optional[str] = None,
    trade_only: bool = False,
    page: int = Query(1, ge=1),
    limit: int = Query(50, le=100),
):
    query = select(User).order_by(User.created_at.desc())
    if search:
        query = query.where(
            (User.name.ilike(f"%{search}%")) |
            (User.email.ilike(f"%{search}%")) |
            (User.phone.ilike(f"%{search}%"))
        )
    if trade_only:
        query = query.where(User.is_trade_approved == True)
    result = await db.execute(query.offset((page - 1) * limit).limit(limit))
    users = result.scalars().all()
    return [{"id": u.id, "name": u.name, "email": u.email, "phone": u.phone,
             "role": u.role, "is_active": u.is_active,
             "is_trade_approved": u.is_trade_approved,
             "created_at": u.created_at} for u in users]


@router.patch("/{user_id}/trade-approve")
async def approve_trade(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_trade_approved = True
    return {"message": f"{user.name} approved as trade customer"}


@router.patch("/{user_id}/trade-revoke")
async def revoke_trade(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_trade_approved = False
    return {"message": f"{user.name} trade access revoked"}


@router.patch("/{user_id}/toggle-active")
async def toggle_active(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = not user.is_active
    return {"message": f"User {'activated' if user.is_active else 'deactivated'}"}


@router.get("/me/profile")
async def my_profile(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "phone": current_user.phone,
        "role": current_user.role,
        "is_trade_approved": current_user.is_trade_approved,
        "is_active": current_user.is_active,
    }
PYEOF

echo "✓ Users endpoint updated"

# ════════════════════════════════════════════
# 3. BACKEND — patch products endpoint
#    Return correct price based on trade status
# ════════════════════════════════════════════

cat > app/api/v1/endpoints/products.py << 'PYEOF'
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


def effective_price(variant: ProductVariant, user: Optional[User]) -> Decimal:
    """Return trade_price if user is approved, else retail price."""
    if user and user.is_trade_approved and variant.trade_price:
        return variant.trade_price
    return variant.price


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
            "id": p.id, "name": p.name, "slug": p.slug,
            "short_description": p.short_description,
            "price_type": p.price_type, "is_featured": p.is_featured,
            "primary_image": primary_image, "min_price": min_price,
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
            "retail_price": v.price,
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
    from python_slugify import slugify
    slug = payload.slug or slugify(payload.name)

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
            product_id=product.id, sku=var.sku,
            selected_attributes=var.selected_attributes,
            price=var.price,
            trade_price=var.trade_price,
            cost_price=var.cost_price,
            compare_price=var.compare_price,
            stock_qty=var.stock_qty,
            width_ft=var.width_ft, height_ft=var.height_ft,
            weight_kg=var.weight_kg,
            low_stock_threshold=var.low_stock_threshold,
            track_inventory=True, is_active=True,
        ))

    await db.flush()
    return {"id": product.id, "slug": product.slug, "message": "Product created"}


@router.patch("/{product_id}")
async def update_product(
    product_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for k, v in payload.items():
        if hasattr(product, k):
            setattr(product, k, v)
    return {"message": "Product updated"}


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
PYEOF

echo "✓ Products endpoint updated"

# ════════════════════════════════════════════
# 4. BACKEND — categories endpoint
# ════════════════════════════════════════════

cat > app/api/v1/endpoints/categories.py << 'PYEOF'
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from python_slugify import slugify
from app.db.session import get_db
from app.models.models import Category
from app.api.v1.endpoints.auth import get_admin_user
from app.models.models import User

router = APIRouter()


class CategoryIn(BaseModel):
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[int] = None
    sort_order: int = 0


@router.get("/")
async def list_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Category).where(Category.is_active == True).order_by(Category.sort_order))
    cats = result.scalars().all()
    return [{"id": c.id, "name": c.name, "slug": c.slug, "parent_id": c.parent_id} for c in cats]


@router.post("/", status_code=201)
async def create_category(
    payload: CategoryIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    sl = payload.slug or slugify(payload.name)
    cat = Category(name=payload.name, slug=sl, description=payload.description,
                   parent_id=payload.parent_id, sort_order=payload.sort_order, is_active=True)
    db.add(cat)
    await db.flush()
    return {"id": cat.id, "name": cat.name, "slug": cat.slug}


@router.delete("/{category_id}", status_code=204)
async def delete_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    result = await db.execute(select(Category).where(Category.id == category_id))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    cat.is_active = False
PYEOF

echo "✓ Categories endpoint updated"

# ════════════════════════════════════════════
# 5. ALEMBIC — new migration for trade fields
# ════════════════════════════════════════════

alembic revision --autogenerate -m "add_trade_pricing"
alembic upgrade head
echo "✓ Database migrated"

cd ..

# ════════════════════════════════════════════
# 6. FRONTEND — Add Product Page
# ════════════════════════════════════════════

cd frontend

mkdir -p "app/(admin)/admin/products/new"
mkdir -p "app/(admin)/admin/customers"

# ── Customers page with trade approval ───

cat > "app/(admin)/admin/customers/page.tsx" << 'EOF'
"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import PageHeader from "@/components/admin/PageHeader";
import DataTable from "@/components/admin/DataTable";

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/users/?${filter === "trade" ? "trade_only=true" : ""}`);
      setCustomers(Array.isArray(res.data) ? res.data : []);
    } catch { setCustomers([]); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);

  const approveTrade = async (id: number, approve: boolean) => {
    setUpdating(id);
    try {
      await api.patch(`/users/${id}/${approve ? "trade-approve" : "trade-revoke"}`);
      load();
    } catch { alert("Failed to update"); } finally { setUpdating(null); }
  };

  const columns = [
    { key: "id", label: "ID", width: 60 },
    { key: "name", label: "Name", render: (r: any) => <span style={{ fontWeight: 500 }}>{r.name}</span> },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "is_trade_approved", label: "Trade Status", render: (r: any) => (
      <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500,
        background: r.is_trade_approved ? "#d1fae5" : "#f1f5f9",
        color: r.is_trade_approved ? "#065f46" : "#475569" }}>
        {r.is_trade_approved ? "✓ Trade Approved" : "Regular"}
      </span>
    )},
    { key: "created_at", label: "Joined", render: (r: any) => new Date(r.created_at).toLocaleDateString("en-IN") },
    { key: "actions", label: "Action", render: (r: any) => (
      <button
        disabled={updating === r.id}
        onClick={() => approveTrade(r.id, !r.is_trade_approved)}
        style={{
          fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer",
          background: r.is_trade_approved ? "#fee2e2" : "#dbeafe",
          color: r.is_trade_approved ? "#991b1b" : "#1d4ed8",
          fontWeight: 500,
        }}>
        {updating === r.id ? "..." : r.is_trade_approved ? "Revoke Trade" : "Approve Trade"}
      </button>
    )},
  ];

  return (
    <div style={{ padding: 32 }}>
      <PageHeader title="Customers" subtitle="Manage customers and trade approvals" />

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[{ key: "all", label: "All Customers" }, { key: "trade", label: "Trade Approved" }].map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: "6px 16px", borderRadius: 20, fontSize: 13, cursor: "pointer",
            border: "1px solid", fontWeight: filter === f.key ? 500 : 400,
            borderColor: filter === f.key ? "#0284c7" : "#e2e8f0",
            background: filter === f.key ? "#eff6ff" : "white",
            color: filter === f.key ? "#0284c7" : "#475569",
          }}>{f.label}</button>
        ))}
      </div>

      <div className="card">
        <DataTable columns={columns} data={customers} loading={loading} emptyText="No customers yet" />
      </div>
    </div>
  );
}
EOF

echo "✓ Customers page with trade approval created"

# ── Add Product Page ─────────────────────

cat > "app/(admin)/admin/products/new/page.tsx" << 'EOF'
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import PageHeader from "@/components/admin/PageHeader";

interface AttrValue { value: string; }
interface Attr { name: string; display_name: string; values: AttrValue[]; }
interface Variant {
  sku: string;
  selected_attributes: Record<string, string>;
  price: string;        // retail
  trade_price: string;
  cost_price: string;
  compare_price: string;
  stock_qty: string;
  weight_kg: string;
}

export default function AddProductPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [addingCat, setAddingCat] = useState(false);

  // Basic info
  const [info, setInfo] = useState({
    name: "", short_description: "", description: "",
    category_id: "", hsn_code: "", gst_rate: "18",
    price_type: "fixed", is_featured: false,
  });

  // Attributes
  const [attrs, setAttrs] = useState<Attr[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [attrCombosGenerated, setAttrCombosGenerated] = useState(false);

  useEffect(() => {
    api.get("/categories/").then(r => setCategories(r.data || [])).catch(() => {});
  }, []);

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    setAddingCat(true);
    try {
      const res = await api.post("/categories/", { name: newCatName });
      setCategories([...categories, res.data]);
      setInfo({ ...info, category_id: String(res.data.id) });
      setNewCatName("");
    } catch { alert("Failed to add category"); } finally { setAddingCat(false); }
  };

  // Attribute helpers
  const addAttr = () => setAttrs([...attrs, { name: "", display_name: "", values: [{ value: "" }] }]);
  const removeAttr = (i: number) => { const a = [...attrs]; a.splice(i, 1); setAttrs(a); setAttrCombosGenerated(false); setVariants([]); };
  const updateAttr = (i: number, key: keyof Attr, val: string) => {
    const a = [...attrs]; (a[i] as any)[key] = val;
    if (key === "name") a[i].display_name = a[i].display_name || val;
    setAttrs(a); setAttrCombosGenerated(false); setVariants([]);
  };
  const addAttrValue = (i: number) => { const a = [...attrs]; a[i].values.push({ value: "" }); setAttrs(a); };
  const removeAttrValue = (ai: number, vi: number) => { const a = [...attrs]; a[ai].values.splice(vi, 1); setAttrs(a); };
  const updateAttrValue = (ai: number, vi: number, val: string) => { const a = [...attrs]; a[ai].values[vi].value = val; setAttrs(a); setAttrCombosGenerated(false); };

  // Generate all combinations
  const generateVariants = () => {
    const validAttrs = attrs.filter(a => a.name && a.values.some(v => v.value.trim()));
    if (validAttrs.length === 0) { alert("Add at least one attribute with values"); return; }

    const combos = validAttrs.reduce<Record<string, string>[]>((acc, attr) => {
      const vals = attr.values.filter(v => v.value.trim());
      if (acc.length === 0) return vals.map(v => ({ [attr.name]: v.value }));
      return acc.flatMap(combo => vals.map(v => ({ ...combo, [attr.name]: v.value })));
    }, []);

    const productName = info.name || "PROD";
    setVariants(combos.map((combo, i) => ({
      sku: `${productName.toUpperCase().replace(/\s+/g, "-").slice(0, 6)}-${Object.values(combo).join("-").toUpperCase().replace(/\s+/g, "")}-${String(i + 1).padStart(3, "0")}`,
      selected_attributes: combo,
      price: "", trade_price: "", cost_price: "", compare_price: "", stock_qty: "0", weight_kg: "",
    })));
    setAttrCombosGenerated(true);
  };

  const updateVariant = (i: number, key: keyof Variant, val: string) => {
    const v = [...variants]; (v[i] as any)[key] = val; setVariants(v);
  };

  // Bulk fill prices
  const [bulk, setBulk] = useState({ price: "", trade_price: "", cost_price: "", stock_qty: "" });
  const applyBulk = () => {
    setVariants(variants.map(v => ({
      ...v,
      ...(bulk.price ? { price: bulk.price } : {}),
      ...(bulk.trade_price ? { trade_price: bulk.trade_price } : {}),
      ...(bulk.cost_price ? { cost_price: bulk.cost_price } : {}),
      ...(bulk.stock_qty ? { stock_qty: bulk.stock_qty } : {}),
    })));
  };

  const save = async () => {
    if (!info.name.trim()) { alert("Product name is required"); return; }
    if (variants.length === 0) { alert("Add at least one variant"); return; }
    if (variants.some(v => !v.price)) { alert("All variants need a retail price"); return; }

    setSaving(true);
    try {
      await api.post("/products/", {
        name: info.name,
        short_description: info.short_description,
        description: info.description,
        category_id: info.category_id ? parseInt(info.category_id) : null,
        hsn_code: info.hsn_code,
        gst_rate: parseFloat(info.gst_rate),
        price_type: info.price_type,
        is_featured: info.is_featured,
        attributes: attrs.filter(a => a.name).map(a => ({
          name: a.name, display_name: a.display_name || a.name,
          values: a.values.filter(v => v.value.trim()).map((v, i) => ({ value: v.value, sort_order: i })),
        })),
        variants: variants.map(v => ({
          sku: v.sku,
          selected_attributes: v.selected_attributes,
          price: parseFloat(v.price),
          trade_price: v.trade_price ? parseFloat(v.trade_price) : null,
          cost_price: v.cost_price ? parseFloat(v.cost_price) : null,
          compare_price: v.compare_price ? parseFloat(v.compare_price) : null,
          stock_qty: parseInt(v.stock_qty) || 0,
          weight_kg: v.weight_kg ? parseFloat(v.weight_kg) : null,
        })),
      });
      router.push("/admin/products");
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to save product");
    } finally { setSaving(false); }
  };

  const inputStyle = { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", outline: "none" };
  const labelStyle = { display: "block", fontSize: 13, fontWeight: 500, color: "#475569", marginBottom: 5 } as const;

  return (
    <div style={{ padding: 32, maxWidth: 1000 }}>
      <PageHeader title="Add Product"
        subtitle="Fill in product details, attributes and variants"
        action={
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-outline" onClick={() => router.back()}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Product"}</button>
          </div>
        }
      />

      {/* ── Basic Info ── */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px", color: "#1e293b" }}>Basic Information</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={labelStyle}>Product Name *</label>
            <input style={inputStyle} placeholder="Eg: Clear Float Glass" value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={labelStyle}>Short Description</label>
            <input style={inputStyle} placeholder="Brief one-line description" value={info.short_description} onChange={(e) => setInfo({ ...info, short_description: e.target.value })} />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={labelStyle}>Full Description</label>
            <textarea style={{ ...inputStyle, height: 90, resize: "vertical" }} placeholder="Detailed product description" value={info.description} onChange={(e) => setInfo({ ...info, description: e.target.value })} />
          </div>

          {/* Category */}
          <div>
            <label style={labelStyle}>Category</label>
            <div style={{ display: "flex", gap: 8 }}>
              <select style={{ ...inputStyle, flex: 1 }} value={info.category_id} onChange={(e) => setInfo({ ...info, category_id: e.target.value })}>
                <option value="">Select category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <input style={{ ...inputStyle, flex: 1, padding: "7px 10px", fontSize: 13 }} placeholder="Or add new category" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
              <button onClick={addCategory} disabled={addingCat} style={{ padding: "7px 12px", borderRadius: 6, background: "#0284c7", color: "white", border: "none", cursor: "pointer", fontSize: 13 }}>{addingCat ? "..." : "+ Add"}</button>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Price Type *</label>
            <select style={inputStyle} value={info.price_type} onChange={(e) => setInfo({ ...info, price_type: e.target.value })}>
              <option value="fixed">Fixed Price (per unit)</option>
              <option value="per_sqft">Per Sq.ft (custom dimensions)</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>HSN Code</label>
            <input style={inputStyle} placeholder="Eg: 70051090" value={info.hsn_code} onChange={(e) => setInfo({ ...info, hsn_code: e.target.value })} />
          </div>

          <div>
            <label style={labelStyle}>GST Rate (%)</label>
            <select style={inputStyle} value={info.gst_rate} onChange={(e) => setInfo({ ...info, gst_rate: e.target.value })}>
              <option value="0">0% (Exempt)</option>
              <option value="5">5%</option>
              <option value="12">12%</option>
              <option value="18">18%</option>
              <option value="28">28%</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input type="checkbox" id="featured" checked={info.is_featured} onChange={(e) => setInfo({ ...info, is_featured: e.target.checked })} style={{ width: 16, height: 16 }} />
            <label htmlFor="featured" style={{ fontSize: 14, color: "#475569", cursor: "pointer" }}>Mark as Featured Product</label>
          </div>
        </div>
      </div>

      {/* ── Attributes ── */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Attributes</h2>
            <p style={{ fontSize: 13, color: "#64748b", margin: "3px 0 0" }}>Define variant options like Thickness, Finish, Color</p>
          </div>
          <button onClick={addAttr} style={{ padding: "7px 14px", borderRadius: 7, background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#475569", cursor: "pointer", fontSize: 13 }}>
            + Add Attribute
          </button>
        </div>

        {attrs.length === 0 && (
          <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8", fontSize: 14, border: "1px dashed #e2e8f0", borderRadius: 8 }}>
            No attributes yet. Click "Add Attribute" to define options like Thickness, Finish, Size.
          </div>
        )}

        {attrs.map((attr, ai) => (
          <div key={ai} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Attribute Name</label>
                <input style={inputStyle} placeholder="Eg: Thickness" value={attr.name} onChange={(e) => updateAttr(ai, "name", e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Display Name</label>
                <input style={inputStyle} placeholder="Eg: Glass Thickness" value={attr.display_name} onChange={(e) => updateAttr(ai, "display_name", e.target.value)} />
              </div>
              <button onClick={() => removeAttr(ai)} style={{ marginTop: 20, padding: "8px 12px", borderRadius: 6, background: "#fee2e2", border: "none", color: "#dc2626", cursor: "pointer" }}>✕</button>
            </div>
            <div>
              <label style={labelStyle}>Values</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {attr.values.map((val, vi) => (
                  <div key={vi} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input style={{ ...inputStyle, width: 100 }} placeholder="Eg: 4mm" value={val.value} onChange={(e) => updateAttrValue(ai, vi, e.target.value)} />
                    {attr.values.length > 1 && (
                      <button onClick={() => removeAttrValue(ai, vi)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 16 }}>✕</button>
                    )}
                  </div>
                ))}
                <button onClick={() => addAttrValue(ai)} style={{ padding: "8px 12px", borderRadius: 6, background: "#f8fafc", border: "1px dashed #cbd5e1", color: "#64748b", cursor: "pointer", fontSize: 13 }}>+ Value</button>
              </div>
            </div>
          </div>
        ))}

        {attrs.length > 0 && (
          <button onClick={generateVariants} style={{
            padding: "9px 20px", borderRadius: 8, background: "#0284c7", color: "white",
            border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500, marginTop: 8,
          }}>
            ⚡ Generate Variants from Attributes
          </button>
        )}
      </div>

      {/* ── Variants ── */}
      {variants.length > 0 && (
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Variants & Pricing</h2>
              <p style={{ fontSize: 13, color: "#64748b", margin: "3px 0 0" }}>{variants.length} variants generated</p>
            </div>
          </div>

          {/* Bulk fill */}
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: "#475569", margin: "0 0 10px" }}>Bulk Fill Prices</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              {[
                { key: "price", placeholder: "Retail Price ₹" },
                { key: "trade_price", placeholder: "Trade Price ₹" },
                { key: "cost_price", placeholder: "Cost Price ₹" },
                { key: "stock_qty", placeholder: "Stock Qty" },
              ].map((f) => (
                <div key={f.key}>
                  <input style={{ ...inputStyle, width: 140 }} placeholder={f.placeholder} value={(bulk as any)[f.key]}
                    onChange={(e) => setBulk({ ...bulk, [f.key]: e.target.value })} />
                </div>
              ))}
              <button onClick={applyBulk} style={{ padding: "9px 16px", borderRadius: 7, background: "#475569", color: "white", border: "none", cursor: "pointer", fontSize: 13 }}>
                Apply to All
              </button>
            </div>
          </div>

          {/* Variant rows */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ textAlign: "left", padding: "8px 10px", color: "#64748b", fontWeight: 600, fontSize: 12 }}>Variant</th>
                  <th style={{ textAlign: "left", padding: "8px 10px", color: "#64748b", fontWeight: 600, fontSize: 12 }}>SKU</th>
                  <th style={{ textAlign: "left", padding: "8px 10px", color: "#64748b", fontWeight: 600, fontSize: 12 }}>Cost ₹</th>
                  <th style={{ textAlign: "left", padding: "8px 10px", color: "#64748b", fontWeight: 600, fontSize: 12, background: "#fef9c3" }}>Retail ₹ *</th>
                  <th style={{ textAlign: "left", padding: "8px 10px", color: "#64748b", fontWeight: 600, fontSize: 12, background: "#d1fae5" }}>Trade ₹</th>
                  <th style={{ textAlign: "left", padding: "8px 10px", color: "#64748b", fontWeight: 600, fontSize: 12 }}>MRP ₹</th>
                  <th style={{ textAlign: "left", padding: "8px 10px", color: "#64748b", fontWeight: 600, fontSize: 12 }}>Stock</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 10px" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {Object.entries(v.selected_attributes).map(([k, val]) => (
                          <span key={k} style={{ fontSize: 11, background: "#eff6ff", color: "#0369a1", padding: "2px 7px", borderRadius: 4 }}>{val}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: "8px 6px" }}>
                      <input style={{ ...inputStyle, width: 150, padding: "6px 8px", fontSize: 12 }} value={v.sku} onChange={(e) => updateVariant(i, "sku", e.target.value)} />
                    </td>
                    <td style={{ padding: "8px 6px" }}>
                      <input type="number" style={{ ...inputStyle, width: 90, padding: "6px 8px" }} placeholder="0.00" value={v.cost_price} onChange={(e) => updateVariant(i, "cost_price", e.target.value)} />
                    </td>
                    <td style={{ padding: "8px 6px", background: "#fefce8" }}>
                      <input type="number" style={{ ...inputStyle, width: 90, padding: "6px 8px", borderColor: v.price ? "#e2e8f0" : "#fca5a5" }} placeholder="0.00 *" value={v.price} onChange={(e) => updateVariant(i, "price", e.target.value)} />
                    </td>
                    <td style={{ padding: "8px 6px", background: "#f0fdf4" }}>
                      <input type="number" style={{ ...inputStyle, width: 90, padding: "6px 8px" }} placeholder="0.00" value={v.trade_price} onChange={(e) => updateVariant(i, "trade_price", e.target.value)} />
                    </td>
                    <td style={{ padding: "8px 6px" }}>
                      <input type="number" style={{ ...inputStyle, width: 90, padding: "6px 8px" }} placeholder="0.00" value={v.compare_price} onChange={(e) => updateVariant(i, "compare_price", e.target.value)} />
                    </td>
                    <td style={{ padding: "8px 6px" }}>
                      <input type="number" style={{ ...inputStyle, width: 70, padding: "6px 8px" }} placeholder="0" value={v.stock_qty} onChange={(e) => updateVariant(i, "stock_qty", e.target.value)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 8, fontSize: 12, color: "#64748b" }}>
            <span style={{ background: "#fef9c3", padding: "2px 8px", borderRadius: 4 }}>🟡 Retail = Public price</span>
            <span style={{ background: "#d1fae5", padding: "2px 8px", borderRadius: 4 }}>🟢 Trade = Approved buyer price</span>
            <span style={{ background: "#f1f5f9", padding: "2px 8px", borderRadius: 4 }}>⚫ Cost = Internal only</span>
          </div>
        </div>
      )}

      {/* Save button bottom */}
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button className="btn-outline" onClick={() => router.back()}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={saving} style={{ minWidth: 140 }}>
          {saving ? "Saving product..." : "Save Product"}
        </button>
      </div>
    </div>
  );
}
EOF

echo "✓ Add Product page created"

# ════════════════════════════════════════════
# GIT PUSH
# ════════════════════════════════════════════

cd ..
git add .
git commit -m "feat: trade pricing, add product form, customer trade approval"
git push origin main

echo ""
echo "=========================================="
echo "  ✅ Done!"
echo ""
echo "  What's new:"
echo "  ✓ Trade pricing (retail + trade + cost)"
echo "  ✓ Admin can approve trade customers"
echo "  ✓ /admin/products/new — full product form"
echo "  ✓ Attribute builder + variant generator"
echo "  ✓ Bulk price fill"
echo "  ✓ /admin/customers — trade approval"
echo "=========================================="
