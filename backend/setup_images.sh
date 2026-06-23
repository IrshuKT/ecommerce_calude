#!/bin/bash
# ============================================================
# GlassStore — Image Upload for Products
# Run from ecommerce_calude/
#   bash setup_images.sh
# ============================================================

set -e
echo "=========================================="
echo "  Product Image Upload Setup"
echo "=========================================="

# ════════════════════════════════════════════
# 1. BACKEND — image upload endpoint
# ════════════════════════════════════════════

cd backend

cat > app/api/v1/endpoints/images.py << 'PYEOF'
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
from app.api.v1.endpoints.auth import get_admin_user
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
    current_user: User = Depends(get_admin_user),
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
    current_user: User = Depends(get_admin_user),
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
    current_user: User = Depends(get_admin_user),
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
PYEOF

echo "✓ Image upload endpoint created"

# ── Add to API router ─────────────────────

python << 'PYEOF'
path = "app/api/v1/__init__.py"
with open(path, "r") as f:
    content = f.read()

if "images" not in content:
    old = "from app.api.v1.endpoints import ("
    new = "from app.api.v1.endpoints import (\n    images,"
    content = content.replace(old, new)

    old = "router.include_router(sales_invoices.router"
    new = "router.include_router(images.router,       prefix=\"/products\",        tags=[\"Product Images\"])\nrouter.include_router(sales_invoices.router"
    content = content.replace(old, new)

    with open(path, "w") as f:
        f.write(content)
    print("✓ Images router added to API")
else:
    print("✓ Images router already in API")
PYEOF

cd ..

# ════════════════════════════════════════════
# 2. FRONTEND — Image Upload Component
# ════════════════════════════════════════════

cd frontend
mkdir -p components/admin

cat > components/admin/ImageUpload.tsx << 'EOF'
"use client";
import { useState, useRef, useEffect } from "react";
import api from "@/lib/api";

interface Image {
  id: number;
  url: string;
  is_primary: boolean;
  alt_text?: string;
}

interface ImageUploadProps {
  productId: number;
  onImagesChange?: (images: Image[]) => void;
}

export default function ImageUpload({ productId, onImagesChange }: ImageUploadProps) {
  const [images, setImages] = useState<Image[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8000";

  useEffect(() => {
    if (productId) loadImages();
  }, [productId]);

  const loadImages = async () => {
    try {
      const res = await api.get(`/products/${productId}/images`);
      setImages(res.data || []);
      onImagesChange?.(res.data || []);
    } catch { setImages([]); }
  };

  const uploadFiles = async (files: FileList | File[]) => {
    setUploading(true);
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        await api.post(`/products/${productId}/images`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } catch (e: any) {
        alert(e.response?.data?.detail || `Failed to upload ${file.name}`);
      }
    }
    await loadImages();
    setUploading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) uploadFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
  };

  const setPrimary = async (imageId: number) => {
    try {
      await api.patch(`/products/${productId}/images/${imageId}/set-primary`);
      await loadImages();
    } catch { alert("Failed to set primary"); }
  };

  const deleteImage = async (imageId: number) => {
    if (!confirm("Delete this image?")) return;
    try {
      await api.delete(`/products/${productId}/images/${imageId}`);
      await loadImages();
    } catch { alert("Failed to delete"); }
  };

  return (
    <div>
      {/* Upload area */}
      <div
        onClick={() => !uploading && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragOver ? "#0284c7" : "#cbd5e1"}`,
          borderRadius: 10,
          padding: 32,
          textAlign: "center",
          cursor: uploading ? "not-allowed" : "pointer",
          background: dragOver ? "#f0f9ff" : "#f8fafc",
          transition: "all 0.15s",
          marginBottom: 16,
        }}
      >
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        <div style={{ fontSize: 32, marginBottom: 8 }}>🖼️</div>
        {uploading ? (
          <p style={{ color: "#0284c7", fontSize: 14, margin: 0 }}>Uploading...</p>
        ) : (
          <>
            <p style={{ fontSize: 14, fontWeight: 500, color: "#475569", margin: "0 0 4px" }}>
              Click to upload or drag & drop
            </p>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
              JPG, PNG, WebP — Max 5MB each — Multiple files allowed
            </p>
          </>
        )}
      </div>

      {/* Image grid */}
      {images.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12 }}>
          {images.map((img) => (
            <div key={img.id} style={{
              position: "relative", borderRadius: 8, overflow: "hidden",
              border: img.is_primary ? "2px solid #0284c7" : "1px solid #e2e8f0",
              background: "#f8fafc",
            }}>
              {/* Image */}
              <img
                src={`${API_BASE}${img.url}`}
                alt={img.alt_text || ""}
                style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }}
              />

              {/* Primary badge */}
              {img.is_primary && (
                <div style={{
                  position: "absolute", top: 6, left: 6,
                  background: "#0284c7", color: "white",
                  fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4,
                }}>PRIMARY</div>
              )}

              {/* Actions */}
              <div style={{ padding: "8px 6px", display: "flex", gap: 4 }}>
                {!img.is_primary && (
                  <button
                    onClick={() => setPrimary(img.id)}
                    style={{ flex: 1, fontSize: 11, padding: "4px", borderRadius: 4, border: "1px solid #e2e8f0", background: "white", cursor: "pointer", color: "#475569" }}
                  >Set Primary</button>
                )}
                <button
                  onClick={() => deleteImage(img.id)}
                  style={{ padding: "4px 8px", borderRadius: 4, border: "none", background: "#fee2e2", cursor: "pointer", color: "#dc2626", fontSize: 12 }}
                >✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length === 0 && !uploading && (
        <p style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", margin: 0 }}>
          No images yet. Upload product images above.
        </p>
      )}
    </div>
  );
}
EOF

echo "✓ ImageUpload component created"

# ════════════════════════════════════════════
# 3. ADD IMAGE SECTION TO EDIT PRODUCT PAGE
# ════════════════════════════════════════════

# Create a patch instruction file
cat > /tmp/image_section.txt << 'EOF'
Add this section to your edit product page (app/(admin)/admin/products/[id]/page.tsx)
AFTER the Basic Information card and BEFORE the Attributes card:

      {/* Images */}
      {id && (
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>Product Images</h2>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>
            Upload product images. First image becomes the primary (thumbnail).
          </p>
          <ImageUpload productId={Number(id)} />
        </div>
      )}

Also add this import at the top of the file:
import ImageUpload from "@/components/admin/ImageUpload";
EOF

echo "✓ Instructions saved"

# ════════════════════════════════════════════
# GIT PUSH
# ════════════════════════════════════════════

cd ..
git add .
git commit -m "feat: product image upload — drag & drop, set primary, delete"
git push origin main

echo ""
echo "=========================================="
echo "  ✅ Image upload ready!"
echo ""
echo "  Backend: POST /api/v1/products/{id}/images"
echo "  Backend: GET  /api/v1/products/{id}/images"
echo "  Backend: DELETE /api/v1/products/{id}/images/{image_id}"
echo ""
echo "  Frontend component: components/admin/ImageUpload.tsx"
echo ""
echo "  To add to edit product page:"
echo "  1. Import: import ImageUpload from '@/components/admin/ImageUpload'"
echo "  2. Add <ImageUpload productId={Number(id)} /> section"
echo "=========================================="
