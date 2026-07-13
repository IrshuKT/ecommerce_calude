"use client";
import { useEffect, useState } from "react";
import staffApi from "@/lib/staffApi";

interface StaffUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: "admin" | "manager" | "sales" | "inventory";
  is_active: boolean;
}

const ROLE_META: Record<string, { label: string; bg: string; color: string }> = {
  admin:     { label: "Admin",     bg: "#eef2ff", color: "#4338ca" },
  manager:   { label: "Manager",   bg: "#eff6ff", color: "#0369a1" },
  sales:     { label: "Sales",     bg: "#f0fdf4", color: "#15803d" },
  inventory: { label: "Inventory", bg: "#fff7ed", color: "#c2410c" },
};

export default function StaffUsersPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<StaffUser | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await staffApi.get("/admin/staff-users");
      setUsers(res.data);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div style={{ padding: 32, maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1e293b", margin: "0 0 4px" }}>Staff Users</h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
            Manage staff accounts. A user's role determines which admin sections they can access.
          </p>
        </div>
        <button onClick={() => { setEditUser(null); setShowModal(true); }} style={{
          padding: "9px 18px", borderRadius: 8, border: "none", background: "#0284c7",
          color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>
          + Add Staff User
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading...</div>
      ) : (
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                {["Name", "Email", "Phone", "Role", "Status", ""].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748b" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const meta = ROLE_META[u.role];
                return (
                  <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 500 }}>{u.name}</td>
                    <td style={{ padding: "10px 14px", color: "#64748b" }}>{u.email}</td>
                    <td style={{ padding: "10px 14px", color: "#64748b" }}>{u.phone || "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: meta.bg, color: meta.color }}>
                        {meta.label}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 20, background: u.is_active ? "#dcfce7" : "#fee2e2", color: u.is_active ? "#166534" : "#991b1b" }}>
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      <button onClick={() => { setEditUser(u); setShowModal(true); }} style={{
                        fontSize: 12, color: "#0284c7", background: "none", border: "none", cursor: "pointer", fontWeight: 500,
                      }}>
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 30, textAlign: "center", color: "#94a3b8" }}>No staff users yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <StaffModal
          existing={editUser}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

function StaffModal({ existing, onClose, onSaved }: {
  existing: StaffUser | null; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(existing?.name || "");
  const [email, setEmail] = useState(existing?.email || "");
  const [phone, setPhone] = useState(existing?.phone || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(existing?.role || "sales");
  const [isActive, setIsActive] = useState(existing?.is_active ?? true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError("");
    if (!name.trim() || !email.trim()) { setError("Name and email are required"); return; }
    if (!existing && !password.trim()) { setError("Password is required for a new user"); return; }

    setSaving(true);
    try {
      if (existing) {
        await staffApi.patch(`/admin/staff-users/${existing.id}`, {
          name, phone: phone || null, role, is_active: isActive,
        });
      } else {
        await staffApi.post("/admin/staff-users", {
          name, email, phone: phone || null, password, role,
        });
      }
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const inp = { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const };
  const lbl = { display: "block", fontSize: 13, fontWeight: 500, color: "#475569", marginBottom: 5 } as const;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "white", borderRadius: 12, padding: 28, width: 420, maxWidth: "95vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 20px" }}>{existing ? "Edit Staff User" : "Add Staff User"}</h2>

        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <label style={lbl}>Name *</label>
            <input style={inp} value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Email *</label>
            <input style={inp} value={email} onChange={e => setEmail(e.target.value)} disabled={!!existing} />
          </div>
          <div>
            <label style={lbl}>Phone</label>
            <input style={inp} value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          {!existing && (
            <div>
              <label style={lbl}>Password *</label>
              <input type="password" style={inp} value={password} onChange={e => setPassword(e.target.value)} />
            </div>
          )}
          <div>
            <label style={lbl}>Role *</label>
            <select style={inp} value={role} onChange={e => setRole(e.target.value as any)}>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="sales">Sales</option>
              <option value="inventory">Inventory</option>
            </select>
          </div>
          {existing && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} id="isActive" />
              <label htmlFor="isActive" style={{ fontSize: 13, color: "#475569" }}>Active</label>
            </div>
          )}
        </div>

        {error && <p style={{ color: "#dc2626", fontSize: 13, marginTop: 12, padding: "8px 12px", background: "#fee2e2", borderRadius: 6 }}>{error}</p>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 7, border: "1px solid #e2e8f0", background: "white", color: "#475569", cursor: "pointer", fontSize: 13 }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ padding: "9px 20px", borderRadius: 7, background: "#0284c7", color: "white", border: "none", cursor: saving ? "default" : "pointer", fontSize: 13, fontWeight: 500 }}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}