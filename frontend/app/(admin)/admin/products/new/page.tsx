"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import PageHeader from "@/components/admin/PageHeader";


interface AttrValue { value: string; }
interface Attr { name: string; display_name: string; values: AttrValue[]; }
interface Variant {
  sku: string;
  selected_attributes: Record<string, string>;
  price: string;
  trade_price: string;
  cost_price: string;
  compare_price: string;
  stock_qty: string;
  weight_kg: string;
}

export default function AddProductPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [info, setInfo] = useState({ name: "", short_description: "", description: "", category_id: "", hsn_code: "", gst_rate: "18", price_type: "fixed", is_featured: false });
  const [attrs, setAttrs] = useState<Attr[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [bulk, setBulk] = useState({ price: "", trade_price: "", cost_price: "", stock_qty: "" });
  const [simplePrice, setSimplePrice] = useState("");
  const [simpleTradePrice, setSimpleTradePrice] = useState("");
  const [simpleCostPrice, setSimpleCostPrice] = useState("");
  const [simpleStock, setSimpleStock] = useState("0");

  useEffect(() => { api.get("/categories/").then(r => setCategories(r.data || [])).catch(() => { }); }, []);

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    setAddingCat(true);
    try { const res = await api.post("/categories/", { name: newCatName }); setCategories([...categories, res.data]); setInfo({ ...info, category_id: String(res.data.id) }); setNewCatName(""); }
    catch { alert("Failed to add category"); } finally { setAddingCat(false); }
  };

  const addAttr = () => setAttrs([...attrs, { name: "", display_name: "", values: [{ value: "" }] }]);
  const removeAttr = (i: number) => { const a = [...attrs]; a.splice(i, 1); setAttrs(a); setVariants([]); };
  const updateAttr = (i: number, key: keyof Attr, val: string) => { const a = [...attrs]; (a[i] as any)[key] = val; if (key === "name") a[i].display_name = a[i].display_name || val; setAttrs(a); setVariants([]); };
  const addAttrValue = (i: number) => { const a = [...attrs]; a[i].values.push({ value: "" }); setAttrs(a); };
  const removeAttrValue = (ai: number, vi: number) => { const a = [...attrs]; a[ai].values.splice(vi, 1); setAttrs(a); };
  const updateAttrValue = (ai: number, vi: number, val: string) => { const a = [...attrs]; a[ai].values[vi].value = val; setAttrs(a); setVariants([]); };

  const generateVariants = () => {
    const validAttrs = attrs.filter(a => a.name && a.values.some(v => v.value.trim()));
    if (validAttrs.length === 0) { alert("Add at least one attribute with values"); return; }
    const combos = validAttrs.reduce<Record<string, string>[]>((acc, attr) => {
      const vals = attr.values.filter(v => v.value.trim());
      if (acc.length === 0) return vals.map(v => ({ [attr.name]: v.value }));
      return acc.flatMap(combo => vals.map(v => ({ ...combo, [attr.name]: v.value })));
    }, []);
    const prefix = info.name.toUpperCase().replace(/\s+/g, "-").slice(0, 6) || "PROD";
    setVariants(combos.map((combo, i) => ({
      sku: `${prefix}-${Object.values(combo).join("-").toUpperCase().replace(/\s+/g, "")}-${String(i + 1).padStart(3, "0")}`,
      selected_attributes: combo,
      price: "", trade_price: "", cost_price: "", compare_price: "", stock_qty: "0", weight_kg: "",
    })));
  };

  const updateVariant = (i: number, key: keyof Variant, val: string) => { const v = [...variants]; (v[i] as any)[key] = val; setVariants(v); };

  const applyBulk = () => setVariants(variants.map(v => ({
    ...v,
    ...(bulk.price ? { price: bulk.price } : {}),
    ...(bulk.trade_price ? { trade_price: bulk.trade_price } : {}),
    ...(bulk.cost_price ? { cost_price: bulk.cost_price } : {}),
    ...(bulk.stock_qty ? { stock_qty: bulk.stock_qty } : {}),
  })));

  const save = async () => {
    if (!info.name.trim()) { alert("Product name is required"); return; }

    let finalVariants = variants;

    // If no variants generated, create one default variant
    if (finalVariants.length === 0) {
      if (!simplePrice) { alert("Please enter at least a retail price"); return; }
      finalVariants = [{
        sku: info.name.toUpperCase().replace(/\s+/g, "-").slice(0, 10) + "-001",
        selected_attributes: {},
        price: simplePrice,
        trade_price: simpleTradePrice,
        cost_price: simpleCostPrice,
        compare_price: "",
        stock_qty: simpleStock,
        weight_kg: "",
      }];
    } else {
      if (finalVariants.some(v => !v.price)) { alert("All variants need a retail price"); return; }
    }

    setSaving(true);
    try {
      const res = await api.post("/products/", {
        name: info.name, short_description: info.short_description,
        description: info.description,
        category_id: info.category_id ? parseInt(info.category_id) : null,
        hsn_code: info.hsn_code, gst_rate: parseFloat(info.gst_rate),
        price_type: info.price_type, is_featured: info.is_featured,
        attributes: attrs.filter(a => a.name).map(a => ({
          name: a.name, display_name: a.display_name || a.name,
          values: a.values.filter(v => v.value.trim()).map((v, i) => ({ value: v.value, sort_order: i })),
        })),
        variants: finalVariants.map(v => ({
          sku: v.sku, selected_attributes: v.selected_attributes,
          price: parseFloat(v.price),
          trade_price: v.trade_price ? parseFloat(v.trade_price) : null,
          cost_price: v.cost_price ? parseFloat(v.cost_price) : null,
          compare_price: v.compare_price ? parseFloat(v.compare_price) : null,
          stock_qty: parseInt(v.stock_qty) || 0,
          weight_kg: v.weight_kg ? parseFloat(v.weight_kg) : null,
        })),
      });
      router.push(`/admin/products/${res.data.id}`);
    } catch (e: any) { alert(e.response?.data?.detail || "Failed to save product"); }
    finally { setSaving(false); }
  };

  const inp = { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", outline: "none" };
  const lbl = { display: "block", fontSize: 13, fontWeight: 500, color: "#475569", marginBottom: 5 } as const;

  return (
    <div style={{ padding: 32, maxWidth: 1000 }}>
      <PageHeader title="Add Product" subtitle="Fill in details, attributes and variants"
        action={<div style={{ display: "flex", gap: 10 }}>
          <button className="btn-outline" onClick={() => router.back()}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Product"}</button>
        </div>} />

      {/* Basic Info */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Basic Information</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ gridColumn: "1/-1" }}><label style={lbl}>Product Name *</label><input style={inp} placeholder="Eg: Clear Float Glass" value={info.name} onChange={e => setInfo({ ...info, name: e.target.value })} /></div>
          <div style={{ gridColumn: "1/-1" }}><label style={lbl}>Short Description</label><input style={inp} placeholder="Brief one-line description" value={info.short_description} onChange={e => setInfo({ ...info, short_description: e.target.value })} /></div>
          <div style={{ gridColumn: "1/-1" }}><label style={lbl}>Full Description</label><textarea style={{ ...inp, height: 80, resize: "vertical" as const }} placeholder="Detailed product description" value={info.description} onChange={e => setInfo({ ...info, description: e.target.value })} /></div>
          <div>
            <label style={lbl}>Category</label>
            <select style={inp} value={info.category_id} onChange={e => setInfo({ ...info, category_id: e.target.value })}>
              <option value="">Select category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <input style={{ ...inp, padding: "7px 10px", fontSize: 13 }} placeholder="Or add new category" value={newCatName} onChange={e => setNewCatName(e.target.value)} />
              <button onClick={addCategory} disabled={addingCat} style={{ padding: "7px 14px", borderRadius: 6, background: "#0284c7", color: "white", border: "none", cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" as const }}>{addingCat ? "..." : "+ Add"}</button>
            </div>
          </div>
          <div>
            <label style={lbl}>Price Type *</label>
            <select style={inp} value={info.price_type} onChange={e => setInfo({ ...info, price_type: e.target.value })}>
              <option value="fixed">Fixed Price (per unit)</option>
              <option value="per_sqft">Per Sq.ft (custom dimensions)</option>
            </select>
          </div>
          <div><label style={lbl}>HSN Code</label><input style={inp} placeholder="Eg: 70051090" value={info.hsn_code} onChange={e => setInfo({ ...info, hsn_code: e.target.value })} /></div>
          <div>
            <label style={lbl}>GST Rate (%)</label>
            <select style={inp} value={info.gst_rate} onChange={e => setInfo({ ...info, gst_rate: e.target.value })}>
              <option value="0">0% (Exempt)</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option>
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input type="checkbox" id="featured" checked={info.is_featured} onChange={e => setInfo({ ...info, is_featured: e.target.checked })} style={{ width: 16, height: 16 }} />
            <label htmlFor="featured" style={{ fontSize: 14, color: "#475569", cursor: "pointer" }}>Mark as Featured Product</label>
          </div>
        </div>
      </div>

      {/* Attributes */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div><h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Attributes</h2><p style={{ fontSize: 13, color: "#64748b", margin: "3px 0 0" }}>Define options like Thickness, Finish, Color</p></div>
          <button onClick={addAttr} style={{ padding: "7px 14px", borderRadius: 7, background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#475569", cursor: "pointer", fontSize: 13 }}>+ Add Attribute</button>
        </div>
        {attrs.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 14, border: "1px dashed #e2e8f0", borderRadius: 8 }}>No attributes yet. Add options like Thickness → 4mm, 6mm, 8mm</div>}
        {attrs.map((attr, ai) => (
          <div key={ai} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}><label style={lbl}>Attribute Name</label><input style={inp} placeholder="Eg: Thickness" value={attr.name} onChange={e => updateAttr(ai, "name", e.target.value)} /></div>
              <div style={{ flex: 1 }}><label style={lbl}>Display Name</label><input style={inp} placeholder="Eg: Glass Thickness" value={attr.display_name} onChange={e => updateAttr(ai, "display_name", e.target.value)} /></div>
              <button onClick={() => removeAttr(ai)} style={{ padding: "9px 12px", borderRadius: 6, background: "#fee2e2", border: "none", color: "#dc2626", cursor: "pointer" }}>✕</button>
            </div>
            <div>
              <label style={lbl}>Values</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {attr.values.map((val, vi) => (
                  <div key={vi} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input style={{ ...inp, width: 100 }} placeholder="Eg: 4mm" value={val.value} onChange={e => updateAttrValue(ai, vi, e.target.value)} />
                    {attr.values.length > 1 && <button onClick={() => removeAttrValue(ai, vi)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 16 }}>✕</button>}
                  </div>
                ))}
                <button onClick={() => addAttrValue(ai)} style={{ padding: "8px 12px", borderRadius: 6, background: "#f8fafc", border: "1px dashed #cbd5e1", color: "#64748b", cursor: "pointer", fontSize: 13 }}>+ Value</button>
              </div>
            </div>
          </div>
        ))}
        {attrs.length > 0 && <button onClick={generateVariants} style={{ padding: "9px 20px", borderRadius: 8, background: "#0284c7", color: "white", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500, marginTop: 8 }}>⚡ Generate Variants</button>}
      </div>
      {/* Simple Pricing — shown when no attributes/variants */}
      {variants.length === 0 && (
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>Pricing & Stock</h2>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>
            Simple product with no variants — or add attributes above to generate variants with individual prices.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
            <div>
              <label style={lbl}>Retail Price ₹ *</label>
              <input type="number" style={{ ...inp, borderColor: "#fca5a5" }} placeholder="0.00" value={simplePrice} onChange={e => setSimplePrice(e.target.value)} />
              <p style={{ fontSize: 11, color: "#94a3b8", margin: "4px 0 0" }}>Public / regular customer price</p>
            </div>
            <div>
              <label style={lbl}>Trade Price ₹</label>
              <input type="number" style={inp} placeholder="0.00" value={simpleTradePrice} onChange={e => setSimpleTradePrice(e.target.value)} />
              <p style={{ fontSize: 11, color: "#94a3b8", margin: "4px 0 0" }}>Approved buyer price</p>
            </div>
            <div>
              <label style={lbl}>Cost Price ₹</label>
              <input type="number" style={inp} placeholder="0.00" value={simpleCostPrice} onChange={e => setSimpleCostPrice(e.target.value)} />
              <p style={{ fontSize: 11, color: "#94a3b8", margin: "4px 0 0" }}>Internal cost (not shown to customers)</p>
            </div>
            <div>
              <label style={lbl}>Stock Qty</label>
              <input type="number" style={inp} placeholder="0" value={simpleStock} onChange={e => setSimpleStock(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Variants */}
      {variants.length > 0 && (
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Variants & Pricing</h2>
            <p style={{ fontSize: 13, color: "#64748b", margin: "3px 0 0" }}>{variants.length} variants — fill in prices below</p>
          </div>
          {/* Bulk fill */}
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: "#475569", margin: "0 0 10px" }}>Bulk Fill (apply same value to all variants)</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              {[{ key: "price", ph: "Retail Price ₹" }, { key: "trade_price", ph: "Trade Price ₹" }, { key: "cost_price", ph: "Cost Price ₹" }, { key: "stock_qty", ph: "Stock Qty" }].map(f => (
                <input key={f.key} style={{ ...inp, width: 140 }} placeholder={f.ph} value={(bulk as any)[f.key]} onChange={e => setBulk({ ...bulk, [f.key]: e.target.value })} />
              ))}
              <button onClick={applyBulk} style={{ padding: "9px 16px", borderRadius: 7, background: "#475569", color: "white", border: "none", cursor: "pointer", fontSize: 13 }}>Apply to All</button>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                {["Variant", "SKU", "Cost ₹", "Retail ₹ *", "Trade ₹", "MRP ₹", "Stock"].map((h, i) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 8px", color: "#64748b", fontWeight: 600, fontSize: 12, background: i === 3 ? "#fef9c3" : i === 4 ? "#d1fae5" : "transparent" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {variants.map((v, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 8px" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {Object.entries(v.selected_attributes).map(([k, val]) => (
                          <span key={k} style={{ fontSize: 11, background: "#eff6ff", color: "#0369a1", padding: "2px 7px", borderRadius: 4 }}>{val}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: "6px 6px" }}><input style={{ ...inp, width: 140, padding: "6px 8px", fontSize: 12 }} value={v.sku} onChange={e => updateVariant(i, "sku", e.target.value)} /></td>
                    <td style={{ padding: "6px 6px" }}><input type="number" style={{ ...inp, width: 85, padding: "6px 8px" }} placeholder="0.00" value={v.cost_price} onChange={e => updateVariant(i, "cost_price", e.target.value)} /></td>
                    <td style={{ padding: "6px 6px", background: "#fefce8" }}><input type="number" style={{ ...inp, width: 85, padding: "6px 8px", borderColor: v.price ? "#e2e8f0" : "#fca5a5" }} placeholder="0.00 *" value={v.price} onChange={e => updateVariant(i, "price", e.target.value)} /></td>
                    <td style={{ padding: "6px 6px", background: "#f0fdf4" }}><input type="number" style={{ ...inp, width: 85, padding: "6px 8px" }} placeholder="0.00" value={v.trade_price} onChange={e => updateVariant(i, "trade_price", e.target.value)} /></td>
                    <td style={{ padding: "6px 6px" }}><input type="number" style={{ ...inp, width: 85, padding: "6px 8px" }} placeholder="0.00" value={v.compare_price} onChange={e => updateVariant(i, "compare_price", e.target.value)} /></td>
                    <td style={{ padding: "6px 6px" }}><input type="number" style={{ ...inp, width: 70, padding: "6px 8px" }} placeholder="0" value={v.stock_qty} onChange={e => updateVariant(i, "stock_qty", e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, fontSize: 12, color: "#64748b" }}>
            <span style={{ background: "#fef9c3", padding: "2px 8px", borderRadius: 4 }}>🟡 Retail = Public price</span>
            <span style={{ background: "#d1fae5", padding: "2px 8px", borderRadius: 4 }}>🟢 Trade = Approved buyer price</span>
            <span style={{ background: "#f1f5f9", padding: "2px 8px", borderRadius: 4 }}>⚫ Cost = Internal only</span>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button className="btn-outline" onClick={() => router.back()}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={saving} style={{ minWidth: 140 }}>{saving ? "Saving..." : "Save Product"}</button>
      </div>
    </div>
  );
}
