from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from slugify import slugify
from app.db.session import get_db
from app.models.models import Category
from app.api.v1.endpoints.shared_auth import require_roles, ActingUser


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

@router.get("/tree")
async def get_category_tree(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Category).where(Category.is_active == True).order_by(Category.sort_order, Category.name)
    )
    cats = result.scalars().all()
    by_id = {c.id: {"id": c.id, "name": c.name, "slug": c.slug, "children": []} for c in cats}
    roots = []
    for c in cats:
        node = by_id[c.id]
        (by_id[c.parent_id]["children"] if c.parent_id and c.parent_id in by_id else roots).append(node)
    return roots


@router.post("/", status_code=201)
async def create_category(
    payload: CategoryIn,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager")),
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
    current_user: ActingUser = Depends(require_roles("admin", "manager")),
):
    result = await db.execute(select(Category).where(Category.id == category_id))
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    cat.is_active = False
    await db.commit()
