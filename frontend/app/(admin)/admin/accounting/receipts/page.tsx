"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import PageHeader from "@/components/admin/PageHeader";
import DataTable from "@/components/admin/DataTable";
import { useRouter } from "next/navigation";

const PAYMENT_MODES = ["cash", "upi", "bank_transfer", "razorpay", "cheque", "neft", "rtgs", "cod"];

export default function ReceiptsPage() {
  const router = useRouter();
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [form, setForm] = useState({
    customer_id: "", invoice_number: "", amount: "",
    payment_mode: "upi", reference_number: "", bank_account: "",
    narration: "", receipt_date: new Date().toISOString().split("T")[0],
  });

  const load = async () => {
    setLoading(true);
    try {
      const [rr, cr] = await Promise.all([api.get("/receipts/"), api.get("/users/")]);
      setReceipts(Array.isArray(rr.data) ? rr.data : []);
      setCustomers(Array.isArray(cr.data) ? cr.data.filter((u: any) => u.role === "customer") : []);
    } catch { setReceipts([]); } finally { setLoading(false); }
  };

  const loadInvoices = async (customerId: string) => {
    if (!customerId) return;
    try {
      const res = await api.get(`/invoices/?limit=50`);
      setInvoices(Array.isArray(res.data) ? res.data.filter((i: any) => i.customer_id === parseInt(customerId) && i.balance_due > 0) : []);
    } catch { setInvoices([]); }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.customer_id || !form.amount) { alert("Customer and amount are required"); return; }
    setSaving(true);
    try {
      await api.post("/receipts/", {
        ...form,
        customer_id: parseInt(form.customer_id),
        amount: parseFloat(form.amount),
      });
      setShowForm(false);
      setForm({ customer_id: "", invoice_number: "", amount: "", payment_mode: "upi", reference_number: "", bank_account: "", narration: "", receipt_date: new Date().toISOString().split("T")[0] });
      load();
    } catch (e: any) { alert(e.response?.data?.detail || "Failed to save"); }
    finally { setSaving(false); }
  };

  const fmt = (n: any) => `₹${parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  const inp = { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const };
  const lbl = { fontSize: 13, fontWeight: 500, color: "#475569", display: "block", marginBottom: 5 } as const;

  const columns = [
    { key: "receipt_number", label: "Receipt #", render: (r: any) => (
      <span
        style={{ fontWeight: 600, color: "#0284c7", cursor: "pointer" }}
        onClick={() => router.push(`/admin/accounting/receipts/${encodeURIComponent(r.receipt_number)}`)}
      >
        {r.receipt_number}
      </span>
    )},
    { key: "receipt_date", label: "Date", render: (r: any) => new Date(r.receipt_date).toLocaleDateString("en-IN") },
    { key: "customer_id", label: "Customer", render: (r: any) => customers.find(c => c.id === r.customer_id)?.name || `Customer #${r.customer_id}` },
    { key: "amount", label: "Amount", render: (r: any) => <span style={{ fontWeight: 600, color: "#16a34a" }}>{fmt(r.amount)}</span> },
    { key: "payment_mode", label: "Mode", render: (r: any) => <span style={{ fontSize: 12, background: "#f1f5f9", padding: "2px 8px", borderRadius: 4, textTransform: "uppercase" }}>{r.payment_mode}</span> },
    { key: "reference_number", label: "Reference", render: (r: any) => <span style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>{r.reference_number || "—"}</span> },
    { key: "narration", label: "Narration", render: (r: any) => <span style={{ fontSize: 12, color: "#64748b" }}>{r.narration || "—"}</span> },
  ];

  return (
    <div style={{ padding: 32 }}>
      <PageHeader title="Receipt Vouchers" subtitle="Record incoming payments from customers"
        action={<button className="btn-primary" onClick={() => setShowForm(true)}>+ New Receipt</button>} />

      {showForm && (
        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>New Receipt Voucher</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div>
              <label style={lbl}>Customer *</label>
              <select style={inp} value={form.customer_id} onChange={e => { setForm({ ...form, customer_id: e.target.value, invoice_number: "" }); loadInvoices(e.target.value); }}>
                <option value="">Select customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Against Invoice</label>
              <select style={inp} value={form.invoice_number} onChange={e => {
                const inv = invoices.find(i => i.invoice_number === e.target.value);
                setForm({ ...form, invoice_number: e.target.value, amount: inv ? String(inv.balance_due) : form.amount });
              }}>
                <option value="">Select invoice (optional)</option>
                {invoices.map(i => <option key={i.invoice_number} value={i.invoice_number}>{i.invoice_number} — Balance: {fmt(i.balance_due)}</option>)}
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
              <label style={lbl}>Reference No. (UTR/Cheque)</label>
              <input style={inp} value={form.reference_number} onChange={e => setForm({ ...form, reference_number: e.target.value })} placeholder="Transaction reference" />
            </div>
            <div>
              <label style={lbl}>Receipt Date</label>
              <input type="date" style={inp} value={form.receipt_date} onChange={e => setForm({ ...form, receipt_date: e.target.value })} />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={lbl}>Narration</label>
              <input style={inp} value={form.narration} onChange={e => setForm({ ...form, narration: e.target.value })} placeholder="Payment description" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Receipt"}</button>
            <button className="btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card">
        <DataTable columns={columns} data={receipts} loading={loading} emptyText="No receipts yet" keyField="receipt_number" />
      </div>
    </div>
  );
}
