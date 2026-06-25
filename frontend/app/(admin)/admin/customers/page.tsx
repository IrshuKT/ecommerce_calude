"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import PageHeader from "@/components/admin/PageHeader";
import DataTable from "@/components/admin/DataTable";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/users/").then(r => setCustomers(Array.isArray(r.data) ? r.data : [])).catch(() => setCustomers([])).finally(() => setLoading(false));
  }, []);

  const columns = [
    { key: "id", label: "ID", width: 60 },
    { key: "name", label: "Name", render: (r: any) => (
  <a href={`/admin/customers/${r.id}`} style={{ fontWeight: 500, color: "#0284c7", textDecoration: "none" }}>
    {r.name}
  </a>
)},
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "role", label: "Role", render: (r: any) => <span style={{ textTransform: "capitalize", fontSize: 12, background: r.role === "admin" ? "#ede9fe" : "#f1f5f9", color: r.role === "admin" ? "#7c3aed" : "#475569", padding: "2px 8px", borderRadius: 4 }}>{r.role}</span> },
    { key: "is_active", label: "Status", render: (r: any) => <span style={{ fontSize: 12, color: r.is_active ? "#16a34a" : "#dc2626" }}>{r.is_active ? "Active" : "Inactive"}</span> },
    { key: "created_at", label: "Joined", render: (r: any) => new Date(r.created_at).toLocaleDateString("en-IN") },
  ];

  return (
    <div style={{ padding: 32 }}>
      <PageHeader title="Customers" subtitle="View registered customers" />
      <div className="card">
        <DataTable columns={columns} data={customers} loading={loading} emptyText="No customers yet" />
      </div>
    </div>
  );
}
