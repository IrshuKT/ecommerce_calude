"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useCartStore } from "@/store/cart";
import { usePublicSettings } from "@/app/context/PublicSettingsContext";
import api from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8000";

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const { items, fetchCart } = useCartStore();
  const router = useRouter();
  const settings = usePublicSettings();
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);

  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);

  // Keep the badge in sync with the backend cart whenever the logged-in user changes
  // (covers first load, login, and switching accounts).
  useEffect(() => {
    if (user) fetchCart();
  }, [user]);

  const submitSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) { router.push("/shop"); return; }

    setSearching(true);
    try {
      const res = await api.get(`/products/?search=${encodeURIComponent(q)}&limit=5`);
      const items = res.data?.items || [];

      // Exact name match (case-insensitive) -> go straight to that product
      const exactMatch = items.find(
        (p: any) => p.name?.trim().toLowerCase() === q.toLowerCase()
      );

      if (exactMatch?.slug) {
        router.push(`/shop/${exactMatch.slug}`);
      } else if (items.length === 1 && items[0]?.slug) {
        // Only one result overall -> take them there directly
        router.push(`/shop/${items[0].slug}`);
      } else {
        // Multiple / no matches -> fall back to listing page
        router.push(`/shop?search=${encodeURIComponent(q)}`);
      }
    } catch {
      // API failed for any reason -> fall back to listing page
      router.push(`/shop?search=${encodeURIComponent(q)}`);
    } finally {
      setSearching(false);
    }
  };

  return (
    <header style={{ background: "white", borderBottom: "1px solid #e2e8f0", position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center", gap: 20 }}>

        {/* Logo */}
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 7, background: "#f1f5f9", display: "flex", alignItems: "left", justifyContent: "left", overflow: "hidden", flexShrink: 0 }}>
            {settings.logo_url
              ? <img src={`${API_BASE}${settings.logo_url}`} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              : <div style={{ width: 28, height: 28, borderRadius: 7, background: "#0284c7", display: "flex", alignItems: "left", justifyContent: "left" }}>
                  <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                    <rect x="2" y="2" width="6" height="6" rx="1" fill="white" opacity="0.9"/>
                    <rect x="10" y="2" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
                    <rect x="2" y="10" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
                    <rect x="10" y="10" width="6" height="6" rx="1" fill="white" opacity="0.9"/>
                  </svg>
                </div>
            }
          </div>
          <span style={{ fontSize: 17, fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap" }}>
            {settings.company_name || ""}<span style={{ color: "#0284c7" }}>{settings.company_name ? "" : " Epozy"}</span>
          </span>
        </Link>

        {/* Nav links */}
        <nav style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          <Link href="/shop" style={{ fontSize: 14, color: "#475569", textDecoration: "none", fontWeight: 500 }}>Shop</Link>
          <Link href="/shop?featured=true" style={{ fontSize: 14, color: "#475569", textDecoration: "none" }}>Featured</Link>
          <Link href="/about" style={{ fontSize: 14, color: "#475569", textDecoration: "none" }}>About</Link>
        </nav>

        {/* Search - takes up remaining space */}
        <form onSubmit={submitSearch} style={{ flex: 1, maxWidth: 450, display: "flex" }}>
          <div style={{ position: "relative", width: "100%" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#94a3b8", pointerEvents: "none" }}>
              {searching ? "⏳" : "🔍"}
            </span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products..."
              disabled={searching}
              style={{
                width: "100%", padding: "8px 12px 8px 34px", borderRadius: 8,
                border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit",
                outline: "none", boxSizing: "border-box" as const,
                background: searching ? "#f1f5f9" : "#f8fafc",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = "#0284c7"; e.currentTarget.style.background = "white"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#f8fafc"; }}
            />
          </div>
        </form>

        {/* Right actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          {user?.is_trade_approved && (
            <span style={{ fontSize: 11, fontWeight: 600, background: "#d1fae5", color: "#065f46", padding: "3px 8px", borderRadius: 4 }}>
              TRADE
            </span>
          )}

          <Link href="/cart" style={{ position: "relative", textDecoration: "none", display: "flex", alignItems: "center", padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0", gap: 6, color: "#475569" }}>
            <span style={{ fontSize: 16 }}>🛒</span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Cart</span>
            {totalItems > 0 && (
              <span style={{ position: "absolute", top: -6, right: -6, background: "#0284c7", color: "white", fontSize: 10, fontWeight: 700, width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {totalItems}
              </span>
            )}
          </Link>

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