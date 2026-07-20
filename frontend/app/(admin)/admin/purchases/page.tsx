"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import staffApi from "@/lib/staffApi";
import PageHeader from "@/components/admin/PageHeader";
import DataTable from "@/components/admin/DataTable";

function StatusBadge({ status }: { status: string }) {
  const c: Record<string, { bg: string; color: string }> = {
    draft: { bg: "#f1f5f9", color: "#475569" },
    ordered: { bg: "#dbeafe", color: "#1d4ed8" },
    partially_received: { bg: "#fef3c7", color: "#92400e" },
    received: { bg: "#dcfce7", color: "#166534" },
    cancelled: { bg: "#fee2e2", color: "#991b1b" },
  };
  const col = c[status] || c.draft;
  return <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: col.bg, color: col.color, textTransform: "capitalize" }}>{status.replace("_", " ")}</span>;
}



const INDIAN_STATES: { name: string; code: string }[] = [
  { name: "Jammu and Kashmir", code: "01" },
  { name: "Himachal Pradesh", code: "02" },
  { name: "Punjab", code: "03" },
  { name: "Chandigarh", code: "04" },
  { name: "Uttarakhand", code: "05" },
  { name: "Haryana", code: "06" },
  { name: "Delhi", code: "07" },
  { name: "Rajasthan", code: "08" },
  { name: "Uttar Pradesh", code: "09" },
  { name: "Bihar", code: "10" },
  { name: "Sikkim", code: "11" },
  { name: "Arunachal Pradesh", code: "12" },
  { name: "Nagaland", code: "13" },
  { name: "Manipur", code: "14" },
  { name: "Mizoram", code: "15" },
  { name: "Tripura", code: "16" },
  { name: "Meghalaya", code: "17" },
  { name: "Assam", code: "18" },
  { name: "West Bengal", code: "19" },
  { name: "Jharkhand", code: "20" },
  { name: "Odisha", code: "21" },
  { name: "Chhattisgarh", code: "22" },
  { name: "Madhya Pradesh", code: "23" },
  { name: "Gujarat", code: "24" },
  { name: "Dadra and Nagar Haveli and Daman and Diu", code: "26" },
  { name: "Maharashtra", code: "27" },
  { name: "Karnataka", code: "29" },
  { name: "Goa", code: "30" },
  { name: "Lakshadweep", code: "31" },
  { name: "Kerala", code: "32" },
  { name: "Tamil Nadu", code: "33" },
  { name: "Puducherry", code: "34" },
  { name: "Andaman and Nicobar Islands", code: "35" },
  { name: "Telangana", code: "36" },
  { name: "Andhra Pradesh", code: "37" },
  { name: "Ladakh", code: "38" },
];



