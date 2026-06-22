"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import PageHeader from "@/components/admin/PageHeader";
import DataTable from "@/components/admin/DataTable";

function StatusBadge({ status }: { status: string }) {
  const c: Record<string, {bg:string;color:string}> = {
    draft:     { bg: "#f1f5f9", color: "#475569" },
    ordered:   { bg: "#dbeafe", color: "#1d4ed8" },
    received:  { bg: "#dcfce7", color: "#166534" },
    cancelled: { bg: "#fee2e2", color: "#991b1b" },
  };
  const col = c[status] || c.draft;
  return <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: col.bg, color: col.color, textTransform: "capitalize" }}>{status}</span>;
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ vendor_id: "", purchase_date: new Date().toISOString().split("T")[0], vendor_invoice_number: "", notes: "" });
  const [items, setItems] = useState([{ product_name: "", quantity: "1", unit_price: "", gst_rate: "18", unit: "Nos" }]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [pr, vr] = await Promise.all([api.get("/purchases/"), api.get("/vendors/")]);
      setPurchases(Array.isArray(pr.data) ? pr.data : pr.data?.items || []);
      setVendors(vr.data || []);
    } catch { setPurchases([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const addItem = () => setItems([...items, { product_name: "", quantity: "1", unit_price: "", gst_rate: "18", unit: "Nos" }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, key: string, val: string) => setItems(items.map((item, idx) => idx === i ? { ...item, [key]: val } : item));

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/purchases/", {
        ...form, vendor_id: parseInt(form.vendor_id),
        items: items.map(i => ({ ...i, quantity: parseFloat(i.quantity), unit_price: parseFloat(i.unit_price), gst_rate: parseFloat(i.gst_rate) })),
      });
      setShowForm(false);
      load();
    } catch (e: any) { alert(e.response?.data?.detail || "Failed to save"); } finally { setSaving(false); }
  };

  const markReceived = async (num: string) => {
    try { await api.patch(`/purchases/${num}/receive`); load(); }
    catch { alert("Failed to mark received"); }
  };

  const columns = [
    { key: "purchase_number", label: "Purchase #", render: (r: any) => <span style={{ fontWeight: 600, color: "#0284c7" }}>{r.purchase_number}</span> },
    { key: "vendor_id", label: "Vendor", render: (r: any) => vendors.find(v => v.id === r.vendor_id)?.name || r.vendor_id },
    { key: "purchase_date", label: "Date", render: (r: any) => new Date(r.purchase_date).toLocaleDateString("en-IN") },
    { key: "grand_total", label: "Total", render: (r: any) => <span style={{ fontWeight: 600 }}>₹{parseFloat(r.grand_total).toLocaleString("en-IN")}</span> },
    { key: "balance_due", label: "Balance", render: (r: any) => <span style={{ color: parseFloat(r.balance_due) > 0 ? "#dc2626" : "#16a34a" }}>₹{parseFloat(r.balance_due).toLocaleString("en-IN")}</span> },
    { key: "status", label: "Status", render: (r: any) => <StatusBadge status={r.status} /> },
    { key: "actions", label: "", render: (r: any) => r.status === "ordered" ? (
      <button onClick={() => markReceived(r.purchase_number)} style={{ fontSize: 12, color: "#16a34a", background: "#dcfce7", border: "none", padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>
        Mark Received
      </button>
    ) : null },
  ];

  return (
    <div style={{ padding: 32 }}>
      <PageHeader title="Purchases" subtitle="Track stock purchases from vendors"
        action={<button className="btn-primary" onClick={() => setShowForm(true)}>+ New Purchase</button>} />

      {showForm && (
        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>New Purchase Order</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
            <div>
              <label className="label">Vendor*</label>
              <select className="input-field" value={form.vendor_id} onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}>
                <option value="">Select vendor</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Purchase Date*</label>
              <input type="date" className="input-field" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Vendor Invoice No.</label>
              <input className="input-field" placeholder="Eg: VND/2024/001" value={form.vendor_invoice_number} onChange={(e) => setForm({ ...form, vendor_invoice_number: e.target.value })} />
            </div>
          </div>

          <h4 style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 10 }}>Items</h4>
          {items.map((item, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 80px 40px", gap: 8, marginBottom: 8, alignItems: "end" }}>
              <div><label className="label">Product</label><input className="input-field" placeholder="Glass sheet 4mm" value={item.product_name} onChange={(e) => updateItem(i, "product_name", e.target.value)} /></div>
              <div><label className="label">Qty</label><input type="number" className="input-field" value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} /></div>
              <div><label className="label">Unit Price ₹</label><input type="number" className="input-field" value={item.unit_price} onChange={(e) => updateItem(i, "unit_price", e.target.value)} /></div>
              <div><label className="label">GST %</label><input type="number" className="input-field" value={item.gst_rate} onChange={(e) => updateItem(i, "gst_rate", e.target.value)} /></div>
              <div><label className="label">Unit</label><input className="input-field" value={item.unit} onChange={(e) => updateItem(i, "unit", e.target.value)} /></div>
              <button onClick={() => removeItem(i)} style={{ marginBottom: 0, background: "#fee2e2", border: "none", borderRadius: 6, color: "#dc2626", cursor: "pointer", height: 38, alignSelf: "end" }}>✕</button>
            </div>
          ))}
          <button onClick={addItem} className="btn-outline" style={{ fontSize: 13, marginBottom: 16 }}>+ Add Item</button>

          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving..." : "Create Purchase"}</button>
            <button className="btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card">
        <DataTable columns={columns} data={purchases} loading={loading} emptyText="No purchases yet" keyField="purchase_number" />
      </div>
    </div>
  );
}
