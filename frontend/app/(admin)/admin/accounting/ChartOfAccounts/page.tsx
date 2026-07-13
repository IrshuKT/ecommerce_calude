"use client";
import { useEffect, useState } from "react";

import PageHeader from "@/components/admin/PageHeader";
import staffApi from "@/lib/staffApi";

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  asset:     { bg: "#dbeafe", color: "#1d4ed8" },
  liability: { bg: "#fee2e2", color: "#991b1b" },
  equity:    { bg: "#ede9fe", color: "#6d28d9" },
  income:    { bg: "#dcfce7", color: "#166534" },
  expense:   { bg: "#fef9c3", color: "#854d0e" },
};

const ACCOUNT_TYPES = ["asset", "liability", "equity", "income", "expense"];

const EMPTY_FORM = { code: "", name: "", account_type: "asset", parent_code: "", description: "", is_active: true };

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await staffApi.get("/journals/accounts/all");
      setAccounts(Array.isArray(r.data) ? r.data : []);
    } catch { setAccounts([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  };

  const openEdit = (a: any) => {
    // find parent code
    const parent = accounts.find(x => x.id === a.parent_id);
    setEditing(a);
    setForm({
      code: a.code,
      name: a.name,
      account_type: a.account_type,
      parent_code: parent?.code || "",
      description: a.description || "",
      is_active: a.is_active,
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.code || !form.name) { alert("Code and Name are required"); return; }
    setSaving(true);
    try {
      if (editing) {
        await staffApi.patch(`/journals/accounts/${editing.id}`, form);
      } else {
        await staffApi.post("/journals/accounts", form);
      }
      setShowForm(false);
      load();
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to save");
    } finally { setSaving(false); }
  };

  const deleteAccount = async (a: any) => {
    if (!confirm(`Delete "${a.name}"? This cannot be undone.`)) return;
    try {
      await staffApi.delete(`/journals/accounts/${a.id}`);
      load();
    } catch (e: any) {
      alert(e.response?.data?.detail || "Cannot delete this account");
    }
  };

  const inp = {
    padding: "8px 10px", borderRadius: 6, border: "1px solid #e2e8f0",
    fontSize: 13, fontFamily: "inherit", outline: "none",
    width: "100%", boxSizing: "border-box" as const,
  };

  const filtered = accounts.filter(a => {
    const matchType = filterType === "all" || a.account_type === filterType;
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.code.includes(search);
    return matchType && matchSearch;
  });

  // group by type
  const grouped = ACCOUNT_TYPES.reduce((acc, t) => {
    acc[t] = filtered.filter(a => a.account_type === t);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div style={{ padding: 32 }}>
      <PageHeader
        title="Chart of Accounts"
        subtitle="Manage your ledger accounts"
        action={<button className="btn-primary" onClick={openCreate}>+ New Account</button>}
      />

      {/* Form */}
      {showForm && (
        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>
            {editing ? `Edit Account — ${editing.code}` : "New Account"}
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>Account Code *</label>
              <input style={{ ...inp, background: editing ? "#f8fafc" : "white" }}
                value={form.code} onChange={e => setForm({ ...form, code: e.target.value })}
                placeholder="e.g. 5310" disabled={!!editing} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>Account Name *</label>
              <input style={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Office Supplies" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>Account Type *</label>
              <select style={inp} value={form.account_type} onChange={e => setForm({ ...form, account_type: e.target.value })}>
                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>Parent Account</label>
              <select style={inp} value={form.parent_code} onChange={e => setForm({ ...form, parent_code: e.target.value })}>
                <option value="">— None (Top Level) —</option>
                {accounts
                  .filter(a => a.account_type === form.account_type && a.id !== editing?.id)
                  .map(a => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>Description</label>
              <input style={inp} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional note" />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 2 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                Active
              </label>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={save} disabled={saving} className="btn-primary">{saving ? "Saving..." : editing ? "Update" : "Create Account"}</button>
            <button onClick={() => setShowForm(false)} className="btn-outline">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ padding: 14, marginBottom: 20, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input style={{ ...inp, width: 220 }} placeholder="Search code or name..." value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ display: "flex", gap: 6 }}>
          {["all", ...ACCOUNT_TYPES].map(t => {
            const c = TYPE_COLORS[t];
            const active = filterType === t;
            return (
              <button key={t} onClick={() => setFilterType(t)}
                style={{
                  padding: "5px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                  background: active ? (c?.bg || "#1e293b") : "#f1f5f9",
                  color: active ? (c?.color || "white") : "#64748b",
                }}>
                {t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            );
          })}
        </div>
        <span style={{ fontSize: 13, color: "#94a3b8", marginLeft: "auto" }}>{filtered.length} accounts</span>
      </div>

      {/* Accounts grouped by type */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>Loading...</div>
      ) : (
        ACCOUNT_TYPES.map(type => {
          const list = grouped[type];
          if (!list || list.length === 0) return null;
          const c = TYPE_COLORS[type];
          return (
            <div key={type} className="card" style={{ marginBottom: 20, overflow: "hidden" }}>
              <div style={{ padding: "12px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 4, background: c.bg, color: c.color, textTransform: "uppercase" }}>
                  {type}
                </span>
                <span style={{ fontSize: 13, color: "#94a3b8" }}>{list.length} accounts</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Code", "Name", "Parent", "Description", "Status", ""].map(h => (
                      <th key={h} style={{ padding: "8px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((a: any) => {
                    const parent = accounts.find(x => x.id === a.parent_id);
                    return (
                      <tr key={a.id} style={{ borderBottom: "1px solid #f1f5f9" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                        onMouseLeave={e => (e.currentTarget.style.background = "white")}>
                        <td style={{ padding: "10px 16px", fontWeight: 700, color: c.color, fontFamily: "monospace" }}>{a.code}</td>
                        <td style={{ padding: "10px 16px", fontWeight: 500 }}>
                          {a.is_system && <span style={{ fontSize: 10, background: "#f1f5f9", color: "#94a3b8", padding: "1px 5px", borderRadius: 3, marginRight: 6 }}>SYSTEM</span>}
                          {a.name}
                        </td>
                        <td style={{ padding: "10px 16px", color: "#64748b" }}>{parent ? `${parent.code} — ${parent.name}` : "—"}</td>
                        <td style={{ padding: "10px 16px", color: "#94a3b8" }}>{a.description || "—"}</td>
                        <td style={{ padding: "10px 16px" }}>
                          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: a.is_active ? "#dcfce7" : "#f1f5f9", color: a.is_active ? "#166534" : "#94a3b8", fontWeight: 600 }}>
                            {a.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          {!a.is_system && (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => openEdit(a)}
                                style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid #e2e8f0", background: "white", cursor: "pointer", fontSize: 12, color: "#475569" }}>
                                Edit
                              </button>
                              <button onClick={() => deleteAccount(a)}
                                style={{ padding: "4px 10px", borderRadius: 5, border: "none", background: "#fee2e2", cursor: "pointer", fontSize: 12, color: "#dc2626" }}>
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })
      )}
    </div>
  );
}