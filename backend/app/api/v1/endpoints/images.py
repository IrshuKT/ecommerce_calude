"""
Product image upload endpoint.
Saves images to /uploads/products/ and returns the URL.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import os, uuid, shutil
from pathlib import Path

from app.db.session import get_db
from app.models.models import Product, ProductImage, User
from app.api.v1.endpoints.shared_auth import require_roles, ActingUser
from app.core.config import settings

router = APIRouter()

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_SIZE_MB = 5


@router.post("/{product_id}/images")
async def upload_product_image(
    product_id: int,
    file: UploadFile = File(...),
    is_primary: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager")),
):
    # Validate product exists
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Validate file extension
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Use: {', '.join(ALLOWED_EXTENSIONS)}")

    # Validate file size
    contents = await file.read()
    if len(contents) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File too large. Max {MAX_SIZE_MB}MB")

    # Save file
    upload_dir = Path(settings.UPLOAD_DIR) / "products" / str(product_id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4().hex}{ext}"
    file_path = upload_dir / filename

    with open(file_path, "wb") as f:
        f.write(contents)

    url = f"/uploads/products/{product_id}/{filename}"

    # If is_primary, unset other primary images
    if is_primary:
        from sqlalchemy import update
        await db.execute(
            update(ProductImage)
            .where(ProductImage.product_id == product_id)
            .values(is_primary=False)
        )

    # Count existing images for sort_order
    from sqlalchemy import func
    count_result = await db.execute(
        select(func.count()).where(ProductImage.product_id == product_id)
    )
    sort_order = count_result.scalar() or 0

    # If first image, make it primary
    if sort_order == 0:
        is_primary = True

    image = ProductImage(
        product_id=product_id,
        url=url,
        alt_text=product.name,
        is_primary=is_primary,
        sort_order=sort_order,
    )
    db.add(image)
    await db.flush()

    return {
        "id": image.id,
        "url": url,
        "is_primary": image.is_primary,
        "message": "Image uploaded successfully"
    }


@router.get("/{product_id}/images")
async def get_product_images(
    product_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProductImage)
        .where(ProductImage.product_id == product_id)
        .order_by(ProductImage.sort_order)
    )
    images = result.scalars().all()
    return [{"id": i.id, "url": i.url, "is_primary": i.is_primary, "alt_text": i.alt_text} for i in images]


@router.patch("/{product_id}/images/{image_id}/set-primary")
async def set_primary_image(
    product_id: int,
    image_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager")),
):
    from sqlalchemy import update
    # Unset all primary
    await db.execute(
        update(ProductImage)
        .where(ProductImage.product_id == product_id)
        .values(is_primary=False)
    )
    # Set new primary
    result = await db.execute(select(ProductImage).where(ProductImage.id == image_id))
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    image.is_primary = True
    return {"message": "Primary image updated"}


@router.delete("/{product_id}/images/{image_id}", status_code=204)
async def delete_product_image(
    product_id: int,
    image_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager")),
):
    result = await db.execute(select(ProductImage).where(ProductImage.id == image_id, ProductImage.product_id == product_id))
    image = result.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    # Delete physical file
    file_path = Path(".") / image.url.lstrip("/")
    if file_path.exists():
        file_path.unlink()

    await db.delete(image)
