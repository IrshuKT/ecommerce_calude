"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import staffApi from "@/lib/staffApi";
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
  imageFile?: File | null;
  imagePreview?: string;
}

export default function AddProductPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [showCatInput, setShowCatInput] = useState(false);
  const [itemType, setItemType] = useState<"product" | "service">("product");
  const [info, setInfo] = useState({ name: "", short_description: "", description: "", category_id: "", hsn_code: "", gst_rate: "18", price_type: "fixed", is_featured: false });
  const [attrs, setAttrs] = useState<Attr[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [bulk, setBulk] = useState({ price: "", trade_price: "", cost_price: "", stock_qty: "" });
  const [simplePrice, setSimplePrice] = useState("");
  const [simpleTradePrice, setSimpleTradePrice] = useState("");
  const [simpleCostPrice, setSimpleCostPrice] = useState("");
  const [simpleStock, setSimpleStock] = useState("0");
  const [tree, setTree] = useState<any[]>([]);
  const [selectedPath, setSelectedPath] = useState<string[]>([]);

  useEffect(() => {
  staffApi.get("/categories/tree").then(r => setTree(r.data || []));
}, []);

  const getOptionsAtLevel = (level: number) => {
  let nodes = tree;
  for (let i = 0; i < level; i++) {
    const chosen = nodes.find(n => String(n.id) === selectedPath[i]);
    if (!chosen) return [];
    nodes = chosen.children;
  }
  return nodes;
};

const onSelectAtLevel = (level: number, id: string) => {
  const newPath = [...selectedPath.slice(0, level), id];
  setSelectedPath(newPath);
  // leaf = deepest selected node with no children
  const options = getOptionsAtLevel(level);
  const node = options.find(n => String(n.id) === id);
  setInfo({ ...info, category_id: id }); // always store the deepest chosen one
  if (!node?.children?.length) return; // no further levels
};
  const isService = itemType === "service";

  const addCategory = async () => {
  if (!newCatName.trim()) return;
  setAddingCat(true);
  try {
    const parentId = selectedPath[selectedPath.length - 1] || null;
    const res = await staffApi.post("/categories/", { name: newCatName, parent_id: parentId ? parseInt(parentId) : null });
    const newNode = { id: res.data.id, name: res.data.name, slug: res.data.slug, children: [] };

    if (!parentId) {
      setTree([...tree, newNode]);
    } else {
      // deep-update: find parent node in tree and push child
      const addChild = (nodes: any[]): any[] => nodes.map(n =>
        String(n.id) === parentId ? { ...n, children: [...n.children, newNode] }
        : { ...n, children: addChild(n.children) }
      );
      setTree(addChild(tree));
    }
    setInfo({ ...info, category_id: String(res.data.id) });
    setSelectedPath([...selectedPath, String(res.data.id)]);
    setNewCatName(""); setShowCatInput(false);
  } catch { alert("Failed to add category"); } finally { setAddingCat(false); }
};
  


  const addAttr = () => setAttrs([...attrs, { name: "", display_name: "", values: [{ value: "" }] }]);
  const removeAttr = (i: number) => { const a = [...attrs]; a.splice(i, 1); setAttrs(a); setVariants([]); };
  const updateAttr = (i: number, key: keyof Attr, val: string) => { const a = [...attrs]; (a[i] as any)[key] = val; if (key === "name") a[i].display_name = a[i].display_name || val; setAttrs(a); setVariants([]); };
  const addAttrValue = (i: number) => { const a = [...attrs]; a[i].values.push({ value: "" }); setAttrs(a); };
  const removeAttrValue = (ai: number, vi: number) => { const a = [...attrs]; a[ai].values.splice(vi, 1); setAttrs(a); };
  const updateAttrValue = (ai: number, vi: number, val: string) => { const a = [...attrs]; a[ai].values[vi].value = val; setAttrs(a); setVariants([]); };

  const generateVariants = () => {
    const validAttrs = attrs.filter(a => a.name.trim() && a.values.some(v => v.value.trim()));
    if (validAttrs.length === 0) { alert("Add at least one attribute with values"); return; }

    const combos = validAttrs.reduce<Record<string, string>[]>((acc, attr) => {
      const vals = attr.values.filter(v => v.value.trim() !== "");
      if (vals.length === 0) return acc;
      if (acc.length === 0) return vals.map(v => ({ [attr.name]: v.value }));
      return acc.flatMap(combo => vals.map(v => ({ ...combo, [attr.name]: v.value })));
    }, []);

    const validCombos = combos.filter(combo => Object.values(combo).every(v => v.trim() !== ""));
    if (validCombos.length === 0) { alert("No valid combinations found. Check your attribute values."); return; }

    const prefix = info.name.toUpperCase().replace(/\s+/g, "-").slice(0, 6) || "PROD";
    setVariants(validCombos.map((combo, i) => ({
  sku: `${prefix}-${Object.values(combo).join("-").toUpperCase().replace(/\s+/g, "").replace(/"/g, "IN")}-${String(i + 1).padStart(3, "0")}`,
  selected_attributes: combo,
  price: "", trade_price: "", cost_price: "", compare_price: "",
  stock_qty: "0", weight_kg: "",
  imageFile: null, imagePreview: "",
})));
  };

  const setVariantImage = (i: number, file: File | null) => {
  const v = [...variants];
  v[i].imageFile = file;
  v[i].imagePreview = file ? URL.createObjectURL(file) : "";
  setVariants(v);
};

  const updateVariant = (i: number, key: keyof Variant, val: string) => { const v = [...variants]; (v[i] as any)[key] = val; setVariants(v); };

  const applyBulk = () => setVariants(variants.map(v => ({
    ...v,
    ...(bulk.price ? { price: bulk.price } : {}),
    ...(bulk.trade_price ? { trade_price: bulk.trade_price } : {}),
    ...(bulk.cost_price ? { cost_price: bulk.cost_price } : {}),
    ...(!isService && bulk.stock_qty ? { stock_qty: bulk.stock_qty } : {}),
  })));

  const save = async () => {
    if (!info.name.trim()) { alert("Product name is required"); return; }

    let finalVariants = variants;
    if (finalVariants.length === 0) {
      if (!simplePrice) { alert("Please enter at least a retail price"); return; }
      finalVariants = [{
        sku: info.name.toUpperCase().replace(/\s+/g, "-").slice(0, 10) + "-001",
        selected_attributes: {},
        price: simplePrice,
        trade_price: simpleTradePrice,
        cost_price: simpleCostPrice,
        compare_price: "",
        stock_qty: isService ? "0" : simpleStock,
        weight_kg: "",
      }];
    } else {
      if (finalVariants.some(v => !v.price)) { alert("All variants need a retail price"); return; }
    }

    setSaving(true);
    try {
      const res = await staffApi.post("/products/", {
        name: info.name, short_description: info.short_description,
        description: info.description,
        category_id: info.category_id ? parseInt(info.category_id) : null,
        hsn_code: info.hsn_code, gst_rate: parseFloat(info.gst_rate),
        price_type: info.price_type,
        item_type: itemType,
        is_featured: info.is_featured,
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
          stock_qty: isService ? 0 : (parseInt(v.stock_qty) || 0),
          weight_kg: v.weight_kg ? parseFloat(v.weight_kg) : null,
        })),
      });
      router.push(`/admin/products/${res.data.id}`);
    } catch (e: any) { alert(e.response?.data?.detail || "Failed to save product"); }
    finally { setSaving(false); }
  };

  const inp = { width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", outline: "none" };
  const lbl = { display: "block", fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 4 } as const;
  const card = { padding: 18, marginBottom: 14 } as const;
  const cardTitle = { fontSize: 14, fontWeight: 600, margin: "0 0 12px", color: "#1e293b" } as const;

  return (
    <div style={{ padding: 24, maxWidth: 880 }}>
      <PageHeader title="Add Product" subtitle="Fill in details, attributes and variants"
        action={<div style={{ display: "flex", gap: 8 }}>
          <button className="btn-outline" onClick={() => router.back()}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</button>
        </div>} />

      {/* Type toggle */}
      <div className="card" style={{ ...card, display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "#475569" }}>Item Type</span>
        <div style={{ display: "flex", gap: 6, background: "#f1f5f9", padding: 3, borderRadius: 8 }}>
          {(["product", "service"] as const).map(t => (
            <button key={t} onClick={() => setItemType(t)} style={{
              padding: "6px 16px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500,
              background: itemType === t ? "white" : "transparent",
              color: itemType === t ? "#0284c7" : "#64748b",
              boxShadow: itemType === t ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}>
              {t === "product" ? "📦 Product" : "🛠️ Service"}
            </button>
          ))}
        </div>
        {isService && <span style={{ fontSize: 12, color: "#94a3b8" }}>No stock tracking — priced per job/hour</span>}
      </div>

      {/* Basic Info */}
      <div className="card" style={card}>
        <h2 style={cardTitle}>Basic Information</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Name *</label>
            <input style={inp} placeholder={isService ? "Eg: Glass Cutting Service" : "Eg: Clear Float Glass"} value={info.name} onChange={e => setInfo({ ...info, name: e.target.value })} />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Short Description</label>
            <input style={inp} placeholder="Brief one-line description" value={info.short_description} onChange={e => setInfo({ ...info, short_description: e.target.value })} />
          </div>

          <div>
  <label style={lbl}>Category</label>
  {Array.from({ length: selectedPath.length + 1 }).map((_, level) => {
    const options = getOptionsAtLevel(level);
    if (level > 0 && options.length === 0) return null;
    return (
      <select key={level} style={{ ...inp, marginBottom: 6 }} value={selectedPath[level] || ""} onChange={e => onSelectAtLevel(level, e.target.value)}>
        <option value="">{level === 0 ? "Select category" : "Select sub-category"}</option>
        {options.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    );
  })}
  {!showCatInput
    ? <button onClick={() => setShowCatInput(true)} style={{ padding: "0 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: "white", color: "#64748b", cursor: "pointer", fontSize: 16 }}>+ Add category</button>
    : <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <input style={inp} autoFocus placeholder="New category name" value={newCatName} onChange={e => setNewCatName(e.target.value)} onKeyDown={e => e.key === "Enter" && addCategory()} />
        <button onClick={addCategory} disabled={addingCat} style={{ padding: "0 12px", borderRadius: 6, background: "#0284c7", color: "white", border: "none", cursor: "pointer", fontSize: 13 }}>{addingCat ? "..." : "Add"}</button>
        <button onClick={() => setShowCatInput(false)} style={{ padding: "0 10px", borderRadius: 6, border: "1px solid #e2e8f0", background: "white", color: "#94a3b8", cursor: "pointer" }}>✕</button>
      </div>}
</div>

          <div>
            <label style={lbl}>Price Type *</label>
            <select style={inp} value={info.price_type} onChange={e => setInfo({ ...info, price_type: e.target.value })}>
              <option value="fixed">Fixed Price {isService ? "(flat rate)" : "(per unit)"}</option>
              {!isService && <option value="per_sqft">Per Sq.ft (custom dimensions)</option>}
            </select>
          </div>

          <div>
            <label style={lbl}>HSN {isService && "/ SAC"} Code</label>
            <input style={inp} placeholder={isService ? "Eg: 998719" : "Eg: 70051090"} value={info.hsn_code} onChange={e => setInfo({ ...info, hsn_code: e.target.value })} />
          </div>
          <div>
            <label style={lbl}>GST Rate (%)</label>
            <select style={inp} value={info.gst_rate} onChange={e => setInfo({ ...info, gst_rate: e.target.value })}>
              <option value="0">0% (Exempt)</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option>
            </select>
          </div>

          <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" id="featured" checked={info.is_featured} onChange={e => setInfo({ ...info, is_featured: e.target.checked })} style={{ width: 15, height: 15 }} />
            <label htmlFor="featured" style={{ fontSize: 13, color: "#475569", cursor: "pointer" }}>Mark as Featured</label>
          </div>

          <details style={{ gridColumn: "1/-1" }}>
            <summary style={{ fontSize: 12, color: "#0284c7", cursor: "pointer", listStyle: "none" }}>+ Full description</summary>
            <textarea style={{ ...inp, height: 64, resize: "vertical" as const, marginTop: 6 }} placeholder="Detailed description" value={info.description} onChange={e => setInfo({ ...info, description: e.target.value })} />
          </details>
        </div>
      </div>

      {/* Attributes — collapsed by default, still useful for service tiers (e.g. "Duration": 1hr/2hr) */}
      <div className="card" style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: attrs.length ? 12 : 0 }}>
          <div>
            <h2 style={cardTitle}>Attributes {attrs.length > 0 && `(${attrs.length})`}</h2>
            {attrs.length === 0 && <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>Optional — eg. Thickness, Color, or Duration for services</p>}
          </div>
          <button onClick={addAttr} style={{ padding: "6px 12px", borderRadius: 6, background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#475569", cursor: "pointer", fontSize: 12 }}>+ Add Attribute</button>
        </div>
        {attrs.map((attr, ai) => (
          <div key={ai} style={{ border: "1px solid #e2e8f0", borderRadius: 7, padding: 12, marginBottom: 8, display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" as const }}>
            <input style={{ ...inp, width: 130 }} placeholder="Name (eg. Thickness)" value={attr.name} onChange={e => updateAttr(ai, "name", e.target.value)} />
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, flex: 1, minWidth: 200 }}>
              {attr.values.map((val, vi) => (
                <div key={vi} style={{ display: "flex", alignItems: "center" }}>
                  <input style={{ ...inp, width: 80, padding: "6px 8px" }} placeholder="Value" value={val.value} onChange={e => updateAttrValue(ai, vi, e.target.value)} />
                  {attr.values.length > 1 && <button onClick={() => removeAttrValue(ai, vi)} style={{ background: "none", border: "none", color: "#cbd5e1", cursor: "pointer", marginLeft: 2 }}>✕</button>}
                </div>
              ))}
              <button onClick={() => addAttrValue(ai)} style={{ padding: "6px 10px", borderRadius: 6, background: "#f8fafc", border: "1px dashed #cbd5e1", color: "#64748b", cursor: "pointer", fontSize: 12 }}>+</button>
            </div>
            <button onClick={() => removeAttr(ai)} style={{ padding: "6px 10px", borderRadius: 6, background: "#fee2e2", border: "none", color: "#dc2626", cursor: "pointer" }}>✕</button>
          </div>
        ))}
        {attrs.length > 0 && <button onClick={generateVariants} style={{ padding: "8px 16px", borderRadius: 7, background: "#0284c7", color: "white", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>⚡ Generate Variants</button>}
      </div>

      {/* Simple pricing */}
      {variants.length === 0 && (
        <div className="card" style={card}>
          <h2 style={cardTitle}>Pricing {!isService && "& Stock"}</h2>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${isService ? 3 : 4}, 1fr)`, gap: 12 }}>
            <div>
              <label style={lbl}>Retail Price ₹ *</label>
              <input type="number" style={{ ...inp, borderColor: "#fca5a5" }} placeholder="0.00" value={simplePrice} onChange={e => setSimplePrice(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Trade Price ₹</label>
              <input type="number" style={inp} placeholder="0.00" value={simpleTradePrice} onChange={e => setSimpleTradePrice(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Cost Price ₹</label>
              <input type="number" style={inp} placeholder="0.00" value={simpleCostPrice} onChange={e => setSimpleCostPrice(e.target.value)} />
            </div>
            {!isService && (
              <div>
                <label style={lbl}>Stock Qty</label>
                <input type="number" style={inp} placeholder="0" value={simpleStock} onChange={e => setSimpleStock(e.target.value)} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Variants table */}
      {variants.length > 0 && (
        <div className="card" style={card}>
          <h2 style={cardTitle}>Variants & Pricing <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: 12 }}>({variants.length})</span></h2>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 7, padding: 10, marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap" as const, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>Bulk fill:</span>
            {[{ key: "price", ph: "Retail ₹" }, { key: "trade_price", ph: "Trade ₹" }, { key: "cost_price", ph: "Cost ₹" }, ...(isService ? [] : [{ key: "stock_qty", ph: "Stock" }])].map(f => (
              <input key={f.key} style={{ ...inp, width: 100, padding: "6px 8px" }} placeholder={f.ph} value={(bulk as any)[f.key]} onChange={e => setBulk({ ...bulk, [f.key]: e.target.value })} />
            ))}
            <button onClick={applyBulk} style={{ padding: "6px 14px", borderRadius: 6, background: "#475569", color: "white", border: "none", cursor: "pointer", fontSize: 12 }}>Apply to All</button>
          </div>
          <div style={{ overflowX: "auto" as const }}>
            <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 12 }}>
              <thead><tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                {["Variant","Image", "SKU", "Cost ₹", "Retail ₹ *", "Trade ₹", "MRP ₹", ...(isService ? [] : ["Stock"])].map((h, i) => (
                  <th key={h} style={{ textAlign: "left" as const, padding: "6px 6px", color: "#64748b", fontWeight: 600, background: i === 3 ? "#fef9c3" : i === 4 ? "#d1fae5" : "transparent" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {variants.map((v, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "6px" }}>
                      <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 3 }}>
                        {Object.entries(v.selected_attributes).map(([k, val]) => (
                          <span key={k} style={{ fontSize: 10, background: "#eff6ff", color: "#0369a1", padding: "1px 6px", borderRadius: 4 }}>{val}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: "4px" }}>
  <label style={{ cursor: "pointer", display: "block" }}>
    {v.imagePreview
      ? <img src={v.imagePreview} style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 5, border: "1px solid #e2e8f0" }} />
      : <div style={{ width: 36, height: 36, borderRadius: 5, border: "1px dashed #cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#cbd5e1" }}>📷</div>}
    <input type="file" accept="image/*" style={{ display: "none" }}
      onChange={e => setVariantImage(i, e.target.files?.[0] || null)} />
  </label>
</td>
                    <td style={{ padding: "4px" }}><input style={{ ...inp, width: 120, padding: "5px 7px", fontSize: 11 }} value={v.sku} onChange={e => updateVariant(i, "sku", e.target.value)} /></td>
                    <td style={{ padding: "4px" }}><input type="number" style={{ ...inp, width: 72, padding: "5px 7px" }} placeholder="0.00" value={v.cost_price} onChange={e => updateVariant(i, "cost_price", e.target.value)} /></td>
                    <td style={{ padding: "4px", background: "#fefce8" }}><input type="number" style={{ ...inp, width: 72, padding: "5px 7px", borderColor: v.price ? "#e2e8f0" : "#fca5a5" }} placeholder="0.00*" value={v.price} onChange={e => updateVariant(i, "price", e.target.value)} /></td>
                    <td style={{ padding: "4px", background: "#f0fdf4" }}><input type="number" style={{ ...inp, width: 72, padding: "5px 7px" }} placeholder="0.00" value={v.trade_price} onChange={e => updateVariant(i, "trade_price", e.target.value)} /></td>
                    <td style={{ padding: "4px" }}><input type="number" style={{ ...inp, width: 72, padding: "5px 7px" }} placeholder="0.00" value={v.compare_price} onChange={e => updateVariant(i, "compare_price", e.target.value)} /></td>
                    {!isService && <td style={{ padding: "4px" }}><input type="number" style={{ ...inp, width: 60, padding: "5px 7px" }} placeholder="0" value={v.stock_qty} onChange={e => updateVariant(i, "stock_qty", e.target.value)} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button className="btn-outline" onClick={() => router.back()}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={saving} style={{ minWidth: 130 }}>{saving ? "Saving..." : "Save Product"}</button>
      </div>
    </div>
  );
}