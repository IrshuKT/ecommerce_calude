"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  { title: "Profit & Loss", href: "/admin/reports/profit-loss", icon: "📈", color: "#16a34a" },
  { title: "Trial Balance", href: "/admin/reports/trial-balance", icon: "⚖️", color: "#0284c7" },
  { title: "Balance Sheet", href: "/admin/reports/balance-sheet", icon: "🏦", color: "#7c3aed" },

  { title: "Cash Book", href: "/admin/reports/cash-book", icon: "💰", color: "#0891b2" },
  { title: "Day Book", href: "/admin/reports/day-book", icon: "📒", color: "#f59e0b" },
  { title: "Ledger", href: "/admin/reports/ledger", icon: "📚", color: "#0f766e" },

  { title: "Stock Report", href: "/admin/reports/stock-report", icon: "📦", color: "#16a34a" },
  { title: "Stock Valuation", href: "/admin/reports/stock-value", icon: "📊", color: "#2563eb" },

  { title: "GSTR-1", href: "/admin/reports/gstr1", icon: "🧾", color: "#dc2626" },
  { title: "GSTR-3B", href: "/admin/reports/gstr3b", icon: "📄", color: "#9333ea" },
];

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isIndex = pathname === "/admin/reports";

  const active = sections.find((s) => pathname.startsWith(s.href));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "calc(100vh - 64px)",
      }}
    >
      {!isIndex && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 24px",
            borderBottom: "1px solid #f1f5f9",
            background: "#fff",
            fontSize: 13,
            color: "#94a3b8",
          }}
        >
          <Link
            href="/admin/reports"
            style={{
              color: "#94a3b8",
              textDecoration: "none",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "#475569")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "#94a3b8")
            }
          >
            Reports
          </Link>

          <span>/</span>

          <span
            style={{
              color: active?.color || "#1e293b",
              fontWeight: 600,
            }}
          >
            {active?.icon} {active?.title}
          </span>
        </div>
      )}

      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}