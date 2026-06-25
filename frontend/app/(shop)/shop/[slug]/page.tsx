"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { useCartStore } from "@/store/cart";
import { useAuthStore } from "@/store/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8000";

export default function ProductDetailPage() {
  const { slug } = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { addItem } = useCartStore();

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>({});
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [customWidth, setCustomWidth] = useState("");
  const [customHeight, setCustomHeight] = useState("");
  const [activeImage, setActiveImage] = useState(0);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (slug) {
      api.get(`/products/${slug}`)
        .then(r => {
          setProduct(r.data);
          // Auto-select first value of each attribute
          const defaults: Record<string, string> = {};
          r.data.attributes?.forEach((attr: any) => {
            if (attr.values?.length) defaults[attr.name] = attr.values[0].value;
          });
          setSelectedAttrs(defaults);
        })
        .catch(() => setProduct(null))
        .finally(() => setLoading(false));
    }
  }, [slug]);

  // Find matching variant when attributes change
  useEffect(() => {
  if (!product?.variants) return;
  if (product.attributes?.length === 0) {
    setSelectedVariant(product.variants[0] || null);
    return;
  }
  // Only match variants that have ALL attributes filled
  const match = product.variants.find((v: any) => {
    const attrKeys = Object.keys(selectedAttrs);
    if (attrKeys.length === 0) return false;
    return attrKeys.every(k => v.selected_attributes?.[k] === selectedAttrs[k]);
  });
  setSelectedVariant(match || null);
}, [selectedAttrs, product]);

  const effectivePrice = () => {
    if (!selectedVariant) return null;
    const price = parseFloat(selectedVariant.price);
    if (product.price_type === "per_sqft" && customWidth && customHeight) {
      return price * parseFloat(customWidth) * parseFloat(customHeight);
    }
    return price;
  };

  const handleAddToCart = () => {
    if (!selectedVariant) return;
    const price = parseFloat(selectedVariant.price);
    addItem({
      variant_id: selectedVariant.id,
      product_name: product.name,
      sku: selectedVariant.sku,
      selected_attributes: selectedVariant.selected_attributes || {},
      price,
      quantity,
      primary_image: product.images?.[0]?.url,
      custom_width_ft: customWidth ? parseFloat(customWidth) : undefined,
      custom_height_ft: customHeight ? parseFloat(customHeight) : undefined,
      price_type: product.price_type,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const inp = { padding: "9px 12px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", outline: "none" };

  if (loading) return (
    <div style={{ minHeight: 400, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
      Loading product...
    </div>
  );

  if (!product) return (
    <div style={{ minHeight: 400, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🪟</div>
      <p style={{ color: "#64748b" }}>Product not found</p>
      <Link href="/shop" style={{ color: "#0284c7", marginTop: 8 }}>← Back to shop</Link>
    </div>
  );

  const unitPrice = selectedVariant ? parseFloat(selectedVariant.price) : null;
  const totalPrice = effectivePrice();
  const area = customWidth && customHeight ? parseFloat(customWidth) * parseFloat(customHeight) : null;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 24, display: "flex", gap: 8, alignItems: "center" }}>
        <Link href="/" style={{ color: "#94a3b8", textDecoration: "none" }}>Home</Link>
        <span>›</span>
        <Link href="/shop" style={{ color: "#94a3b8", textDecoration: "none" }}>Shop</Link>
        <span>›</span>
        <span style={{ color: "#475569" }}>{product.name}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48 }}>
        {/* Left — Images */}
        <div>
          {/* Main image */}
          <div style={{ borderRadius: 12, overflow: "hidden", background: "#f1f5f9", height: 380, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, border: "1px solid #e2e8f0" }}>
            {product.images?.[activeImage]
              ? <img src={`${API_BASE}${product.images[activeImage].url}`} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 80 }}>🪟</span>
            }
          </div>
          {/* Thumbnails */}
          {product.images?.length > 1 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {product.images.map((img: any, i: number) => (
                <div key={img.id} onClick={() => setActiveImage(i)} style={{
                  width: 64, height: 64, borderRadius: 8, overflow: "hidden", cursor: "pointer",
                  border: activeImage === i ? "2px solid #0284c7" : "1px solid #e2e8f0",
                }}>
                  <img src={`${API_BASE}${img.url}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right — Product info */}
        <div>
          {/* Trade badge */}
          {product.is_trade_price && (
            <div style={{ display: "inline-block", background: "#d1fae5", color: "#065f46", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 4, marginBottom: 10 }}>
              🟢 TRADE PRICE ACTIVE
            </div>
          )}

          <h1 style={{ fontSize: 26, fontWeight: 700, color: "#1e293b", margin: "0 0 8px", lineHeight: 1.2 }}>{product.name}</h1>

          {product.short_description && (
            <p style={{ fontSize: 15, color: "#64748b", margin: "0 0 16px", lineHeight: 1.6 }}>{product.short_description}</p>
          )}

          {/* HSN + GST */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
  {product.hsn_code && <span style={{ fontSize: 12, color: "#94a3b8" }}>HSN: {product.hsn_code}</span>}
  <span style={{ fontSize: 12, color: "#94a3b8" }}>GST: {product.gst_rate}%</span>
</div>

          {/* Attributes */}
          {product.attributes?.filter((attr: any) => attr.values?.length > 0).map((attr: any) => (
  <div key={attr.id} style={{ marginBottom: 20 }}>
    <label style={{ fontSize: 13, fontWeight: 600, color: "#475569", display: "block", marginBottom: 8 }}>
      {attr.display_name}:
      <span style={{ fontWeight: 700, color: "#1e293b", marginLeft: 6 }}>{selectedAttrs[attr.name]}</span>
    </label>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {attr.values.filter((val: any) => val.value?.trim()).map((val: any) => {
        const isSelected = selectedAttrs[attr.name] === val.value;
        const hasVariant = product.variants?.some((v: any) =>
          v.selected_attributes?.[attr.name] === val.value &&
          Object.keys(v.selected_attributes).length > 0
        );
        return (
          <button key={val.id} onClick={() => setSelectedAttrs({ ...selectedAttrs, [attr.name]: val.value })}
            disabled={!hasVariant}
            style={{
              padding: "7px 16px", borderRadius: 8, fontSize: 14,
              cursor: hasVariant ? "pointer" : "not-allowed",
              border: isSelected ? "2px solid #0284c7" : "1px solid #e2e8f0",
              background: isSelected ? "#eff6ff" : hasVariant ? "white" : "#f8fafc",
              color: isSelected ? "#0284c7" : hasVariant ? "#475569" : "#cbd5e1",
              fontWeight: isSelected ? 600 : 400, transition: "all 0.15s",
            }}>
            {val.value}
          </button>
        );
      })}
    </div>
  </div>
))}

          {/* Custom dimensions for per_sqft */}
          {product.price_type === "per_sqft" && (
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#475569", margin: "0 0 12px" }}>Custom Dimensions (in feet)</p>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>Width (ft)</label>
                  <input type="number" style={{ ...inp, width: 90 }} placeholder="0.00" value={customWidth} onChange={e => setCustomWidth(e.target.value)} min="0" step="0.1" />
                </div>
                <span style={{ color: "#94a3b8", marginTop: 18 }}>×</span>
                <div>
                  <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>Height (ft)</label>
                  <input type="number" style={{ ...inp, width: 90 }} placeholder="0.00" value={customHeight} onChange={e => setCustomHeight(e.target.value)} min="0" step="0.1" />
                </div>
                {area && (
                  <div style={{ marginTop: 18, fontSize: 13, color: "#475569" }}>
                    = <strong>{area.toFixed(2)} sq.ft</strong>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Price */}
          {unitPrice && (
            <div style={{ marginBottom: 24, padding: 16, background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
              {product.price_type === "per_sqft" ? (
                <>
                  <div style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>
                    Rate: <strong>₹{unitPrice.toLocaleString("en-IN")}/sqft</strong>
                  </div>
                  {totalPrice && area ? (
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#0284c7" }}>
                      ₹{(totalPrice * quantity).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      <span style={{ fontSize: 13, color: "#64748b", fontWeight: 400, marginLeft: 8 }}>
                        ({area.toFixed(2)} sqft × ₹{unitPrice} × qty {quantity})
                      </span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 14, color: "#94a3b8" }}>Enter dimensions to see total price</div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 24, fontWeight: 700, color: "#0284c7" }}>
                  ₹{(unitPrice * quantity).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  {selectedVariant?.compare_price && parseFloat(selectedVariant.compare_price) > unitPrice && (
                    <span style={{ fontSize: 15, color: "#94a3b8", textDecoration: "line-through", marginLeft: 10, fontWeight: 400 }}>
                      ₹{parseFloat(selectedVariant.compare_price).toLocaleString("en-IN")}
                    </span>
                  )}
                </div>
              )}
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                + GST {product.gst_rate}% applicable
              </div>
              {selectedVariant && (
                <div style={{ fontSize: 12, color: selectedVariant.stock_qty > 0 ? "#16a34a" : "#dc2626", marginTop: 6 }}>
                  {selectedVariant.stock_qty > 0 ? `✓ In stock (${selectedVariant.stock_qty} available)` : "✗ Out of stock"}
                </div>
              )}
            </div>
          )}

          {/* No variant match */}
          {product.attributes?.length > 0 && !selectedVariant && (
            <div style={{ padding: 12, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, marginBottom: 20, fontSize: 13, color: "#dc2626" }}>
              This combination is not available
            </div>
          )}

          {/* Quantity + Add to cart */}
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
              <button onClick={() => setQuantity(q => Math.max(1, q - 1))} style={{ width: 36, height: 42, border: "none", background: "#f8fafc", cursor: "pointer", fontSize: 18, color: "#475569" }}>−</button>
              <span style={{ width: 40, textAlign: "center", fontSize: 15, fontWeight: 600 }}>{quantity}</span>
              <button onClick={() => setQuantity(q => q + 1)} style={{ width: 36, height: 42, border: "none", background: "#f8fafc", cursor: "pointer", fontSize: 18, color: "#475569" }}>+</button>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={!selectedVariant || selectedVariant?.stock_qty === 0 || added}
              style={{
                flex: 1, padding: "11px 24px", borderRadius: 8, border: "none", cursor: "pointer",
                background: added ? "#16a34a" : !selectedVariant || selectedVariant?.stock_qty === 0 ? "#e2e8f0" : "#0284c7",
                color: !selectedVariant || selectedVariant?.stock_qty === 0 ? "#94a3b8" : "white",
                fontSize: 15, fontWeight: 600, transition: "all 0.2s",
              }}>
              {added ? "✓ Added to Cart!" : selectedVariant?.stock_qty === 0 ? "Out of Stock" : "Add to Cart"}
            </button>

            <button onClick={() => { handleAddToCart(); router.push("/cart"); }}
              disabled={!selectedVariant || selectedVariant?.stock_qty === 0}
              style={{ padding: "11px 20px", borderRadius: 8, border: "1px solid #0284c7", background: "white", color: "#0284c7", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Buy Now
            </button>
          </div>

          {/* SKU */}
          {selectedVariant && (
            <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>SKU: {selectedVariant.sku}</p>
          )}

          {/* Description */}
          {product.description && (
            <div style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid #e2e8f0" }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", marginBottom: 10 }}>Product Description</h3>
              <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.7, margin: 0 }}>{product.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
