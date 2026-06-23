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
