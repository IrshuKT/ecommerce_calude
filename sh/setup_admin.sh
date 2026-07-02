#!/bin/bash
# ============================================================
# GlassStore — Admin Panel Setup
# Run INSIDE frontend folder:
#   cd ecommerce_calude/frontend
#   bash setup_admin.sh
# ============================================================

set -e
echo "=========================================="
echo "  GlassStore Admin Panel Setup"
echo "=========================================="

mkdir -p "app/(admin)/admin/products"
mkdir -p "app/(admin)/admin/orders"
mkdir -p "app/(admin)/admin/vendors"
mkdir -p "app/(admin)/admin/purchases"
mkdir -p "app/(admin)/admin/accounting"
mkdir -p "app/(admin)/admin/reports"
mkdir -p "app/(admin)/admin/coupons"
mkdir -p "app/(admin)/admin/customers"
mkdir -p "components/admin"

echo "✓ Folders created"

# ════════════════════════════════════════════
# ADMIN LAYOUT
# ════════════════════════════════════════════

cat > "app/(admin)/layout.tsx" << 'EOF'
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import AdminSidebar from "@/components/admin/Sidebar";
import Spinner from "@/components/ui/Spinner";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.replace("/login");
    else if (user.role !== "admin") router.replace("/shop");
  }, [user, router]);

  if (!user) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Spinner size="lg" />
    </div>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc" }}>
      <AdminSidebar />
      <main style={{ flex: 1, overflow: "auto" }}>
        {children}
      </main>
    </div>
  );
}
EOF

echo "✓ Admin layout created"

# ════════════════════════════════════════════
# SIDEBAR COMPONENT
# ════════════════════════════════════════════

cat > "components/admin/Sidebar.tsx" << 'EOF'
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";

