from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal

from app.db.session import get_db
from app.models.models import Product, ProductVariant, ProductAttribute, ProductImage, Category

router = APIRouter()


@router.get("/")
async def list_products(
    db: AsyncSession = Depends(get_db),
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
        min_price = min((v.price for v in active_variants), default=None)
        items.append({
            "id": p.id, "name": p.name, "slug": p.slug,
            "short_description": p.short_description,
            "price_type": p.price_type, "is_featured": p.is_featured,
            "primary_image": primary_image, "min_price": min_price,
        })
    return {"items": items, "total": total, "page": page, "limit": limit}


@router.get("/{slug}")
async def get_product(slug: str, db: AsyncSession = Depends(get_db)):
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
    return product