export default function PurchasesPage() {
  const [purchases, setPurchases] = useState([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [refreshingProducts, setRefreshingProducts] = useState(false);
  const [vendorForm, setVendorForm] = useState({
    name: "", gstin: "", phone: "", email: "",
    contact_person: "", city: "",
    state: "Kerala", state_code: "32",
  });
  const [savingVendor, setSavingVendor] = useState(false);
  const saveVendor = async () => {
    if (!vendorForm.name.trim()) {
      alert("Vendor name  required");
      return;
    }
    setSavingVendor(true);
    try {
      const res = await staffApi.post("/vendors/", vendorForm);
      // POST only returns {id, code, name} — refetch full list so the
      // dropdown has state_code etc. for the is_interstate calc later
      const vr = await staffApi.get("/vendors/");
      setVendors(vr.data || []);
      setForm((f) => ({ ...f, vendor_id: String(res.data.id) }));
      setShowVendorModal(false);
      setVendorForm({ name: "", gstin: "", phone: "", email: "", contact_person: "", city: "", state: "Kerala", state_code: "32" });
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to add vendor");
    } finally {
      setSavingVendor(false);
    }
  };
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ vendor_id: "", purchase_date: new Date().toISOString().split("T")[0], vendor_invoice_number: "", notes: "" });
  const [items, setItems] = useState([{
    product_id: '',
    product_name: "",
    variant_id: '',
    quantity: "1",
    unit_price: "",
    gst_rate: "18",
    unit: "Nos"
  }]);
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

  const addItem = () => setItems([...items, { product_id: '', variant_id: "", product_name: "", quantity: "1", unit_price: "", gst_rate: "18", unit: "Nos" }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, key: string, val: string) => setItems(items.map((item, idx) => idx === i ? { ...item, [key]: val } : item));

  const updateItemFields = (i: number, fields: Record<string, string>) => {
    setItems(items.map((item, idx) => idx === i ? { ...item, ...fields } : item));
  };
  // state
  const [productSearch, setProductSearch] = useState<Record<number, string>>({});
  const [showProductDropdown, setShowProductDropdown] = useState<number | null>(null);
  const productBoxRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (showProductDropdown === null) return;
      const ref = productBoxRefs.current[showProductDropdown];
      if (ref && !ref.contains(e.target as Node)) setShowProductDropdown(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showProductDropdown]);


  const [showReceiveModal, setShowReceiveModal] = useState(false);
const [receivingPurchase, setReceivingPurchase] = useState<any>(null);
const [receiveQtys, setReceiveQtys] = useState<Record<number, string>>({});
const [receiving, setReceiving] = useState(false);

async function openReceiveModal(purchaseNumber: string) {
  try {
    const res = await staffApi.get(`/purchases/${encodeURIComponent(purchaseNumber)}`);
    const p = res.data;
    setReceivingPurchase(p);
    const initial: Record<number, string> = {};
    for (const item of p.items) {
      const outstanding = Number(item.quantity) - Number(item.received_qty || 0);
      initial[item.id] = outstanding > 0 ? String(outstanding) : "0";
    }
    setReceiveQtys(initial);
    setShowReceiveModal(true);
  } catch (e: any) {
    alert(e.response?.data?.detail || "Failed to load purchase details");
  }
}

async function confirmReceive() {
  if (!receivingPurchase) return;
  setReceiving(true);
  try {
    const payload = {
      items: receivingPurchase.items.map((item: any) => ({
        item_id: item.id,
        received_qty: parseFloat(receiveQtys[item.id] || "0"),
      })),
    };
    const res = await staffApi.patch(
      `/purchases/${encodeURIComponent(receivingPurchase.purchase_number)}/receive`,
      payload
    );
    setShowReceiveModal(false);
    setReceivingPurchase(null);
    load();
    alert(res.data.message || "Stock updated!");
  } catch (e: any) {
    alert(e.response?.data?.detail || "Failed to receive");
  } finally {
    setReceiving(false);
  }
}


  function pickProductForRow(idx: number, p: any) {
    updateItemFields(idx, {
      product_id: String(p.id),
      product_name: p.name,
      variant_id: "",
      unit_price: "0",
      gst_rate: String(p.gst_rate ?? 18),
      unit: "Nos",
    });
    setProductSearch((s) => ({ ...s, [idx]: "" }));
    setShowProductDropdown(null);
  }

  const refreshProducts = async () => {
    setRefreshingProducts(true);
    try {
      const pd = await staffApi.get("/products/");
      setProducts(Array.isArray(pd.data) ? pd.data : pd.data?.items || []);
    } catch {
      alert("Failed to refresh product list");
    } finally {
      setRefreshingProducts(false);
    }
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
      setItems([{ product_id: '', product_name: "", variant_id: '', quantity: "1", unit_price: "", gst_rate: "18", unit: "Nos" }]);
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
        <a href={`/admin/purchases/${encodeURIComponent(r.purchase_number)}`}
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
    return (r.status === "ordered" || r.status === "partially_received") ? (
      <button
        onClick={() => openReceiveModal(r.purchase_number)}
        style={{ fontSize: 12, color: "#16a34a", background: "#dcfce7", border: "none", padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>
        Receive Stock
      </button>
    ) : <span style={{ fontSize: 12, color: "#94a3b8" }}>{r.status.replace("_", " ")}</span>;
  }
},
  ];

  return (
    <div style={{ padding: 32 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        marginBottom: 16,
        fontSize: 13, color: "#94a3b8",
      }}>
        <Link href="/admin/accounting"
          style={{ color: "#94a3b8", textDecoration: "none" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#475569")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
        >
          Accounting
        </Link>
        <span>/</span>
        <span style={{ color: "#c2410c", fontWeight: 600 }}>
          📦 Purchases
        </span>
      </div>

      <PageHeader title="Purchases" subtitle="Track stock purchases from vendors"
        action={<button className="btn-primary" onClick={() => setShowForm(true)}>+ New Purchase</button>} />

      {showVendorModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div className="card" style={{ padding: 24, width: 460 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Add New Vendor</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className="label">Vendor Name*</label>
                <input className="input-field" value={vendorForm.name}
                  onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                  placeholder="Eg: ABC Glass Suppliers" />
              </div>

              <div>
                <label className="label">Phone</label>
                <input className="input-field" value={vendorForm.phone}
                  onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })} />
              </div>
              <div>
                <label className="label">Contact Person</label>
                <input className="input-field" value={vendorForm.contact_person}
                  onChange={(e) => setVendorForm({ ...vendorForm, contact_person: e.target.value })} />
              </div>
              <div>
                <label className="label">GSTIN</label>
                <input className="input-field" value={vendorForm.gstin}
                  onChange={(e) => setVendorForm({ ...vendorForm, gstin: e.target.value })} />
              </div>
              <div>
                <label className="label">City</label>
                <input className="input-field" value={vendorForm.city}
                  onChange={(e) => setVendorForm({ ...vendorForm, city: e.target.value })} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="label">State*</label>
                <select
                  className="input-field"
                  value={vendorForm.state_code}
                  onChange={(e) => {
                    const chosen = INDIAN_STATES.find((s) => s.code === e.target.value);
                    setVendorForm({ ...vendorForm, state_code: e.target.value, state: chosen?.name || "" });
                  }}
                >
                  {INDIAN_STATES.map((s) => (
                    <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button className="btn-primary" onClick={saveVendor} disabled={savingVendor}>
                {savingVendor ? "Saving..." : "Add Vendor"}
              </button>
              <button className="btn-outline" onClick={() => setShowVendorModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showReceiveModal && receivingPurchase && (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
    <div className="card" style={{ padding: 24, width: 620, maxHeight: "80vh", overflowY: "auto" }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>Receive Stock — {receivingPurchase.purchase_number}</h3>
      <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 16px" }}>
        Enter quantity received now for each item. Leftover stays outstanding.
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
            <th style={{ textAlign: "left", padding: "6px 8px", fontSize: 12, color: "#64748b" }}>Product</th>
            <th style={{ textAlign: "right", padding: "6px 8px", fontSize: 12, color: "#64748b" }}>Ordered</th>
            <th style={{ textAlign: "right", padding: "6px 8px", fontSize: 12, color: "#64748b" }}>Already Received</th>
            <th style={{ textAlign: "right", padding: "6px 8px", fontSize: 12, color: "#64748b" }}>Receive Now</th>
          </tr>
        </thead>
        <tbody>
          {receivingPurchase.items.map((item: any) => {
            const already = Number(item.received_qty || 0);
            const outstanding = Number(item.quantity) - already;
            return (
              <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "6px 8px" }}>
                  {item.product_name}
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{item.variant_sku || "—"}</div>
                </td>
                <td style={{ padding: "6px 8px", textAlign: "right" }}>{item.quantity}</td>
                <td style={{ padding: "6px 8px", textAlign: "right", color: "#94a3b8" }}>{already}</td>
                <td style={{ padding: "6px 8px", textAlign: "right" }}>
                  <input
                    type="number"
                    min={0}
                    max={outstanding}
                    className="input-field"
                    style={{ width: 90, textAlign: "right" }}
                    value={receiveQtys[item.id] ?? "0"}
                    onChange={(e) => setReceiveQtys((s) => ({ ...s, [item.id]: e.target.value }))}
                    disabled={outstanding <= 0}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        <button className="btn-primary" onClick={confirmReceive} disabled={receiving}>
          {receiving ? "Saving..." : "Confirm Receive"}
        </button>
        <button className="btn-outline" onClick={() => { setShowReceiveModal(false); setReceivingPurchase(null); }}>
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
      {showForm && (
        <div className="card" style={{ padding: 14, marginBottom: 14 }}>
          <h3 style={{ fontSize: 13, fontWeight: 400, margin: "0 0 16px" }}>New Purchase Order</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
            <div>
              <label className="label">Vendor*</label>
              <select
                className="input-field"
                value={form.vendor_id}
                onChange={(e) => {
                  if (e.target.value === "__new__") {
                    setShowVendorModal(true);
                    return;
                  }
                  setForm({ ...form, vendor_id: e.target.value });
                }}
              >
                <option value="">Select vendor</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                <option value="__new__" style={{ fontWeight: 600, color: "#0284c7" }}>+ Add New Vendor</option>
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
          <h4 style={{ fontSize: 13, fontWeight: 400, color: "#475569", marginBottom: 10 }}>Items</h4>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 10 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "8px 8px", width: 36, textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748b" }}>No</th>
                <th style={{ padding: "8px 8px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748b" }}>Product</th>
                <th style={{ padding: "8px 8px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748b" }}>Variant</th>
                <th style={{ padding: "8px 8px", width: 80, textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748b" }}>Qty</th>
                <th style={{ padding: "8px 8px", width: 130, textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748b" }}>Unit Price ₹</th>
                <th style={{ padding: "8px 8px", width: 80, textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748b" }}>GST %</th>
                <th style={{ padding: "8px 8px", width: 90, textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748b" }}>Unit</th>
                <th style={{ padding: "8px 8px", width: 110, textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748b" }}>Total ₹</th>
                <th style={{ padding: "8px 8px", width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const qty = parseFloat(item.quantity || "0");
                const rate = parseFloat(item.unit_price || "0");
                const gst = parseFloat(item.gst_rate || "0");
                const lineTotal = qty * rate * (1 + gst / 100);
                const product = products.find((x: any) => x.id === Number(item.product_id));

                return (
                  <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "6px 8px", color: "#94a3b8" }}>{idx + 1}</td>

                    <td style={{ padding: "6px 8px", minWidth: 160 }}>
                      <div
                        ref={(el) => { productBoxRefs.current[idx] = el; }}
                        style={{ position: "relative" }}
                      >
                       
                        <input
                          className="input-field"
                          placeholder="Type to search product..."
                          value={showProductDropdown === idx ? (productSearch[idx] || "") : (item.product_name || "")}
                          onFocus={() => { setShowProductDropdown(idx); setProductSearch((s) => ({ ...s, [idx]: "" })); }}
                          onChange={(e) => setProductSearch((s) => ({ ...s, [idx]: e.target.value }))}
                        />
                        {showProductDropdown === idx && (
                          <div style={{
                            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
                            background: "white", border: "1px solid #e2e8f0", borderRadius: 8,
                            marginTop: 4, maxHeight: 220, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
                          }}>
                            {products
                              .filter((p: any) => p.name.toLowerCase().includes((productSearch[idx] || "").toLowerCase()))
                              .map((p: any) => (
                                <div key={p.id} onClick={() => pickProductForRow(idx, p)}
                                  style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13 }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = "white")}>
                                  {p.name}
                                </div>
                              ))}
                            <div onClick={() => window.open("/admin/products/new", "_blank")}
                              style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#0284c7", borderTop: "1px solid #f1f5f9" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f9ff")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "white")}>
                              + Add New Product (opens in new tab)
                            </div>
                          </div>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: "6px 8px", minWidth: 150 }}>
                      <select
                        className="input-field"
                        style={{ width: "100%" }}
                        value={item.variant_id || ""}
                        onChange={(e) => {
                          const variantId = e.target.value;
                          const variant = product?.variants?.find((v: any) => String(v.id) === variantId);
                          updateItemFields(idx, {
                            variant_id: variantId,
                            unit_price: variant?.cost_price ? String(variant.cost_price) : item.unit_price,
                          });
                        }}
                      >
                        <option value="">Select Variant</option>
                        {product?.variants?.map((v: any) => (
                          <option key={v.id} value={v.id}>
                            {Object.values(v.selected_attributes || {}).join(" / ") || "Default"} — {v.sku}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td style={{ padding: "6px 8px", width: 80 }}>
                      <input type="number" className="input-field" style={{ width: "100%", paddingRight: 4 }}
                        value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} />
                    </td>

                    <td style={{ padding: "6px 8px", width: 130 }}>
                      <input type="number" className="input-field" style={{ width: "100%", paddingRight: 4 }}
                        value={item.unit_price} onChange={(e) => updateItem(idx, "unit_price", e.target.value)}
                        placeholder="0.00" />
                    </td>

                    <td style={{ padding: "6px 8px", width: 80 }}>
                      <input type="number" className="input-field" style={{ width: "100%", paddingRight: 4 }}
                        value={item.gst_rate} onChange={(e) => updateItem(idx, "gst_rate", e.target.value)} />
                    </td>

                    <td style={{ padding: "6px 8px", width: 90 }}>
                      <input className="input-field" style={{ width: "100%" }}
                        value={item.unit} onChange={(e) => updateItem(idx, "unit", e.target.value)} />
                    </td>

                    <td style={{ padding: "6px 8px", fontWeight: 600, whiteSpace: "nowrap" }}>
                      ₹{lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>

                    <td style={{ padding: "6px 8px" }}>
                      <button onClick={() => removeItem(idx)} disabled={items.length <= 1}
                        style={{ background: "#fee2e2", border: "none", borderRadius: 5, color: "#dc2626", cursor: items.length <= 1 ? "not-allowed" : "pointer", padding: "4px 8px", opacity: items.length <= 1 ? 0.4 : 1 }}>
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #e2e8f0" }}>
                <td colSpan={7} style={{ padding: "8px 8px", fontWeight: 700, textAlign: "right" }}>Grand Total</td>
                <td colSpan={2} style={{ padding: "8px 8px", fontWeight: 700 }}>
                  ₹{items.reduce((sum, item) => {
                    const q = parseFloat(item.quantity || "0");
                    const r = parseFloat(item.unit_price || "0");
                    const g = parseFloat(item.gst_rate || "0");
                    return sum + q * r * (1 + g / 100);
                  }, 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>

         <button onClick={addItem} className="btn-outline" style={{ fontSize: 13 }}>+ Add Item</button>
  <button onClick={refreshProducts} disabled={refreshingProducts} className="btn-outline" style={{ fontSize: 13 }}>
    {refreshingProducts ? "Refreshing..." : "🔄 Refresh Products"}
  </button>
          <div style={{ display: "flex", gap: 5 }}>
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
