"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";

const navItems = [
  { label: "Dashboard",  href: "/account",           icon: "▦" },
  { label: "My Orders",  href: "/account/orders",    icon: "📦" },
  { label: "Invoices",   href: "/account/invoices",  icon: "🧾" },
  { label: "Addresses",  href: "/account/addresses", icon: "📍" },
  { label: "Profile",    href: "/account/profile",   icon: "👤" },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setHydrated(true); }, []);
  useEffect(() => {
    if (hydrated && !user) router.replace("/login");
  }, [hydrated, user]);

  if (!hydrated || !user) return null;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24 }}>
        {/* Sidebar */}
        <aside>
          {/* User card */}
          <div className="card" style={{ padding: 20, marginBottom: 16, textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 22, fontWeight: 700, margin: "0 auto 10px" }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: "0 0 2px" }}>{user.name}</p>
            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 8px" }}>{user.role === "admin" ? "Administrator" : "Customer"}</p>
            {(user as any).is_trade_approved && (
              <span style={{ fontSize: 11, fontWeight: 700, background: "#d1fae5", color: "#065f46", padding: "3px 10px", borderRadius: 20 }}>
                ✓ Trade Account
              </span>
            )}
          </div>

          {/* Nav */}
          <div className="card" style={{ overflow: "hidden" }}>
            {navItems.map((item, i) => {
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 16px", fontSize: 14, textDecoration: "none",
                  borderBottom: i < navItems.length - 1 ? "1px solid #f1f5f9" : "none",
                  background: active ? "#eff6ff" : "white",
                  color: active ? "#0284c7" : "#475569",
                  fontWeight: active ? 500 : 400,
                }}>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
            <button onClick={() => { logout(); router.push("/login"); }} style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%",
              padding: "12px 16px", fontSize: 14, color: "#dc2626", background: "#fff5f5",
              border: "none", cursor: "pointer", borderTop: "1px solid #fee2e2",
            }}>
              <span>🚪</span> Sign Out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main>{children}</main>
      </div>
    </div>
  );
}
