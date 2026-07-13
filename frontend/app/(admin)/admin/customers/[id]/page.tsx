"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import staffApi from "@/lib/staffApi";
import PageHeader from "@/components/admin/PageHeader";

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9", fontSize: 14 }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ fontWeight: 500, color: "#1e293b", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: bg, color, textTransform: "capitalize" }}>
      {label}
    </span>
  );
}

export default function CustomerDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [tradeBusy, setTradeBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      // list endpoint with search to find by id — or use direct get if you add one
      const res = await staffApi.get(`/users/${id}`);
        setCustomer(res.data);
    } catch {
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id) load(); }, [id]);

  const toggleActive = async () => {
    setToggling(true);
    try {
      await staffApi.patch(`/users/${id}/toggle-active`);
      await load();
    } catch { alert("Failed to update status"); }
    finally { setToggling(false); }
  };

  const approveTrade = async () => {
    setTradeBusy(true);
    try {
      await staffApi.patch(`/users/${id}/trade-approve`);
      await load();
    } catch { alert("Failed to approve trade"); }
    finally { setTradeBusy(false); }
  };

  const revokeTrade = async () => {
    setTradeBusy(true);
    try {
      await staffApi.patch(`/users/${id}/trade-revoke`);
      await load();
    } catch { alert("Failed to revoke trade"); }
    finally { setTradeBusy(false); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading customer...</div>;
  if (!customer) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Customer not found</div>;

  return (
    <div style={{ padding: 32, maxWidth: 900 }}>
      <PageHeader
        title={customer.name}
        subtitle={`Customer #${customer.id} · Joined ${new Date(customer.created_at).toLocaleDateString("en-IN", { dateStyle: "long" })}`}
        action={<button className="btn-outline" onClick={() => router.back()}>← Back</button>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

        {/* Profile */}
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "#475569", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Profile</h2>
          <InfoRow label="Name" value={customer.name} />
          <InfoRow label="Email" value={customer.email} />
          <InfoRow label="Phone" value={customer.phone || "—"} />
          <InfoRow label="Role" value={
            <Badge
              label={customer.role}
              bg={customer.role === "admin" ? "#ede9fe" : "#f1f5f9"}
              color={customer.role === "admin" ? "#7c3aed" : "#475569"}
            />
          } />
          <InfoRow label="Verified" value={
            customer.is_verified
              ? <Badge label="Verified" bg="#dcfce7" color="#166534" />
              : <Badge label="Unverified" bg="#fee2e2" color="#991b1b" />
          } />
        </div>

        {/* Account Actions */}
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "#475569", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Account Actions</h2>

          {/* Active / Inactive toggle */}
          <div style={{ padding: "14px 0", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 500, color: "#1e293b" }}>Account Status</p>
                <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                  {customer.is_active ? "Customer can log in and place orders" : "Customer is blocked from logging in"}
                </p>
              </div>
              <button
                onClick={toggleActive}
                disabled={toggling}
                style={{
                  padding: "7px 16px", borderRadius: 7, border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: 500,
                  background: customer.is_active ? "#fee2e2" : "#dcfce7",
                  color: customer.is_active ? "#991b1b" : "#166534",
                  opacity: toggling ? 0.6 : 1,
                }}
              >
                {toggling ? "..." : customer.is_active ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>

          {/* Trade approval */}
          <div style={{ padding: "14px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 500, color: "#1e293b" }}>Trade Access</p>
                <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                  {customer.is_trade_approved ? "Approved for trade pricing" : "Not approved for trade pricing"}
                </p>
              </div>
              {customer.is_trade_approved ? (
                <button
                  onClick={revokeTrade}
                  disabled={tradeBusy}
                  style={{ padding: "7px 16px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, background: "#fef9c3", color: "#854d0e", opacity: tradeBusy ? 0.6 : 1 }}
                >
                  {tradeBusy ? "..." : "Revoke Trade"}
                </button>
              ) : (
                <button
                  onClick={approveTrade}
                  disabled={tradeBusy}
                  style={{ padding: "7px 16px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, background: "#eff6ff", color: "#0284c7", opacity: tradeBusy ? 0.6 : 1 }}
                >
                  {tradeBusy ? "..." : "Approve Trade"}
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}