"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import staffApi from "@/lib/staffApi";
import PageHeader from "@/components/admin/PageHeader";
import DataTable from "@/components/admin/DataTable";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8000";

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const [showInactive, setShowInactive] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await staffApi.get(`/products/admin/?search=${search}&limit=100${showInactive ? "&include_inactive=true" : ""}`);
      setProducts(res.data?.items || []);
    } catch { setProducts([]); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, showInactive]);

  const toggleActive = async (id: number, current: boolean) => {
    try {
      await staffApi.patch(`/products/${id}`, { is_active: !current });
      load();
    } catch { alert("Failed to update"); }
  };

  const columns = [
    {
      key: "serial", label: "#", width: 48, render: (r: any, index: number) => (
        <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>
          {index + 1}
        </span>
      )
    },
    {
      key: "name", label: "Product", render: (r: any) => (
        <span onClick={() => router.push(`/admin/products/${r.id}`)}
          style={{ fontWeight: 500, cursor: "pointer", color: "#1e293b" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#0284c7")}
          onMouseLeave={e => (e.currentTarget.style.color = "#1e293b")}>
          {r.name}
        </span>
      )
    },
    { key: "price_type", label: "Price Type", render: (r: any) => <span style={{ fontSize: 12, background: "#f1f5f9", padding: "2px 8px", borderRadius: 4, textTransform: "uppercase" }}>{r.price_type}</span> },
    { key: "min_price", label: "From", render: (r: any) => r.min_price ? `₹${parseFloat(r.min_price).toLocaleString("en-IN")}` : "—" },
    {
      key: "stock", label: "Stock", render: (r: any) => {
        const totalStock = r.variants?.reduce((sum: number, v: any) => sum + (v.stock_qty || 0), 0) ?? null;
        const variantCount = r.variants?.length || 0;

        if (totalStock === null) return <span style={{ color: "#94a3b8" }}>—</span>;

        return (
          <div>
            <span style={{
              fontWeight: 600, fontSize: 14,
              color: totalStock > 10 ? "#16a34a" : totalStock > 0 ? "#d97706" : "#dc2626"
            }}>
              {totalStock}
            </span>
            {variantCount > 1 && (
              <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 4 }}>
                ({variantCount} variants)
              </span>
            )}
          </div>
        );
      }
    },
    { key: "is_featured", label: "Featured", render: (r: any) => r.is_featured ? <span style={{ color: "#d97706" }}>⭐</span> : "—" },
    {
      key: "is_active", label: "Status", render: (r: any) => (
        <button onClick={() => toggleActive(r.id, r.is_active)} style={{
          padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer",
          background: r.is_active ? "#dcfce7" : "#fee2e2", color: r.is_active ? "#166534" : "#991b1b",
        }}>{r.is_active ? "Active" : "Inactive"}</button>
      )
    },
    {
      key: "actions", label: "", render: (r: any) => (
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => router.push(`/admin/products/${r.id}`)}
            style={{ fontSize: 12, color: "#475569", background: "#f1f5f9", border: "none", cursor: "pointer", padding: "4px 10px", borderRadius: 6 }}>
            View
          </button>
          <button onClick={() => router.push(`/admin/products/${r.id}/edit`)}
            style={{ fontSize: 12, color: "#0284c7", background: "#eff6ff", border: "none", cursor: "pointer", padding: "4px 10px", borderRadius: 6 }}>
            Edit →
          </button>
        </div>
      )
    },

  ];

  return (
    <div style={{ padding: 22 }}>
      <PageHeader title="Products" subtitle="Manage your product catalog"
        action={<button className="btn-primary" onClick={() => router.push("/admin/products/new")}>+ Add Product</button>} />

      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <input className="input-field" style={{ maxWidth: 320 }} placeholder="Search products..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <button
          onClick={() => setShowInactive(!showInactive)}
          style={{
            padding: "8px 14px", borderRadius: 7, fontSize: 13, cursor: "pointer",
            border: "1px solid #e2e8f0",
            background: showInactive ? "#fef9c3" : "white",
            color: showInactive ? "#854d0e" : "#475569",
          }}>
          {showInactive ? "👁 Showing Inactive" : "Show Inactive"}
        </button>
      </div>

      <div className="card">
        <DataTable columns={columns} data={products} loading={loading} emptyText="No products found" />
      </div>
    </div>
  );
}
