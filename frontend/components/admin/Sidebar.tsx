"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useStaffAuthStore } from "@/store/staffAuth";
import { useRouter } from "next/navigation";
import { useSettings } from "@/app/context/SettingsContext";
import { useState, useEffect } from "react";

const accountingItems = [
  { label: "Sales Invoices",    href: "/admin/accounting/invoices",         icon: "🧾" },
  { label: "Sales Returns",     href: "/admin/accounting/returns",          icon: "↩️" },
  { label: "Purchases",  href: "/admin/purchases",  icon: "🛒" },
  { label: "Purchase Returns",  href: "/admin/accounting/purchases/return", icon: "↪️" },
  { label: "Receipt Vouchers",  href: "/admin/accounting/receipts",         icon: "💰" },
  { label: "Payment Vouchers",  href: "/admin/accounting/payments",         icon: "💸" },
  { label: "Journal Entries",   href: "/admin/accounting/journal",          icon: "📒" },
  { label: "Chart of Accounts", href: "/admin/accounting/ChartOfAccounts",  icon: "📊" },
  { label: "Statements",        href: "/admin/accounting/statement",        icon: "📋" },
  { label: "Opening Balances",  href: "/admin/accounting/opening-balances", icon: "⚖️" },
];

const posItems = [
  { label: "New Sale", href: "/admin/pos",         icon: "🧾" },
  { label: "History",  href: "/admin/pos/history",  icon: "🕘" },
];

// Maps an expandable nav item's key to its submenu items and active-path prefix
const subMenus: Record<string, { items: { label: string; href: string; icon: string }[]; activePrefix: string }> = {
  accounting: { items: accountingItems, activePrefix: "/admin/accounting" },
  pos:        { items: posItems,        activePrefix: "/admin/pos" },
};

// Reports has a second nesting level (group -> items), so it's handled separately
// from subMenus. Each item links to /admin/reports?report=<key>, matching the
// keys ReportsPage expects (pl, tb, bs, cashbook, daybook, ledger, stock, ...).
const reportGroups: { group: string; icon: string; items: { key: string; label: string }[] }[] = [
  {
    group: "Accounting",
    icon: "📊",
    items: [
      { key: "pl",       label: "Profit & Loss" },
      { key: "tb",       label: "Trial Balance" },
      { key: "bs",       label: "Balance Sheet" },
      { key: "cashbook", label: "Cash Book"     },
      { key: "daybook",  label: "Day Book"      },
      { key: "ledger",   label: "Ledger"        },
    ],
  },
  {
    group: "Inventory",
    icon: "📦",
    items: [
      { key: "stock",      label: "Stock Report"    },
      { key: "stockvalue", label: "Stock Valuation" },
      { key: "fastmoving",  label: "Fast Moving Products" },
    { key: "profitable",  label: "Profitable Products"  },
    ],
  },
  {
    group: "GST Returns",
    icon: "🧾",
    items: [
      { key: "gstr1",  label: "GSTR-1"  },
      { key: "gstr3b", label: "GSTR-3B" },
    ],
  },
];

