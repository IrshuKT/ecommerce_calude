"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import PageHeader from "@/components/admin/PageHeader";
import Link from "next/link";
const STATUSES = ["placed","confirmed","processing","shipped","delivered","cancelled"];

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    placed:     { bg: "#fef9c3", color: "#854d0e" },
    confirmed:  { bg: "#dbeafe", color: "#1d4ed8" },
    processing: { bg: "#ede9fe", color: "#6d28d9" },
    shipped:    { bg: "#d1fae5", color: "#065f46" },
    delivered:  { bg: "#dcfce7", color: "#166534" },
    cancelled:  { bg: "#fee2e2", color: "#991b1b" },
    refunded:   { bg: "#f1f5f9", color: "#475569" },
    pending:    { bg: "#fef9c3", color: "#854d0e" },
    paid:       { bg: "#dcfce7", color: "#166534" },
    failed:     { bg: "#fee2e2", color: "#991b1b" },
  };
  const c = colors[status] || { bg: "#f1f5f9", color: "#475569" };
  return (
    <span style={{ padding: "3px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: c.bg, color: c.color, textTransform: "capitalize" }}>
      {status}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9", fontSize: 14 }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ fontWeight: 500, color: "#1e293b", textAlign: "right", maxWidth: "60%" }}>{value}</span>
    </div>
  );
}



export default function OrderDetailPage() {
  const { orderNumber } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState("");

  useEffect(() => {
    if (orderNumber) load();
  }, [orderNumber]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/orders/admin/${orderNumber}`);
      setOrder(res.data);
      setNewStatus(res.data.status);
    } catch { alert("Failed to load order"); }
    finally { setLoading(false); }
  };

  const updateStatus = async () => {
    setUpdating(true);
    try {
      await api.patch(`/orders/${orderNumber}/status`, { status: newStatus });
      await load();
    } catch { alert("Failed to update status"); }
    finally { setUpdating(false); }
  };

  const fmt = (n: any) => `₹${parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading order...</div>;
  if (!order) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Order not found</div>;

  return (
    <div style={{ padding: 32, maxWidth: 1000 }}>
      <PageHeader
        title={
  <span>
    Order{" "}
    <a
      href={`/admin/orders/${order.order_number}`}
      style={{
        fontWeight: 600,
        color: "#0284c7",
        textDecoration: "none",
      }}
    >
      {order.order_number}
    </a>
  </span>
}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

        {/* Order Status */}
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#475569", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Order Status</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <StatusBadge status={order.status} />
            <span style={{ fontSize: 13, color: "#64748b" }}>Current status</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
              style={{ flex: 1, padding: "8px 12px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", outline: "none" }}>
              {STATUSES.map(s => <option key={s} value={s} style={{ textTransform: "capitalize" }}>{s}</option>)}
            </select>
            <button onClick={updateStatus} disabled={updating || newStatus === order.status}
              style={{ padding: "8px 16px", borderRadius: 7, background: "#0284c7", color: "white", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, opacity: newStatus === order.status ? 0.5 : 1 }}>
              {updating ? "..." : "Update"}
            </button>
          </div>

          {/* Tracking timeline */}
          {order.tracking?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", margin: "0 0 10px", textTransform: "uppercase" }}>Timeline</p>
              {[...order.tracking].reverse().map((t: any, i: number) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0284c7", marginTop: 5, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, color: "#1e293b", margin: "0 0 2px", textTransform: "capitalize" }}>{t.status}</p>
                    {t.message && <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 2px" }}>{t.message}</p>}
                    <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>{new Date(t.created_at).toLocaleString("en-IN")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment Info */}
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#475569", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Payment</h2>
          <InfoRow label="Method" value={<span style={{ textTransform: "uppercase", fontSize: 12, background: "#f1f5f9", padding: "2px 8px", borderRadius: 4 }}>{order.payment_method}</span>} />
          <InfoRow label="Status" value={<StatusBadge status={order.payment_status} />} />
          {order.razorpay_payment_id && <InfoRow label="Razorpay ID" value={<span style={{ fontSize: 12, fontFamily: "monospace" }}>{order.razorpay_payment_id}</span>} />}
        </div>

        {/* Customer & Shipping */}
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#475569", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Delivery Address</h2>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", margin: "0 0 4px" }}>{order.shipping_name}</p>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 4px" }}>{order.shipping_line1}{order.shipping_line2 ? `, ${order.shipping_line2}` : ""}</p>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 4px" }}>{order.shipping_city}, {order.shipping_state} — {order.shipping_pincode}</p>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>📞 {order.shipping_phone}</p>
          {order.is_interstate && (
            <span style={{ display: "inline-block", marginTop: 8, fontSize: 11, background: "#fef9c3", color: "#854d0e", padding: "2px 8px", borderRadius: 4, fontWeight: 500 }}>
              Interstate — IGST applicable
            </span>
          )}
        </div>

        {/* Price Breakdown */}
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#475569", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Price Breakdown</h2>
          <InfoRow label="Subtotal" value={fmt(order.subtotal)} />
          {parseFloat(order.discount_amount) > 0 && <InfoRow label="Discount" value={<span style={{ color: "#16a34a" }}>− {fmt(order.discount_amount)}</span>} />}
          {parseFloat(order.cgst_amount) > 0 && <InfoRow label="CGST" value={fmt(order.cgst_amount)} />}
          {parseFloat(order.sgst_amount) > 0 && <InfoRow label="SGST" value={fmt(order.sgst_amount)} />}
          {parseFloat(order.igst_amount) > 0 && <InfoRow label="IGST" value={fmt(order.igst_amount)} />}
          {parseFloat(order.shipping_charge) > 0 && <InfoRow label="Shipping" value={fmt(order.shipping_charge)} />}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
            <span>Total</span>
            <span>{fmt(order.total_amount)}</span>
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: "#475569", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Order Items</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
              {["Product", "Variant", "SKU", "Qty", "Unit Price", "Total"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {order.items?.map((item: any) => (
              <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "12px 10px", fontWeight: 500, color: "#1e293b" }}>{item.product_name}</td>
                <td style={{ padding: "12px 10px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {Object.entries(item.selected_attributes || {}).map(([k, v]) => (
                      <span key={k} style={{ fontSize: 11, background: "#f1f5f9", padding: "2px 6px", borderRadius: 4, color: "#475569" }}>{String(v)}</span>
                    ))}
                    {item.area_sqft && <span style={{ fontSize: 11, background: "#eff6ff", padding: "2px 6px", borderRadius: 4, color: "#0284c7" }}>{item.area_sqft} sqft</span>}
                  </div>
                </td>
                <td style={{ padding: "12px 10px", fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>{item.variant_sku}</td>
                <td style={{ padding: "12px 10px" }}>{item.quantity}</td>
                <td style={{ padding: "12px 10px" }}>{fmt(item.unit_price)}</td>
                <td style={{ padding: "12px 10px", fontWeight: 600 }}>{fmt(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Notes */}
      {order.notes && (
        <div className="card" style={{ padding: 20, marginTop: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#475569", margin: "0 0 10px" }}>Order Notes</h2>
          <p style={{ fontSize: 14, color: "#475569", margin: 0 }}>{order.notes}</p>
        </div>
      )}
    </div>
  );
}
