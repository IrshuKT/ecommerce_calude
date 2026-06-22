"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import PageHeader from "@/components/admin/PageHeader";
import DataTable from "@/components/admin/DataTable";

const STATUSES = ["all","placed","confirmed","processing","shipped","delivered","cancelled"];

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    placed:     { bg: "#fef9c3", color: "#854d0e" },
    confirmed:  { bg: "#dbeafe", color: "#1d4ed8" },
    processing: { bg: "#ede9fe", color: "#6d28d9" },
    shipped:    { bg: "#d1fae5", color: "#065f46" },
    delivered:  { bg: "#dcfce7", color: "#166534" },
    cancelled:  { bg: "#fee2e2", color: "#991b1b" },
  };
  const c = colors[status] || { bg: "#f1f5f9", color: "#475569" };
  return <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: c.bg, color: c.color, textTransform: "capitalize" }}>{status}</span>;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [updating, setUpdating] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/orders/?${statusFilter !== "all" ? `status=${statusFilter}` : ""}`);
      setOrders(Array.isArray(res.data) ? res.data : res.data?.items || []);
    } catch { setOrders([]); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const updateStatus = async (orderNumber: string, status: string) => {
    setUpdating(orderNumber);
    try {
      await api.patch(`/orders/${orderNumber}/status`, { status });
      await load();
    } catch (e) { alert("Failed to update status"); } finally { setUpdating(null); }
  };

  const columns = [
    { key: "order_number", label: "Order #", render: (r: any) => <span style={{ fontWeight: 600, color: "#0284c7" }}>{r.order_number}</span> },
    { key: "shipping_name", label: "Customer" },
    { key: "shipping_city", label: "City" },
    { key: "total_amount", label: "Amount", render: (r: any) => <span style={{ fontWeight: 600 }}>₹{parseFloat(r.total_amount).toLocaleString("en-IN")}</span> },
    { key: "payment_method", label: "Payment", render: (r: any) => <span style={{ textTransform: "uppercase", fontSize: 12, background: "#f1f5f9", padding: "2px 8px", borderRadius: 4 }}>{r.payment_method}</span> },
    { key: "status", label: "Status", render: (r: any) => <StatusBadge status={r.status} /> },
    { key: "created_at", label: "Date", render: (r: any) => new Date(r.created_at).toLocaleDateString("en-IN") },
    { key: "actions", label: "Action", render: (r: any) => (
      <select value={r.status} disabled={updating === r.order_number}
        onChange={(e) => updateStatus(r.order_number, e.target.value)}
        style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0", background: "white", cursor: "pointer" }}>
        {["placed","confirmed","processing","shipped","delivered","cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    )},
  ];

  return (
    <div style={{ padding: 32 }}>
      <PageHeader title="Orders" subtitle="Manage and update customer orders" />

      {/* Status filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{
            padding: "6px 14px", borderRadius: 20, fontSize: 13, border: "1px solid",
            borderColor: statusFilter === s ? "#0284c7" : "#e2e8f0",
            background: statusFilter === s ? "#eff6ff" : "white",
            color: statusFilter === s ? "#0284c7" : "#475569",
            cursor: "pointer", textTransform: "capitalize", fontWeight: statusFilter === s ? 500 : 400,
          }}>{s}</button>
        ))}
      </div>

      <div className="card">
        <DataTable columns={columns} data={orders} loading={loading} emptyText="No orders found" keyField="order_number" />
      </div>
    </div>
  );
}
