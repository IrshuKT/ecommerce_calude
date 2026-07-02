"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

// ─── types ────────────────────────────────────────────────────────────────────
interface Customer { id: number; name: string; phone: string; email: string; }
interface Variant  { id: number; sku: string; retail_price: number; stock_qty: number; selected_attributes: Record<string,string>; product: { name: string; gst_rate: number; hsn_code: string; }; }
interface LineItem {
  variant_id: number;
  product_name: string;
  sku: string;
  unit_price: number;
  quantity: number;
  discount_pct: number;
  gst_rate: number;
  unit: string;
  // computed
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  line_total: number;
}

const today = () => new Date().toISOString().split("T")[0];
const r2 = (n: number) => Math.round(n * 100) / 100;

function calcLine(item: LineItem, is_interstate: boolean): LineItem {
  const subtotal      = item.unit_price * item.quantity;
  const discount_amt  = r2(subtotal * item.discount_pct / 100);
  const taxable       = r2(subtotal - discount_amt);
  const gst           = item.gst_rate;
  const cgst_rate     = is_interstate ? 0 : gst / 2;
  const sgst_rate     = is_interstate ? 0 : gst / 2;
  const igst_rate     = is_interstate ? gst : 0;
  return {
    ...item,
    taxable_amount: taxable,
    cgst_amount:    r2(taxable * cgst_rate / 100),
    sgst_amount:    r2(taxable * sgst_rate / 100),
    igst_amount:    r2(taxable * igst_rate / 100),
    line_total:     r2(taxable + r2(taxable * cgst_rate / 100) + r2(taxable * sgst_rate / 100) + r2(taxable * igst_rate / 100)),
  };
}

const emptyLine = (): LineItem => ({
  variant_id: 0, product_name: "", sku: "", unit_price: 0,
  quantity: 1, discount_pct: 0, gst_rate: 18, unit: "Nos",
  taxable_amount: 0, cgst_amount: 0, sgst_amount: 0, igst_amount: 0, line_total: 0,
});

const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
const inp = "width:100%;padding:8px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;outline:none;box-sizing:border-box;font-family:inherit";

