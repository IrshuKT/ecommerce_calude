"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { usePublicSettings } from "@/app/context/PublicSettingsContext";

interface Variant {
  id: number;
  sku?: string;
  selected_attributes?: Record<string, string>;
  retail_price?: string | number;   
  stock_qty?: number;
}

interface Product {
  id: number;
  name: string;
  slug: string;
  short_description: string;
  price_type: string;
  min_price: number;
  primary_image: string;
  is_trade_price: boolean;
  variants?: Variant[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8000";

function ProductCard({ product }: { product: Product }) {
  const [showVariants, setShowVariants] = useState(false);
  const variantCount = product.variants?.length || 0;

  const toggleVariants = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowVariants(v => !v);
  };

  return (
    <Link href={`/shop/${product.slug}`} style={{ textDecoration: "none" }}>
      <div style={{
        background: "white", borderRadius: 12, border: "1px solid #e2e8f0",
        overflow: "hidden", transition: "all 0.2s", cursor: "pointer", position: "relative",
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
      >
        {/* Image */}
        <div style={{ height: 180, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {product.primary_image
            ? <img src={`${API_BASE}${product.primary_image}`} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontSize: 48 }}>🪟</span>
          }
        </div>

        {/* Info */}
        <div style={{ padding: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: "0 0 4px", lineHeight: 1.3 }}>{product.name}</h3>
          {product.short_description && <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 8px", lineHeight: 1.4 }}>{product.short_description}</p>}

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
                    boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 200, padding: 8,
                  }}
                >
               {product.variants!.map(v => (
  <div key={v.id} style={{
    display: "flex", justifyContent: "space-between", gap: 12,
    fontSize: 12, color: "#475569", padding: "5px 6px", borderRadius: 5,
  }}>
    <span>{Object.values(v.selected_attributes || {}).join(" / ") || v.sku}</span>
    <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {v.retail_price != null && (
        <span style={{ color: "#0284c7", fontWeight: 600 }}>
          ₹{parseFloat(String(v.retail_price)).toLocaleString("en-IN")}
        </span>
      )}
      {v.stock_qty != null && (
        <span style={{ color: v.stock_qty > 0 ? "#16a34a" : "#dc2626", fontSize: 11 }}>
          {v.stock_qty > 0 ? `${v.stock_qty} in stock` : "Out of stock"}
        </span>
      )}
    </span>
  </div>
))}
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
  );
}

export default function HomePage() {
  const settings = usePublicSettings();
  const { user } = useAuthStore();
  const [featured, setFeatured] = useState<Product[]>([]);
  const [latest, setLatest] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [featRes, latestRes, catRes] = await Promise.all([
          api.get("/products/?featured=true&limit=4"),
          api.get("/products/?limit=8"),
          api.get("/categories/"),
        ]);
        setFeatured(featRes.data?.items || []);
        setLatest(latestRes.data?.items || []);
        setCategories(catRes.data || []);
      } catch { } finally { setLoading(false); }
    };
    load();
  }, []);

  return (
    <div>
      {/* Hero */}
      <section style={{ background: "linear-gradient(135deg, #0369a1 0%, #0284c7 50%, #0ea5e9 100%)", padding: "80px 24px", textAlign: "center", color: "white" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          {user?.is_trade_approved && (
            <div style={{ display: "inline-block", background: "rgba(255,255,255,0.2)", borderRadius: 20, padding: "4px 16px", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
              🟢 Trade Account Active — You're seeing trade prices
            </div>
          )}
          <h1 style={{ fontSize: 48, fontWeight: 700, margin: "0 0 16px", lineHeight: 1.15 }}>
            {settings.company_name || "KT'S Hub"}<br /> Online Shop
          </h1>
          <p style={{ fontSize: 18, opacity: 0.9, margin: "0 0 32px", lineHeight: 1.6 }}>
            {settings.tagline || "Clear glass, mirrors, frosted panels and more."}
            {settings.city ? ` ${settings.city} & all ${settings.state} delivery.` : " All Kerala delivery."}
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/shop" style={{ padding: "14px 32px", borderRadius: 10, background: "white", color: "#0284c7", fontWeight: 600, fontSize: 16, textDecoration: "none" }}>
              Shop Now
            </Link>
            {!user && (
              <Link href="/register" style={{ padding: "14px 32px", borderRadius: 10, border: "2px solid rgba(255,255,255,0.6)", color: "white", fontWeight: 600, fontSize: 16, textDecoration: "none" }}>
                Create Account
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Stats bar */}
       <section style={{ background: "#1e293b", padding: "20px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "center", gap: 48, flexWrap: "wrap" }}>
          {[
            ["🪟", "500+ Products"],
            ["📦", `${settings.state || "Kerala"} delivery`],
            ["🧾", "GST Invoices"],
            ["✅", "Quality Assured"]
          ].map(([icon, text]) => (
            <div key={text} style={{ display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 14 }}>
              <span style={{ fontSize: 18 }}>{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 24px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1e293b", marginBottom: 24 }}>Shop by Category</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {categories.map((cat) => (
              <Link key={cat.id} href={`/shop?category=${cat.slug}`} style={{
                padding: "10px 20px", borderRadius: 24, border: "1px solid #e2e8f0",
                background: "white", color: "#475569", fontSize: 14, fontWeight: 500,
                textDecoration: "none", transition: "all 0.15s",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#eff6ff"; (e.currentTarget as HTMLElement).style.color = "#0284c7"; (e.currentTarget as HTMLElement).style.borderColor = "#0284c7"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "white"; (e.currentTarget as HTMLElement).style.color = "#475569"; (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0"; }}
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Products */}
      {featured.length > 0 && (
        <section style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 48px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1e293b", margin: 0 }}>Featured Products</h2>
            <Link href="/shop?featured=true" style={{ fontSize: 14, color: "#0284c7", textDecoration: "none" }}>View all →</Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20 }}>
            {featured.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {/* All Products */}
      <section style={{ background: "#f8fafc", padding: "48px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1e293b", margin: 0 }}>Latest Products</h2>
            <Link href="/shop" style={{ fontSize: 14, color: "#0284c7", textDecoration: "none" }}>View all →</Link>
          </div>
          {loading ? (
            <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>Loading products...</div>
          ) : latest.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🪟</div>
              <p style={{ color: "#64748b", fontSize: 16 }}>No products yet. Check back soon!</p>
              {user?.role === "admin" && (
                <Link href="/admin/products/new" style={{ display: "inline-block", marginTop: 12, padding: "10px 24px", background: "#0284c7", color: "white", borderRadius: 8, textDecoration: "none", fontSize: 14 }}>
                  + Add First Product
                </Link>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20 }}>
              {latest.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </section>

      {/* Trade CTA */}
      {!user?.is_trade_approved && (
        <section style={{ background: "#0284c7", padding: "48px 24px", textAlign: "center" }}>
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <h2 style={{ fontSize: 26, fontWeight: 700, color: "white", margin: "0 0 12px" }}>Are you a Trade Buyer?</h2>
            <p style={{ fontSize: 16, color: "#bae6fd", margin: "0 0 24px" }}>
              Register and get approved for exclusive trade pricing on all products.
            </p>
            <Link href={user ? "/account" : "/register"} style={{ padding: "13px 32px", borderRadius: 10, background: "white", color: "#0284c7", fontWeight: 600, fontSize: 15, textDecoration: "none" }}>
              {user ? "Contact us to upgrade" : "Register as Trade Buyer"}
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
