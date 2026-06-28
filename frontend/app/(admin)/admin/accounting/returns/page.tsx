"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import PageHeader from "@/components/admin/PageHeader";
import DataTable from "@/components/admin/DataTable";

function StatusBadge({ status }: { status: string }) {
  const c: Record<string, { bg: string; color: string }> = {
    requested: { bg: "#fef9c3", color: "#854d0e" },
    approved:  { bg: "#dcfce7", color: "#166534" },
    rejected:  { bg: "#fee2e2", color: "#991b1b" },
    completed: { bg: "#dbeafe", color: "#1d4ed8" },
  };
  const col = c[status] || { bg: "#f1f5f9", color: "#475569" };
  return <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: col.bg, color: col.color, textTransform: "capitalize" }}>{status}</span>;
}

export default function SalesReturnsPage() {
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [processing, setProcessing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/sales-returns/${filter !== "all" ? `?status=${filter}` : ""}`);
      setReturns(Array.isArray(res.data) ? res.data : []);
    } catch { setReturns([]); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);

  const approve = async (returnNumber: string) => {
    if (!confirm(`Approve return ${returnNumber}? A credit note will be issued.`)) return;
    setProcessing(returnNumber);
    try {
      const res = await api.patch(`/sales-returns/${returnNumber}/approve`);
      alert(`Approved! Credit note: ${res.data.credit_note_number}`);
      load();
    } catch (e: any) { alert(e.response?.data?.detail || "Failed"); }
    finally { setProcessing(null); }
  };

  const reject = async (returnNumber: string) => {
    const reason = prompt("Reason for rejection:");
    if (reason === null) return;
    setProcessing(returnNumber);
    try {
      await api.patch(`/sales-returns/${returnNumber}/reject?reason=${encodeURIComponent(reason)}`);
      load();
    } catch (e: any) { alert(e.response?.data?.detail || "Failed"); }
    finally { setProcessing(null); }
  };

  const fmt = (n: any) => `₹${parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const columns = [
    { key: "return_number", label: "Return #", render: (r: any) => <span style={{ fontWeight: 600, color: "#0284c7" }}>{r.return_number}</span> },
    { key: "return_date", label: "Date", render: (r: any) => new Date(r.return_date).toLocaleDateString("en-IN") },
    { key: "invoice_id", label: "Invoice", render: (r: any) => <span style={{ fontSize: 12, color: "#64748b" }}>#{r.invoice_id}</span> },
    { key: "total_amount", label: "Amount", render: (r: any) => <span style={{ fontWeight: 600 }}>{fmt(r.total_amount)}</span> },
    { key: "credit_note_number", label: "Credit Note", render: (r: any) => r.credit_note_number ? <span style={{ fontSize: 12, fontWeight: 600, color: "#16a34a" }}>{r.credit_note_number}</span> : "—" },
    { key: "reason", label: "Reason", render: (r: any) => <span style={{ fontSize: 12, color: "#64748b", maxWidth: 200, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.reason || "—"}</span> },
    { key: "status", label: "Status", render: (r: any) => <StatusBadge status={r.status} /> },
    { key: "actions", label: "", render: (r: any) => r.status === "requested" ? (
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => approve(r.return_number)} disabled={processing === r.return_number}
          style={{ fontSize: 12, color: "#16a34a", background: "#dcfce7", border: "none", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontWeight: 500 }}>
          ✓ Approve
        </button>
        <button onClick={() => reject(r.return_number)} disabled={processing === r.return_number}
          style={{ fontSize: 12, color: "#991b1b", background: "#fee2e2", border: "none", padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontWeight: 500 }}>
          ✕ Reject
        </button>
      </div>
    ) : null },
  ];

  return (
    <div style={{ padding: 32 }}>
      <PageHeader title="Sales Returns" subtitle="Manage customer return requests and credit notes" />
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {["all", "requested", "approved", "rejected"].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: "6px 14px", borderRadius: 20, fontSize: 13, border: "1px solid", cursor: "pointer",
            borderColor: filter === s ? "#0284c7" : "#e2e8f0",
            background: filter === s ? "#eff6ff" : "white",
            color: filter === s ? "#0284c7" : "#475569",
            fontWeight: filter === s ? 500 : 400, textTransform: "capitalize",
          }}>{s}</button>
        ))}
      </div>
      <div className="card">
        <DataTable columns={columns} data={returns} loading={loading} emptyText="No returns found" keyField="return_number" />
      </div>
    </div>
  );
}
