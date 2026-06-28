"use client";
import { useState } from "react";
import Link from "next/link";

const sections = [
  { title: "Sales Invoices",    href: "/admin/accounting/invoices",  icon: "🧾", desc: "View all customer invoices", color: "#0284c7" },
  { title: "Sales Returns",     href: "/admin/accounting/returns",   icon: "↩️", desc: "Credit notes & return approvals", color: "#d97706" },
  { title: "Receipt Vouchers",  href: "/admin/accounting/receipts",  icon: "💰", desc: "Record incoming payments", color: "#16a34a" },
  { title: "Payment Vouchers",  href: "/admin/accounting/payments",  icon: "💸", desc: "Record outgoing payments to vendors", color: "#7c3aed" },
  { title: "Journal Entries",   href: "/admin/accounting/journal",   icon: "📒", desc: "View all double-entry journal entries", color: "#0891b2" },
   { title: "Chart of Accounts",   href: "/admin/accounting/ChartOfAccounts", icon: "📊", desc: "Manage ledger accounts & account groups", color: "#0f766e" },
  { title: "Statements", href: "/admin/accounting/statement", icon: "📋", desc: "Customer & vendor account statements", color: "#0f766e" },
  ];

export default function AccountingPage() {
  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "#1e293b", margin: 0 }}>Accounting</h1>
        <p style={{ fontSize: 14, color: "#64748b", margin: "4px 0 0" }}>Manage invoices, vouchers and financial records</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        {sections.map((s) => (
          <Link key={s.href} href={s.href} style={{ textDecoration: "none" }}>
            <div className="card" style={{ padding: 24, transition: "all 0.15s", cursor: "pointer" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = s.color; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0"; (e.currentTarget as HTMLElement).style.transform = "none"; }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${s.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                  {s.icon}
                </div>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: 0 }}>{s.title}</h2>
              </div>
              <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>{s.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
