"use client";
import { useEffect, useState } from "react";
import posApi from "@/lib/posApi";
import { useAuthStore } from "@/store/auth";
import { useStaffAuthStore } from "@/store/staffAuth";
import StatCard from "@/components/admin/StatCard";
import PageHeader from "@/components/admin/PageHeader";
import DataTable from "@/components/admin/DataTable";

export default function AdminDashboard() {
  const customerUser = useAuthStore((s) => s.user);
  const staffUser = useStaffAuthStore((s) => s.user);
  const isCustomerAdmin = customerUser?.role === "admin";

  const [stats, setStats] = useState({ orders: 0, revenue: 0, customers: 0, pending: 0, products: 0 });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, ordersRes] = await Promise.all([
          posApi.get("/admin/dashboard-stats"),
          posApi.get("/orders/admin/all?limit=5"),
        ]);
        setStats({
          orders: statsRes.data.total_orders,
          revenue: statsRes.data.total_revenue,
          customers: statsRes.data.total_customers,
          pending: statsRes.data.pending_orders,
          products: statsRes.data.total_products,
        });
        setRecentOrders(ordersRes.data?.items || []);
      } catch {
        setStats({ orders: 0, revenue: 0, customers: 0, pending: 0, products: 0 });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const orderColumns = [
    { key: "order_number", label: "Order #" },
    { key: "shipping_name", label: "Customer" },
    { key: "total_amount", label: "Amount", render: (r: any) => `₹${parseFloat(r.total_amount).toLocaleString("en-IN")}` },
    { key: "payment_method", label: "Payment", render: (r: any) => <span style={{ textTransform: "uppercase", fontSize: 12 }}>{r.payment_method}</span> },
    { key: "status", label: "Status", render: (r: any) => <StatusBadge status={r.status} /> },
    { key: "created_at", label: "Date", render: (r: any) => new Date(r.created_at).toLocaleDateString("en-IN") },
  ];

  const displayName = customerUser?.name || staffUser?.name || "";

  return (
    <div style={{ padding: 32 }}>
      <PageHeader
        title="Dashboard"
        subtitle={
          isCustomerAdmin
            ? `Good ${greeting()}, here's what's happening today.`
            : `Welcome, ${displayName}. Here's what's happening today.`
        }
      />

      {/* Stats */}
     <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 8 }}>
  <StatCard label="Total Orders"    value={stats.orders}   icon="📦" color="#0284c7" sub="All time" />
  <StatCard label="Total Revenue"   value={`₹${stats.revenue.toLocaleString("en-IN")}`} icon="💰" color="#16a34a" sub="Gross sales" />
  <StatCard label="Pending Orders"  value={stats.pending}  icon="⏳" color="#d97706" sub="Needs action" />
  <StatCard label="Products"        value={stats.products} icon="🪟" color="#0891b2" sub="Active" />
  <StatCard label="Customers"       value={stats.customers} icon="👥" color="#7c3aed" sub="Registered" />
</div>

      {/* Quick links */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 8 }}>
        {[
          { label: "Add Product",   href: "/admin/products/new",  icon: "➕", color: "#0284c7" },
          { label: "New Purchase",  href: "/admin/purchases/new", icon: "🛒", color: "#16a34a" },
          { label: "Add Vendor",    href: "/admin/vendors/new",   icon: "🏭", color: "#7c3aed" },
          { label: "View Reports",  href: "/admin/reports",       icon: "📊", color: "#d97706" },
          { label: "GST Returns",   href: "/admin/reports#gst",   icon: "🧾", color: "#db2777" },
          { label: "Add Coupon",    href: "/admin/coupons/new",   icon: "🏷️", color: "#0891b2" },
        ].map((q) => (
          <a key={q.href} href={q.href} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            padding: "16px 12px", borderRadius: 10, background: "white",
            border: "1px solid #e2e8f0", textDecoration: "none", transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = q.color; (e.currentTarget as HTMLElement).style.background = `${q.color}08`; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0"; (e.currentTarget as HTMLElement).style.background = "white"; }}>
            <span style={{ fontSize: 22 }}>{q.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: "#475569", textAlign: "center" }}>{q.label}</span>
          </a>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="card">
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: 0 }}>Recent Orders</h2>
        </div>
        <DataTable columns={orderColumns} data={recentOrders} loading={loading} emptyText="No orders yet" />
        <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", textAlign: "right" }}>
          <a href="/admin/orders" style={{ fontSize: 13, color: "#0284c7", textDecoration: "none" }}>View all orders →</a>
        </div>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    placed:     { bg: "#fef9c3", color: "#854d0e" },
    confirmed:  { bg: "#dbeafe", color: "#1d4ed8" },
    processing: { bg: "#ede9fe", color: "#6d28d9" },
    shipped:    { bg: "#d1fae5", color: "#065f46" },
    delivered:  { bg: "#dcfce7", color: "#166534" },
    cancelled:  { bg: "#fee2e2", color: "#991b1b" },
    refunded:   { bg: "#f1f5f9", color: "#475569" },
  };
  const c = colors[status] || { bg: "#f1f5f9", color: "#475569" };
  return (
    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: c.bg, color: c.color, textTransform: "capitalize" }}>
      {status}
    </span>
  );
}