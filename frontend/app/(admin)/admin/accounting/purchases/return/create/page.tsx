"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import staffApi from "@/lib/staffApi";

// ─── types ────────────────────────────────────────────────────────────────────
interface Vendor { id: number; name: string; phone?: string; gstin?: string; }
interface Variant {
  id: number;
  sku: string;
  retail_price: number;
  product: { name: string; gst_rate: number };
}

interface ReturnLine {
  variant_id: number;
  product_name: string;
  sku: string;
  unit_price: number;
  quantity: number;
  gst_rate: number;
  // computed
  taxable_amount: number;
  tax_amount: number;
  line_total: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

function calcLine(line: ReturnLine): ReturnLine {
  const taxable = r2(line.unit_price * line.quantity);
  const tax     = r2(taxable * line.gst_rate / 100);
  return { ...line, taxable_amount: taxable, tax_amount: tax, line_total: r2(taxable + tax) };
}

const emptyLine = (): ReturnLine => ({
  variant_id: 0, product_name: "", sku: "", unit_price: 0, quantity: 1, gst_rate: 18,
  taxable_amount: 0, tax_amount: 0, line_total: 0,
});

const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 13, color: "#0f172a", background: "#fff", boxSizing: "border-box", fontFamily: "inherit", outline: "none" };
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" };
const dropStyle:  React.CSSProperties = { position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", zIndex: 50, marginTop: 4, maxHeight: 240, overflowY: "auto" };
const dropItem:   React.CSSProperties = { padding: "9px 12px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", fontSize: 13, background: "#fff" };

export default function CreatePurchaseReturnPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"purchase" | "manual">("purchase");

  // purchase mode
  const [purchaseNumberInput, setPurchaseNumberInput] = useState("");
  const [purchaseNumber, setPurchaseNumber] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");

  // manual mode — vendor lookup
  const [vendorId, setVendorId] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [showVendorDrop, setShowVendorDrop] = useState(false);

  // shared line items
  const [lines, setLines] = useState<ReturnLine[]>([emptyLine()]);
  const [variantSearch, setVariantSearch] = useState<string[]>([""]);
  const [variantResults, setVariantResults] = useState<Variant[][]>([[]]);
  const [showVarDrop, setShowVarDrop] = useState<boolean[]>([false]);

  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState("");

  const parseApiError = (e: any): string => {
    const detail = e?.response?.data?.detail;
    if (!detail) return "Failed to create return";
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((d: any) => `${(d.loc || []).slice(1).join(".")}: ${d.msg}`).join(" | ");
    }
    return "Failed to create return";
  };

  // ── vendor search (manual mode) ──
  const searchVendors = useCallback(async (q: string) => {
    setVendorSearch(q);
    setVendorId("");
    if (q.length < 1) { setVendors([]); return; }
    try {
      const r = await staffApi.get(`/vendors/?limit=50`);
      const data = Array.isArray(r.data) ? r.data : r.data?.items || [];
      const filtered = data.filter((v: any) =>
        v.name?.toLowerCase().includes(q.toLowerCase()) ||
        v.phone?.includes(q) ||
        v.gstin?.toLowerCase().includes(q.toLowerCase())
      );
      setVendors(filtered.slice(0, 8));
      setShowVendorDrop(true);
    } catch { setVendors([]); }
  }, []);

  // ── lookup purchase, prefill lines from its items ──
  const lookupPurchase = async () => {
    if (!purchaseNumberInput.trim()) return;
    setFetching(true);
    setFetchError("");
    try {
      const r = await staffApi.get(`/purchases/${purchaseNumberInput.trim()}`);
      const p = r.data;
      setPurchaseNumber(p.purchase_number);
      setVendorName(p.vendor?.name || p.vendor_name || "");
      const newLines: ReturnLine[] = (p.items || []).map((it: any) =>
        calcLine({
          variant_id: it.variant_id,
          product_name: it.product_name,
          sku: it.sku || "",
          unit_price: it.unit_price,
          quantity: it.quantity,
          gst_rate: it.gst_rate,
          taxable_amount: 0, tax_amount: 0, line_total: 0,
        })
      );
      setLines(newLines.length ? newLines : [emptyLine()]);
      setVariantSearch(newLines.map((l: ReturnLine) => `${l.product_name} — ${l.sku}`));
      setVariantResults(newLines.map(() => []));
      setShowVarDrop(newLines.map(() => false));
    } catch {
      setFetchError("Purchase not found");
      setPurchaseNumber("");
    } finally {
      setFetching(false);
    }
  };

  // ── variant search for manual mode ──
  const searchVariants = useCallback(async (q: string, idx: number) => {
    const ns = [...variantSearch]; ns[idx] = q; setVariantSearch(ns);
    const nd = [...showVarDrop]; nd[idx] = true; setShowVarDrop(nd);
    if (q.length < 1) {
      const nr = [...variantResults]; nr[idx] = []; setVariantResults(nr); return;
    }
    try {
      const r = await staffApi.get(`/products/variants/search?q=${encodeURIComponent(q)}&limit=8`);
      const nr = [...variantResults]; nr[idx] = Array.isArray(r.data) ? r.data : [];
      setVariantResults(nr);
    } catch {}
  }, [variantSearch, variantResults, showVarDrop]);

  const selectVariant = (variant: Variant, idx: number) => {
    const ns = [...variantSearch]; ns[idx] = `${variant.product.name} — ${variant.sku}`; setVariantSearch(ns);
    const nd = [...showVarDrop]; nd[idx] = false; setShowVarDrop(nd);
    const newLine = calcLine({
      ...emptyLine(),
      variant_id: variant.id,
      product_name: variant.product.name,
      sku: variant.sku,
      unit_price: variant.retail_price,
      gst_rate: variant.product.gst_rate,
    });
    const nl = [...lines]; nl[idx] = newLine; setLines(nl);
  };

  const updateLine = (idx: number, field: keyof ReturnLine, value: any) => {
    const nl = [...lines];
    nl[idx] = calcLine({ ...nl[idx], [field]: typeof value === "string" && field !== "product_name" && field !== "sku" ? Number(value) || 0 : value });
    setLines(nl);
  };

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

  const switchMode = (m: "purchase" | "manual") => {
    setMode(m);
    setError("");
    setLines([emptyLine()]);
    setVariantSearch([""]);
    setVariantResults([[]]);
    setShowVarDrop([false]);
    setPurchaseNumber("");
    setVendorName("");
    setPurchaseNumberInput("");
    setVendorId("");
    setVendorSearch("");
    setVendors([]);
  };

  // ── totals ──
  const taxableTotal = r2(lines.reduce((s, l) => s + l.taxable_amount, 0));
  const taxTotal      = r2(lines.reduce((s, l) => s + l.tax_amount, 0));
  const grandTotal    = r2(taxableTotal + taxTotal);

  const handleSave = async () => {
    if (saving || created) return;
    setError("");
    const validLines = lines.filter(l => l.product_name && l.quantity > 0);

    if (mode === "purchase" && !purchaseNumber) { setError("Look up a purchase first"); return; }
    if (mode === "manual" && !vendorId) { setError("Select a vendor"); return; }
    if (validLines.length === 0) { setError("Add at least one item with a quantity greater than 0"); return; }

    setSaving(true);
    try {
      const payload: any = {
        purchase_number: mode === "purchase" ? purchaseNumber : null,
        items: validLines.map(l => ({
          variant_id: l.variant_id || null,
          product_name: l.product_name,
          quantity: l.quantity,
          unit_price: l.unit_price,
          gst_rate: l.gst_rate,
        })),
      };
      if (mode === "manual") payload.vendor_id = Number(vendorId);
      const r = await staffApi.post("/purchase-returns/", payload);
      setCreated(true);
      alert(`Purchase return ${r.data.return_number} created — Debit note: ${r.data.debit_note_number}`);
      router.push(`/admin/accounting/purchases/return`); // adjust to your actual returns list route
    } catch (e: any) {
      setError(parseApiError(e));
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 28, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: 0 }}>New Purchase Return</h1>
        <p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 0" }}>Return items to a vendor from a purchase, or enter manually</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>

        {/* ── LEFT: main form ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* mode toggle + purchase lookup / vendor lookup */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: "0 0 16px" }}>Return Details</h2>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button onClick={() => switchMode("purchase")} style={{
                padding: "8px 16px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, cursor: "pointer",
                background: mode === "purchase" ? "#eff6ff" : "white",
                color: mode === "purchase" ? "#0284c7" : "#64748b",
                fontWeight: mode === "purchase" ? 600 : 400,
              }}>📦 From Purchase</button>
              <button onClick={() => switchMode("manual")} style={{
                padding: "8px 16px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, cursor: "pointer",
                background: mode === "manual" ? "#eff6ff" : "white",
                color: mode === "manual" ? "#0284c7" : "#64748b",
                fontWeight: mode === "manual" ? 600 : 400,
              }}>✏️ Manual Entry</button>
            </div>

            {mode === "purchase" ? (
              <div>
                <label style={labelStyle}>Purchase Number *</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    style={{ ...inputStyle, borderColor: purchaseNumber ? "#0284c7" : "#e2e8f0" }}
                    placeholder="Enter purchase number…"
                    value={purchaseNumberInput}
                    onChange={e => setPurchaseNumberInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && lookupPurchase()}
                  />
                  <button onClick={lookupPurchase} disabled={fetching}
                    style={{ padding: "8px 18px", background: "#0284c7", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: fetching ? "default" : "pointer", whiteSpace: "nowrap" }}>
                    {fetching ? "Searching…" : "Find"}
                  </button>
                </div>
                {fetchError && <p style={{ color: "#dc2626", fontSize: 12, margin: "8px 0 0" }}>{fetchError}</p>}
                {purchaseNumber && (
                  <p style={{ fontSize: 13, color: "#16a34a", margin: "10px 0 0" }}>
                    ✓ Purchase #{purchaseNumber} — {vendorName}
                  </p>
                )}
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <label style={labelStyle}>Vendor *</label>
                <input
                  style={{ ...inputStyle, borderColor: vendorId ? "#0284c7" : "#e2e8f0" }}
                  placeholder="Search vendor name or phone…"
                  value={vendorSearch}
                  onChange={e => searchVendors(e.target.value)}
                  onFocus={() => setShowVendorDrop(true)}
                />
                {showVendorDrop && vendors.length > 0 && (
                  <div style={dropStyle}>
                    {vendors.map(v => (
                      <div key={v.id} style={dropItem}
                        onClick={() => { setVendorId(String(v.id)); setVendorSearch(v.name); setShowVendorDrop(false); }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                        onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                        <span style={{ fontWeight: 600 }}>{v.name}</span>
                        <span style={{ color: "#94a3b8", fontSize: 12, marginLeft: 8 }}>{v.phone}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p style={{ fontSize: 12, color: "#94a3b8", margin: "10px 0 0" }}>
                  Search and add items directly below — no purchase required.
                </p>
              </div>
            )}
          </div>

          {/* line items */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", margin: 0 }}>Items to Return</h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 80px 110px 70px 100px 36px", gap: 8, padding: "10px 16px", borderBottom: "1px solid #f1f5f9" }}>
              {["Product / Variant", "Qty", "Unit Price", "GST %", "Total", ""].map(h => (
                <div key={h} style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" }}>{h}</div>
              ))}
            </div>

            {lines.map((line, idx) => (
              <div key={idx} style={{ padding: "10px 16px", borderBottom: "1px solid #f8fafc" }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 80px 110px 70px 100px 36px", gap: 8, alignItems: "center" }}>

                  {mode === "manual" ? (
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
                  ) : (
                    <div style={{ fontSize: 13, color: "#0f172a", padding: "8px 0" }}>
                      <div style={{ fontWeight: 600 }}>{line.product_name}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{line.sku}</div>
                    </div>
                  )}

                  <input type="number" min="0" style={inputStyle} value={line.quantity}
                    onChange={e => updateLine(idx, "quantity", e.target.value)} />
                  <input type="number" min="0" style={inputStyle} value={line.unit_price}
                    disabled={mode === "purchase"}
                    onChange={e => updateLine(idx, "unit_price", e.target.value)} />
                  <input type="number" min="0" style={inputStyle} value={line.gst_rate}
                    disabled={mode === "purchase"}
                    onChange={e => updateLine(idx, "gst_rate", e.target.value)} />

                  <div style={{ textAlign: "right", fontWeight: 600, fontSize: 13, color: "#0f172a" }}>
                    {fmt(line.line_total)}
                  </div>

                  {mode === "manual" && (
                    <button onClick={() => removeLine(idx)} disabled={lines.length === 1}
                      style={{ border: "1px solid #fca5a5", background: lines.length === 1 ? "#f8fafc" : "#fff5f5",
                        color: lines.length === 1 ? "#cbd5e1" : "#ef4444", borderRadius: 6,
                        cursor: lines.length === 1 ? "default" : "pointer", fontSize: 16,
                        width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}

            {mode === "manual" && (
              <div style={{ padding: "12px 16px" }}>
                <button onClick={addLine} style={{ padding: "7px 16px", border: "1px dashed #cbd5e1", background: "#f8fafc", borderRadius: 6, fontSize: 13, color: "#475569", cursor: "pointer" }}>
                  + Add Line
                </button>
              </div>
            )}
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
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 13 }}>
              <span style={{ color: "#64748b" }}>Taxable Amount</span>
              <span style={{ color: "#0f172a" }}>{fmt(taxableTotal)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 13 }}>
              <span style={{ color: "#64748b" }}>GST</span>
              <span style={{ color: "#0f172a" }}>{fmt(taxTotal)}</span>
            </div>
            <div style={{ borderTop: "2px solid #e2e8f0", marginTop: 14, paddingTop: 14, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Return Total</span>
              <span style={{ fontWeight: 700, fontSize: 18, color: "#0284c7" }}>{fmt(grandTotal)}</span>
            </div>
          </div>

          <div style={{ padding: "0 18px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            <button onClick={handleSave} disabled={saving || created}
              style={{ padding: "10px", background: (saving || created) ? "#94a3b8" : "#0284c7", color: "#fff", border: "none", borderRadius: 7, fontWeight: 600, fontSize: 14, cursor: (saving || created) ? "default" : "pointer" }}>
              {created ? "✓ Created" : saving ? "Creating…" : "💾 Create Return"}
            </button>
            <button onClick={() => router.back()}
              style={{ padding: "10px", background: "#fff", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 13, cursor: "pointer" }}>
              Cancel
            </button>
          </div>

          <div style={{ padding: "12px 18px", background: "#eff6ff", borderTop: "1px solid #bfdbfe", fontSize: 12, color: "#1e40af" }}>
            ℹ️ Purchase returns are approved immediately — a debit note is issued and stock is deducted right away.
          </div>
        </div>
      </div>
    </div>
  );
}