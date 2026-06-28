"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { usePublicSettings } from "@/app/context/PublicSettingsContext";
import { Settings } from "lucide-react";

function StatCard({ label, value, icon, href }: any) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div className="card" style={{ padding: 20, transition: "all 0.15s" }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#0284c7"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0"; }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 4px" }}>{label}</p>
            <p style={{ fontSize: 26, fontWeight: 700, color: "#1e293b", margin: 0 }}>{value}</p>
          </div>
          <span style={{ fontSize: 28 }}>{icon}</span>
        </div>
      </div>
    </Link>
  );
}

export default function AccountDashboard() {
  const { user } = useAuthStore();
  const settings = usePublicSettings();
  const [orders, setOrders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/orders/").catch(() => ({ data: [] })),
      api.get("/invoices/my").catch(() => ({ data: [] })),
    ]).then(([o, i]) => {
      setOrders(Array.isArray(o.data) ? o.data : []);
      setInvoices(Array.isArray(i.data) ? i.data : []);
    }).finally(() => setLoading(false));
  }, []);

  const pendingOrders = orders.filter(o => !["delivered", "cancelled"].includes(o.status)).length;
  const totalSpent = orders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1e293b", margin: "0 0 4px" }}>
          Welcome back, {user?.name?.split(" ")[0]}!
        </h1>
        <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>Here's a summary of your account.</p>
      </div>

      {/* Trade status banner */}
      {(user as any)?.is_trade_approved ? (
        <div style={{ padding: 14, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>✅</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#166534", margin: 0 }}>Trade Account Active</p>
            <p style={{ fontSize: 13, color: "#16a34a", margin: 0 }}>You are getting exclusive trade pricing on all products.</p>
          </div>
        </div>
      ) : (
        <div style={{ padding: 14, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>💼</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#1d4ed8", margin: 0 }}>Upgrade to Trade Account</p>
              <p style={{ fontSize: 13, color: "#3b82f6", margin: 0 }}>Get exclusive pricing. Contact us to get approved.</p>
            </div>
          </div>
          <a href={`mailto:${settings.email || "hello@glassstore.in"}`} 
  style={{ fontSize: 13, color: "#0284c7", background: "white", padding: "6px 14px", borderRadius: 6, border: "1px solid #bfdbfe", textDecoration: "none", fontWeight: 500 }}>
  Contact Us
</a>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Orders" value={loading ? "..." : orders.length} icon="📦" href="/account/orders" />
        <StatCard label="Active Orders" value={loading ? "..." : pendingOrders} icon="⏳" href="/account/orders" />
        <StatCard label="Total Spent" value={loading ? "..." : `₹${totalSpent.toLocaleString("en-IN", { minimumFractionDigits: 0 })}`} icon="💰" href="/account/orders" />
        <StatCard label="Invoices" value={loading ? "..." : invoices.length} icon="🧾" href="/account/invoices" />
      </div>

      {/* Recent orders */}
      <div className="card">
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Recent Orders</h2>
          <Link href="/account/orders" style={{ fontSize: 13, color: "#0284c7", textDecoration: "none" }}>View all →</Link>
        </div>
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>Loading...</div>
        ) : orders.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center" }}>
            <p style={{ color: "#64748b", marginBottom: 12 }}>No orders yet.</p>
            <Link href="/shop" style={{ color: "#0284c7", fontSize: 14 }}>Start Shopping →</Link>
          </div>
        ) : orders.slice(0, 5).map((order: any) => {
          const statusColors: Record<string, string> = { placed: "#854d0e", confirmed: "#1d4ed8", processing: "#6d28d9", shipped: "#065f46", delivered: "#166534", cancelled: "#991b1b" };
          const statusBg: Record<string, string> = { placed: "#fef9c3", confirmed: "#dbeafe", processing: "#ede9fe", shipped: "#d1fae5", delivered: "#dcfce7", cancelled: "#fee2e2" };
          return (
            <div key={order.id} style={{ padding: "14px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", margin: "0 0 2px" }}>{order.order_number}</p>
                <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>{new Date(order.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>₹{parseFloat(order.total_amount).toLocaleString("en-IN")}</span>
                <span style={{ fontSize: 12, fontWeight: 500, padding: "3px 10px", borderRadius: 20, background: statusBg[order.status] || "#f1f5f9", color: statusColors[order.status] || "#475569", textTransform: "capitalize" }}>
                  {order.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