const nav = [
  { label: "Dashboard",   href: "/admin",             icon: "▦" },
  { label: "Products",    href: "/admin/products",     icon: "🪟" },
  { label: "Orders",      href: "/admin/orders",       icon: "📦" },
  { label: "Customers",   href: "/admin/customers",    icon: "👥" },
  { label: "Vendors",     href: "/admin/vendors",      icon: "🏭" },
  { label: "Purchases",   href: "/admin/purchases",    icon: "🛒" },
  { label: "Accounting",  href: "/admin/accounting",   icon: "🧾" },
  { label: "Reports",     href: "/admin/reports",      icon: "📊" },
  { label: "Coupons",     href: "/admin/coupons",      icon: "🏷️" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => { logout(); router.replace("/login"); };

  return (
    <aside style={{
      width: 240, background: "white", borderRight: "1px solid #e2e8f0",
      display: "flex", flexDirection: "column", height: "100vh",
      position: "sticky", top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <rect x="2" y="2" width="6" height="6" rx="1" fill="white" opacity="0.9"/>
              <rect x="10" y="2" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
              <rect x="2" y="10" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
              <rect x="10" y="10" width="6" height="6" rx="1" fill="white" opacity="0.9"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1e293b" }}>GlassStore</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>Admin Panel</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
        {nav.map((item) => {
          const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 12px", borderRadius: 8, marginBottom: 2,
              fontSize: 14, fontWeight: active ? 500 : 400,
              color: active ? "#0284c7" : "#475569",
              background: active ? "#eff6ff" : "transparent",
              textDecoration: "none", transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 13, fontWeight: 600 }}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>{user?.name}</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>Administrator</div>
          </div>
        </div>
        <button onClick={handleLogout} style={{
          width: "100%", padding: "8px", borderRadius: 7, border: "1px solid #e2e8f0",
          background: "white", color: "#64748b", fontSize: 13, cursor: "pointer",
          transition: "all 0.15s",
        }}>
          Sign out
        </button>
      </div>
    </aside>
  );
}
EOF

echo "✓ Sidebar created"

# ════════════════════════════════════════════
# STAT CARD COMPONENT
# ════════════════════════════════════════════

cat > "components/admin/StatCard.tsx" << 'EOF'
interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: string;
  color?: string;
}
export default function StatCard({ label, value, sub, icon, color = "#0284c7" }: StatCardProps) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>{label}</p>
          <p style={{ fontSize: 26, fontWeight: 700, color: "#1e293b", margin: "6px 0 4px" }}>{value}</p>
          {sub && <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>{sub}</p>}
        </div>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
          {icon}
        </div>
      </div>
    </div>
  );
}
EOF

# ════════════════════════════════════════════
# PAGE HEADER COMPONENT
# ════════════════════════════════════════════

cat > "components/admin/PageHeader.tsx" << 'EOF'
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}
export default function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "#1e293b", margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 14, color: "#64748b", margin: "4px 0 0" }}>{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
EOF

# ════════════════════════════════════════════
# DATA TABLE COMPONENT
# ════════════════════════════════════════════

cat > "components/admin/DataTable.tsx" << 'EOF'
interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  width?: number;
}
interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyText?: string;
  keyField?: string;
}
export default function DataTable<T extends Record<string, any>>({ columns, data, loading, emptyText = "No data found", keyField = "id" }: DataTableProps<T>) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
            {columns.map((col) => (
              <th key={col.key} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", width: col.width }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={columns.length} style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading...</td></tr>
          ) : data.length === 0 ? (
            <tr><td colSpan={columns.length} style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>{emptyText}</td></tr>
          ) : data.map((row, i) => (
            <tr key={row[keyField] ?? i} style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.1s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              {columns.map((col) => (
                <td key={col.key} style={{ padding: "12px 16px", color: "#334155", verticalAlign: "middle" }}>
                  {col.render ? col.render(row) : row[col.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
EOF

echo "✓ Shared components created"

# ════════════════════════════════════════════
# DASHBOARD PAGE
# ════════════════════════════════════════════

cat > "app/(admin)/admin/page.tsx" << 'EOF'
"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import StatCard from "@/components/admin/StatCard";
import PageHeader from "@/components/admin/PageHeader";
import DataTable from "@/components/admin/DataTable";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ orders: 0, revenue: 0, customers: 0, pending: 0 });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [ordersRes] = await Promise.all([
          api.get("/orders/admin/all?limit=5"),
        ]);
        const orders = ordersRes.data?.items || [];
        setRecentOrders(orders);
        setStats({
          orders: ordersRes.data?.total || 0,
          revenue: orders.reduce((s: number, o: any) => s + parseFloat(o.total_amount || 0), 0),
          customers: 0,
          pending: orders.filter((o: any) => o.status === "placed").length,
        });
      } catch {
        // API may not have admin/all endpoint yet — use mock
        setStats({ orders: 0, revenue: 0, customers: 0, pending: 0 });
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

  return (
    <div style={{ padding: 32 }}>
      <PageHeader title="Dashboard" subtitle={`Good ${greeting()}, here's what's happening today.`} />

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
        <StatCard label="Total Orders"    value={stats.orders}   icon="📦" color="#0284c7" sub="All time" />
        <StatCard label="Total Revenue"   value={`₹${stats.revenue.toLocaleString("en-IN")}`} icon="💰" color="#16a34a" sub="Gross sales" />
        <StatCard label="Pending Orders"  value={stats.pending}  icon="⏳" color="#d97706" sub="Needs action" />
        <StatCard label="Customers"       value={stats.customers} icon="👥" color="#7c3aed" sub="Registered" />
      </div>

      {/* Quick links */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 32 }}>
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
EOF

echo "✓ Dashboard page created"

# ════════════════════════════════════════════
# ORDERS PAGE
# ════════════════════════════════════════════

cat > "app/(admin)/admin/orders/page.tsx" << 'EOF'
"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import PageHeader from "@/components/admin/PageHeader";
import DataTable from "@/components/admin/DataTable";

const STATUSES = ["all","placed","confirmed","processing","shipped","delivered","cancelled"];

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    placed:     { bg: "#fef9c3", color: "#854d0e" },
    confirmed:  { bg: "#dbeafe", color: "#1d4ed8" },
    processing: { bg: "#ede9fe", color: "#6d28d9" },
    shipped:    { bg: "#d1fae5", color: "#065f46" },
    delivered:  { bg: "#dcfce7", color: "#166534" },
    cancelled:  { bg: "#fee2e2", color: "#991b1b" },
  };
  const c = colors[status] || { bg: "#f1f5f9", color: "#475569" };
  return <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: c.bg, color: c.color, textTransform: "capitalize" }}>{status}</span>;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [updating, setUpdating] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/orders/?${statusFilter !== "all" ? `status=${statusFilter}` : ""}`);
      setOrders(Array.isArray(res.data) ? res.data : res.data?.items || []);
    } catch { setOrders([]); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const updateStatus = async (orderNumber: string, status: string) => {
    setUpdating(orderNumber);
    try {
      await api.patch(`/orders/${orderNumber}/status`, { status });
      await load();
    } catch (e) { alert("Failed to update status"); } finally { setUpdating(null); }
  };

  const columns = [
    { key: "order_number", label: "Order #", render: (r: any) => <span style={{ fontWeight: 600, color: "#0284c7" }}>{r.order_number}</span> },
    { key: "shipping_name", label: "Customer" },
    { key: "shipping_city", label: "City" },
    { key: "total_amount", label: "Amount", render: (r: any) => <span style={{ fontWeight: 600 }}>₹{parseFloat(r.total_amount).toLocaleString("en-IN")}</span> },
    { key: "payment_method", label: "Payment", render: (r: any) => <span style={{ textTransform: "uppercase", fontSize: 12, background: "#f1f5f9", padding: "2px 8px", borderRadius: 4 }}>{r.payment_method}</span> },
    { key: "status", label: "Status", render: (r: any) => <StatusBadge status={r.status} /> },
    { key: "created_at", label: "Date", render: (r: any) => new Date(r.created_at).toLocaleDateString("en-IN") },
    { key: "actions", label: "Action", render: (r: any) => (
      <select value={r.status} disabled={updating === r.order_number}
        onChange={(e) => updateStatus(r.order_number, e.target.value)}
        style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0", background: "white", cursor: "pointer" }}>
        {["placed","confirmed","processing","shipped","delivered","cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    )},
  ];

  return (
    <div style={{ padding: 32 }}>
      <PageHeader title="Orders" subtitle="Manage and update customer orders" />

      {/* Status filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{
            padding: "6px 14px", borderRadius: 20, fontSize: 13, border: "1px solid",
            borderColor: statusFilter === s ? "#0284c7" : "#e2e8f0",
            background: statusFilter === s ? "#eff6ff" : "white",
            color: statusFilter === s ? "#0284c7" : "#475569",
            cursor: "pointer", textTransform: "capitalize", fontWeight: statusFilter === s ? 500 : 400,
          }}>{s}</button>
        ))}
      </div>

      <div className="card">
        <DataTable columns={columns} data={orders} loading={loading} emptyText="No orders found" keyField="order_number" />
      </div>
    </div>
  );
}
EOF

echo "✓ Orders page created"

# ════════════════════════════════════════════
# PRODUCTS PAGE
# ════════════════════════════════════════════

cat > "app/(admin)/admin/products/page.tsx" << 'EOF'
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import PageHeader from "@/components/admin/PageHeader";
import DataTable from "@/components/admin/DataTable";

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const router = useRouter();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/products/?search=${search}&limit=50`);
      setProducts(res.data?.items || []);
    } catch { setProducts([]); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search]);

  const toggleActive = async (id: number, current: boolean) => {
    try {
      await api.patch(`/products/${id}`, { is_active: !current });
      load();
    } catch { alert("Failed to update"); }
  };

  const columns = [
    { key: "primary_image", label: "", width: 56, render: (r: any) => (
      <div style={{ width: 40, height: 40, borderRadius: 6, background: "#f1f5f9", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
        {r.primary_image ? <img src={r.primary_image} alt={r.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🪟"}
      </div>
    )},
    { key: "name", label: "Product", render: (r: any) => <span style={{ fontWeight: 500 }}>{r.name}</span> },
    { key: "price_type", label: "Price Type", render: (r: any) => <span style={{ fontSize: 12, background: "#f1f5f9", padding: "2px 8px", borderRadius: 4, textTransform: "uppercase" }}>{r.price_type}</span> },
    { key: "min_price", label: "From", render: (r: any) => r.min_price ? `₹${parseFloat(r.min_price).toLocaleString("en-IN")}` : "—" },
    { key: "is_featured", label: "Featured", render: (r: any) => r.is_featured ? <span style={{ color: "#d97706" }}>⭐</span> : "—" },
    { key: "is_active", label: "Status", render: (r: any) => (
      <button onClick={() => toggleActive(r.id, r.is_active)} style={{
        padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer",
        background: r.is_active ? "#dcfce7" : "#fee2e2", color: r.is_active ? "#166534" : "#991b1b",
      }}>{r.is_active ? "Active" : "Inactive"}</button>
    )},
    { key: "actions", label: "", render: (r: any) => (
      <button onClick={() => router.push(`/admin/products/${r.id}`)} style={{ fontSize: 12, color: "#0284c7", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}>
        Edit →
      </button>
    )},
  ];

  return (
    <div style={{ padding: 32 }}>
      <PageHeader title="Products" subtitle="Manage your glass product catalog"
        action={<button className="btn-primary" onClick={() => router.push("/admin/products/new")}>+ Add Product</button>} />

      <div style={{ marginBottom: 16 }}>
        <input className="input-field" style={{ maxWidth: 320 }} placeholder="Search products..." value={search}
          onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card">
        <DataTable columns={columns} data={products} loading={loading} emptyText="No products found" />
      </div>
    </div>
  );
}
EOF

echo "✓ Products page created"

# ════════════════════════════════════════════
# VENDORS PAGE
# ════════════════════════════════════════════

cat > "app/(admin)/admin/vendors/page.tsx" << 'EOF'
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import PageHeader from "@/components/admin/PageHeader";
import DataTable from "@/components/admin/DataTable";

export default function VendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", gstin: "", phone: "", email: "", contact_person: "", city: "", state: "Kerala", state_code: "32", credit_days: "30" });
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const load = async () => {
    setLoading(true);
    try { const res = await api.get("/vendors/"); setVendors(res.data || []); }
    catch { setVendors([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/vendors/", { ...form, credit_days: parseInt(form.credit_days) });
      setShowForm(false);
      setForm({ name: "", code: "", gstin: "", phone: "", email: "", contact_person: "", city: "", state: "Kerala", state_code: "32", credit_days: "30" });
      load();
    } catch (e: any) { alert(e.response?.data?.detail || "Failed to save"); } finally { setSaving(false); }
  };

  const columns = [
    { key: "code", label: "Code", render: (r: any) => <span style={{ fontFamily: "monospace", fontSize: 12, background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>{r.code}</span> },
    { key: "name", label: "Vendor", render: (r: any) => <span style={{ fontWeight: 500 }}>{r.name}</span> },
    { key: "contact_person", label: "Contact" },
    { key: "phone", label: "Phone" },
    { key: "gstin", label: "GSTIN" },
    { key: "city", label: "City" },
    { key: "credit_days", label: "Credit Days", render: (r: any) => `${r.credit_days} days` },
    { key: "actions", label: "", render: (r: any) => (
      <button onClick={() => router.push(`/admin/vendors/${r.id}`)} style={{ fontSize: 12, color: "#0284c7", background: "none", border: "none", cursor: "pointer" }}>Edit →</button>
    )},
  ];

  return (
    <div style={{ padding: 32 }}>
      <PageHeader title="Vendors" subtitle="Manage your glass suppliers"
        action={<button className="btn-primary" onClick={() => setShowForm(true)}>+ Add Vendor</button>} />

      {/* Quick Add Form */}
      {showForm && (
        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>New Vendor</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {[
              { key: "name", label: "Vendor Name*", placeholder: "Eg: Kerala Glass Traders" },
              { key: "code", label: "Code*", placeholder: "Eg: KGT001" },
              { key: "gstin", label: "GSTIN", placeholder: "32XXXXX..." },
              { key: "phone", label: "Phone", placeholder: "9876543210" },
              { key: "email", label: "Email", placeholder: "vendor@email.com" },
              { key: "contact_person", label: "Contact Person", placeholder: "Name" },
              { key: "city", label: "City", placeholder: "Kochi" },
              { key: "state", label: "State", placeholder: "Kerala" },
              { key: "state_code", label: "State Code", placeholder: "32" },
              { key: "credit_days", label: "Credit Days", placeholder: "30" },
            ].map((f) => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                <input className="input-field" placeholder={f.placeholder} value={(form as any)[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save Vendor"}</button>
            <button className="btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card">
        <DataTable columns={columns} data={vendors} loading={loading} emptyText="No vendors yet. Add your first vendor." />
      </div>
    </div>
  );
}
EOF

echo "✓ Vendors page created"

# ════════════════════════════════════════════
# PURCHASES PAGE
# ════════════════════════════════════════════

cat > "app/(admin)/admin/purchases/page.tsx" << 'EOF'
"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import PageHeader from "@/components/admin/PageHeader";
import DataTable from "@/components/admin/DataTable";

function StatusBadge({ status }: { status: string }) {
  const c: Record<string, {bg:string;color:string}> = {
    draft:     { bg: "#f1f5f9", color: "#475569" },
    ordered:   { bg: "#dbeafe", color: "#1d4ed8" },
    received:  { bg: "#dcfce7", color: "#166534" },
    cancelled: { bg: "#fee2e2", color: "#991b1b" },
  };
  const col = c[status] || c.draft;
  return <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: col.bg, color: col.color, textTransform: "capitalize" }}>{status}</span>;
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ vendor_id: "", purchase_date: new Date().toISOString().split("T")[0], vendor_invoice_number: "", notes: "" });
  const [items, setItems] = useState([{ product_name: "", quantity: "1", unit_price: "", gst_rate: "18", unit: "Nos" }]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [pr, vr] = await Promise.all([api.get("/purchases/"), api.get("/vendors/")]);
      setPurchases(Array.isArray(pr.data) ? pr.data : pr.data?.items || []);
      setVendors(vr.data || []);
    } catch { setPurchases([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const addItem = () => setItems([...items, { product_name: "", quantity: "1", unit_price: "", gst_rate: "18", unit: "Nos" }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, key: string, val: string) => setItems(items.map((item, idx) => idx === i ? { ...item, [key]: val } : item));

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/purchases/", {
        ...form, vendor_id: parseInt(form.vendor_id),
        items: items.map(i => ({ ...i, quantity: parseFloat(i.quantity), unit_price: parseFloat(i.unit_price), gst_rate: parseFloat(i.gst_rate) })),
      });
      setShowForm(false);
      load();
    } catch (e: any) { alert(e.response?.data?.detail || "Failed to save"); } finally { setSaving(false); }
  };

  const markReceived = async (num: string) => {
    try { await api.patch(`/purchases/${num}/receive`); load(); }
    catch { alert("Failed to mark received"); }
  };

  const columns = [
    { key: "purchase_number", label: "Purchase #", render: (r: any) => <span style={{ fontWeight: 600, color: "#0284c7" }}>{r.purchase_number}</span> },
    { key: "vendor_id", label: "Vendor", render: (r: any) => vendors.find(v => v.id === r.vendor_id)?.name || r.vendor_id },
    { key: "purchase_date", label: "Date", render: (r: any) => new Date(r.purchase_date).toLocaleDateString("en-IN") },
    { key: "grand_total", label: "Total", render: (r: any) => <span style={{ fontWeight: 600 }}>₹{parseFloat(r.grand_total).toLocaleString("en-IN")}</span> },
    { key: "balance_due", label: "Balance", render: (r: any) => <span style={{ color: parseFloat(r.balance_due) > 0 ? "#dc2626" : "#16a34a" }}>₹{parseFloat(r.balance_due).toLocaleString("en-IN")}</span> },
    { key: "status", label: "Status", render: (r: any) => <StatusBadge status={r.status} /> },
    { key: "actions", label: "", render: (r: any) => r.status === "ordered" ? (
      <button onClick={() => markReceived(r.purchase_number)} style={{ fontSize: 12, color: "#16a34a", background: "#dcfce7", border: "none", padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>
        Mark Received
      </button>
    ) : null },
  ];

  return (
    <div style={{ padding: 32 }}>
      <PageHeader title="Purchases" subtitle="Track stock purchases from vendors"
        action={<button className="btn-primary" onClick={() => setShowForm(true)}>+ New Purchase</button>} />

      {showForm && (
        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>New Purchase Order</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
            <div>
              <label className="label">Vendor*</label>
              <select className="input-field" value={form.vendor_id} onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}>
                <option value="">Select vendor</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
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

          <h4 style={{ fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 10 }}>Items</h4>
          {items.map((item, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 80px 40px", gap: 8, marginBottom: 8, alignItems: "end" }}>
              <div><label className="label">Product</label><input className="input-field" placeholder="Glass sheet 4mm" value={item.product_name} onChange={(e) => updateItem(i, "product_name", e.target.value)} /></div>
              <div><label className="label">Qty</label><input type="number" className="input-field" value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} /></div>
              <div><label className="label">Unit Price ₹</label><input type="number" className="input-field" value={item.unit_price} onChange={(e) => updateItem(i, "unit_price", e.target.value)} /></div>
              <div><label className="label">GST %</label><input type="number" className="input-field" value={item.gst_rate} onChange={(e) => updateItem(i, "gst_rate", e.target.value)} /></div>
              <div><label className="label">Unit</label><input className="input-field" value={item.unit} onChange={(e) => updateItem(i, "unit", e.target.value)} /></div>
              <button onClick={() => removeItem(i)} style={{ marginBottom: 0, background: "#fee2e2", border: "none", borderRadius: 6, color: "#dc2626", cursor: "pointer", height: 38, alignSelf: "end" }}>✕</button>
            </div>
          ))}
          <button onClick={addItem} className="btn-outline" style={{ fontSize: 13, marginBottom: 16 }}>+ Add Item</button>

          <div style={{ display: "flex", gap: 10 }}>
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
EOF

echo "✓ Purchases page created"

# ════════════════════════════════════════════
# ACCOUNTING PAGE
# ════════════════════════════════════════════

cat > "app/(admin)/admin/accounting/page.tsx" << 'EOF'
"use client";
import { useState } from "react";
import Link from "next/link";

const sections = [
  { title: "Sales Invoices",    href: "/admin/accounting/invoices",  icon: "🧾", desc: "View all customer invoices", color: "#0284c7" },
  { title: "Sales Returns",     href: "/admin/accounting/returns",   icon: "↩️", desc: "Credit notes & return approvals", color: "#d97706" },
  { title: "Receipt Vouchers",  href: "/admin/accounting/receipts",  icon: "💰", desc: "Record incoming payments", color: "#16a34a" },
  { title: "Payment Vouchers",  href: "/admin/accounting/payments",  icon: "💸", desc: "Record outgoing payments to vendors", color: "#7c3aed" },
  { title: "Journal Entries",   href: "/admin/accounting/journal",   icon: "📒", desc: "View all double-entry journal entries", color: "#0891b2" },
];

export default function AccountingPage() {
  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "#1e293b", margin: 0 }}>Accounting</h1>
        <p style={{ fontSize: 14, color: "#64748b", margin: "4px 0 0" }}>Manage invoices, vouchers and financial records</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        {sections.map((s) => (
          <Link key={s.href} href={s.href} style={{ textDecoration: "none" }}>
            <div className="card" style={{ padding: 24, transition: "all 0.15s", cursor: "pointer" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = s.color; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0"; (e.currentTarget as HTMLElement).style.transform = "none"; }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${s.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                  {s.icon}
                </div>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: 0 }}>{s.title}</h2>
              </div>
              <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>{s.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
EOF

echo "✓ Accounting page created"

# ════════════════════════════════════════════
# REPORTS PAGE
# ════════════════════════════════════════════

cat > "app/(admin)/admin/reports/page.tsx" << 'EOF'
"use client";
import { useState } from "react";
import api from "@/lib/api";
import PageHeader from "@/components/admin/PageHeader";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("pl");
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    setData(null);
    try {
      let res;
      if (activeTab === "pl") res = await api.get(`/reports/profit-loss?from_date=${fromDate}&to_date=${toDate}`);
      else if (activeTab === "tb") res = await api.get(`/reports/trial-balance?as_of_date=${toDate}`);
      else if (activeTab === "bs") res = await api.get(`/reports/balance-sheet?as_of_date=${toDate}`);
      else if (activeTab === "gstr1") res = await api.get(`/gst/gstr1?month=${month}&year=${year}`);
      else if (activeTab === "gstr3b") res = await api.get(`/gst/gstr3b?month=${month}&year=${year}`);
      setData(res?.data);
    } catch (e: any) { alert(e.response?.data?.detail || "Failed to load report"); }
    finally { setLoading(false); }
  };

  const tabs = [
    { key: "pl",     label: "Profit & Loss" },
    { key: "tb",     label: "Trial Balance" },
    { key: "bs",     label: "Balance Sheet" },
    { key: "gstr1",  label: "GSTR-1" },
    { key: "gstr3b", label: "GSTR-3B" },
  ];

  const isGST = activeTab === "gstr1" || activeTab === "gstr3b";

  return (
    <div style={{ padding: 32 }}>
      <PageHeader title="Reports" subtitle="Financial reports and GST returns" />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid #e2e8f0", paddingBottom: 0 }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => { setActiveTab(t.key); setData(null); }} style={{
            padding: "8px 16px", fontSize: 14, fontWeight: activeTab === t.key ? 600 : 400,
            color: activeTab === t.key ? "#0284c7" : "#64748b",
            borderBottom: activeTab === t.key ? "2px solid #0284c7" : "2px solid transparent",
            background: "none", border: "none", borderBottom: activeTab === t.key ? "2px solid #0284c7" : "2px solid transparent",
            cursor: "pointer", marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          {isGST ? (
            <>
              <div><label className="label">Month</label>
                <select className="input-field" style={{ width: 140 }} value={month} onChange={(e) => setMonth(parseInt(e.target.value))}>
                  {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div><label className="label">Year</label>
                <input type="number" className="input-field" style={{ width: 100 }} value={year} onChange={(e) => setYear(parseInt(e.target.value))} />
              </div>
            </>
          ) : (
            <>
              <div><label className="label">From Date</label><input type="date" className="input-field" style={{ width: 160 }} value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
              <div><label className="label">To Date</label><input type="date" className="input-field" style={{ width: 160 }} value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
            </>
          )}
          <button className="btn-primary" onClick={fetchReport} disabled={loading}>{loading ? "Loading..." : "Generate"}</button>
        </div>
      </div>

      {/* Report output */}
      {data && (
        <div className="card" style={{ padding: 24 }}>
          {activeTab === "pl" && <PLReport data={data} />}
          {activeTab === "tb" && <TBReport data={data} />}
          {activeTab === "bs" && <BSReport data={data} />}
          {activeTab === "gstr1" && <GSTR1Report data={data} />}
          {activeTab === "gstr3b" && <GSTR3BReport data={data} />}
        </div>
      )}
    </div>
  );
}

const fmt = (n: any) => `₹${parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

function Section({ title, items, total, color = "#1e293b" }: any) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color, borderBottom: "1px solid #e2e8f0", paddingBottom: 8, marginBottom: 12 }}>{title}</h3>
      {items?.map((item: any) => (
        <div key={item.code} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 14, color: "#475569" }}>
          <span>{item.code} — {item.name}</span>
          <span style={{ fontWeight: 500 }}>{fmt(item.amount || item.balance)}</span>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 15, fontWeight: 700, borderTop: "1px solid #e2e8f0", marginTop: 8, color }}>
        <span>Total {title}</span><span>{fmt(total)}</span>
      </div>
    </div>
  );
}

function PLReport({ data }: any) {
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Profit & Loss Statement</h2>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>{data.period?.from} to {data.period?.to}</p>
      <Section title="Income" items={data.income?.items} total={data.income?.total} color="#16a34a" />
      <Section title="Expenses" items={data.expenses?.items} total={data.expenses?.total} color="#dc2626" />
      <div style={{ padding: 16, borderRadius: 10, background: data.is_profit ? "#f0fdf4" : "#fef2f2", marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 700, color: data.is_profit ? "#16a34a" : "#dc2626" }}>
          <span>Net {data.is_profit ? "Profit" : "Loss"}</span>
          <span>{fmt(Math.abs(data.net_profit))}</span>
        </div>
      </div>
    </div>
  );
}

function TBReport({ data }: any) {
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Trial Balance</h2>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>As of {data.as_of_date}</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead><tr style={{ borderBottom: "2px solid #e2e8f0" }}>
          <th style={{ textAlign: "left", padding: "8px 0", color: "#64748b" }}>Account</th>
          <th style={{ textAlign: "right", padding: "8px 0", color: "#64748b" }}>Debit</th>
          <th style={{ textAlign: "right", padding: "8px 0", color: "#64748b" }}>Credit</th>
        </tr></thead>
        <tbody>
          {data.accounts?.map((a: any) => (
            <tr key={a.code} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "7px 0" }}>{a.code} — {a.name}</td>
              <td style={{ textAlign: "right", padding: "7px 0" }}>{a.debit > 0 ? fmt(a.debit) : ""}</td>
              <td style={{ textAlign: "right", padding: "7px 0" }}>{a.credit > 0 ? fmt(a.credit) : ""}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr style={{ borderTop: "2px solid #e2e8f0", fontWeight: 700 }}>
          <td style={{ padding: "8px 0" }}>Total</td>
          <td style={{ textAlign: "right" }}>{fmt(data.total_debit)}</td>
          <td style={{ textAlign: "right" }}>{fmt(data.total_credit)}</td>
        </tr></tfoot>
      </table>
      <p style={{ marginTop: 12, fontSize: 13, color: data.balanced ? "#16a34a" : "#dc2626" }}>
        {data.balanced ? "✓ Books are balanced" : "⚠ Books are not balanced"}
      </p>
    </div>
  );
}

function BSReport({ data }: any) {
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Balance Sheet</h2>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>As of {data.as_of_date}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
        <Section title="Assets" items={data.assets?.items} total={data.assets?.total} color="#0284c7" />
        <div>
          <Section title="Liabilities" items={data.liabilities?.items} total={data.liabilities?.total} color="#dc2626" />
          <Section title="Equity" items={data.equity?.items} total={data.equity?.total} color="#7c3aed" />
        </div>
      </div>
    </div>
  );
}

function GSTR1Report({ data }: any) {
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>GSTR-1 — Outward Supplies</h2>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>Period: {data.period}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total Invoices", value: data.summary?.total_invoices },
          { label: "Taxable Value", value: fmt(data.summary?.total_taxable_value) },
          { label: "Total GST", value: fmt(data.summary?.total_tax) },
          { label: "IGST", value: fmt(data.summary?.total_igst) },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: 16 }}>
            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 4px" }}>{s.label}</p>
            <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{s.value}</p>
          </div>
        ))}
      </div>
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>B2C Invoices ({data.b2c_invoices?.length})</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead><tr style={{ borderBottom: "1px solid #e2e8f0", color: "#64748b" }}>
          {["Invoice #","Date","Customer","Taxable","CGST","SGST","IGST","Total"].map(h => <th key={h} style={{ textAlign: "left", padding: "6px 8px" }}>{h}</th>)}
        </tr></thead>
        <tbody>
          {data.b2c_invoices?.map((inv: any) => (
            <tr key={inv.invoice_number} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "6px 8px", fontWeight: 500 }}>{inv.invoice_number}</td>
              <td style={{ padding: "6px 8px" }}>{new Date(inv.invoice_date).toLocaleDateString("en-IN")}</td>
              <td style={{ padding: "6px 8px" }}>{inv.customer_name}</td>
              <td style={{ padding: "6px 8px" }}>{fmt(inv.taxable_value)}</td>
              <td style={{ padding: "6px 8px" }}>{fmt(inv.cgst)}</td>
              <td style={{ padding: "6px 8px" }}>{fmt(inv.sgst)}</td>
              <td style={{ padding: "6px 8px" }}>{fmt(inv.igst)}</td>
              <td style={{ padding: "6px 8px", fontWeight: 600 }}>{fmt(inv.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GSTR3BReport({ data }: any) {
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>GSTR-3B Summary</h2>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>Period: {data.period}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#16a34a", marginBottom: 16 }}>Outward Supplies (Tax Liability)</h3>
          {[
            { label: "Taxable Value", value: fmt(data.outward_supplies?.taxable_value) },
            { label: "CGST",          value: fmt(data.outward_supplies?.cgst) },
            { label: "SGST",          value: fmt(data.outward_supplies?.sgst) },
            { label: "IGST",          value: fmt(data.outward_supplies?.igst) },
            { label: "Total Tax",     value: fmt(data.outward_supplies?.total_tax) },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14, borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ color: "#475569" }}>{r.label}</span><span style={{ fontWeight: 600 }}>{r.value}</span>
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#0284c7", marginBottom: 16 }}>Input Tax Credit</h3>
          {[
            { label: "CGST ITC", value: fmt(data.input_tax_credit?.cgst) },
            { label: "SGST ITC", value: fmt(data.input_tax_credit?.sgst) },
            { label: "IGST ITC", value: fmt(data.input_tax_credit?.igst) },
            { label: "Total ITC", value: fmt(data.input_tax_credit?.total_itc) },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14, borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ color: "#475569" }}>{r.label}</span><span style={{ fontWeight: 600 }}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 20, padding: 20, borderRadius: 10, background: "#fef9c3", border: "1px solid #fde047" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 700, color: "#854d0e" }}>
          <span>Net Tax Payable</span><span>{fmt(data.net_tax_payable)}</span>
        </div>
      </div>
    </div>
  );
}
EOF

echo "✓ Reports page created"

# ════════════════════════════════════════════
# COUPONS PAGE
# ════════════════════════════════════════════

cat > "app/(admin)/admin/coupons/page.tsx" << 'EOF'
"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import PageHeader from "@/components/admin/PageHeader";
import DataTable from "@/components/admin/DataTable";

export default function CouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "", coupon_type: "percentage", value: "", min_order_amount: "", max_discount_amount: "", usage_limit: "", valid_until: "", description: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const res = await api.get("/coupons/"); setCoupons(Array.isArray(res.data) ? res.data : []); }
    catch { setCoupons([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/coupons/", { ...form, code: form.code.toUpperCase(), value: parseFloat(form.value), min_order_amount: form.min_order_amount ? parseFloat(form.min_order_amount) : null, max_discount_amount: form.max_discount_amount ? parseFloat(form.max_discount_amount) : null, usage_limit: form.usage_limit ? parseInt(form.usage_limit) : null });
      setShowForm(false);
      load();
    } catch (e: any) { alert(e.response?.data?.detail || "Failed to save"); } finally { setSaving(false); }
  };

  const columns = [
    { key: "code", label: "Code", render: (r: any) => <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#0284c7", background: "#eff6ff", padding: "3px 8px", borderRadius: 4 }}>{r.code}</span> },
    { key: "coupon_type", label: "Type", render: (r: any) => <span style={{ textTransform: "capitalize", fontSize: 12 }}>{r.coupon_type}</span> },
    { key: "value", label: "Discount", render: (r: any) => r.coupon_type === "percentage" ? `${r.value}%` : `₹${r.value}` },
    { key: "min_order_amount", label: "Min Order", render: (r: any) => r.min_order_amount ? `₹${r.min_order_amount}` : "—" },
    { key: "used_count", label: "Used", render: (r: any) => `${r.used_count}${r.usage_limit ? ` / ${r.usage_limit}` : ""}` },
    { key: "valid_until", label: "Expires", render: (r: any) => r.valid_until ? new Date(r.valid_until).toLocaleDateString("en-IN") : "No expiry" },
    { key: "is_active", label: "Status", render: (r: any) => <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: r.is_active ? "#dcfce7" : "#fee2e2", color: r.is_active ? "#166534" : "#991b1b" }}>{r.is_active ? "Active" : "Inactive"}</span> },
  ];

  return (
    <div style={{ padding: 32 }}>
      <PageHeader title="Coupons" subtitle="Create and manage discount codes"
        action={<button className="btn-primary" onClick={() => setShowForm(true)}>+ New Coupon</button>} />

      {showForm && (
        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>New Coupon</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div><label className="label">Code*</label><input className="input-field" placeholder="GLASS10" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></div>
            <div><label className="label">Type*</label>
              <select className="input-field" value={form.coupon_type} onChange={(e) => setForm({ ...form, coupon_type: e.target.value })}>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (₹)</option>
              </select>
            </div>
            <div><label className="label">Value*</label><input type="number" className="input-field" placeholder={form.coupon_type === "percentage" ? "10" : "100"} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
            <div><label className="label">Min Order Amount</label><input type="number" className="input-field" placeholder="500" value={form.min_order_amount} onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })} /></div>
            <div><label className="label">Max Discount (for %)</label><input type="number" className="input-field" placeholder="200" value={form.max_discount_amount} onChange={(e) => setForm({ ...form, max_discount_amount: e.target.value })} /></div>
            <div><label className="label">Usage Limit</label><input type="number" className="input-field" placeholder="100" value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} /></div>
            <div><label className="label">Valid Until</label><input type="date" className="input-field" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></div>
            <div><label className="label">Description</label><input className="input-field" placeholder="10% off on all glass" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving..." : "Create Coupon"}</button>
            <button className="btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card">
        <DataTable columns={columns} data={coupons} loading={loading} emptyText="No coupons yet" />
      </div>
    </div>
  );
}
EOF

echo "✓ Coupons page created"

# ════════════════════════════════════════════
# CUSTOMERS PAGE
# ════════════════════════════════════════════

cat > "app/(admin)/admin/customers/page.tsx" << 'EOF'
"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import PageHeader from "@/components/admin/PageHeader";
import DataTable from "@/components/admin/DataTable";

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/users/").then(r => setCustomers(Array.isArray(r.data) ? r.data : [])).catch(() => setCustomers([])).finally(() => setLoading(false));
  }, []);

  const columns = [
    { key: "id", label: "ID", width: 60 },
    { key: "name", label: "Name", render: (r: any) => <span style={{ fontWeight: 500 }}>{r.name}</span> },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "role", label: "Role", render: (r: any) => <span style={{ textTransform: "capitalize", fontSize: 12, background: r.role === "admin" ? "#ede9fe" : "#f1f5f9", color: r.role === "admin" ? "#7c3aed" : "#475569", padding: "2px 8px", borderRadius: 4 }}>{r.role}</span> },
    { key: "is_active", label: "Status", render: (r: any) => <span style={{ fontSize: 12, color: r.is_active ? "#16a34a" : "#dc2626" }}>{r.is_active ? "Active" : "Inactive"}</span> },
    { key: "created_at", label: "Joined", render: (r: any) => new Date(r.created_at).toLocaleDateString("en-IN") },
  ];

  return (
    <div style={{ padding: 32 }}>
      <PageHeader title="Customers" subtitle="View registered customers" />
      <div className="card">
        <DataTable columns={columns} data={customers} loading={loading} emptyText="No customers yet" />
      </div>
    </div>
  );
}
EOF

echo "✓ Customers page created"

# ════════════════════════════════════════════
# GIT PUSH
# ════════════════════════════════════════════

cd ..
git add .
git commit -m "feat: admin panel — dashboard, orders, products, vendors, purchases, accounting, reports, coupons"
git push origin main

echo ""
echo "=========================================="
echo "  ✅ Admin panel pushed!"
echo ""
echo "  Pages available at:"
echo "  /admin              Dashboard"
echo "  /admin/orders       Order management"
echo "  /admin/products     Product catalog"
echo "  /admin/vendors      Vendor management"
echo "  /admin/purchases    Purchase orders"
echo "  /admin/accounting   Invoices & vouchers"
echo "  /admin/reports      P&L, GST, Balance Sheet"
echo "  /admin/coupons      Discount codes"
echo "  /admin/customers    Customer list"
echo "=========================================="