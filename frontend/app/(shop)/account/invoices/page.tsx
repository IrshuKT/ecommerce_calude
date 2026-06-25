"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";

function InvoicesContent() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();

  useEffect(() => {
    api.get("/invoices/my").then(r => setInvoices(Array.isArray(r.data) ? r.data : [])).catch(() => setInvoices([])).finally(() => setLoading(false));
  }, []);

  const fmt = (n: any) => `₹${parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", margin: "0 0 20px" }}>My Invoices</h1>
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>Loading invoices...</div>
      ) : invoices.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🧾</div>
          <p style={{ color: "#64748b" }}>No invoices yet. Place an order to get started.</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                {["Invoice #", "Date", "Amount", "GST", "Status", ""].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv: any) => {
                const statusColors: Record<string, { bg: string; color: string }> = {
                  confirmed:      { bg: "#dbeafe", color: "#1d4ed8" },
                  partially_paid: { bg: "#fef9c3", color: "#854d0e" },
                  paid:           { bg: "#dcfce7", color: "#166534" },
                  cancelled:      { bg: "#fee2e2", color: "#991b1b" },
                };
                const c = statusColors[inv.status] || { bg: "#f1f5f9", color: "#475569" };
                const totalTax = parseFloat(inv.cgst_amount || 0) + parseFloat(inv.sgst_amount || 0) + parseFloat(inv.igst_amount || 0);
                return (
                  <tr key={inv.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "#0284c7" }}>{inv.invoice_number}</td>
                    <td style={{ padding: "12px 16px", color: "#475569" }}>{new Date(inv.invoice_date).toLocaleDateString("en-IN", { dateStyle: "medium" })}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 600 }}>{fmt(inv.grand_total)}</td>
                    <td style={{ padding: "12px 16px", color: "#64748b" }}>{fmt(totalTax)}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 12, fontWeight: 500, padding: "3px 10px", borderRadius: 20, background: c.bg, color: c.color, textTransform: "capitalize" }}>
                        {inv.status.replace("_", " ")}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <Link href={`/account/invoices/${inv.invoice_number}`}
                        style={{ fontSize: 13, color: "#0284c7", textDecoration: "none", padding: "5px 12px", border: "1px solid #bfdbfe", borderRadius: 6 }}>
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function InvoicesPage() {
  return <Suspense fallback={<div style={{ padding: 48, textAlign: "center", color: "#94a3b8" }}>Loading...</div>}><InvoicesContent /></Suspense>;
}
