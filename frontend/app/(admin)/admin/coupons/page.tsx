"use client";
import { useEffect, useState } from "react";
import staffApi from "@/lib/staffApi";
import PageHeader from "@/components/admin/PageHeader";
import DataTable from "@/components/admin/DataTable";

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "", coupon_type: "percentage", value: "", min_order_amount: "", max_discount_amount: "", usage_limit: "", valid_until: "", description: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const res = await staffApi.get("/coupons/"); setCoupons(Array.isArray(res.data) ? res.data : []); }
    catch { setCoupons([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await staffApi.post("/coupons/", { ...form, code: form.code.toUpperCase(), value: parseFloat(form.value), min_order_amount: form.min_order_amount ? parseFloat(form.min_order_amount) : null, max_discount_amount: form.max_discount_amount ? parseFloat(form.max_discount_amount) : null, usage_limit: form.usage_limit ? parseInt(form.usage_limit) : null });
      setShowForm(false);
      load();
    } catch (e: any) { alert(e.response?.data?.detail || "Failed to save"); } finally { setSaving(false); }
  };

  const columns = [
    { key: "code", label: "Code", render: (r: any) => <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#0284c7", background: "#eff6ff", padding: "3px 8px", borderRadius: 4 }}>{r.code}</span> },
    { key: "coupon_type", label: "Type", render: (r: any) => <span style={{ textTransform: "capitalize", fontSize: 12 }}>{r.coupon_type}</span> },
    { key: "value", label: "Discount", render: (r: any) => r.coupon_type === "percentage" ? `${r.value}%` : `₹${r.value}` },
    { key: "min_order_amount", label: "Min Order", render: (r: any) => r.min_order_amount ? `₹${r.min_order_amount}` : "—" },
    { key: "used_count", label: "Used", render: (r: any) => `${r.used_count}${r.usage_limit ? ` / ${r.usage_limit}` : ""}` },
    { key: "valid_until", label: "Expires", render: (r: any) => r.valid_until ? new Date(r.valid_until).toLocaleDateString("en-IN") : "No expiry" },
    { key: "is_active", label: "Status", render: (r: any) => <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: r.is_active ? "#dcfce7" : "#fee2e2", color: r.is_active ? "#166534" : "#991b1b" }}>{r.is_active ? "Active" : "Inactive"}</span> },
  ];

  return (
    <div style={{ padding: 32 }}>
      <PageHeader title="Coupons" subtitle="Create and manage discount codes"
        action={<button className="btn-primary" onClick={() => setShowForm(true)}>+ New Coupon</button>} />

      {showForm && (
        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>New Coupon</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div><label className="label">Code*</label><input className="input-field" placeholder="GLASS10" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></div>
            <div><label className="label">Type*</label>
              <select className="input-field" value={form.coupon_type} onChange={(e) => setForm({ ...form, coupon_type: e.target.value })}>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (₹)</option>
              </select>
            </div>
            <div><label className="label">Value*</label><input type="number" className="input-field" placeholder={form.coupon_type === "percentage" ? "10" : "100"} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
            <div><label className="label">Min Order Amount</label><input type="number" className="input-field" placeholder="500" value={form.min_order_amount} onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })} /></div>
            <div><label className="label">Max Discount (for %)</label><input type="number" className="input-field" placeholder="200" value={form.max_discount_amount} onChange={(e) => setForm({ ...form, max_discount_amount: e.target.value })} /></div>
            <div><label className="label">Usage Limit</label><input type="number" className="input-field" placeholder="100" value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} /></div>
            <div><label className="label">Valid Until</label><input type="date" className="input-field" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></div>
            <div><label className="label">Description</label><input className="input-field" placeholder="10% off on all glass" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving..." : "Create Coupon"}</button>
            <button className="btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card">
        <DataTable columns={columns} data={coupons} loading={loading} emptyText="No coupons yet" />
      </div>
    </div>
  );
}
