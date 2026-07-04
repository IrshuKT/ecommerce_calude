"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8000";

function ProductCard({ product }: { product: any }) {
  return (
    <Link href={`/shop/${product.slug}`} style={{ textDecoration: "none" }}>
      <div style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden", transition: "all 0.2s" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}>
        <div style={{ height: 180, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {product.primary_image
            ? <img src={`${API_BASE}${product.primary_image}`} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontSize: 48 }}>🪟</span>}
        </div>
        <div style={{ padding: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: "0 0 4px" }}>{product.name}</h3>
          {product.short_description && <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px" }}>{product.short_description}</p>}
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
