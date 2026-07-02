"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import PageHeader from "@/components/admin/PageHeader";
import DataTable from "@/components/admin/DataTable";
import { useRouter } from "next/navigation";

const PAYMENT_MODES = ["cash", "upi", "bank_transfer", "cheque", "neft", "rtgs"];

export default function PaymentVouchersPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vendor_id: "", purchase_number: "", amount: "",
    payment_mode: "bank_transfer", reference_number: "",
    bank_account: "", narration: "", payment_date: new Date().toISOString().split("T")[0],
  });

  const load = async () => {
    setLoading(true);
    try {
      const [pv, vr, pr] = await Promise.all([api.get("/payment-vouchers/"), api.get("/vendors/"), api.get("/purchases/")]);
      setPayments(Array.isArray(pv.data) ? pv.data : []);
      setVendors(vr.data || []);
      setPurchases(Array.isArray(pr.data) ? pr.data : pr.data?.items || []);
    } catch { setPayments([]); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.vendor_id || !form.amount) { alert("Vendor and amount are required"); return; }
    setSaving(true);
    try {
      await api.post("/payment-vouchers/", {
        ...form,
        vendor_id: parseInt(form.vendor_id),
        amount: parseFloat(form.amount),
      });
      setShowForm(false);
      setForm({ vendor_id: "", purchase_number: "", amount: "", payment_mode: "bank_transfer", reference_number: "", bank_account: "", narration: "", payment_date: new Date().toISOString().split("T")[0] });
      load();
    } catch (e: any) { alert(e.response?.data?.detail || "Failed to save"); }
    finally { setSaving(false); }
  };

  const fmt = (n: any) => `₹${parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  const inp = { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const };
  const lbl = { fontSize: 13, fontWeight: 500, color: "#475569", display: "block", marginBottom: 5 } as const;

  const vendorPurchases = purchases.filter((p: any) => p.vendor_id === parseInt(form.vendor_id) && parseFloat(p.balance_due) > 0);

  const columns = [
    { key: "payment_number", label: "Payment #", render: (r: any) => (
      <span
        style={{ fontWeight: 600, color: "#7c3aed", cursor: "pointer" }}
        onClick={() => router.push(`/admin/accounting/payments/${encodeURIComponent(r.payment_number)}`)}
      >
        {r.payment_number}
      </span>
    )},
    { key: "payment_date", label: "Date", render: (r: any) => new Date(r.payment_date).toLocaleDateString("en-IN") },
    { key: "vendor_id", label: "Vendor", render: (r: any) => vendors.find(v => v.id === r.vendor_id)?.name || `Vendor #${r.vendor_id}` },
    { key: "amount", label: "Amount", render: (r: any) => <span style={{ fontWeight: 600, color: "#dc2626" }}>{fmt(r.amount)}</span> },
    { key: "payment_mode", label: "Mode", render: (r: any) => <span style={{ fontSize: 12, background: "#f1f5f9", padding: "2px 8px", borderRadius: 4, textTransform: "uppercase" }}>{r.payment_mode}</span> },
    { key: "reference_number", label: "Reference", render: (r: any) => <span style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>{r.reference_number || "—"}</span> },
    { key: "narration", label: "Narration", render: (r: any) => <span style={{ fontSize: 12, color: "#64748b" }}>{r.narration || "—"}</span> },
  ];

  return (
    <div style={{ padding: 32 }}>
      <PageHeader title="Payment Vouchers" subtitle="Record outgoing payments to vendors"
        action={<button className="btn-primary" onClick={() => setShowForm(true)}>+ New Payment</button>} />

      {showForm && (
        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>New Payment Voucher</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div>
              <label style={lbl}>Vendor *</label>
              <select style={inp} value={form.vendor_id} onChange={e => setForm({ ...form, vendor_id: e.target.value, purchase_number: "" })}>
                <option value="">Select vendor</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Against Purchase</label>
              <select style={inp} value={form.purchase_number} onChange={e => {
                const p = vendorPurchases.find((x: any) => x.purchase_number === e.target.value);
                setForm({ ...form, purchase_number: e.target.value, amount: p ? String(p.balance_due) : form.amount });
              }}>
                <option value="">Select purchase (optional)</option>
                {vendorPurchases.map((p: any) => <option key={p.purchase_number} value={p.purchase_number}>{p.purchase_number} — Balance: {fmt(p.balance_due)}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Amount ₹ *</label>
              <input type="number" style={inp} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
            </div>
            <div>
              <label style={lbl}>Payment Mode *</label>
              <select style={inp} value={form.payment_mode} onChange={e => setForm({ ...form, payment_mode: e.target.value })}>
                {PAYMENT_MODES.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Reference No.</label>
              <input style={inp} value={form.reference_number} onChange={e => setForm({ ...form, reference_number: e.target.value })} placeholder="UTR/Cheque no." />
            </div>
            <div>
              <label style={lbl}>Payment Date</label>
              <input type="date" style={inp} value={form.payment_date} onChange={e => setForm({ ...form, payment_date: e.target.value })} />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={lbl}>Narration</label>
              <input style={inp} value={form.narration} onChange={e => setForm({ ...form, narration: e.target.value })} placeholder="Payment description" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Payment"}</button>
            <button className="btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card">
        <DataTable columns={columns} data={payments} loading={loading} emptyText="No payment vouchers yet" keyField="payment_number" />
      </div>
    </div>
  );
}
