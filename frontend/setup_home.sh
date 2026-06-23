#!/bin/bash
# ============================================================
# GlassStore — Home Page
# Run from ecommerce_calude/frontend
#   bash setup_home.sh
# ============================================================

set -e
echo "=========================================="
echo "  GlassStore Home Page Setup"
echo "=========================================="

mkdir -p "app/(shop)"
mkdir -p "app/(shop)/shop"
mkdir -p "components/shop"

# ════════════════════════════════════════════
# SHOP LAYOUT
# ════════════════════════════════════════════

cat > "app/(shop)/layout.tsx" << 'EOF'
import Navbar from "@/components/shop/Navbar";
import Footer from "@/components/shop/Footer";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar />
      <main style={{ flex: 1 }}>{children}</main>
      <Footer />
    </div>
  );
}
EOF

# ════════════════════════════════════════════
# NAVBAR
# ════════════════════════════════════════════

cat > "components/shop/Navbar.tsx" << 'EOF'
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useCartStore } from "@/store/cart";

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const { items } = useCartStore();
  const router = useRouter();
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <header style={{ background: "white", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* Logo */}
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <rect x="2" y="2" width="6" height="6" rx="1" fill="white" opacity="0.9"/>
              <rect x="10" y="2" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
              <rect x="2" y="10" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
              <rect x="10" y="10" width="6" height="6" rx="1" fill="white" opacity="0.9"/>
            </svg>
          </div>
          <span style={{ fontSize: 17, fontWeight: 600, color: "#1e293b" }}>Glass<span style={{ color: "#0284c7" }}>Store</span></span>
        </Link>

        {/* Nav links */}
        <nav style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link href="/shop" style={{ fontSize: 14, color: "#475569", textDecoration: "none", fontWeight: 500 }}>Shop</Link>
          <Link href="/shop?featured=true" style={{ fontSize: 14, color: "#475569", textDecoration: "none" }}>Featured</Link>
          <Link href="/about" style={{ fontSize: 14, color: "#475569", textDecoration: "none" }}>About</Link>
        </nav>

        {/* Right actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Trade badge */}
          {user?.is_trade_approved && (
            <span style={{ fontSize: 11, fontWeight: 600, background: "#d1fae5", color: "#065f46", padding: "3px 8px", borderRadius: 4 }}>
              TRADE
            </span>
          )}

          {/* Cart */}
          <Link href="/cart" style={{ position: "relative", textDecoration: "none", display: "flex", alignItems: "center", padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0", gap: 6, color: "#475569" }}>
            <span style={{ fontSize: 16 }}>🛒</span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Cart</span>
            {totalItems > 0 && (
              <span style={{ position: "absolute", top: -6, right: -6, background: "#0284c7", color: "white", fontSize: 10, fontWeight: 700, width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {totalItems}
              </span>
            )}
          </Link>

          {/* Auth */}
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link href="/account" style={{ fontSize: 13, color: "#475569", textDecoration: "none", fontWeight: 500 }}>
                {user.name.split(" ")[0]}
              </Link>
              {user.role === "admin" && (
                <Link href="/admin" style={{ fontSize: 12, color: "#0284c7", textDecoration: "none", background: "#eff6ff", padding: "4px 10px", borderRadius: 6 }}>Admin</Link>
              )}
              <button onClick={() => { logout(); router.push("/login"); }} style={{ fontSize: 13, color: "#94a3b8", background: "none", border: "none", cursor: "pointer" }}>
                Sign out
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <Link href="/login" style={{ fontSize: 13, color: "#475569", textDecoration: "none", padding: "6px 14px", borderRadius: 7, border: "1px solid #e2e8f0" }}>Sign in</Link>
              <Link href="/register" style={{ fontSize: 13, color: "white", textDecoration: "none", padding: "6px 14px", borderRadius: 7, background: "#0284c7" }}>Register</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
EOF

echo "✓ Navbar created"

# ════════════════════════════════════════════
# FOOTER
# ════════════════════════════════════════════

cat > "components/shop/Footer.tsx" << 'EOF'
import Link from "next/link";

export default function Footer() {
  return (
    <footer style={{ background: "#1e293b", color: "#94a3b8", marginTop: "auto" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 32, marginBottom: 32 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ width: 26, height: 26, borderRadius: 6, background: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                  <rect x="2" y="2" width="6" height="6" rx="1" fill="white" opacity="0.9"/>
                  <rect x="10" y="2" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
                  <rect x="2" y="10" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
                  <rect x="10" y="10" width="6" height="6" rx="1" fill="white" opacity="0.9"/>
                </svg>
              </div>
              <span style={{ fontSize: 16, fontWeight: 600, color: "white" }}>GlassStore</span>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>Premium glass materials for homes, offices and projects across India.</p>
          </div>
          <div>
            <h4 style={{ color: "white", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Shop</h4>
            {[["All Products", "/shop"], ["Featured", "/shop?featured=true"], ["Categories", "/shop"]].map(([label, href]) => (
              <div key={label} style={{ marginBottom: 8 }}><Link href={href} style={{ color: "#94a3b8", textDecoration: "none", fontSize: 13 }}>{label}</Link></div>
            ))}
          </div>
          <div>
            <h4 style={{ color: "white", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Account</h4>
            {[["My Orders", "/account/orders"], ["My Invoices", "/account/invoices"], ["Profile", "/account"]].map(([label, href]) => (
              <div key={label} style={{ marginBottom: 8 }}><Link href={href} style={{ color: "#94a3b8", textDecoration: "none", fontSize: 13 }}>{label}</Link></div>
            ))}
          </div>
          <div>
            <h4 style={{ color: "white", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Contact</h4>
            <p style={{ fontSize: 13, margin: "0 0 6px" }}>📞 +91 98765 43210</p>
            <p style={{ fontSize: 13, margin: "0 0 6px" }}>✉️ hello@glassstore.in</p>
            <p style={{ fontSize: 13, margin: 0 }}>📍 Kerala, India</p>
          </div>
        </div>
        <div style={{ borderTop: "1px solid #334155", paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <p style={{ fontSize: 12, margin: 0 }}>© 2025 GlassStore. All rights reserved.</p>
          <p style={{ fontSize: 12, margin: 0 }}>GST Registered | Pan India Delivery</p>
        </div>
      </div>
    </footer>
  );
}
EOF

echo "✓ Footer created"

# ════════════════════════════════════════════
# CART STORE (Zustand)
# ════════════════════════════════════════════

cat > "store/cart.ts" << 'EOF'
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  variant_id: number;
  product_name: string;
  sku: string;
  selected_attributes: Record<string, string>;
  price: number;
  quantity: number;
  primary_image?: string;
  custom_width_ft?: number;
  custom_height_ft?: number;
  price_type: string;
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  updateQuantity: (variant_id: number, quantity: number) => void;
  removeItem: (variant_id: number) => void;
  clearCart: () => void;
  total: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const existing = get().items.find(i => i.variant_id === item.variant_id);
        if (existing) {
          set({ items: get().items.map(i => i.variant_id === item.variant_id ? { ...i, quantity: i.quantity + item.quantity } : i) });
        } else {
          set({ items: [...get().items, item] });
        }
      },

      updateQuantity: (variant_id, quantity) => {
        if (quantity <= 0) {
          set({ items: get().items.filter(i => i.variant_id !== variant_id) });
        } else {
          set({ items: get().items.map(i => i.variant_id === variant_id ? { ...i, quantity } : i) });
        }
      },

      removeItem: (variant_id) => {
        set({ items: get().items.filter(i => i.variant_id !== variant_id) });
      },

      clearCart: () => set({ items: [] }),

      total: () => get().items.reduce((sum, item) => {
        const price = item.price_type === "per_sqft" && item.custom_width_ft && item.custom_height_ft
          ? item.price * item.custom_width_ft * item.custom_height_ft * item.quantity
          : item.price * item.quantity;
        return sum + price;
      }, 0),
    }),
    { name: "cart-store" }
  )
);
EOF

echo "✓ Cart store created"

# ════════════════════════════════════════════
# HOME PAGE
# ════════════════════════════════════════════

cat > "app/(shop)/page.tsx" << 'EOF'
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";

interface Product {
  id: number;
  name: string;
  slug: string;
  short_description: string;
  price_type: string;
  min_price: number;
  primary_image: string;
  is_trade_price: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8000";

function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/shop/${product.slug}`} style={{ textDecoration: "none" }}>
      <div style={{
        background: "white", borderRadius: 12, border: "1px solid #e2e8f0",
        overflow: "hidden", transition: "all 0.2s", cursor: "pointer",
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
          {product.short_description && <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px", lineHeight: 1.4 }}>{product.short_description}</p>}
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
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          {user?.is_trade_approved && (
            <div style={{ display: "inline-block", background: "rgba(255,255,255,0.2)", borderRadius: 20, padding: "4px 16px", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
              🟢 Trade Account Active — You're seeing trade prices
            </div>
          )}
          <h1 style={{ fontSize: 48, fontWeight: 700, margin: "0 0 16px", lineHeight: 1.15 }}>
            Premium Glass<br />Materials Online
          </h1>
          <p style={{ fontSize: 18, opacity: 0.9, margin: "0 0 32px", lineHeight: 1.6 }}>
            Clear glass, mirrors, frosted panels and more. GST invoices with every order. Pan India delivery.
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
          {[["🪟", "500+ Products"], ["📦", "Pan India Delivery"], ["🧾", "GST Invoices"], ["✅", "Quality Assured"]].map(([icon, text]) => (
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
EOF

echo "✓ Home page created"

# ════════════════════════════════════════════
# UPDATE ROOT PAGE — redirect to home
# ════════════════════════════════════════════

cat > "app/page.tsx" << 'EOF'
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";

export default function RootPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (user?.role === "admin") router.replace("/admin");
    else router.replace("/");
  }, [hydrated, user, router]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 32, height: 32, border: "3px solid #0284c7", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
EOF

# ════════════════════════════════════════════
# GIT PUSH
# ════════════════════════════════════════════

cd ..
git add .
git commit -m "feat: home page — hero, featured products, categories, trade CTA"
git push origin main

echo ""
echo "=========================================="
echo "  ✅ Home page ready!"
echo ""
echo "  Visit: http://localhost:3000"
echo "  - Hero section with CTA"
echo "  - Category filter pills"
echo "  - Featured products grid"
echo "  - Latest products grid"
echo "  - Trade buyer CTA section"
echo "  - Navbar with cart count"
echo "  - Footer"
echo "=========================================="
