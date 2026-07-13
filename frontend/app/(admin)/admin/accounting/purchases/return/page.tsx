"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import staffApi from "@/lib/staffApi";
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

export default function PurchaseReturnsPage() {
  const router = useRouter();
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await staffApi.get(`/purchase-returns/`);
      setReturns(Array.isArray(res.data) ? res.data : []);
    } catch { setReturns([]); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const fmt = (n: any) => `₹${parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const columns = [
    { key: "return_number", label: "Return #", render: (r: any) => <span style={{ fontWeight: 600, color: "#0284c7" }}>{r.return_number}</span> },
    { key: "return_date", label: "Date", render: (r: any) => new Date(r.return_date).toLocaleDateString("en-IN") },
    { key: "vendor_name", label: "Vendor", render: (r: any) => <span style={{ fontSize: 13 }}>{r.vendor_name || "—"}</span> },
    { key: "purchase_id", label: "Purchase", render: (r: any) => r.purchase_id ? <span style={{ fontSize: 12, color: "#64748b" }}>#{r.purchase_id}</span> : <span style={{ fontSize: 12, color: "#94a3b8" }}>Manual</span> },
    { key: "total_amount", label: "Amount", render: (r: any) => <span style={{ fontWeight: 600 }}>{fmt(r.total_amount)}</span> },
    { key: "debit_note_number", label: "Debit Note", render: (r: any) => r.debit_note_number ? <span style={{ fontSize: 12, fontWeight: 600, color: "#16a34a" }}>{r.debit_note_number}</span> : "—" },
    { key: "reason", label: "Reason", render: (r: any) => <span style={{ fontSize: 12, color: "#64748b", maxWidth: 200, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.reason || "—"}</span> },
    { key: "status", label: "Status", render: (r: any) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div style={{ padding: 32 }}>
      <PageHeader
        title="Purchase Returns"
        subtitle="Items returned to vendors and debit notes issued"
        action={<button onClick={() => router.push("/admin/accounting/purchases/return/create")} className="btn-outline">+ Create Return</button>}
      />

      <div className="card" style={{ marginTop: 20 }}>
        <DataTable columns={columns} data={returns} loading={loading} emptyText="No purchase returns found" keyField="return_number" />
      </div>
    </div>
  );
}