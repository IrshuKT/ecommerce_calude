"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import staffApi from "@/lib/staffApi";
import PageHeader from "@/components/admin/PageHeader";
import DataTable from "@/components/admin/DataTable";

function StatusBadge({ status }: { status: string }) {
  const c: Record<string, { bg: string; color: string }> = {
    draft: { bg: "#f1f5f9", color: "#475569" },
    ordered: { bg: "#dbeafe", color: "#1d4ed8" },
    received: { bg: "#dcfce7", color: "#166534" },
    cancelled: { bg: "#fee2e2", color: "#991b1b" },
  };
  const col = c[status] || c.draft;
  return <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: col.bg, color: col.color, textTransform: "capitalize" }}>{status}</span>;
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ vendor_id: "", purchase_date: new Date().toISOString().split("T")[0], vendor_invoice_number: "", notes: "" });
  const [items, setItems] = useState([{ product_id: '', 
    product_name: "",
    variant_id: '',
     quantity: "1", 
     unit_price: "",
      gst_rate: "18",
       unit: "Nos" }]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [pr, vr, pd] = await Promise.all([staffApi.get("/purchases/"), staffApi.get("/vendors/"), staffApi.get("/products/")]);
      setPurchases(Array.isArray(pr.data) ? pr.data : pr.data?.items || []);
      setVendors(vr.data || []);
      setProducts(Array.isArray(pd.data) ? pd.data : pd.data?.items || []);
    } catch { setPurchases([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const addItem = () => setItems([...items, { product_id: '',variant_id:"", product_name: "", quantity: "1", unit_price: "", gst_rate: "18", unit: "Nos" }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, key: string, val: string) => setItems(items.map((item, idx) => idx === i ? { ...item, [key]: val } : item));

  const updateItemFields = (i: number, fields: Record<string, string>) => {
  setItems(items.map((item, idx) => idx === i ? { ...item, ...fields } : item));
  };

  const save = async () => {
    if (!form.vendor_id) { alert("Please select a vendor"); return; }

    // Validate items
    const invalidItems = items.filter(i => !i.product_name.trim() || !i.unit_price);
    if (invalidItems.length > 0) { alert("Please fill product name and unit price for all items"); return; }

    setSaving(true);
    try {
      await staffApi.post("/purchases/", {
        ...form,
        vendor_id: parseInt(form.vendor_id),
        items: items.map(item => ({
  product_name: item.product_name,
  variant_id: item.variant_id ? parseInt(item.variant_id) : null,  // ← add this
  quantity: parseFloat(item.quantity),
  unit_price: parseFloat(item.unit_price),
  gst_rate: parseFloat(item.gst_rate),
  unit: item.unit,
})),
      });
      setShowForm(false);
      setItems([{ product_id: '', product_name: "",variant_id:'', quantity: "1", unit_price: "", gst_rate: "18", unit: "Nos" }]);
      load();
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const markReceived = async (num: string) => {
    if (!confirm(`Mark purchase ${num} as received?`)) return;
    try {
      console.log("Calling:", `/purchases/${num}/receive`);
      const res = await staffApi.patch(`/purchases/${num}/receive`);
      console.log("Response:", res.data);
      load();
      alert("Stock updated!");
    } catch (e: any) {
           alert(e.response?.data?.detail || e.message || "Failed");
    }
  };

  const columns = [
    {
      key: "purchase_number", label: "Purchase #", render: (r: any) => (
        <a href={`/admin/purchases/${r.purchase_number}`}
          style={{ fontWeight: 600, color: "#0284c7", textDecoration: "none" }}>
          {r.purchase_number}
        </a>
      )
    },
    { key: "vendor_id", label: "Vendor", render: (r: any) => vendors.find(v => v.id === r.vendor_id)?.name || r.vendor_id },
    { key: "purchase_date", label: "Date", render: (r: any) => new Date(r.purchase_date).toLocaleDateString("en-IN") },
    { key: "grand_total", label: "Total", render: (r: any) => <span style={{ fontWeight: 600 }}>₹{parseFloat(r.grand_total).toLocaleString("en-IN")}</span> },
    { key: "balance_due", label: "Balance", render: (r: any) => <span style={{ color: parseFloat(r.balance_due) > 0 ? "#dc2626" : "#16a34a" }}>₹{parseFloat(r.balance_due).toLocaleString("en-IN")}</span> },
    { key: "status", label: "Status", render: (r: any) => <StatusBadge status={r.status} /> },
    {
      key: "actions", label: "", render: (r: any) => {
        console.log("Row data:", r); // temporary debug
        return r.status === "ordered" ? (
          <button
            onClick={() => markReceived(r.purchase_number)}
            style={{ fontSize: 12, color: "#16a34a", background: "#dcfce7", border: "none", padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>
            Mark Received
          </button>
        ) : <span style={{ fontSize: 12, color: "#94a3b8" }}>{r.status}</span>;
      }
    },
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
          {items.map((item, idx) => (
            <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 80px 40px", gap: 8, marginBottom: 8, alignItems: "end" }}>
              <div>
  <label className="label">Product</label>
  <select
    className="input-field"
    value={item.product_id || ""}
    onChange={(e) => {
  const selectedValue = e.target.value;
  const product = products.find((x: any) => x.id === Number(selectedValue));
  updateItemFields(idx, {
    product_id: selectedValue,
    product_name: product?.name || "",
    variant_id: "",  
    unit_price: "0",
    gst_rate: String(product?.gst_rate ?? 18),
    unit: "Nos"
  });
}}
  >
    <option value="">Select Product</option>
    {products.map(p => (
      <option key={p.id} value={p.id}>
        {p.name}
      </option>
    ))}
  </select>
</div>
<div>
      <label className="label">Variant</label>
      <select className="input-field" value={item.variant_id || ""}
        onChange={(e) => {
          const variantId = e.target.value;
          const product = products.find((x: any) => x.id === Number(item.product_id));
          const variant = product?.variants?.find((v: any) => String(v.id) === variantId);
          updateItemFields(idx, {
            variant_id: variantId,
            unit_price: variant?.cost_price ? String(variant.cost_price) : item.unit_price,
          });
        }}>
        <option value="">Select Variant</option>
        {products
          .find((x: any) => x.id === Number(item.product_id))
          ?.variants?.map((v: any) => (
            <option key={v.id} value={v.id}>
              {Object.values(v.selected_attributes || {}).join(" / ") || "Default"} — {v.sku}
            </option>
          ))}
      </select>
    </div>
              <div><label className="label">Qty</label><input type="number" className="input-field" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} /></div>
              <div><label className="label">Unit Price ₹</label><input type="number" className="input-field" value={item.unit_price} onChange={(e) => updateItem(idx, "unit_price", e.target.value)} /></div>
              <div><label className="label">GST %</label><input type="number" className="input-field" value={item.gst_rate} onChange={(e) => updateItem(idx, "gst_rate", e.target.value)} /></div>
              <div><label className="label">Unit</label><input className="input-field" value={item.unit} onChange={(e) => updateItem(idx, "unit", e.target.value)} /></div>
              <button onClick={() => removeItem(idx)} style={{ marginBottom: 0, background: "#fee2e2", border: "none", borderRadius: 6, color: "#dc2626", cursor: "pointer", height: 38, alignSelf: "end" }}>✕</button>
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
