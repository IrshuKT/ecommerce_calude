"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8000";

interface Address {
  id: number;
  label: string;
  full_name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  state_code: string;
  pincode: string;
  is_default: boolean;
}

interface OrderItem {
  id: number;
  variant_id: number;
  product_name: string;
  variant_sku: string;
  selected_attributes: Record<string, string>;
  unit_price: number;
  quantity: number;
  custom_width_ft?: number;
  custom_height_ft?: number;
  line_total: number;
}

interface SearchResult {
  id: number;
  sku: string;
  retail_price: number;
  stock_qty: number;
  selected_attributes: Record<string, string>;
  product: { name: string; gst_rate: number; hsn_code: string };
}

export default function EditOrderPage() {
  const router = useRouter();
  const params = useParams();
  const orderNumber = decodeURIComponent(params.order_number as string);
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!user) { router.replace("/login"); return; }
    load();
  }, [user]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [orderRes, addrRes] = await Promise.all([
        api.get(`/orders/${encodeURIComponent(orderNumber)}`),
        api.get("/users/addresses"),
      ]);

      const order = orderRes.data;
      if (order.status !== "placed") {
        setError("This order can no longer be edited — it has already been confirmed.");
        setLoading(false);
        return;
      }

      setAddresses(addrRes.data || []);
      const matchingAddr = (addrRes.data || []).find(
        (a: Address) => a.line1 === order.shipping_line1 && a.pincode === order.shipping_pincode
      );
      setSelectedAddressId(matchingAddr?.id ?? addrRes.data?.[0]?.id ?? null);

      setItems(
        (order.items || []).map((it: any) => ({
          id: it.id,
          variant_id: it.variant_id,
          product_name: it.product_name,
          variant_sku: it.variant_sku,
          selected_attributes: it.selected_attributes || {},
          unit_price: parseFloat(it.unit_price),
          quantity: it.quantity,
          custom_width_ft: it.custom_width_ft,
          custom_height_ft: it.custom_height_ft,
          line_total: parseFloat(it.line_total),
        }))
      );
    } catch (e: any) {
      setError(e.response?.data?.detail || "Failed to load order");
    } finally {
      setLoading(false);
    }
  };

  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const gstEstimate = subtotal * 0.18;
  const total = subtotal + gstEstimate;

  const updateQty = (variantId: number, qty: number) => {
    if (qty <= 0) {
      setItems((prev) => prev.filter((i) => i.variant_id !== variantId));
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.variant_id === variantId
          ? { ...i, quantity: qty, line_total: i.unit_price * qty }
          : i
      )
    );
  };

  const removeItem = (variantId: number) => {
    setItems((prev) => prev.filter((i) => i.variant_id !== variantId));
  };

  const handleSearch = async (value: string) => {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get(`/products/variants/search?q=${encodeURIComponent(value)}`);
      setResults(res.data || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const addVariant = (v: SearchResult) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.variant_id === v.id);
      if (existing) {
        return prev.map((i) =>
          i.variant_id === v.id
            ? { ...i, quantity: i.quantity + 1, line_total: i.unit_price * (i.quantity + 1) }
            : i
        );
      }
      return [
        ...prev,
        {
          id: -Date.now(), // temp id for new rows, not sent to backend
          variant_id: v.id,
          product_name: v.product.name,
          variant_sku: v.sku,
          selected_attributes: v.selected_attributes || {},
          unit_price: v.retail_price,
          quantity: 1,
          line_total: v.retail_price,
        },
      ];
    });
    setQuery("");
    setResults([]);
  };

  const saveChanges = async () => {
    if (!selectedAddressId) {
      alert("Please select a delivery address");
      return;
    }
    if (items.length === 0) {
      alert("Order must have at least one item");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/orders/${encodeURIComponent(orderNumber)}/edit`, {
        address_id: selectedAddressId,
        items: items.map((i) => ({
          variant_id: i.variant_id,
          quantity: i.quantity,
          custom_width_ft: i.custom_width_ft,
          custom_height_ft: i.custom_height_ft,
        })),
      });
      router.push("/account/orders");
    } catch (e: any) {
      setError(e.response?.data?.detail || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 900, margin: "60px auto", padding: "0 24px", textAlign: "center", color: "#94a3b8" }}>
        Loading order...
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div style={{ maxWidth: 600, margin: "60px auto", padding: "0 24px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
        <p style={{ color: "#dc2626", marginBottom: 20 }}>{error}</p>
        <Link href="/account/orders" style={{ padding: "10px 24px", background: "#0284c7", color: "white", borderRadius: 8, textDecoration: "none", fontWeight: 500 }}>
          Back to Orders
        </Link>
      </div>
    );
  }

  const lbl = { fontSize: 13, fontWeight: 500, color: "#475569", display: "block", marginBottom: 5 } as const;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1e293b", margin: 0 }}>Edit Order</h1>
        <Link href="/account/orders" style={{ fontSize: 13, color: "#64748b", textDecoration: "none" }}>← Back to Orders</Link>
      </div>
      <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 24px" }}>{orderNumber} — editable until confirmed</p>

      {error && (
        <div style={{ padding: 12, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>
        <div>
          {/* Address picker */}
          <div className="card" style={{ padding: 20, marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 14px" }}>Delivery Address</h2>
            {addresses.map((addr) => (
              <div key={addr.id} onClick={() => setSelectedAddressId(addr.id)}
                style={{ padding: 14, borderRadius: 8, border: `2px solid ${selectedAddressId === addr.id ? "#0284c7" : "#e2e8f0"}`, marginBottom: 10, cursor: "pointer", background: selectedAddressId === addr.id ? "#f0f9ff" : "white" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, background: "#f1f5f9", padding: "2px 8px", borderRadius: 4, color: "#475569" }}>{addr.label}</span>
                  {addr.is_default && <span style={{ fontSize: 11, background: "#dbeafe", color: "#1d4ed8", padding: "1px 6px", borderRadius: 3, fontWeight: 500 }}>Default</span>}
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", margin: "0 0 2px" }}>{addr.full_name}</p>
                <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>{addr.line1}, {addr.city}, {addr.state} — {addr.pincode}</p>
              </div>
            ))}
          </div>

          {/* Items */}
          <div className="card" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 14px" }}>Order Items</h2>

            <div style={{ position: "relative", marginBottom: 16 }}>
              <input
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search products to add..."
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, outline: "none" }}
              />
              {results.length > 0 && (
                <div style={{ position: "absolute", zIndex: 10, width: "100%", background: "white", border: "1px solid #e2e8f0", borderRadius: 8, marginTop: 4, maxHeight: 260, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}>
                  {results.map((r) => (
                    <div key={r.id} onClick={() => addVariant(r)}
                      style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "white")}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{r.product.name}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{r.sku} · stock {r.stock_qty}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0284c7" }}>₹{r.retail_price}</div>
                    </div>
                  ))}
                </div>
              )}
              {searching && <div style={{ position: "absolute", right: 12, top: 12, fontSize: 12, color: "#94a3b8" }}>searching…</div>}
            </div>

            {items.length === 0 ? (
              <p style={{ textAlign: "center", color: "#94a3b8", padding: 24 }}>No items — add products above</p>
            ) : (
              items.map((item) => (
                <div key={item.variant_id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: "#1e293b", margin: "0 0 2px" }}>{item.product_name}</p>
                    <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>{item.variant_sku} · ₹{item.unit_price}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", border: "1px solid #e2e8f0", borderRadius: 7, overflow: "hidden" }}>
                    <button onClick={() => updateQty(item.variant_id, item.quantity - 1)}
                      style={{ width: 30, height: 30, border: "none", background: "#f8fafc", cursor: "pointer", fontSize: 15 }}>−</button>
                    <span style={{ width: 34, textAlign: "center", fontSize: 13, fontWeight: 600 }}>{item.quantity}</span>
                    <button onClick={() => updateQty(item.variant_id, item.quantity + 1)}
                      style={{ width: 30, height: 30, border: "none", background: "#f8fafc", cursor: "pointer", fontSize: 15 }}>+</button>
                  </div>
                  <div style={{ width: 90, textAlign: "right", fontSize: 14, fontWeight: 600 }}>
                    ₹{item.line_total.toLocaleString("en-IN")}
                  </div>
                  <button onClick={() => removeItem(item.variant_id)} style={{ color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>✕</button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="card" style={{ padding: 20, position: "sticky", top: 80 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Summary</h3>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475569", marginBottom: 8 }}>
            <span>Subtotal</span><span>₹{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475569", marginBottom: 8 }}>
            <span>GST (est. 18%)</span><span>₹{gstEstimate.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700, color: "#1e293b", paddingTop: 10, borderTop: "1px solid #e2e8f0", marginBottom: 20 }}>
            <span>Total (est.)</span><span>₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
          <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 16 }}>
            GST is estimated at 18% flat here for preview — actual per-item GST rates apply on save.
          </p>
          <button onClick={saveChanges} disabled={saving}
            style={{ width: "100%", padding: "12px", borderRadius: 8, background: saving ? "#94a3b8" : "#0284c7", color: "white", border: "none", cursor: saving ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600 }}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}