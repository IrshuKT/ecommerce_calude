"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  { title: "Sales Invoices",    href: "/admin/accounting/invoices",         icon: "🧾", color: "#0284c7" },
  { title: "Sales Returns",     href: "/admin/accounting/returns",          icon: "↩️", color: "#d97706" },
  { title: "Receipt Vouchers",  href: "/admin/accounting/receipts",         icon: "💰", color: "#16a34a" },
  { title: "Payment Vouchers",  href: "/admin/accounting/payments",         icon: "💸", color: "#7c3aed" },
  { title: "Journal Entries",   href: "/admin/accounting/journal",          icon: "📒", color: "#0891b2" },
  { title: "Chart of Accounts", href: "/admin/accounting/ChartOfAccounts",  icon: "📊", color: "#0f766e" },
  { title: "Statements",        href: "/admin/accounting/statement",        icon: "📋", color: "#0f766e" },
  { title: "Opening Balances",  href: "/admin/accounting/opening-balances", icon: "⚖️", color: "#6366f1" },
];

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isIndex = pathname === "/admin/accounting";

  // On index page, no sidebar — full width card grid
  if (isIndex) return <>{children}</>;

  const active = sections.find((s) => pathname.startsWith(s.href));

  return (
    <div style={{ display: "flex", minHeight: "calc(100vh - 64px)" }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 220,
        flexShrink: 0,
        background: "#fff",
        borderRight: "1px solid #e2e8f0",
        padding: "20px 0",
        position: "sticky",
        top: 64,
        height: "calc(100vh - 64px)",
        overflowY: "auto",
      }}>
        {/* Back to accounting index */}
        <Link href="/admin/accounting" style={{ textDecoration: "none" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 16px", margin: "0 8px 12px",
            borderRadius: 7, color: "#64748b", fontSize: 13,
            transition: "background 0.1s",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ fontSize: 16 }}>←</span>
            <span style={{ fontWeight: 500 }}>Accounting</span>
          </div>
        </Link>

        <div style={{ height: 1, background: "#e2e8f0", margin: "0 16px 12px" }} />

        <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 16px", marginBottom: 6 }}>
          Modules
        </p>

        {sections.map((s) => {
          const isActive = pathname.startsWith(s.href);
          return (
            <Link key={s.href} href={s.href} style={{ textDecoration: "none" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 16px", margin: "1px 8px",
                borderRadius: 7,
                background: isActive ? `${s.color}12` : "transparent",
                borderLeft: isActive ? `3px solid ${s.color}` : "3px solid transparent",
                transition: "all 0.1s",
                cursor: "pointer",
              }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "#f8fafc"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: 15 }}>{s.icon}</span>
                <span style={{
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? s.color : "#475569",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {s.title}
                </span>
              </div>
            </Link>
          );
        })}
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
        {/* Breadcrumb bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "10px 24px",
          borderBottom: "1px solid #f1f5f9",
          background: "#fff",
          fontSize: 13, color: "#94a3b8",
        }}>
          <Link href="/admin/accounting" style={{ color: "#94a3b8", textDecoration: "none" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#475569")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
          >
            Accounting
          </Link>
          <span>/</span>
          <span style={{ color: active?.color || "#1e293b", fontWeight: 600 }}>
            {active?.icon} {active?.title || ""}
          </span>
        </div>

        {/* Page content */}
        <div>{children}</div>
      </main>
    </div>
  );
}