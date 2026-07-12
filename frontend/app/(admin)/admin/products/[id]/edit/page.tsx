"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import PageHeader from "@/components/admin/PageHeader";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8000";

interface AttrValue { value: string; sort_order?: number; }
interface Attr { name: string; display_name: string; values: AttrValue[]; }
interface Variant {
  id?: number;
  sku: string;
  selected_attributes: Record<string, string>;
  price: string;
  trade_price: string;
  cost_price: string;
  compare_price: string;
  stock_qty: string;
  weight_kg: string;
  is_active?: boolean;
  image_url?: string;
}
interface ProductImage {
  id: number;
  url: string;
  alt_text?: string;
  is_primary: boolean;
}

export default function ProductEditPage() {
  const { id } = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [info, setInfo] = useState({
    name: "", short_description: "", description: "",
    category_id: "", hsn_code: "", gst_rate: "18",
    price_type: "fixed", is_featured: false, is_active: true,
  });
  const [attrs, setAttrs] = useState<Attr[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [bulk, setBulk] = useState({ price: "", trade_price: "", cost_price: "", stock_qty: "" });

  // Simple product (no variants) prices
  const [simplePrice, setSimplePrice] = useState("");
  const [simpleTradePrice, setSimpleTradePrice] = useState("");
  const [simpleCostPrice, setSimpleCostPrice] = useState("");
  const [simpleStock, setSimpleStock] = useState("0");
  const [isSimple, setIsSimple] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/products/admin/${id}`),
      api.get("/categories/"),
    ]).then(([prodRes, catRes]) => {
      const p = prodRes.data;
      setCategories(catRes.data || []);
      setInfo({
        name: p.name || "",
        short_description: p.short_description || "",
        description: p.description || "",
        category_id: p.category_id ? String(p.category_id) : "",
        hsn_code: p.hsn_code || "",
        gst_rate: String(p.gst_rate ?? 18),
        price_type: p.price_type || "fixed",
        is_featured: !!p.is_featured,
        is_active: !!p.is_active,
      });
      setImages(p.images || []);
      setAttrs(
        (p.attributes || []).map((a: any) => ({
          name: a.name,
          display_name: a.display_name,
          values: (a.values || []).map((v: any) => ({ value: v.value, sort_order: v.sort_order })),
        }))
      );

      const vList: Variant[] = (p.variants || []).map((v: any) => ({
        id: v.id,
        sku: v.sku || "",
        selected_attributes: v.selected_attributes || {},
        price: v.retail_price != null ? String(v.retail_price) : "",
        trade_price: v.trade_price != null ? String(v.trade_price) : "",
        cost_price: v.cost_price != null ? String(v.cost_price) : "",
        compare_price: v.compare_price != null ? String(v.compare_price) : "",
        stock_qty: String(v.stock_qty ?? 0),
        weight_kg: v.weight_kg != null ? String(v.weight_kg) : "",
        is_active: v.is_active !== false,
        image_url: v.image_url || "",
      }));
      setVariants(vList);

      // Detect simple product: one variant with no selected_attributes
      if (vList.length === 1 && Object.keys(vList[0].selected_attributes).length === 0) {
        setIsSimple(true);
        setSimplePrice(vList[0].price);
        setSimpleTradePrice(vList[0].trade_price);
        setSimpleCostPrice(vList[0].cost_price);
        setSimpleStock(vList[0].stock_qty);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  // ── Attribute helpers ──────────────────────────────────────────
  const addAttr = () => setAttrs([...attrs, { name: "", display_name: "", values: [{ value: "" }] }]);
  const removeAttr = (i: number) => { const a = [...attrs]; a.splice(i, 1); setAttrs(a); };
  const updateAttr = (i: number, key: keyof Attr, val: string) => {
    const a = [...attrs];
    (a[i] as any)[key] = val;
    if (key === "name" && !a[i].display_name) a[i].display_name = val;
    setAttrs(a);
  };
  const addAttrValue = (i: number) => { const a = [...attrs]; a[i].values.push({ value: "" }); setAttrs(a); };
  const removeAttrValue = (ai: number, vi: number) => { const a = [...attrs]; a[ai].values.splice(vi, 1); setAttrs(a); };
  const updateAttrValue = (ai: number, vi: number, val: string) => { const a = [...attrs]; a[ai].values[vi].value = val; setAttrs(a); };
  const addBlankVariant = () => {
  const prefix = info.name.toUpperCase().replace(/\s+/g, "-").slice(0, 6) || "PROD";
  const nextNum = String(variants.length + 1).padStart(3, "0");

  if (isSimple) {
    // Convert the current simple product into variant #1, then add a blank variant #2
    const existingAsVariant: Variant = {
      ...(variants[0] || {}),
      sku: variants[0]?.sku || `${prefix}-001`,
      selected_attributes: {},
      price: simplePrice,
      trade_price: simpleTradePrice,
      cost_price: simpleCostPrice,
      stock_qty: simpleStock,
      weight_kg: "",
      is_active: true,
    };
    setVariants([
      existingAsVariant,
      { sku: `${prefix}-${nextNum}`, selected_attributes: {}, price: "", trade_price: "", cost_price: "", compare_price: "", stock_qty: "0", weight_kg: "", is_active: true },
    ]);
    setIsSimple(false);
  } else {
    setVariants([...variants, { sku: `${prefix}-${nextNum}`, selected_attributes: {}, price: "", trade_price: "", cost_price: "", compare_price: "", stock_qty: "0", weight_kg: "", is_active: true }]);
  }
};

const [uploadingVariantId, setUploadingVariantId] = useState<number | null>(null);

const uploadVariantImage = async (index: number, file: File) => {
  const variant = variants[index];
  if (!variant.id) {
    alert("Save the product first before adding a variant image (this variant hasn't been saved yet).");
    return;
  }
  setUploadingVariantId(variant.id);
  try {
    const fd = new FormData();
    fd.append("file", file);
    const res = await api.post(`/products/variants/${variant.id}/image`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    updateVariant(index, "image_url", res.data.image_url);
  } catch (e: any) {
    alert(e.response?.data?.detail || "Failed to upload variant image");
  } finally {
    setUploadingVariantId(null);
  }
};

  const generateVariants = () => {
  const validAttrs = attrs.filter(a => a.name.trim() && a.values.some(v => v.value.trim()));
  if (validAttrs.length === 0) { alert("Add at least one attribute with values"); return; }

  const combos = validAttrs.reduce<Record<string, string>[]>((acc, attr) => {
    const vals = attr.values.filter(v => v.value.trim());
    if (vals.length === 0) return acc;
    if (acc.length === 0) return vals.map(v => ({ [attr.name]: v.value }));
    return acc.flatMap(combo => vals.map(v => ({ ...combo, [attr.name]: v.value })));
  }, []);

  const prefix = info.name.toUpperCase().replace(/\s+/g, "-").slice(0, 6) || "PROD";

  // If we're converting FROM a simple product (single variant, no attributes),
  // carry its data into the first generated combo instead of losing it.
  const wasSimple = variants.length === 1 && Object.keys(variants[0].selected_attributes).length === 0;
  const simpleData = wasSimple ? variants[0] : null;
  let usedSimpleData = false;

  setVariants(combos.map((combo, i) => {
    const existingKey = Object.values(combo).join("-").toUpperCase().replace(/\s+/g, "").replace(/"/g, "IN");

    // Try to match against a real existing variant with the same attributes
    const existing = variants.find(v =>
      Object.keys(v.selected_attributes).length > 0 &&
      JSON.stringify(v.selected_attributes) === JSON.stringify(combo)
    );

    if (existing) {
      return { ...existing, selected_attributes: combo };
    }

    // First combo, converting from simple → carry over the old simple product's data
    if (simpleData && !usedSimpleData) {
      usedSimpleData = true;
      return {
        ...simpleData,
        sku: simpleData.sku || `${prefix}-${existingKey}-${String(i + 1).padStart(3, "0")}`,
        selected_attributes: combo,
      };
    }

    return {
      sku: `${prefix}-${existingKey}-${String(i + 1).padStart(3, "0")}`,
      selected_attributes: combo,
      price: "", trade_price: "", cost_price: "", compare_price: "",
      stock_qty: "0", weight_kg: "", is_active: true,
    };
  }));
  setIsSimple(false);
};

  // ── Variant helpers ────────────────────────────────────────────
  const updateVariant = (i: number, key: keyof Variant, val: any) => {
    const v = [...variants]; (v[i] as any)[key] = val; setVariants(v);
  };
  const applyBulk = () => setVariants(variants.map(v => ({
    ...v,
    ...(bulk.price ? { price: bulk.price } : {}),
    ...(bulk.trade_price ? { trade_price: bulk.trade_price } : {}),
    ...(bulk.cost_price ? { cost_price: bulk.cost_price } : {}),
    ...(bulk.stock_qty ? { stock_qty: bulk.stock_qty } : {}),
  })));

  // ── Image helpers ──────────────────────────────────────────────
  const uploadImage = async (file: File) => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("is_primary", String(images.length === 0));
      const res = await api.post(`/products/${id}/images`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImages([...images, res.data]);
    } catch { alert("Failed to upload image"); }
    finally { setUploadingImage(false); }
  };

  const deleteImage = async (imgId: number) => {
    if (!confirm("Delete this image?")) return;
    try {
      await api.delete(`/products/${id}/images/${imgId}`);
      setImages(images.filter(img => img.id !== imgId));
    } catch { alert("Failed to delete image"); }
  };

  const setPrimaryImage = async (imgId: number) => {
    try {
      await api.patch(`/products/${id}/images/${imgId}`, { is_primary: true });
      setImages(images.map(img => ({ ...img, is_primary: img.id === imgId })));
    } catch { alert("Failed to set primary image"); }
  };

  // ── Category helpers ───────────────────────────────────────────
  const addCategory = async () => {
    if (!newCatName.trim()) return;
    setAddingCat(true);
    try {
      const res = await api.post("/categories/", { name: newCatName });
      setCategories([...categories, res.data]);
      setInfo({ ...info, category_id: String(res.data.id) });
      setNewCatName("");
    } catch { alert("Failed to add category"); }
    finally { setAddingCat(false); }
  };

  // ── Save ───────────────────────────────────────────────────────
  const save = async () => {
    if (!info.name.trim()) { alert("Product name is required"); return; }

    let finalVariants = isSimple ? [] : variants;
    const variantsPayload = finalVariants.map(v => ({
      id: (v as any).id || null,      // ← include id so backend can match
      sku: v.sku,
      selected_attributes: (v as any).selected_attributes || {},
      price: v.price,
      trade_price: v.trade_price,
      cost_price: v.cost_price,
      compare_price: v.compare_price,
      stock_qty: (v as any).stock_qty || 0,
    }));

    if (isSimple) {
      if (!simplePrice) { alert("Please enter a retail price"); return; }
      finalVariants = [{
        ...(variants[0]?.id ? { id: variants[0].id } : {}),
        sku: variants[0]?.sku || info.name.toUpperCase().replace(/\s+/g, "-").slice(0, 10) + "-001",
        selected_attributes: {},
        price: simplePrice,
        trade_price: simpleTradePrice,
        cost_price: simpleCostPrice,
        compare_price: "",
        stock_qty: simpleStock,
        weight_kg: "",
        is_active: true,
      }];
    } else {
      if (finalVariants.some(v => !v.price)) { alert("All variants need a retail price"); return; }
    }

    setSaving(true);
    try {
      await api.patch(`/products/${id}`, {
        name: info.name,
        short_description: info.short_description,
        description: info.description,
        category_id: info.category_id ? parseInt(info.category_id) : null,
        hsn_code: info.hsn_code,
        gst_rate: parseFloat(info.gst_rate),
        price_type: info.price_type,
        is_featured: info.is_featured,
        is_active: info.is_active,
        attributes: attrs.filter(a => a.name).map(a => ({
          name: a.name,
          display_name: a.display_name || a.name,
          values: a.values.filter(v => v.value.trim()).map((v, i) => ({ value: v.value, sort_order: i })),
        })),
        variants: finalVariants.map(v => ({
          ...(v.id ? { id: v.id } : {}),
          sku: v.sku,
          selected_attributes: v.selected_attributes,
          price: parseFloat(v.price),
          trade_price: v.trade_price ? parseFloat(v.trade_price) : null,
          cost_price: v.cost_price ? parseFloat(v.cost_price) : null,
          compare_price: v.compare_price ? parseFloat(v.compare_price) : null,
          stock_qty: parseInt(v.stock_qty) || 0,
          weight_kg: v.weight_kg ? parseFloat(v.weight_kg) : null,
          is_active: v.is_active !== false,
        })),
      });
      router.push(`/admin/products/${id}`);
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  // ── Styles ─────────────────────────────────────────────────────
  const inp = {
    width: "100%", padding: "9px 12px", borderRadius: 7,
    border: "1px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", outline: "none",
  };
  const lbl = { display: "block", fontSize: 13, fontWeight: 500, color: "#475569", marginBottom: 5 } as const;

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading product...</div>;
  
  
  return (
    <div style={{ padding: 22, maxWidth: 1000 }}>
   
      <PageHeader
        title={`Edit: ${info.name || "Product"}`}
        subtitle="Update product details, pricing and variants"
        action={
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-outline" onClick={() => router.push(`/admin/products/${id}`)}>← Cancel</button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        }
      />

      {/* ── Basic Info ── */}
      <div className="card" style={{ padding: 14, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Basic Information</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Product Name *</label>
            <input style={inp} value={info.name} onChange={e => setInfo({ ...info, name: e.target.value })} />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Short Description</label>
            <input style={inp} value={info.short_description} onChange={e => setInfo({ ...info, short_description: e.target.value })} />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Full Description</label>
            <textarea style={{ ...inp, height: 90, resize: "vertical" as const }} value={info.description} onChange={e => setInfo({ ...info, description: e.target.value })} />
          </div>

          <div>
            <label style={lbl}>Category</label>
            <select style={inp} value={info.category_id} onChange={e => setInfo({ ...info, category_id: e.target.value })}>
              <option value="">Select category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <input style={{ ...inp, padding: "7px 10px", fontSize: 13 }} placeholder="Or add new category" value={newCatName} onChange={e => setNewCatName(e.target.value)} />
              <button onClick={addCategory} disabled={addingCat} style={{ padding: "7px 14px", borderRadius: 6, background: "#0284c7", color: "white", border: "none", cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" as const }}>
                {addingCat ? "..." : "+ Add"}
              </button>
            </div>
          </div>

          <div>
            <label style={lbl}>Price Type *</label>
            <select style={inp} value={info.price_type} onChange={e => setInfo({ ...info, price_type: e.target.value })}>
              <option value="fixed">Fixed Price (per unit)</option>
              <option value="per_sqft">Per Sq.ft (custom dimensions)</option>
            </select>
          </div>

          <div>
            <label style={lbl}>HSN Code</label>
            <input style={inp} placeholder="Eg: 70051090" value={info.hsn_code} onChange={e => setInfo({ ...info, hsn_code: e.target.value })} />
          </div>

          <div>
            <label style={lbl}>GST Rate (%)</label>
            <select style={inp} value={info.gst_rate} onChange={e => setInfo({ ...info, gst_rate: e.target.value })}>
              <option value="0">0% (Exempt)</option>
              <option value="5">5%</option>
              <option value="12">12%</option>
              <option value="18">18%</option>
              <option value="28">28%</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#475569", cursor: "pointer" }}>
              <input type="checkbox" checked={info.is_featured} onChange={e => setInfo({ ...info, is_featured: e.target.checked })} style={{ width: 16, height: 16 }} />
              ⭐ Featured Product
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#475569", cursor: "pointer" }}>
              <input type="checkbox" checked={info.is_active} onChange={e => setInfo({ ...info, is_active: e.target.checked })} style={{ width: 16, height: 16 }} />
              Active
            </label>
          </div>
        </div>
      </div>

      {/* ── Images ── */}
      <div className="card" style={{ padding: 14, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>Images</h2>
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>First image is primary. Click a non-primary image to set it as primary.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-start" }}>
          {images.map(img => (
            <div key={img.id} style={{ position: "relative", group: true } as any}>
              <img
                src={`${API_BASE}${img.url}`}
                alt={img.alt_text || info.name}
                style={{
                  width: 96, height: 96, objectFit: "cover", borderRadius: 8,
                  border: img.is_primary ? "2px solid #0284c7" : "1px solid #e2e8f0",
                  cursor: img.is_primary ? "default" : "pointer",
                }}
                onClick={() => !img.is_primary && setPrimaryImage(img.id)}
                title={img.is_primary ? "Primary image" : "Click to set as primary"}
              />
              {img.is_primary && (
                <span style={{ position: "absolute", top: 3, left: 3, fontSize: 9, fontWeight: 700, background: "#0284c7", color: "white", padding: "1px 5px", borderRadius: 3 }}>PRIMARY</span>
              )}
              <button
                onClick={() => deleteImage(img.id)}
                style={{
                  position: "absolute", top: 3, right: 3, width: 20, height: 20, borderRadius: "50%",
                  background: "#dc2626", color: "white", border: "none", cursor: "pointer",
                  fontSize: 11, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >✕</button>
            </div>
          ))}

          {/* Upload button */}
          <label style={{
            width: 96, height: 96, borderRadius: 8, border: "1px dashed #cbd5e1",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            cursor: uploadingImage ? "default" : "pointer", color: "#94a3b8", fontSize: 12, gap: 4,
            background: "#f8fafc",
          }}>
            {uploadingImage ? (
              <span style={{ fontSize: 11 }}>Uploading...</span>
            ) : (
              <>
                <span style={{ fontSize: 22 }}>+</span>
                <span>Add image</span>
              </>
            )}
            <input
              type="file" accept="image/*" style={{ display: "none" }}
              disabled={uploadingImage}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }}
            />
          </label>
        </div>
      </div>

      {/* ── Attributes ── */}
      <div className="card" style={{ padding: 14, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Attributes</h2>
            <p style={{ fontSize: 13, color: "#64748b", margin: "3px 0 0" }}>Options like Thickness, Finish, Color. Editing these requires regenerating variants.</p>
          </div>
          <button onClick={addAttr} style={{ padding: "7px 14px", borderRadius: 7, background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#475569", cursor: "pointer", fontSize: 13 }}>
            + Add Attribute
          </button>
        </div>

        {attrs.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 14, border: "1px dashed #e2e8f0", borderRadius: 8 }}>
            No attributes. Add options like Thickness → 4mm, 6mm, 8mm to generate variants.
          </div>
        )}

        {attrs.map((attr, ai) => (
          <div key={ai} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 16, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Attribute Name</label>
                <input style={inp} placeholder="Eg: thickness" value={attr.name} onChange={e => updateAttr(ai, "name", e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={lbl}>Display Name</label>
                <input style={inp} placeholder="Eg: Glass Thickness" value={attr.display_name} onChange={e => updateAttr(ai, "display_name", e.target.value)} />
              </div>
              <button onClick={() => removeAttr(ai)} style={{ padding: "9px 12px", borderRadius: 6, background: "#fee2e2", border: "none", color: "#dc2626", cursor: "pointer" }}>✕</button>
            </div>
            <div>
              <label style={lbl}>Values</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {attr.values.map((val, vi) => (
                  <div key={vi} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input style={{ ...inp, width: 110 }} placeholder="Eg: 4mm" value={val.value} onChange={e => updateAttrValue(ai, vi, e.target.value)} />
                    {attr.values.length > 1 && (
                      <button onClick={() => removeAttrValue(ai, vi)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 16 }}>✕</button>
                    )}
                  </div>
                ))}
                <button onClick={() => addAttrValue(ai)} style={{ padding: "8px 12px", borderRadius: 6, background: "#f8fafc", border: "1px dashed #cbd5e1", color: "#64748b", cursor: "pointer", fontSize: 13 }}>
                  + Value
                </button>
              </div>
            </div>
          </div>
        ))}

        {attrs.length > 0 && (
          <button onClick={generateVariants} style={{ padding: "9px 20px", borderRadius: 8, background: "#0284c7", color: "white", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500, marginTop: 8 }}>
            ⚡ Regenerate Variants
          </button>
        )}
      </div>

      {/* ── Simple Pricing ── */}
      {isSimple && (
        <div className="card" style={{ padding: 14, marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>Pricing & Stock</h2>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>Simple product — no variants.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
            <div>
              <label style={lbl}>Retail Price ₹ *</label>
              <input type="number" style={{ ...inp, border: simplePrice ? "1px solid #e2e8f0" : "1px solid #fca5a5" }} placeholder="0.00" value={simplePrice} onChange={e => setSimplePrice(e.target.value)} />
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
              <p style={{ fontSize: 11, color: "#94a3b8", margin: "4px 0 0" }}>Internal cost</p>
            </div>
            <div>
              <label style={lbl}>Stock Qty</label>
              <input type="number" style={inp} placeholder="0" value={simpleStock} onChange={e => setSimpleStock(e.target.value)} />
            </div>
          </div>
            <div style={{ marginTop: 18 }}>
      <label style={lbl}>Variant Image</label>
      <label style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 12 }}>
        {variants[0]?.image_url ? (
          <img src={`${API_BASE}${variants[0].image_url}`} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, border: "1px solid #e2e8f0" }} />
        ) : (
          <div style={{ width: 64, height: 64, borderRadius: 8, border: "1px dashed #cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#cbd5e1" }}>
            {uploadingVariantId === variants[0]?.id ? "…" : "📷"}
          </div>
        )}
        <span style={{ fontSize: 13, color: "#0284c7" }}>
          {variants[0]?.image_url ? "Change image" : "Upload image"}
        </span>
        <input
          type="file" accept="image/*" style={{ display: "none" }}
          disabled={uploadingVariantId === variants[0]?.id}
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadVariantImage(0, f); e.target.value = ""; }}
        />
      </label>
    </div>
        </div>
      )}
      {isSimple && (
  <div className="card" style={{ padding: 24, marginBottom: 20 }}>
    {/* ...existing simple pricing fields unchanged... */}
    <button onClick={addBlankVariant} style={{ marginTop: 14, padding: "8px 16px", borderRadius: 7, background: "#f1f5f9", border: "1px dashed #94a3b8", color: "#475569", cursor: "pointer", fontSize: 13 }}>
      + Add another price/stock variant
    </button>
  </div>
)}

      {/* ── Variants table ── */}
      {!isSimple && variants.length > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Variants & Pricing</h2>
            <p style={{ fontSize: 13, color: "#64748b", margin: "3px 0 0" }}>{variants.length} variants</p>
          </div>
          <button onClick={addBlankVariant} style={{ padding: "7px 14px", borderRadius: 7, background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#475569", cursor: "pointer", fontSize: 13 }}>
  + Add Variant
</button>
          {/* Bulk fill */}
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: "#475569", margin: "0 0 10px" }}>Bulk Fill — apply same value to all variants</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
              {[{ key: "price", ph: "Retail Price ₹" }, { key: "trade_price", ph: "Trade Price ₹" }, { key: "cost_price", ph: "Cost Price ₹" }, { key: "stock_qty", ph: "Stock Qty" }].map(f => (
                <input key={f.key} style={{ ...inp, width: 140 }} placeholder={f.ph} value={(bulk as any)[f.key]} onChange={e => setBulk({ ...bulk, [f.key]: e.target.value })} />
              ))}
              <button onClick={applyBulk} style={{ padding: "9px 16px", borderRadius: 7, background: "#475569", color: "white", border: "none", cursor: "pointer", fontSize: 13 }}>
                Apply to All
              </button>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  {["Variant", "Image", "SKU", "Cost ₹", "Retail ₹ *", "Trade ₹", "MRP ₹", "Stock", "Active"].map((h, i) => (
  <th key={h} style={{
    textAlign: "left", padding: "8px", color: "#64748b", fontWeight: 600, fontSize: 12,
    background: i === 4 ? "#fef9c3" : i === 5 ? "#d1fae5" : "transparent",   // ← shifted indices by 1 for the new column
  }}>{h}</th>
))}
                </tr>
              </thead>
              <tbody>
                {variants.map((v, i) => (
                  <tr key={v.id ?? i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {Object.entries(v.selected_attributes).length > 0
                          ? Object.entries(v.selected_attributes).map(([k, val]) => (
                              <span key={k} style={{ fontSize: 11, background: "#eff6ff", color: "#0369a1", padding: "2px 7px", borderRadius: 4 }}>{val}</span>
                            ))
                          : <span style={{ color: "#94a3b8" }}>Default</span>
                        }
                      </div>
                    </td>
                    <td style={{ padding: "6px" }}>
  <label style={{ cursor: "pointer", display: "block", position: "relative" }}>
    {v.image_url ? (
      <img src={`${API_BASE}${v.image_url}`} style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6, border: "1px solid #e2e8f0" }} />
    ) : (
      <div style={{ width: 40, height: 40, borderRadius: 6, border: "1px dashed #cbd5e1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, color: "#cbd5e1" }}>
        {uploadingVariantId === v.id ? "…" : "📷"}
      </div>
    )}
    <input
      type="file" accept="image/*" style={{ display: "none" }}
      disabled={uploadingVariantId === v.id}
      onChange={e => { const f = e.target.files?.[0]; if (f) uploadVariantImage(i, f); e.target.value = ""; }}
    />
  </label>
</td>
                    <td style={{ padding: "6px" }}>
                      <input style={{ ...inp, width: 140, padding: "6px 8px", fontSize: 12 }} value={v.sku} onChange={e => updateVariant(i, "sku", e.target.value)} />
                    </td>
                    <td style={{ padding: "6px" }}>
                      <input type="number" style={{ ...inp, width: 85, padding: "6px 8px" }} placeholder="0.00" value={v.cost_price} onChange={e => updateVariant(i, "cost_price", e.target.value)} />
                    </td>
                    <td style={{ padding: "6px", background: "#fefce8" }}>
                      <input type="number" style={{ ...inp, width: 85, padding: "6px 8px", border: v.price ? "1px solid #e2e8f0" : "1px solid #fca5a5" }} placeholder="0.00 *" value={v.price} onChange={e => updateVariant(i, "price", e.target.value)} />
                    </td>
                    <td style={{ padding: "6px", background: "#f0fdf4" }}>
                      <input type="number" style={{ ...inp, width: 85, padding: "6px 8px" }} placeholder="0.00" value={v.trade_price} onChange={e => updateVariant(i, "trade_price", e.target.value)} />
                    </td>
                    <td style={{ padding: "6px" }}>
                      <input type="number" style={{ ...inp, width: 85, padding: "6px 8px" }} placeholder="0.00" value={v.compare_price} onChange={e => updateVariant(i, "compare_price", e.target.value)} />
                    </td>
                    <td style={{ padding: "6px" }}>
                      <input type="number" style={{ ...inp, width: 70, padding: "6px 8px" }} placeholder="0" value={v.stock_qty} onChange={e => updateVariant(i, "stock_qty", e.target.value)} />
                    </td>
                    <td style={{ padding: "6px", textAlign: "center" }}>
                      <input type="checkbox" checked={v.is_active !== false} onChange={e => updateVariant(i, "is_active", e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
                    </td>
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
        <button className="btn-outline" onClick={() => router.push(`/admin/products/${id}`)}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={saving} style={{ minWidth: 140 }}>
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}