"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/orders/").then(r => setOrders(Array.isArray(r.data) ? r.data : [])).catch(() => setOrders([])).finally(() => setLoading(false));
  }, []);

  const statusColors: Record<string, { bg: string; color: string }> = {
    placed:     { bg: "#fef9c3", color: "#854d0e" },
    confirmed:  { bg: "#dbeafe", color: "#1d4ed8" },
    processing: { bg: "#ede9fe", color: "#6d28d9" },
    shipped:    { bg: "#d1fae5", color: "#065f46" },
    delivered:  { bg: "#dcfce7", color: "#166534" },
    cancelled:  { bg: "#fee2e2", color: "#991b1b" },
  };

  const STEPS = ["placed", "confirmed", "processing", "shipped", "delivered"];

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", margin: "0 0 20px" }}>My Orders</h1>

      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
          <p style={{ color: "#64748b", marginBottom: 16 }}>No orders yet.</p>
          <Link href="/shop" style={{ padding: "10px 24px", background: "#0284c7", color: "white", borderRadius: 8, textDecoration: "none", fontWeight: 500 }}>Start Shopping</Link>
        </div>
      ) : orders.map((order: any) => {
        const c = statusColors[order.status] || { bg: "#f1f5f9", color: "#475569" };
        const stepIdx = STEPS.indexOf(order.status);

        return (
          <div key={order.id} className="card" style={{ marginBottom: 16, overflow: "hidden" }}>
            {/* Order header */}
            <div style={{ padding: "14px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{order.order_number}</span>
                <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 12 }}>
                  {new Date(order.created_at).toLocaleDateString("en-IN", { dateStyle: "long" })}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>₹{parseFloat(order.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 12px", borderRadius: 20, background: c.bg, color: c.color, textTransform: "capitalize" }}>{order.status}</span>
              </div>
            </div>

            {/* Progress bar — only for active orders */}
            {!["cancelled", "refunded"].includes(order.status) && (
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  {STEPS.map((step, i) => (
                    <div key={step} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : 0 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 700,
                          background: i <= stepIdx ? "#0284c7" : "#e2e8f0",
                          color: i <= stepIdx ? "white" : "#94a3b8",
                        }}>
                          {i < stepIdx ? "✓" : i + 1}
                        </div>
                        <span style={{ fontSize: 10, color: i <= stepIdx ? "#0284c7" : "#94a3b8", marginTop: 4, textTransform: "capitalize", whiteSpace: "nowrap" }}>{step}</span>
                      </div>
                      {i < STEPS.length - 1 && (
                        <div style={{ flex: 1, height: 2, background: i < stepIdx ? "#0284c7" : "#e2e8f0", margin: "0 4px", marginBottom: 16 }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Order details */}
            <div style={{ padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                <span style={{ marginRight: 16 }}>Payment: <strong style={{ textTransform: "uppercase" }}>{order.payment_method}</strong></span>
                <span>Status: <strong style={{ color: order.payment_status === "paid" ? "#16a34a" : "#d97706", textTransform: "capitalize" }}>{order.payment_status}</strong></span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
  {order.status === "placed" && (
  <Link href={`/account/orders/${encodeURIComponent(order.order_number)}/edit`}
    style={{ fontSize: 13, color: "#d97706", textDecoration: "none", padding: "5px 12px", border: "1px solid #fde68a", borderRadius: 6, background: "#fffbeb" }}>
    ✎ Edit Order
  </Link>
)}
  <Link href={`/account/invoices?order=${encodeURIComponent(order.order_number)}`}
    style={{ fontSize: 13, color: "#0284c7", textDecoration: "none", padding: "5px 12px", border: "1px solid #bfdbfe", borderRadius: 6, background: "#eff6ff" }}>
    🧾 Invoice
  </Link>
</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