export default function CreateManualInvoicePage() {
  const router = useRouter();

  // ── form state ─────────────────────────────────────────────────────────────
  const [customerId,     setCustomerId]     = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers,      setCustomers]      = useState<Customer[]>([]);
  const [showCustDrop,   setShowCustDrop]   = useState(false);
  const [invoiceDate,    setInvoiceDate]    = useState(today());
  const [dueDate,        setDueDate]        = useState("");
  const [isInterstate,   setIsInterstate]   = useState(false);
  const [customerGstin,  setCustomerGstin]  = useState("");
  const [shippingCharge, setShippingCharge] = useState(0);
  const [notes,          setNotes]          = useState("");
  const [lines,          setLines]          = useState<LineItem[]>([emptyLine()]);

  // variant search per row
  const [variantSearch,  setVariantSearch]  = useState<string[]>([""]);
  const [variantResults, setVariantResults] = useState<Variant[][]>([[]]);
  const [showVarDrop,    setShowVarDrop]    = useState<boolean[]>([false]);

  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  // preload customers on mount
  useEffect(() => {
    api.get("/users/?limit=100").then(r => {
      const data = Array.isArray(r.data) ? r.data : r.data?.items || [];
      setCustomers(data.filter((u: any) => u.role === "customer"));
    }).catch(() => {});
  }, []);

  // ── customer search ────────────────────────────────────────────────────────
  const searchCustomers = useCallback(async (q: string) => {
    setCustomerSearch(q);
    setCustomerId("");
    if (q.length < 1) { setCustomers([]); return; }
    try {
      const r = await api.get(`/users/?limit=50`);
      const data = Array.isArray(r.data) ? r.data : r.data?.items || [];
      const filtered = data.filter((u: any) =>
        u.role === "customer" &&
        (u.name?.toLowerCase().includes(q.toLowerCase()) ||
         u.phone?.includes(q) ||
         u.email?.toLowerCase().includes(q.toLowerCase()))
      );
      setCustomers(filtered.slice(0, 8));
      setShowCustDrop(true);
    } catch { setCustomers([]); }
  }, []);

  // ── variant search per row ─────────────────────────────────────────────────
  const searchVariants = useCallback(async (q: string, idx: number) => {
    const ns = [...variantSearch]; ns[idx] = q; setVariantSearch(ns);
    const nd = [...showVarDrop]; nd[idx] = true; setShowVarDrop(nd);
    if (q.length < 1) {
      const nr = [...variantResults]; nr[idx] = []; setVariantResults(nr); return;
    }
    try {
      const r = await api.get(`/products/variants/search?q=${encodeURIComponent(q)}&limit=8`);
      const nr = [...variantResults]; nr[idx] = Array.isArray(r.data) ? r.data : [];
      setVariantResults(nr);
    } catch { }
  }, [variantSearch, variantResults, showVarDrop]);

  const selectVariant = (variant: Variant, idx: number) => {
    const ns = [...variantSearch]; ns[idx] = `${variant.product.name} — ${variant.sku}`; setVariantSearch(ns);
    const nd = [...showVarDrop]; nd[idx] = false; setShowVarDrop(nd);

    const newLine: LineItem = calcLine({
      ...emptyLine(),
      variant_id:   variant.id,
      product_name: variant.product.name,
      sku:          variant.sku,
      unit_price:   variant.retail_price,
      gst_rate:     variant.product.gst_rate,
    }, isInterstate);

    const nl = [...lines]; nl[idx] = newLine; setLines(nl);
  };

  const updateLine = (idx: number, field: keyof LineItem, value: any) => {
    const nl = [...lines];
    nl[idx] = calcLine({ ...nl[idx], [field]: Number(value) || value }, isInterstate);
    setLines(nl);
  };

  // recalc all lines when interstate toggles
  useEffect(() => {
    setLines(lines.map(l => calcLine(l, isInterstate)));
  }, [isInterstate]);

  const addLine = () => {
    setLines([...lines, emptyLine()]);
    setVariantSearch([...variantSearch, ""]);
    setVariantResults([...variantResults, []]);
    setShowVarDrop([...showVarDrop, false]);
  };

  const removeLine = (idx: number) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== idx));
    setVariantSearch(variantSearch.filter((_, i) => i !== idx));
    setVariantResults(variantResults.filter((_, i) => i !== idx));
    setShowVarDrop(showVarDrop.filter((_, i) => i !== idx));
  };

  // ── totals ─────────────────────────────────────────────────────────────────
  const subtotal      = r2(lines.reduce((s, l) => s + l.unit_price * l.quantity, 0));
  const discountTotal = r2(lines.reduce((s, l) => s + r2(l.unit_price * l.quantity * l.discount_pct / 100), 0));
  const taxableTotal  = r2(lines.reduce((s, l) => s + l.taxable_amount, 0));
  const cgstTotal     = r2(lines.reduce((s, l) => s + l.cgst_amount, 0));
  const sgstTotal     = r2(lines.reduce((s, l) => s + l.sgst_amount, 0));
  const igstTotal     = r2(lines.reduce((s, l) => s + l.igst_amount, 0));
  const taxTotal      = r2(cgstTotal + sgstTotal + igstTotal);
  const grandTotal    = r2(taxableTotal + taxTotal + shippingCharge);

  // ── submit ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setError("");
    if (!customerId) { setError("Select a customer"); return; }
    if (lines.some(l => !l.variant_id)) { setError("Select a product variant for each row"); return; }
    if (lines.some(l => l.quantity <= 0)) { setError("Quantity must be greater than 0"); return; }

    setSaving(true);
    try {
      const payload = {
        customer_id:    Number(customerId),
        invoice_date:   invoiceDate,
        due_date:       dueDate || null,
        is_interstate:  isInterstate,
        customer_gstin: customerGstin || null,
        shipping_charge: shippingCharge,
        notes:          notes || null,
        items: lines.map(l => ({
          variant_id:   l.variant_id,
          quantity:     l.quantity,
          unit_price:   l.unit_price,
          discount_pct: l.discount_pct,
          unit:         l.unit,
        })),
      };
      const r = await api.post("/invoices/manual", payload);
      router.push(`/admin/accounting/invoices/${encodeURIComponent(r.data.invoice_number)}`);
    } catch (e: any) {
      setError(e.response?.data?.detail || "Failed to create invoice");
    } finally {
      setSaving(false);
    }
  };

  // ─── render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 28, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: 0 }}>New Manual Invoice</h1>
        <p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 0" }}>Create invoice directly without an order</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>

        {/* ── LEFT: main form ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* header fields */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: "0 0 16px" }}>Invoice Details</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>

              {/* customer */}
              <div style={{ position: "relative", gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Customer *</label>
                <input
                  style={{ ...inputStyle, borderColor: customerId ? "#0284c7" : "#e2e8f0" }}
                  placeholder="Search customer name or phone…"
                  value={customerSearch}
                  onChange={e => searchCustomers(e.target.value)}
                  onFocus={() => setShowCustDrop(true)}
                />
                {showCustDrop && customers.length > 0 && (
                  <div style={dropStyle}>
                    {customers.map(c => (
                      <div key={c.id} style={dropItem}
                        onClick={() => { setCustomerId(String(c.id)); setCustomerSearch(c.name); setShowCustDrop(false); }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                        onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                        <span style={{ fontWeight: 600 }}>{c.name}</span>
                        <span style={{ color: "#94a3b8", fontSize: 12, marginLeft: 8 }}>{c.phone}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label style={labelStyle}>Invoice Date *</label>
                <input type="date" style={inputStyle} value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Due Date</label>
                <input type="date" style={inputStyle} value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Customer GSTIN</label>
                <input style={inputStyle} placeholder="22AAAAA0000A1Z5" value={customerGstin} onChange={e => setCustomerGstin(e.target.value)} />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 20 }}>
                <input type="checkbox" id="interstate" checked={isInterstate} onChange={e => setIsInterstate(e.target.checked)} style={{ width: 16, height: 16 }} />
                <label htmlFor="interstate" style={{ fontSize: 13, color: "#475569", cursor: "pointer" }}>
                  Interstate (IGST)
                </label>
              </div>
            </div>
          </div>

          {/* line items */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: 0 }}>Line Items</h2>
            </div>

            {/* col headers */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 80px 110px 80px 60px 100px 36px", gap: 8, padding: "10px 16px", borderBottom: "1px solid #f1f5f9" }}>
              {["Product / Variant", "Qty", "Unit Price", "Disc %", "Unit", "Total", ""].map(h => (
                <div key={h} style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>{h}</div>
              ))}
            </div>

            {/* rows */}
            {lines.map((line, idx) => (
              <div key={idx} style={{ padding: "10px 16px", borderBottom: "1px solid #f8fafc" }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 80px 110px 80px 60px 100px 36px", gap: 8, alignItems: "center" }}>

                  {/* variant search */}
                  <div style={{ position: "relative" }}>
                    <input
                      style={{ ...inputStyle, borderColor: line.variant_id ? "#0284c7" : "#e2e8f0" }}
                      placeholder="Search product…"
                      value={variantSearch[idx] || ""}
                      onChange={e => searchVariants(e.target.value, idx)}
                    />
                    {showVarDrop[idx] && variantResults[idx]?.length > 0 && (
                      <div style={{ ...dropStyle, zIndex: 100 }}>
                        {variantResults[idx].map(v => (
                          <div key={v.id} style={dropItem}
                            onClick={() => selectVariant(v, idx)}
                            onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                            onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                            <span style={{ fontWeight: 600 }}>{v.product.name}</span>
                            <span style={{ color: "#94a3b8", fontSize: 11, marginLeft: 6 }}>{v.sku}</span>
                            <span style={{ float: "right", fontSize: 12, color: "#0284c7" }}>₹{v.retail_price}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <input type="number" min="1" style={inputStyle} value={line.quantity}
                    onChange={e => updateLine(idx, "quantity", e.target.value)} />
                  <input type="number" min="0" style={inputStyle} value={line.unit_price}
                    onChange={e => updateLine(idx, "unit_price", e.target.value)} />
                  <input type="number" min="0" max="100" style={inputStyle} value={line.discount_pct}
                    onChange={e => updateLine(idx, "discount_pct", e.target.value)} />
                  <input style={inputStyle} value={line.unit} onChange={e => updateLine(idx, "unit", e.target.value)} />

                  <div style={{ textAlign: "right", fontWeight: 600, fontSize: 13, color: "#0f172a" }}>
                    {fmt(line.line_total)}
                  </div>

                  <button onClick={() => removeLine(idx)} disabled={lines.length === 1}
                    style={{ border: "1px solid #fca5a5", background: lines.length === 1 ? "#f8fafc" : "#fff5f5",
                      color: lines.length === 1 ? "#cbd5e1" : "#ef4444", borderRadius: 6,
                      cursor: lines.length === 1 ? "default" : "pointer", fontSize: 16,
                      width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    ×
                  </button>
                </div>

                {/* GST breakdown per line */}
                {line.variant_id > 0 && (
                  <div style={{ marginTop: 6, fontSize: 11, color: "#94a3b8", paddingLeft: 2 }}>
                    Taxable: {fmt(line.taxable_amount)} &nbsp;|&nbsp;
                    {isInterstate
                      ? `IGST (${line.gst_rate}%): ${fmt(line.igst_amount)}`
                      : `CGST (${line.gst_rate/2}%): ${fmt(line.cgst_amount)} + SGST (${line.gst_rate/2}%): ${fmt(line.sgst_amount)}`}
                  </div>
                )}
              </div>
            ))}

            <div style={{ padding: "12px 16px" }}>
              <button onClick={addLine} style={{ padding: "7px 16px", border: "1px dashed #cbd5e1", background: "#f8fafc", borderRadius: 6, fontSize: 13, color: "#475569", cursor: "pointer" }}>
                + Add Line
              </button>
            </div>
          </div>

          {/* notes */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20 }}>
            <label style={labelStyle}>Notes</label>
            <textarea style={{ ...inputStyle, height: 72, resize: "vertical" } as any}
              placeholder="Internal notes or payment terms…"
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          {error && (
            <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, color: "#dc2626", fontSize: 13 }}>
              {error}
            </div>
          )}
        </div>

        {/* ── RIGHT: summary ── */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", position: "sticky", top: 80 }}>
          <div style={{ padding: "14px 18px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: 0 }}>Summary</h2>
          </div>
          <div style={{ padding: 18 }}>
            {[
              ["Subtotal",   fmt(subtotal)],
              ["Discount",   discountTotal > 0 ? `- ${fmt(discountTotal)}` : "—"],
              ["Taxable",    fmt(taxableTotal)],
              ...(isInterstate
                ? [["IGST", fmt(igstTotal)]]
                : [["CGST", fmt(cgstTotal)], ["SGST", fmt(sgstTotal)]]),
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 13 }}>
                <span style={{ color: "#64748b" }}>{label}</span>
                <span style={{ color: "#0f172a" }}>{value}</span>
              </div>
            ))}

            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: "#64748b" }}>Shipping</span>
              </div>
              <input type="number" min="0" style={inputStyle} value={shippingCharge}
                onChange={e => setShippingCharge(Number(e.target.value) || 0)} />
            </div>

            <div style={{ borderTop: "2px solid #e2e8f0", marginTop: 14, paddingTop: 14, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Grand Total</span>
              <span style={{ fontWeight: 700, fontSize: 18, color: "#0284c7" }}>{fmt(grandTotal)}</span>
            </div>

            <div style={{ marginTop: 4, fontSize: 11, color: "#94a3b8", textAlign: "right" }}>
              Tax: {fmt(taxTotal)} &nbsp;|&nbsp; {isInterstate ? "IGST" : "CGST+SGST"}
            </div>
          </div>

          <div style={{ padding: "0 18px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: "10px", background: "#0284c7", color: "#fff", border: "none", borderRadius: 7, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
              {saving ? "Creating…" : "💾 Save as Draft"}
            </button>
            <button onClick={() => router.back()}
              style={{ padding: "10px", background: "#fff", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, cursor: "pointer" }}>
              Cancel
            </button>
          </div>

          <div style={{ padding: "12px 18px", background: "#eff6ff", borderTop: "1px solid #bfdbfe", fontSize: 12, color: "#1e40af" }}>
            ℹ️ Invoice saves as <strong>Draft</strong>. Open it and click <strong>Confirm</strong> to post journal entries and deduct stock.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── shared styles ─────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 13, color: "#0f172a", background: "#fff", boxSizing: "border-box", fontFamily: "inherit", outline: "none" };
const dropStyle:  React.CSSProperties = { position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", zIndex: 50, marginTop: 4, maxHeight: 240, overflowY: "auto" };
const dropItem:   React.CSSProperties = { padding: "9px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", fontSize: 13, background: "#fff" };