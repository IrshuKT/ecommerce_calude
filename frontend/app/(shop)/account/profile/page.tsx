"use client";
import { useState } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [form, setForm] = useState({ name: user?.name || "", email: (user as any)?.email || "", phone: (user as any)?.phone || "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", confirm: "" });
  const [changingPw, setChangingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const inp = { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const };
  const lbl = { fontSize: 13, fontWeight: 500, color: "#475569", display: "block", marginBottom: 5 } as const;

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.patch("/users/me/profile", form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) { alert(e.response?.data?.detail || "Failed to update"); }
    finally { setSaving(false); }
  };

  const changePassword = async () => {
    if (pwForm.new_password !== pwForm.confirm) { setPwMsg({ type: "error", text: "Passwords do not match" }); return; }
    if (pwForm.new_password.length < 6) { setPwMsg({ type: "error", text: "Password must be at least 6 characters" }); return; }
    setChangingPw(true);
    try {
      await api.patch("/users/me/password", { current_password: pwForm.current_password, new_password: pwForm.new_password });
      setPwMsg({ type: "success", text: "Password changed successfully!" });
      setPwForm({ current_password: "", new_password: "", confirm: "" });
    } catch (e: any) { setPwMsg({ type: "error", text: e.response?.data?.detail || "Failed to change password" }); }
    finally { setChangingPw(false); }
  };

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", margin: "0 0 20px" }}>My Profile</h1>

      {/* Trade status */}
      <div style={{ padding: 14, borderRadius: 8, marginBottom: 20, border: "1px solid", borderColor: (user as any)?.is_trade_approved ? "#bbf7d0" : "#e2e8f0", background: (user as any)?.is_trade_approved ? "#f0fdf4" : "#f8fafc" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>{(user as any)?.is_trade_approved ? "✅" : "👤"}</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: (user as any)?.is_trade_approved ? "#166534" : "#475569", margin: 0 }}>
              {(user as any)?.is_trade_approved ? "Trade Account — You get exclusive pricing" : "Regular Customer Account"}
            </p>
            {!(user as any)?.is_trade_approved && (
              <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Contact us to upgrade to a trade account and get better prices.</p>
            )}
          </div>
        </div>
      </div>

      {/* Profile form */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Personal Information</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Full Name</label>
            <input style={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label style={lbl}>Email</label>
            <input style={inp} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label style={lbl}>Phone</label>
            <input style={inp} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} maxLength={10} />
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <button onClick={saveProfile} disabled={saving} className="btn-primary">
            {saving ? "Saving..." : saved ? "✓ Saved!" : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Password change */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Change Password</h2>
        {pwMsg && (
          <div style={{ padding: "10px 14px", borderRadius: 7, marginBottom: 14, fontSize: 13, background: pwMsg.type === "success" ? "#f0fdf4" : "#fef2f2", color: pwMsg.type === "success" ? "#16a34a" : "#dc2626", border: `1px solid ${pwMsg.type === "success" ? "#bbf7d0" : "#fecaca"}` }}>
            {pwMsg.text}
          </div>
        )}
        <div style={{ display: "grid", gap: 12, maxWidth: 400 }}>
          <div>
            <label style={lbl}>Current Password</label>
            <input style={inp} type="password" value={pwForm.current_password} onChange={e => setPwForm({ ...pwForm, current_password: e.target.value })} placeholder="••••••••" />
          </div>
          <div>
            <label style={lbl}>New Password</label>
            <input style={inp} type="password" value={pwForm.new_password} onChange={e => setPwForm({ ...pwForm, new_password: e.target.value })} placeholder="Min. 6 characters" />
          </div>
          <div>
            <label style={lbl}>Confirm New Password</label>
            <input style={inp} type="password" value={pwForm.confirm} onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} placeholder="Re-enter new password" />
          </div>
          <button onClick={changePassword} disabled={changingPw} className="btn-primary" style={{ width: "fit-content" }}>
            {changingPw ? "Changing..." : "Change Password"}
          </button>
        </div>
      </div>
    </div>
  );
}
