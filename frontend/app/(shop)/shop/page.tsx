"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useCartStore } from "@/store/cart";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8000";

interface Variant {
  id: number;
  sku?: string;
  selected_attributes?: Record<string, string>;
  retail_price?: string | number;
  stock_qty?: number;
}

function BuyModal({ product, variant, onClose }: { product: any; variant: Variant; onClose: () => void }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const addItem = useCartStore(s => s.addItem);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const outOfStock = variant.stock_qty != null && variant.stock_qty <= 0;
  const maxQty = variant.stock_qty ?? 99;

  const handleAdd = async () => {
    if (!user) {
      router.push(`/login?next=/shop`);
      return;
    }
    setAdding(true);
    try {
      await addItem(variant.id, qty);
      setAdded(true);
      setTimeout(() => { setAdded(false); onClose(); }, 1000);
    } catch {
      alert("Failed to add to cart");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div
      onClick={e => { e.preventDefault(); e.stopPropagation(); onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
      }}
    >
      <div
        onClick={e => { e.preventDefault(); e.stopPropagation(); }}
        style={{ background: "white", borderRadius: 14, width: 340, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
      >
        <div style={{ height: 200, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {product.primary_image
            ? <img src={`${API_BASE}${product.primary_image}`} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontSize: 56 }}>🪟</span>}
        </div>

        <div style={{ padding: 18 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: "0 0 2px" }}>{product.name}</h3>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px" }}>
            {Object.values(variant.selected_attributes || {}).join(" / ") || variant.sku}
          </p>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#0284c7" }}>
              {variant.retail_price != null ? `₹${parseFloat(String(variant.retail_price)).toLocaleString("en-IN")}` : "—"}
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: outOfStock ? "#dc2626" : "#16a34a" }}>
              {outOfStock ? "Out of stock" : `${variant.stock_qty} in stock`}
            </span>
          </div>

          {!outOfStock && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: "#475569" }}>Quantity</span>
              <div style={{ display: "flex", alignItems: "center", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                <button onClick={() => setQty(q => Math.max(1, q - 1))}
                  style={{ width: 32, height: 32, border: "none", background: "none", cursor: "pointer", fontSize: 16, color: "#475569" }}>−</button>
                <span style={{ width: 32, textAlign: "center", fontSize: 14, fontWeight: 600 }}>{qty}</span>
                <button onClick={() => setQty(q => Math.min(maxQty, q + 1))}
                  style={{ width: 32, height: 32, border: "none", background: "none", cursor: "pointer", fontSize: 16, color: "#475569" }}>+</button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #e2e8f0",
              background: "white", color: "#475569", fontSize: 14, fontWeight: 500, cursor: "pointer",
            }}>
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={outOfStock || adding}
              style={{
                flex: 2, padding: "10px 0", borderRadius: 8, border: "none",
                background: added ? "#16a34a" : outOfStock ? "#f1f5f9" : "#0284c7",
                color: outOfStock ? "#94a3b8" : "white",
                fontSize: 14, fontWeight: 600, cursor: outOfStock ? "not-allowed" : "pointer",
              }}
            >
              {added ? "Added ✓" : adding ? "Adding..." : outOfStock ? "Unavailable" : "Add to Cart"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductCard({ product }: { product: any }) {
  const [showVariants, setShowVariants] = useState(false);
  const [buyVariant, setBuyVariant] = useState<Variant | null>(null);
  const variants: Variant[] = product.variants || [];
  const variantCount = variants.length;

  const toggleVariants = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowVariants(v => !v);
  };

  const openBuyMode = (e: React.MouseEvent, v: Variant) => {
    e.preventDefault();
    e.stopPropagation();
    setBuyVariant(v);
    setShowVariants(false);
  };

  return (
    <>
      <Link href={`/shop/${product.slug}`} style={{ textDecoration: "none" }}>
        <div style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", transition: "all 0.2s", position: "relative" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}>
          <div style={{ height: 180, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: "12px 12px 0 0" }}>
            {product.primary_image
              ? <img src={`${API_BASE}${product.primary_image}`} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 48 }}>🪟</span>}
          </div>
          <div style={{ padding: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: "0 0 4px" }}>{product.name}</h3>
            {product.short_description && <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 8px" }}>{product.short_description}</p>}

            {variantCount > 1 && (
              <div style={{ position: "relative", marginBottom: 8 }}>
                <span
                  onClick={toggleVariants}
                  style={{ fontSize: 12, color: "#0284c7", fontWeight: 500, cursor: "pointer", textDecoration: "underline" }}
                >
                  {variantCount} variants available
                </span>

                {showVariants && (
                  <div
                    onClick={e => { e.preventDefault(); e.stopPropagation(); }}
                    style={{
                      position: "absolute", top: "100%", left: 0, marginTop: 6, zIndex: 20,
                      background: "white", border: "1px solid #e2e8f0", borderRadius: 8,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 220, padding: 8,
                    }}
                  >
                    {variants.map(v => {
                      const outOfStock = v.stock_qty != null && v.stock_qty <= 0;
                      return (
                        <div key={v.id}
                          onClick={e => !outOfStock && openBuyMode(e, v)}
                          style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                            fontSize: 12, color: "#475569", padding: "7px 6px", borderRadius: 5,
                            cursor: outOfStock ? "default" : "pointer",
                          }}
                          onMouseEnter={e => { if (!outOfStock) (e.currentTarget as HTMLElement).style.background = "#f8fafc"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; }}
                        >
                          <span>{Object.values(v.selected_attributes || {}).join(" / ") || v.sku}</span>
                          <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            {v.retail_price != null && (
                              <span style={{ color: "#0284c7", fontWeight: 600 }}>
                                ₹{parseFloat(String(v.retail_price)).toLocaleString("en-IN")}
                              </span>
                            )}
                            <span style={{ color: outOfStock ? "#dc2626" : "#16a34a", fontSize: 11 }}>
                              {outOfStock ? "Out of stock" : `${v.stock_qty} in stock`}
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                {product.is_trade_price && <div style={{ fontSize: 10, fontWeight: 600, color: "#065f46", background: "#d1fae5", padding: "1px 6px", borderRadius: 3, marginBottom: 3, display: "inline-block" }}>TRADE PRICE</div>}
                <div style={{ fontSize: 16, fontWeight: 700, color: "#0284c7" }}>
                  {product.min_price ? `₹${parseFloat(String(product.min_price)).toLocaleString("en-IN")}` : "Contact for price"}
                  {product.price_type === "per_sqft" && <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>/sqft</span>}
                </div>
              </div>
              <span style={{ fontSize: 12, color: "#0284c7", fontWeight: 500 }}>View →</span>
            </div>
          </div>
        </div>
      </Link>

      {buyVariant && (
        <BuyModal product={product} variant={buyVariant} onClose={() => setBuyVariant(null)} />
      )}
    </>
  );
}

function ShopContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 12;

  const categorySlug = searchParams.get("category") || "";
  const featured = searchParams.get("featured") || "";

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (categorySlug) params.set("category_slug", categorySlug);
      if (featured) params.set("featured", "true");
      params.set("page", String(page));
      params.set("limit", String(limit));
      const res = await api.get(`/products/?${params}`);
      setProducts(res.data?.items || []);
      setTotal(res.data?.total || 0);
    } catch { setProducts([]); } finally { setLoading(false); }
  };

  useEffect(() => { api.get("/categories/").then(r => setCategories(r.data || [])).catch(() => {}); }, []);
  useEffect(() => { load(); }, [search, categorySlug, featured, page]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#1e293b", margin: "0 0 4px" }}>
          {featured ? "Featured Products" : categorySlug ? categories.find(c => c.slug === categorySlug)?.name || "Products" : "All Products"}
        </h1>
        <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>{total} products found</p>
      </div>

      {/* Category pills - top */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <Link href="/shop" style={{
          padding: "8px 18px", borderRadius: 20, border: "1px solid",
          borderColor: !categorySlug ? "#0284c7" : "#e2e8f0",
          background: !categorySlug ? "#0284c7" : "white",
          color: !categorySlug ? "white" : "#475569",
          fontSize: 13, fontWeight: 500, textDecoration: "none",
        }}>
          All Products
        </Link>
        {categories.map(cat => (
          <Link key={cat.id} href={`/shop?category=${cat.slug}`} style={{
            padding: "8px 18px", borderRadius: 20, border: "1px solid",
            borderColor: categorySlug === cat.slug ? "#0284c7" : "#e2e8f0",
            background: categorySlug === cat.slug ? "#0284c7" : "white",
            color: categorySlug === cat.slug ? "white" : "#475569",
            fontSize: 13, fontWeight: 500, textDecoration: "none",
          }}>
            {cat.name}
          </Link>
        ))}
      </div>

      {/* Products grid - now full width, no sidebar */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>Loading products...</div>
      ) : products.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🪟</div>
          <p style={{ color: "#64748b" }}>No products found</p>
          <Link href="/shop" style={{ color: "#0284c7", fontSize: 14 }}>Clear filters</Link>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 20, marginBottom: 32 }}>
            {products.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)} style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid", borderColor: page === p ? "#0284c7" : "#e2e8f0", background: page === p ? "#0284c7" : "white", color: page === p ? "white" : "#475569", cursor: "pointer", fontSize: 14 }}>{p}</button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>Loading...</div>}>
      <ShopContent />
    </Suspense>
  );
}