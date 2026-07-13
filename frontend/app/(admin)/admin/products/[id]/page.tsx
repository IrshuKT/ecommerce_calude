"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import staffApi from "@/lib/staffApi";
import PageHeader from "@/components/admin/PageHeader";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8000";

interface StockTxn {
  id: string;
  variant_id: number;
  variant_sku: string;
  variant_attrs: Record<string, string>;
  txn_type: "in" | "out" | "adjustment";
  qty_change: number;
  qty_before: number | null;
  qty_after: number | null;
  reference_type?: string;
  reference_id?: string;
  note?: string;
  created_at: string;
}

interface AvgCost {
  variant_id: number;
  sku: string;
  stock_qty: number;
  cost_price: number | null;
  avg_cost: number | null;
  total_received: number;
  purchase_count: number;
  selected_attributes: Record<string, string>;
}

const TXN_META = {
  in:         { label: "Stock In",   bg: "#dcfce7", color: "#166534", icon: "↑" },
  out:        { label: "Stock Out",  bg: "#fee2e2", color: "#991b1b", icon: "↓" },
  adjustment: { label: "Adjustment", bg: "#fef9c3", color: "#854d0e", icon: "±" },
};

const fmt    = (n: any) => n != null ? `₹${parseFloat(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—";
const fmtDate = (s: string) => new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function VariantBadges({ attrs }: { attrs: Record<string, string> }) {
  const entries = Object.values(attrs || {});
  if (!entries.length) return <span style={{ color: "#94a3b8", fontSize: 12 }}>Default</span>;
  return (
    <>{entries.map((v, i) => (
      <span key={i} style={{ fontSize: 11, background: "#eff6ff", color: "#0369a1", padding: "1px 6px", borderRadius: 4, marginRight: 3 }}>{v}</span>
    ))}</>
  );
}

export default function ProductViewPage() {
  const { id } = useParams();
  const router = useRouter();
  const [product,      setProduct]      = useState<any>(null);
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState<"details" | "stock">("details");
  const [txns,         setTxns]         = useState<StockTxn[]>([]);
  const [txnLoading,   setTxnLoading]   = useState(false);
  const [txnTotal,     setTxnTotal]     = useState(0);
  const [txnPage,      setTxnPage]      = useState(1);
  const [txnRefreshKey,setTxnRefreshKey]= useState(0);
  const [filterVariant,setFilterVariant]= useState("");
  const [filterType,   setFilterType]   = useState("");
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [allProductIds,setAllProductIds]= useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [avgCosts,     setAvgCosts]     = useState<AvgCost[]>([]);
  const [avgLoading,   setAvgLoading]   = useState(false);

  const loadTxns = async (page = 1) => {
    setTxnLoading(true);
    try {
      const params: any = { page, limit: 30 };
      if (filterVariant) params.variant_id = filterVariant;
      if (filterType)    params.txn_type   = filterType;
      const r = await staffApi.get(`/products/${id}/stock-transactions`, { params });
      setTxns(r.data.items);
      setTxnTotal(r.data.total);
      setTxnPage(page);
    } catch (e: any) {
      setTxns([]);
    } finally {
      setTxnLoading(false);
    }
  };

  const loadAvgCost = async () => {
    setAvgLoading(true);
    try {
      const r = await staffApi.get(`/products/${id}/avg-cost`);
      setAvgCosts(Array.isArray(r.data) ? r.data : []);
    } catch {
      setAvgCosts([]);
    } finally {
      setAvgLoading(false);
    }
  };

  const toggleActive = async () => {
    try {
      await staffApi.patch(`/products/${id}`, { is_active: !product.is_active });
      setProduct((p: any) => ({ ...p, is_active: !p.is_active }));
    } catch { alert("Failed to update"); }
  };

  useEffect(() => {
    if (id) {
      staffApi.get(`/products/admin/${id}`)
        .then(r => setProduct(r.data))
        .catch(() => setProduct(null))
        .finally(() => setLoading(false));
      loadAvgCost();
    }
  }, [id]);

  useEffect(() => {
    staffApi.get("/products/admin/ids").then(r => {
      const ids = (r.data.ids || []).map(Number);
      setAllProductIds(ids);
      setCurrentIndex(ids.indexOf(Number(id)));
    }).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (activeTab === "stock" && id) {
      setTxnPage(1);
      setFilterVariant("");
      setFilterType("");
    }
  }, [activeTab, id]);

  useEffect(() => {
    if (activeTab === "stock" && id) loadTxns(1);
  }, [activeTab, id, filterVariant, filterType, txnRefreshKey]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading product...</div>;
  if (!product) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <p style={{ color: "#64748b" }}>Product not found.</p>
      <button onClick={() => router.back()} style={{ color: "#0284c7", background: "none", border: "none", cursor: "pointer" }}>← Go back</button>
    </div>
  );

  const TabBtn = ({ k, label }: { k: "details" | "stock"; label: string }) => (
    <button onClick={() => setActiveTab(k)} style={{
      padding: "9px 22px", borderRadius: "7px 7px 0 0",
      border: "1px solid #e2e8f0", borderBottom: activeTab === k ? "1px solid white" : undefined,
      background: activeTab === k ? "white" : "#f8fafc",
      color: activeTab === k ? "#0284c7" : "#64748b",
      fontWeight: activeTab === k ? 600 : 400,
      fontSize: 13, cursor: "pointer", marginBottom: -1, position: "relative" as const,
    }}>{label}</button>
  );

  // overall avg cost across all variants (weighted)
  const overallAvg = (() => {
    const withCost = avgCosts.filter(a => a.avg_cost !== null && a.total_received > 0);
    if (!withCost.length) return null;
    const totalCost = withCost.reduce((s, a) => s + (a.avg_cost! * a.total_received), 0);
    const totalQty  = withCost.reduce((s, a) => s + a.total_received, 0);
    return totalQty > 0 ? totalCost / totalQty : null;
  })();

  return (
    <div style={{ padding: 32, maxWidth: 1000 }}>
      <PageHeader
        title={product.name}
        subtitle={`${product.short_description || "Product details"}${currentIndex >= 0 ? ` · ${currentIndex + 1} of ${allProductIds.length}` : ""}`}
        action={
          <div style={{ display: "flex", gap: 10 }}>
            <button disabled={currentIndex <= 0}
              onClick={() => router.push(`/admin/products/${allProductIds[currentIndex - 1]}`)}
              style={{ padding: "8px 14px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, background: currentIndex <= 0 ? "#f8fafc" : "white", color: currentIndex <= 0 ? "#cbd5e1" : "#475569", cursor: currentIndex <= 0 ? "default" : "pointer" }}>
              ← Prev
            </button>
            <button disabled={currentIndex < 0 || currentIndex >= allProductIds.length - 1}
              onClick={() => router.push(`/admin/products/${allProductIds[currentIndex + 1]}`)}
              style={{ padding: "8px 14px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, background: currentIndex >= allProductIds.length - 1 ? "#f8fafc" : "white", color: currentIndex >= allProductIds.length - 1 ? "#cbd5e1" : "#475569", cursor: currentIndex < 0 || currentIndex >= allProductIds.length - 1 ? "default" : "pointer" }}>
              Next →
            </button>
            <button onClick={toggleActive} style={{ padding: "8px 16px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, background: product.is_active ? "#fee2e2" : "#dcfce7", color: product.is_active ? "#991b1b" : "#166534" }}>
              {product.is_active ? "Deactivate" : "Activate"}
            </button>
            <button className="btn-outline" onClick={() => router.push(`/admin/products/${id}/edit`)}>✏️ Edit</button>
            <button className="btn-outline" onClick={() => router.back()}>← Back</button>
          </div>
        }
      />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #e2e8f0" }}>
        <TabBtn k="details" label="📋 Product Details" />
        <TabBtn k="stock"   label="📦 Stock Transactions" />
      </div>

      <div style={{ background: "white", border: "1px solid #e2e8f0", borderTop: "none", borderRadius: "0 7px 7px 7px", padding: 24 }}>

        {/* ── DETAILS TAB ── */}
        {activeTab === "details" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

              {/* Basic Info */}
              <div className="card" style={{ padding: 20 }}>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: "#475569", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Basic Info</h2>
                {[
                  { label: "Status", value: <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: product.is_active ? "#dcfce7" : "#fee2e2", color: product.is_active ? "#166534" : "#991b1b" }}>{product.is_active ? "Active" : "Inactive"}</span> },
                  { label: "Price Type", value: <span style={{ fontSize: 12, background: "#f1f5f9", padding: "2px 8px", borderRadius: 4, textTransform: "uppercase" as const }}>{product.price_type}</span> },
                  { label: "GST Rate", value: `${product.gst_rate}%` },
                  { label: "HSN Code", value: product.hsn_code || "—" },
                  { label: "Featured", value: product.is_featured ? "⭐ Yes" : "No" },
                  { label: "Category", value: product.category?.name || "—" },
                ].map(row => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
                    <span style={{ color: "#64748b" }}>{row.label}</span>
                    <span style={{ fontWeight: 500 }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Images */}
              <div className="card" style={{ padding: 20 }}>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: "#475569", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Images</h2>
                {product.images?.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {product.images.map((img: any) => (
                      <div key={img.id} style={{ position: "relative" }}>
                        <img src={`${API_BASE}${img.url}`} alt={img.alt_text || product.name}
                          style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: img.is_primary ? "2px solid #0284c7" : "1px solid #e2e8f0" }} />
                        {img.is_primary && <span style={{ position: "absolute", top: 3, left: 3, fontSize: 9, fontWeight: 700, background: "#0284c7", color: "white", padding: "1px 5px", borderRadius: 3 }}>PRIMARY</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ height: 80, background: "#f1f5f9", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>
                    No images —&nbsp;<button onClick={() => router.push(`/admin/products/${id}/edit`)} style={{ color: "#0284c7", background: "none", border: "none", cursor: "pointer" }}>Add images</button>
                  </div>
                )}
              </div>
            </div>

            {/* ── COST ANALYSIS CARD ── */}
            <div className="card" style={{ padding: 20, marginBottom: 20, border: "1px solid #e2e8f0", borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 14, fontWeight: 600, color: "#475569", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    💰 Cost Analysis
                  </h2>
                  <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
                    Weighted average cost from received purchases · 
                  </p>
                </div>
                {overallAvg !== null && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>Overall Avg Cost</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#f59e0b" }}>{fmt(overallAvg)}</div>
                  </div>
                )}
              </div>

              {avgLoading ? (
                <div style={{ padding: "20px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Calculating...</div>
              ) : avgCosts.length === 0 ? (
                <div style={{ padding: "16px", textAlign: "center", color: "#94a3b8", fontSize: 13, background: "#f8fafc", borderRadius: 8 }}>
                  No purchase data yet — avg cost will appear after purchases are received
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      {["Variant", "SKU", "Avg Cost", "Static Cost Price", "Margin (Retail)", "Total Received", "Purchases"].map(h => (
                        <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {avgCosts.map(a => {
                      // find retail price from product variants
                      const variant = product.variants?.find((v: any) => v.id === a.variant_id);
                      const retailPrice = variant?.retail_price;
                      const margin = a.avg_cost && retailPrice
                        ? (((retailPrice - a.avg_cost) / retailPrice) * 100).toFixed(1)
                        : null;

                      return (
                        <tr key={a.variant_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "10px 12px" }}>
                            <VariantBadges attrs={a.selected_attributes} />
                          </td>
                          <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12, color: "#64748b" }}>{a.sku}</td>
                          <td style={{ padding: "10px 12px" }}>
                            {a.avg_cost !== null ? (
                              <span style={{ fontWeight: 700, fontSize: 14, color: "#f59e0b" }}>{fmt(a.avg_cost)}</span>
                            ) : (
                              <span style={{ color: "#94a3b8", fontSize: 12 }}>No purchases</span>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#64748b" }}>
                            {fmt(a.cost_price)}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            {margin !== null ? (
                              <span style={{
                                fontWeight: 600,
                                color: parseFloat(margin) > 30 ? "#16a34a" : parseFloat(margin) > 10 ? "#d97706" : "#dc2626",
                                fontSize: 13,
                              }}>
                                {margin}%
                              </span>
                            ) : "—"}
                          </td>
                          <td style={{ padding: "10px 12px", color: "#475569" }}>{a.total_received} units</td>
                          <td style={{ padding: "10px 12px", color: "#475569" }}>{a.purchase_count}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {product.description && (
              <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: "#475569", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Description</h2>
                <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.7, margin: 0 }}>{product.description}</p>
              </div>
            )}

            {product.attributes?.length > 0 && (
              <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: "#475569", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Attributes</h2>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  {product.attributes.map((attr: any) => (
                    <div key={attr.name}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#64748b", margin: "0 0 8px" }}>{attr.display_name}</p>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {attr.values.map((val: any) => (
                          <span key={val.value} style={{ fontSize: 13, background: "#eff6ff", color: "#0369a1", padding: "4px 12px", borderRadius: 6, fontWeight: 500 }}>{val.value}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {product.variants?.length > 0 && (
              <div className="card" style={{ padding: 20 }}>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: "#475569", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Variants ({product.variants.length})
                </h2>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                        {["Variant", "SKU", "Cost", "Retail Price", "Trade Price", "MRP", "Stock", "Status"].map(h => (
                          <th key={h} style={{ padding: "10px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748b" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {product.variants.map((v: any) => {
                        const ac = avgCosts.find(a => a.variant_id === v.id);
                        return (
                          <tr key={v.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px" }}><VariantBadges attrs={v.selected_attributes} /></td>
                            <td style={{ padding: "10px", fontFamily: "monospace", fontSize: 12, color: "#64748b" }}>{v.sku}</td>
                            <td style={{ padding: "10px" }}>
                              <div style={{ color: "#64748b" }}>{fmt(v.cost_price)}</div>
                              {ac?.avg_cost && (
                                <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 2 }}>
                                  avg: {fmt(ac.avg_cost)}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: "10px", fontWeight: 600, color: "#0284c7" }}>{fmt(v.retail_price)}</td>
                            <td style={{ padding: "10px", color: "#16a34a" }}>{fmt(v.trade_price)}</td>
                            <td style={{ padding: "10px", color: "#94a3b8" }}>{fmt(v.compare_price)}</td>
                            <td style={{ padding: "10px" }}>
                              <span style={{ fontWeight: 600, color: v.stock_qty > 5 ? "#16a34a" : v.stock_qty > 0 ? "#d97706" : "#dc2626" }}>{v.stock_qty}</span>
                            </td>
                            <td style={{ padding: "10px" }}>
                              <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 20, background: v.is_active ? "#dcfce7" : "#fee2e2", color: v.is_active ? "#166534" : "#991b1b" }}>
                                {v.is_active ? "Active" : "Inactive"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── STOCK TAB ── */}
        {activeTab === "stock" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
              {product.variants?.map((v: any) => (
                <div key={v.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 18px" }}>
                  <div style={{ marginBottom: 4 }}><VariantBadges attrs={v.selected_attributes} /></div>
                  <p style={{ fontSize: 11, color: "#94a3b8", margin: "2px 0 6px", fontFamily: "monospace" }}>{v.sku}</p>
                  <p style={{ fontSize: 22, fontWeight: 700, margin: 0, color: v.stock_qty > 5 ? "#16a34a" : v.stock_qty > 0 ? "#d97706" : "#dc2626" }}>
                    {v.stock_qty} <span style={{ fontSize: 12, fontWeight: 400, color: "#94a3b8" }}>units</span>
                  </p>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 16, fontSize: 12 }}>
              <span style={{ background: "#dcfce7", color: "#166534", padding: "3px 10px", borderRadius: 20, fontWeight: 500 }}>↑ Stock In = from Purchases</span>
              <span style={{ background: "#fee2e2", color: "#991b1b", padding: "3px 10px", borderRadius: 20, fontWeight: 500 }}>↓ Stock Out = from Sales Orders</span>
              <span style={{ background: "#fef9c3", color: "#854d0e", padding: "3px 10px", borderRadius: 20, fontWeight: 500 }}>± Adjustment = manual correction</span>
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <select value={filterVariant} onChange={e => { setFilterVariant(e.target.value); setTxnPage(1); }}
                style={{ padding: "8px 12px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, color: "#475569", outline: "none" }}>
                <option value="">All Variants</option>
                {product.variants?.map((v: any) => (
                  <option key={v.id} value={v.id}>
                    {Object.values(v.selected_attributes || {}).join(" / ") || "Default"} — {v.sku}
                  </option>
                ))}
              </select>
              <select value={filterType} onChange={e => { setFilterType(e.target.value); setTxnPage(1); }}
                style={{ padding: "8px 12px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, color: "#475569", outline: "none" }}>
                <option value="">All Types</option>
                <option value="in">Stock In (Purchases)</option>
                <option value="out">Stock Out (Orders)</option>
                <option value="adjustment">Adjustments</option>
              </select>
              <div style={{ flex: 1 }} />
              <button onClick={() => setShowAdjModal(true)}
                style={{ padding: "8px 18px", borderRadius: 7, background: "#f59e0b", color: "white", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
                ± Stock Adjustment
              </button>
            </div>

            {txnLoading ? (
              <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading...</div>
            ) : txns.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", border: "1px dashed #e2e8f0", borderRadius: 10, color: "#94a3b8" }}>
                <p style={{ fontSize: 15, margin: "0 0 6px" }}>No transactions yet</p>
                <p style={{ fontSize: 13, margin: 0 }}>Stock In appears when purchases are received. Stock Out appears when orders are placed.</p>
              </div>
            ) : (
              <>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                        {["Date & Time", "Variant", "Type", "Qty Change", "Stock Before", "Stock After", "Reference", "Note"].map(h => (
                          <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748b", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {txns.map(t => {
                        const meta = TXN_META[t.txn_type];
                        return (
                          <tr key={t.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "10px 12px", color: "#64748b", whiteSpace: "nowrap", fontSize: 12 }}>{t.created_at ? fmtDate(t.created_at) : "—"}</td>
                            <td style={{ padding: "10px 12px" }}>
                              <VariantBadges attrs={t.variant_attrs} />
                              <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace", marginTop: 2 }}>{t.variant_sku}</div>
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, background: meta.bg, color: meta.color }}>
                                {meta.icon} {meta.label}
                              </span>
                            </td>
                            <td style={{ padding: "10px 12px", fontWeight: 700, fontSize: 15, color: t.qty_change > 0 ? "#16a34a" : t.qty_change < 0 ? "#dc2626" : "#d97706" }}>
                              {t.qty_change > 0 ? "+" : ""}{t.qty_change}
                            </td>
                            <td style={{ padding: "10px 12px", color: "#64748b" }}>{t.qty_before != null ? t.qty_before : "—"}</td>
                            <td style={{ padding: "10px 12px", fontWeight: 600 }}>{t.qty_after != null ? t.qty_after : "—"}</td>
                            <td style={{ padding: "10px 12px" }}>
                              {t.reference_id ? (
                                <span style={{ fontSize: 12, background: "#f1f5f9", padding: "2px 8px", borderRadius: 4, color: "#475569", fontFamily: "monospace" }}>
                                  {t.reference_type === "order" ? "🛒" : t.reference_type === "purchase" ? "📦" : "✏️"} {t.reference_id}
                                </span>
                              ) : "—"}
                            </td>
                            <td style={{ padding: "10px 12px", color: "#64748b", maxWidth: 200 }}>
                              <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.note || ""}>{t.note || "—"}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {txnTotal > 30 && (
                  <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
                    <button disabled={txnPage === 1} onClick={() => loadTxns(txnPage - 1)} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #e2e8f0", background: txnPage === 1 ? "#f8fafc" : "white", cursor: txnPage === 1 ? "default" : "pointer", color: "#475569", fontSize: 13 }}>← Prev</button>
                    <span style={{ padding: "6px 12px", fontSize: 13, color: "#64748b" }}>Page {txnPage} of {Math.ceil(txnTotal / 30)}</span>
                    <button disabled={txnPage * 30 >= txnTotal} onClick={() => loadTxns(txnPage + 1)} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #e2e8f0", background: txnPage * 30 >= txnTotal ? "#f8fafc" : "white", cursor: txnPage * 30 >= txnTotal ? "default" : "pointer", color: "#475569", fontSize: 13 }}>Next →</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {showAdjModal && (
        <AdjustmentModal
          product={product}
          productId={String(id)}
          onClose={() => setShowAdjModal(false)}
          onSaved={() => {
            setShowAdjModal(false);
            staffApi.get(`/products/admin/${id}`).then(r => setProduct(r.data));
            setTxnRefreshKey(k => k + 1);
          }}
        />
      )}
    </div>
  );
}

// ── Adjustment Modal (unchanged) ──────────────────────────────────────────────
function AdjustmentModal({ product, productId, onClose, onSaved }: {
  product: any; productId: string; onClose: () => void; onSaved: () => void;
}) {
  const [variantId, setVariantId] = useState(String(product.variants?.[0]?.id || ""));
  const [newQty,    setNewQty]    = useState("");
  const [note,      setNote]      = useState("");
  const [refId,     setRefId]     = useState("");
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");

  const selectedVariant = product.variants?.find((v: any) => String(v.id) === variantId);
  const parsedQty = parseInt(newQty);
  const delta = selectedVariant && !isNaN(parsedQty) ? parsedQty - selectedVariant.stock_qty : null;

  const submit = async () => {
    if (!variantId)  { setError("Select a variant"); return; }
    if (newQty === "" || isNaN(parsedQty) || parsedQty < 0) { setError("Enter a valid stock quantity (0 or more)"); return; }
    if (!note.trim()) { setError("Please add a note explaining the adjustment"); return; }
    setSaving(true); setError("");
    try {
      await staffApi.post(`/products/${productId}/stock-transactions`, {
        variant_id: parseInt(variantId), txn_type: "adjustment",
        new_qty: parsedQty, note, reference_type: "manual", reference_id: refId || null,
      });
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.detail || "Failed to save adjustment");
    } finally { setSaving(false); }
  };

  const inp = { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const };
  const lbl = { display: "block", fontSize: 13, fontWeight: 500, color: "#475569", marginBottom: 5 } as const;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "white", borderRadius: 12, padding: 28, width: 460, maxWidth: "95vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px" }}>± Stock Adjustment</h2>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Correct stock for damage, loss, audit, or opening stock.</p>
        </div>
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <label style={lbl}>Variant *</label>
            <select style={inp} value={variantId} onChange={e => { setVariantId(e.target.value); setNewQty(""); }}>
              <option value="">Select variant</option>
              {product.variants?.map((v: any) => (
                <option key={v.id} value={v.id}>
                  {Object.values(v.selected_attributes || {}).join(" / ") || "Default"} — {v.sku} (current: {v.stock_qty})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={lbl}>Set stock to (new absolute quantity) *</label>
            <input type="number" min={0} style={inp} placeholder={selectedVariant ? `Current: ${selectedVariant.stock_qty}` : "0"} value={newQty} onChange={e => setNewQty(e.target.value)} />
            {delta !== null && (
              <p style={{ fontSize: 12, margin: "5px 0 0", color: delta === 0 ? "#94a3b8" : delta > 0 ? "#16a34a" : "#dc2626", fontWeight: 500 }}>
                {delta === 0 ? "No change" : delta > 0 ? `↑ Stock will increase by ${delta}` : `↓ Stock will decrease by ${Math.abs(delta)}`}
                {" "}({selectedVariant?.stock_qty} → {parsedQty})
              </p>
            )}
          </div>
          <div>
            <label style={lbl}>Reason / Note *</label>
            <input style={inp} placeholder="e.g. Damage write-off, Physical count correction..." value={note} onChange={e => setNote(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Reference ID <span style={{ fontWeight: 400, color: "#94a3b8" }}>(optional)</span></label>
            <input style={inp} placeholder="e.g. DMG-001, AUDIT-2026-Q1..." value={refId} onChange={e => setRefId(e.target.value)} />
          </div>
        </div>
        {error && <p style={{ color: "#dc2626", fontSize: 13, marginTop: 12, padding: "8px 12px", background: "#fee2e2", borderRadius: 6, margin: "12px 0 0" }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 7, border: "1px solid #e2e8f0", background: "white", color: "#475569", cursor: "pointer", fontSize: 13 }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ padding: "9px 20px", borderRadius: 7, background: "#f59e0b", color: "white", border: "none", cursor: saving ? "default" : "pointer", fontSize: 13, fontWeight: 500 }}>
            {saving ? "Saving..." : "Save Adjustment"}
          </button>
        </div>
      </div>
    </div>
  );
}