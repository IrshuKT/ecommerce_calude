from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal

from app.db.session import get_db
from app.models.models import CartItem, ProductVariant, User, Product
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()


class AddToCartRequest(BaseModel):
    variant_id: int
    quantity: int = 1
    custom_width_ft: Optional[Decimal] = None
    custom_height_ft: Optional[Decimal] = None


@router.get("/")
async def get_cart(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CartItem)
        .options(selectinload(CartItem.variant).selectinload(ProductVariant.product).selectinload(Product.images))
        .where(CartItem.user_id == current_user.id)
    )
    items = result.scalars().all()
    out = []
    for item in items:
        v = item.variant
        p = v.product
        if p.price_type == "per_sqft" and item.custom_width_ft and item.custom_height_ft:
            area = item.custom_width_ft * item.custom_height_ft
            unit_price = v.retail_price * area
        else:
            unit_price = v.retail_price
        line_total = unit_price * item.quantity
        primary_image = next((img.url for img in p.images if img.is_primary), None)
        out.append({
            "id": item.id, "variant_id": v.id, "quantity": item.quantity,
            "custom_width_ft": item.custom_width_ft, "custom_height_ft": item.custom_height_ft,
            "product_name": p.name, "sku": v.sku,
            "selected_attributes": v.selected_attributes,
            "unit_price": unit_price, "line_total": line_total,
            "primary_image": primary_image, "stock_qty": v.stock_qty,
        })
    return out


@router.post("/", status_code=201)
async def add_to_cart(payload: AddToCartRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProductVariant).where(ProductVariant.id == payload.variant_id, ProductVariant.is_active == True))
    variant = result.scalar_one_or_none()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    if variant.track_inventory and variant.stock_qty < payload.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    result = await db.execute(select(CartItem).where(CartItem.user_id == current_user.id, CartItem.variant_id == payload.variant_id))
    existing = result.scalar_one_or_none()
    if existing:
        existing.quantity += payload.quantity
    else:
        db.add(CartItem(user_id=current_user.id, variant_id=payload.variant_id,
                        quantity=payload.quantity, custom_width_ft=payload.custom_width_ft,
                        custom_height_ft=payload.custom_height_ft))
    return {"message": "Added to cart"}


@router.patch("/{item_id}")
async def update_cart_item(item_id: int, quantity: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CartItem).where(CartItem.id == item_id, CartItem.user_id == current_user.id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    if quantity <= 0:
        await db.delete(item)
    else:
        item.quantity = quantity
    return {"message": "Cart updated"}


@router.delete("/{item_id}", status_code=204)
async def remove_cart_item(item_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CartItem).where(CartItem.id == item_id, CartItem.user_id == current_user.id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    await db.delete(item)
