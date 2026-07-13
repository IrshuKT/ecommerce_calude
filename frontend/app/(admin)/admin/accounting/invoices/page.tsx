"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import staffApi from "@/lib/staffApi";
import PageHeader from "@/components/admin/PageHeader";
import DataTable from "@/components/admin/DataTable";
import { useSettings } from "@/hooks/useSettings";
import { ManualInvoiceButton } from "./InvoiceActions";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8000";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    draft:          { bg: "#f1f5f9", color: "#475569" },
    confirmed:      { bg: "#dbeafe", color: "#1d4ed8" },
    partially_paid: { bg: "#fef9c3", color: "#854d0e" },
    paid:           { bg: "#dcfce7", color: "#166534" },
    cancelled:      { bg: "#fee2e2", color: "#991b1b" },
  };
  const c = colors[status] || { bg: "#f1f5f9", color: "#475569" };
  return (
    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: c.bg, color: c.color, textTransform: "capitalize" }}>
      {status.replace("_", " ")}
    </span>
  );
}

export default function InvoicesPage() {
  const settings = useSettings();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const router = useRouter();

  const load = async () => {
    setLoading(true);
    try {
      const res = await staffApi.get(`/invoices/?${statusFilter !== "all" ? `status=${statusFilter}` : ""}&limit=50`);
      setInvoices(Array.isArray(res.data) ? res.data : []);
    } catch { setInvoices([]); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const fmt = (n: any) => `₹${parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const confirmInvoice = async (invoiceNumber: string) => {
  if (!confirm(`Confirm invoice ${invoiceNumber}? This will deduct stock and post accounting entries. This cannot be undone.`)) return;
  try {
    const res = await staffApi.post(`/invoices/${encodeURIComponent(invoiceNumber)}/confirm`);
    alert(`Invoice confirmed. Voucher: ${res.data.voucher_number}`);
    load();
  } catch (err: any) {
    alert(err?.response?.data?.detail || "Failed to confirm invoice");
  }
};

  const columns = [
    { key: "invoice_number", label: "Invoice #", render: (r: any) => (
  <span style={{ fontWeight: 600, color: "#0284c7", cursor: "pointer" }}
    onClick={() => router.push(`/admin/accounting/invoices/${encodeURIComponent(r.invoice_number)}`)}>
    {r.invoice_number}
  </span>
)},
    { key: "invoice_date", label: "Date", render: (r: any) => new Date(r.invoice_date).toLocaleDateString("en-IN") },
    { key: "billing_name", label: "Customer" },
    { key: "billing_city", label: "City" },
    { key: "is_interstate", label: "GST Type", render: (r: any) => (
      <span style={{ fontSize: 12, background: r.is_interstate ? "#eff6ff" : "#f0fdf4", color: r.is_interstate ? "#0284c7" : "#16a34a", padding: "2px 8px", borderRadius: 4 }}>
        {r.is_interstate ? "IGST" : "CGST+SGST"}
      </span>
    )},
    { key: "grand_total", label: "Total", render: (r: any) => <span style={{ fontWeight: 600 }}>{fmt(r.grand_total)}</span> },
    { key: "balance_due", label: "Balance", render: (r: any) => (
      <span style={{ color: parseFloat(r.balance_due) > 0 ? "#dc2626" : "#16a34a", fontWeight: 500 }}>
        {fmt(r.balance_due)}
      </span>
    )},
    { key: "status", label: "Status", render: (r: any) => <StatusBadge status={r.status} /> },
    { key: "actions", label: "", render: (r: any) => (
  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
    {r.status === "draft" && (
      <button onClick={() => confirmInvoice(r.invoice_number)}
        style={{ fontSize: 12, color: "#166534", background: "#dcfce7", border: "none", cursor: "pointer", padding: "4px 10px", borderRadius: 6 }}>
        Confirm →
      </button>
    )}
    <button onClick={() => router.push(`/admin/accounting/invoices/${encodeURIComponent(r.invoice_number)}`)}
      style={{ fontSize: 12, color: "#0284c7", background: "none", border: "none", cursor: "pointer" }}>
      View →
    </button>
  </div>
)},
  ];

  return (
    <div style={{ padding: 32 }}>
      {/* ── header row with button ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <PageHeader title="Sales Invoices" subtitle="Auto-generated invoices from orders" />
        <ManualInvoiceButton />   {/* ← use it here */}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {["all", "draft", "confirmed", "partially_paid", "paid", "cancelled"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{
            padding: "6px 14px", borderRadius: 20, fontSize: 13, border: "1px solid", cursor: "pointer",
            borderColor: statusFilter === s ? "#0284c7" : "#e2e8f0",
            background: statusFilter === s ? "#eff6ff" : "white",
            color: statusFilter === s ? "#0284c7" : "#475569",
            fontWeight: statusFilter === s ? 500 : 400,
            textTransform: "capitalize",
          }}>{s.replace("_", " ")}</button>
        ))}
      </div>

      <div className="card">
        <DataTable columns={columns} data={invoices} loading={loading} emptyText="No invoices yet." keyField="invoice_number" />
      </div>
    </div>
  );
}