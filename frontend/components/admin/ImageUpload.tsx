"use client";
import { useState, useRef, useEffect } from "react";
import staffApi from "@/lib/staffApi";

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
      const res = await staffApi.get(`/products/${productId}/images`);
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
        await staffApi.post(`/products/${productId}/images`, formData, {
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
      await staffApi.patch(`/products/${productId}/images/${imageId}/set-primary`);
      await loadImages();
    } catch { alert("Failed to set primary"); }
  };

  const deleteImage = async (imageId: number) => {
    if (!confirm("Delete this image?")) return;
    try {
      await staffApi.delete(`/products/${productId}/images/${imageId}`);
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