const nav = [
  { key: "dashboard",  label: "Dashboard",  href: "/admin",           icon: "▦" },
  { key: "pos",        label: "POS Sale",   href: "/admin/pos",       icon: "🧾", expandable: true },
  { key: "products",   label: "Products",   href: "/admin/products",   icon: "🪟" },
  { key: "orders",     label: "Orders",     href: "/admin/orders",     icon: "📦" },
  { key: "customers",  label: "Customers",  href: "/admin/customers",  icon: "👥" },
  { key: "vendors",    label: "Vendors",    href: "/admin/vendors",     icon: "🏭" },
  { key: "users",      label: "Users",      href: "/admin/users",       icon: "🔑" },
  { key: "accounting", label: "Accounting", href: "/admin/accounting", icon: "🧾", expandable: true },
  { key: "reports",    label: "Reports",    href: "/admin/reports",    icon: "📊", expandable: true },
  { key: "coupons",    label: "Coupons",    href: "/admin/coupons",    icon: "🏷️" },
  { key: "settings",   label: "Settings",   href: "/admin/settings",   icon: "⚙️" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user: customerUser, logout: customerLogout } = useAuthStore();
  const { user: staffUser, menus: staffMenus, logout: staffLogout } = useStaffAuthStore();
  const router = useRouter();
  const settings = useSettings();

  const isCustomerAdmin = customerUser?.role === "admin";

  const visibleNav = isCustomerAdmin
    ? nav
    : nav.filter((item) => staffMenus.includes(item.key));

  const displayName = customerUser?.name || staffUser?.name || "";
  const displayRole = isCustomerAdmin ? "Administrator" : (staffUser?.role || "");

  // openMenus tracks expand/collapse state per expandable nav key (accounting, pos, reports, ...)
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  // openReportGroups tracks expand/collapse per report group (Accounting, Inventory, GST Returns)
  const [openReportGroups, setOpenReportGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(reportGroups.map((g) => [g.group, true]))
  );

  const activeReportKey = pathname.startsWith("/admin/reports")
    ? (searchParams.get("report") || "pl")
    : null;

  useEffect(() => {
    // Auto-expand whichever expandable section matches the current path
    const updates: Record<string, boolean> = {};
    for (const key of Object.keys(subMenus)) {
      if (pathname.startsWith(subMenus[key].activePrefix)) updates[key] = true;
    }
    if (pathname.startsWith("/admin/reports")) updates["reports"] = true;
    if (Object.keys(updates).length) {
      setOpenMenus((prev) => ({ ...prev, ...updates }));
    }
  }, [pathname]);

  useEffect(() => {
    // Auto-expand whichever report group contains the active report
    if (!activeReportKey) return;
    const group = reportGroups.find((g) => g.items.some((i) => i.key === activeReportKey));
    if (group) {
      setOpenReportGroups((prev) => ({ ...prev, [group.group]: true }));
    }
  }, [activeReportKey]);

  const toggleMenu = (key: string) => {
    setOpenMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleReportGroup = (group: string) => {
    setOpenReportGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const handleLogout = () => {
    if (isCustomerAdmin) { customerLogout(); window.location.href = "/"; }
    else { staffLogout(); window.location.href = "/staff-login"; }
  };

  const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8000";

  return (
    <aside style={{
      width: 240, background: "white", borderRight: "1px solid #e2e8f0",
      display: "flex", flexDirection: "column", height: "100vh",
      position: "sticky", top: 0,
    }}>
      <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: 7, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
            {settings.logo_url
              ? <img src={`${API_BASE}${settings.logo_url}`} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              : <div style={{ width: 30, height: 30, borderRadius: 7, background: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                    <rect x="2" y="2" width="6" height="6" rx="1" fill="white" opacity="0.9"/>
                    <rect x="10" y="2" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
                    <rect x="2" y="10" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
                    <rect x="10" y="10" width="6" height="6" rx="1" fill="white" opacity="0.9"/>
                  </svg>
                </div>
            }
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1e293b" }}>
              {settings.company_name || "Admin Panel"}
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>Admin Panel</div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
        {visibleNav.map((item) => {
          const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));

          if (item.key === "reports" && item.expandable) {
            const isOpen = !!openMenus.reports;
            return (
              <div key={item.key}>
                <div
                  onClick={() => toggleMenu("reports")}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "9px 12px", borderRadius: 8, marginBottom: 2,
                    fontSize: 14, fontWeight: active ? 500 : 400,
                    color: active ? "#0284c7" : "#475569",
                    background: active ? "#eff6ff" : "transparent",
                    cursor: "pointer", transition: "all 0.15s",
                    userSelect: "none",
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#f8fafc"; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 16 }}>{item.icon}</span>
                    {item.label}
                  </div>
                  <span style={{
                    fontSize: 10, color: "#94a3b8",
                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                    display: "inline-block",
                  }}>▼</span>
                </div>

                {isOpen && (
                  <div style={{
                    marginLeft: 12,
                    borderLeft: "2px solid #e2e8f0",
                    paddingLeft: 8,
                    marginBottom: 4,
                    overflow: "hidden",
                  }}>
                    {reportGroups.map((group) => {
                      const groupOpen = !!openReportGroups[group.group];
                      return (
                        <div key={group.group}>
                          <div
                            onClick={() => toggleReportGroup(group.group)}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "6px 10px", borderRadius: 6, marginBottom: 1,
                              fontSize: 12, fontWeight: 600, color: "#64748b",
                              cursor: "pointer", userSelect: "none",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 13 }}>{group.icon}</span>
                              {group.group}
                            </div>
                            <span style={{
                              fontSize: 9, color: "#94a3b8",
                              transform: groupOpen ? "rotate(180deg)" : "rotate(0deg)",
                              transition: "transform 0.2s",
                              display: "inline-block",
                            }}>▼</span>
                          </div>

                          {groupOpen && group.items.map((r) => {
                            const subActive = activeReportKey === r.key;
                            return (
                              <Link key={r.key} href={`/admin/reports?report=${r.key}`} style={{ textDecoration: "none" }}>
                                <div style={{
                                  display: "flex", alignItems: "center", gap: 8,
                                  padding: "7px 10px 7px 20px", borderRadius: 6, marginBottom: 1,
                                  fontSize: 13,
                                  fontWeight: subActive ? 600 : 400,
                                  color: subActive ? "#0284c7" : "#64748b",
                                  background: subActive ? "#eff6ff" : "transparent",
                                  transition: "all 0.1s",
                                  borderLeft: subActive ? "2px solid #0284c7" : "2px solid transparent",
                                }}
                                  onMouseEnter={(e) => { if (!subActive) e.currentTarget.style.background = "#f8fafc"; }}
                                  onMouseLeave={(e) => { if (!subActive) e.currentTarget.style.background = "transparent"; }}
                                >
                                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {r.label}
                                  </span>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          if (item.expandable) {
            const sub = subMenus[item.key];
            const isOpen = !!openMenus[item.key];
            return (
              <div key={item.key}>
                <div
                  onClick={() => toggleMenu(item.key)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "9px 12px", borderRadius: 8, marginBottom: 2,
                    fontSize: 14, fontWeight: active ? 500 : 400,
                    color: active ? "#0284c7" : "#475569",
                    background: active ? "#eff6ff" : "transparent",
                    cursor: "pointer", transition: "all 0.15s",
                    userSelect: "none",
                  }}
                  onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#f8fafc"; }}
                  onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 16 }}>{item.icon}</span>
                    {item.label}
                  </div>
                  <span style={{
                    fontSize: 10, color: "#94a3b8",
                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                    display: "inline-block",
                  }}>▼</span>
                </div>

                {isOpen && sub && (
                  <div style={{
                    marginLeft: 12,
                    borderLeft: "2px solid #e2e8f0",
                    paddingLeft: 8,
                    marginBottom: 4,
                    overflow: "hidden",
                  }}>
                    {sub.items.map((s) => {
                      const subActive = pathname === s.href || pathname.startsWith(s.href + "/");
                      return (
                        <Link key={s.href} href={s.href} style={{ textDecoration: "none" }}>
                          <div style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "7px 10px", borderRadius: 6, marginBottom: 1,
                            fontSize: 13,
                            fontWeight: subActive ? 600 : 400,
                            color: subActive ? "#0284c7" : "#64748b",
                            background: subActive ? "#eff6ff" : "transparent",
                            transition: "all 0.1s",
                            borderLeft: subActive ? "2px solid #0284c7" : "2px solid transparent",
                          }}
                            onMouseEnter={(e) => { if (!subActive) e.currentTarget.style.background = "#f8fafc"; }}
                            onMouseLeave={(e) => { if (!subActive) e.currentTarget.style.background = "transparent"; }}
                          >
                            <span style={{ fontSize: 13 }}>{s.icon}</span>
                            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {s.label}
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

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

      <div style={{ padding: "12px 16px", borderTop: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 13, fontWeight: 600 }}>
            {displayName?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>{displayName}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "capitalize" }}>{displayRole}</div>
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