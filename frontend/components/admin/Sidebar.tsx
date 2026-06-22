"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";

const nav = [
  { label: "Dashboard",   href: "/admin",             icon: "▦" },
  { label: "Products",    href: "/admin/products",     icon: "🪟" },
  { label: "Orders",      href: "/admin/orders",       icon: "📦" },
  { label: "Customers",   href: "/admin/customers",    icon: "👥" },
  { label: "Vendors",     href: "/admin/vendors",      icon: "🏭" },
  { label: "Purchases",   href: "/admin/purchases",    icon: "🛒" },
  { label: "Accounting",  href: "/admin/accounting",   icon: "🧾" },
  { label: "Reports",     href: "/admin/reports",      icon: "📊" },
  { label: "Coupons",     href: "/admin/coupons",      icon: "🏷️" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => { logout(); router.replace("/login"); };

  return (
    <aside style={{
      width: 240, background: "white", borderRight: "1px solid #e2e8f0",
      display: "flex", flexDirection: "column", height: "100vh",
      position: "sticky", top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <rect x="2" y="2" width="6" height="6" rx="1" fill="white" opacity="0.9"/>
              <rect x="10" y="2" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
              <rect x="2" y="10" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
              <rect x="10" y="10" width="6" height="6" rx="1" fill="white" opacity="0.9"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1e293b" }}>GlassStore</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>Admin Panel</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 12px", borderRadius: 8, marginBottom: 2,
              fontSize: 14, fontWeight: active ? 500 : 400,
              color: active ? "#0284c7" : "#475569",
              background: active ? "#eff6ff" : "transparent",
              textDecoration: "none", transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 13, fontWeight: 600 }}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>{user?.name}</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>Administrator</div>
          </div>
        </div>
        <button onClick={handleLogout} style={{
          width: "100%", padding: "8px", borderRadius: 7, border: "1px solid #e2e8f0",
          background: "white", color: "#64748b", fontSize: 13, cursor: "pointer",
          transition: "all 0.15s",
        }}>
          Sign out
        </button>
      </div>
    </aside>
  );
}
