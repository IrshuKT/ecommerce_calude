"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import PageHeader from "@/components/admin/PageHeader";
import DataTable from "@/components/admin/DataTable";

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const router = useRouter();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/products/?search=${search}&limit=50`);
      setProducts(res.data?.items || []);
    } catch { setProducts([]); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search]);

  const toggleActive = async (id: number, current: boolean) => {
    try {
      await api.patch(`/products/${id}`, { is_active: !current });
      load();
    } catch { alert("Failed to update"); }
  };

  const columns = [
    { key: "primary_image", label: "", width: 56, render: (r: any) => (
      <div style={{ width: 40, height: 40, borderRadius: 6, background: "#f1f5f9", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
        {r.primary_image ? <img src={r.primary_image} alt={r.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🪟"}
      </div>
    )},
    { key: "name", label: "Product", render: (r: any) => <span style={{ fontWeight: 500 }}>{r.name}</span> },
    { key: "price_type", label: "Price Type", render: (r: any) => <span style={{ fontSize: 12, background: "#f1f5f9", padding: "2px 8px", borderRadius: 4, textTransform: "uppercase" }}>{r.price_type}</span> },
    { key: "min_price", label: "From", render: (r: any) => r.min_price ? `₹${parseFloat(r.min_price).toLocaleString("en-IN")}` : "—" },
    { key: "is_featured", label: "Featured", render: (r: any) => r.is_featured ? <span style={{ color: "#d97706" }}>⭐</span> : "—" },
    { key: "is_active", label: "Status", render: (r: any) => (
      <button onClick={() => toggleActive(r.id, r.is_active)} style={{
        padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer",
        background: r.is_active ? "#dcfce7" : "#fee2e2", color: r.is_active ? "#166534" : "#991b1b",
      }}>{r.is_active ? "Active" : "Inactive"}</button>
    )},
    { key: "actions", label: "", render: (r: any) => (
      <button onClick={() => router.push(`/admin/products/${r.id}`)} style={{ fontSize: 12, color: "#0284c7", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}>
        Edit →
      </button>
    )},
  ];

  return (
    <div style={{ padding: 32 }}>
      <PageHeader title="Products" subtitle="Manage your glass product catalog"
        action={<button className="btn-primary" onClick={() => router.push("/admin/products/new")}>+ Add Product</button>} />

      <div style={{ marginBottom: 16 }}>
        <input className="input-field" style={{ maxWidth: 320 }} placeholder="Search products..." value={search}
          onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card">
        <DataTable columns={columns} data={products} loading={loading} emptyText="No products found" />
      </div>
    </div>
  );
}
