"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";

const INDIAN_STATES = [
  { name: "Andhra Pradesh", code: "37" }, { name: "Bihar", code: "10" },
  { name: "Delhi", code: "07" }, { name: "Goa", code: "30" },
  { name: "Gujarat", code: "24" }, { name: "Haryana", code: "06" },
  { name: "Karnataka", code: "29" }, { name: "Kerala", code: "32" },
  { name: "Madhya Pradesh", code: "23" }, { name: "Maharashtra", code: "27" },
  { name: "Odisha", code: "21" }, { name: "Punjab", code: "03" },
  { name: "Rajasthan", code: "08" }, { name: "Tamil Nadu", code: "33" },
  { name: "Telangana", code: "36" }, { name: "Uttar Pradesh", code: "09" },
  { name: "West Bengal", code: "19" },
];

const emptyForm = { label: "Home", full_name: "", phone: "", line1: "", line2: "", city: "", state: "Kerala", state_code: "32", pincode: "", is_default: false };

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try { const res = await api.get("/users/addresses"); setAddresses(res.data || []); }
    catch { setAddresses([]); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.full_name || !form.phone || !form.line1 || !form.city || !form.pincode) {
      alert("Please fill all required fields"); return;
    }
    setSaving(true);
    try { await api.post("/users/addresses", form); setShowForm(false); setForm({ ...emptyForm }); load(); }
    catch (e: any) { alert(e.response?.data?.detail || "Failed to save"); }
    finally { setSaving(false); }
  };

  const deleteAddr = async (id: number) => {
    if (!confirm("Delete this address?")) return;
    setDeleting(id);
    try { await api.delete(`/users/addresses/${id}`); load(); }
    catch { alert("Failed to delete"); } finally { setDeleting(null); }
  };

  const inp = { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const };
  const lbl = { fontSize: 13, fontWeight: 500, color: "#475569", display: "block", marginBottom: 5 } as const;
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", margin: 0 }}>Saved Addresses</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary">+ Add Address</button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>New Address</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Label</label>
              <select style={inp} value={form.label} onChange={e => set("label", e.target.value)}>
                {["Home", "Office", "Other"].map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Full Name *</label>
              <input style={inp} value={form.full_name} onChange={e => set("full_name", e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <label style={lbl}>Phone *</label>
              <input style={inp} value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="10-digit mobile" maxLength={10} />
            </div>
            <div>
              <label style={lbl}>Pincode *</label>
              <input style={inp} value={form.pincode} onChange={e => set("pincode", e.target.value)} placeholder="6-digit pincode" maxLength={6} />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={lbl}>Address Line 1 *</label>
              <input style={inp} value={form.line1} onChange={e => set("line1", e.target.value)} placeholder="House no, Street, Area" />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={lbl}>Landmark</label>
              <input style={inp} value={form.line2} onChange={e => set("line2", e.target.value)} placeholder="Optional landmark" />
            </div>
            <div>
              <label style={lbl}>City *</label>
              <input style={inp} value={form.city} onChange={e => set("city", e.target.value)} placeholder="City" />
            </div>
            <div>
              <label style={lbl}>State *</label>
              <select style={inp} value={form.state} onChange={e => {
                const st = INDIAN_STATES.find(s => s.name === e.target.value);
                setForm(f => ({ ...f, state: e.target.value, state_code: st?.code || f.state_code }));
              }}>
                {INDIAN_STATES.map(s => <option key={s.code} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" id="default" checked={form.is_default} onChange={e => set("is_default", e.target.checked)} style={{ width: 16, height: 16 }} />
              <label htmlFor="default" style={{ fontSize: 14, color: "#475569", cursor: "pointer" }}>Set as default address</label>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={save} disabled={saving} className="btn-primary">{saving ? "Saving..." : "Save Address"}</button>
            <button onClick={() => { setShowForm(false); setForm({ ...emptyForm }); }} className="btn-outline">Cancel</button>
          </div>
        </div>
      )}

      {/* Address list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading...</div>
      ) : addresses.length === 0 && !showForm ? (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📍</div>
          <p style={{ color: "#64748b", marginBottom: 12 }}>No saved addresses yet.</p>
          <button onClick={() => setShowForm(true)} className="btn-primary">Add Your First Address</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {addresses.map(addr => (
            <div key={addr.id} className="card" style={{ padding: 20, position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, background: "#f1f5f9", padding: "2px 8px", borderRadius: 4, color: "#475569" }}>{addr.label}</span>
                  {addr.is_default && <span style={{ fontSize: 11, background: "#dbeafe", color: "#1d4ed8", padding: "1px 6px", borderRadius: 3, fontWeight: 500 }}>Default</span>}
                </div>
                <button onClick={() => deleteAddr(addr.id)} disabled={deleting === addr.id}
                  style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 13 }}>
                  {deleting === addr.id ? "..." : "Delete"}
                </button>
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", margin: "0 0 2px" }}>{addr.full_name}</p>
              <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 2px" }}>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</p>
              <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 2px" }}>{addr.city}, {addr.state} — {addr.pincode}</p>
              <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>📞 {addr.phone}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
