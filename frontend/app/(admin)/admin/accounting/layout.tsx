"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  { title: "Sales Invoices",    href: "/admin/accounting/invoices",         icon: "🧾", color: "#0284c7" },
  { title: "Sales Returns",     href: "/admin/accounting/returns",          icon: "↩️", color: "#d97706" },
  { title: "Purchases",         href: "/admin/accounting/purchases",        icon: "📦", color: "#c2410c" },
  { title: "Purchase Returns",  href: "/admin/accounting/purchases/return", icon: "↪️", color: "#b45309" },
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
  const active = sections.find((s) => pathname.startsWith(s.href));

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 64px)" }}>

      {/* Breadcrumb — hidden on index page */}
      {!isIndex && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "10px 24px",
          borderBottom: "1px solid #f1f5f9",
          background: "#fff",
          fontSize: 13, color: "#94a3b8",
        }}>
          <Link href="/admin/accounting"
            style={{ color: "#94a3b8", textDecoration: "none" }}
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
      )}

      {/* Page content — full width */}
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}