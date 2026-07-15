"use client";
import { useEffect, useState, useRef } from "react";
import staffApi from "@/lib/staffApi";
import PageHeader from "@/components/admin/PageHeader";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8000";

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

export default function SettingsPage() {
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
   const [backups, setBackups] = useState<any[]>([]);
  const [backingUp, setBackingUp] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState("");

  const doRestoreExisting = async () => {
    if (!selectedBackup) return;
    setRestoring(true);
    try {
      await staffApi.post("/settings/backup/restore-existing", { filename: selectedBackup, confirm: restoreConfirm });
      alert("Restored successfully. Reloading...");
      window.location.reload();
    } catch (e: any) { alert(e.response?.data?.detail || "Restore failed"); }
    finally { setRestoring(false); }
  };
   const loadBackups = () => staffApi.get("/settings/backup/list").then(r => setBackups(r.data)).catch(() => {});
  useEffect(() => { loadBackups(); }, []);

  const runBackup = async () => {
    setBackingUp(true);
    try { await staffApi.post("/settings/backup/run"); loadBackups(); }
    catch (e: any) { alert(e.response?.data?.detail || "Backup failed"); }
    finally { setBackingUp(false); }
  };
  const downloadBackup = async (filename: string) => {
  try {
    const res = await staffApi.get(`/settings/backup/${filename}/download`, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (e: any) {
    alert("Download failed — check console");
    console.error(e);
  }
};
  const deleteBackup = async (filename: string) => {
    if (!confirm(`Delete ${filename}?`)) return;
    await staffApi.delete(`/settings/backup/${filename}`);
    loadBackups();
  };

  const doRestore = async () => {
    if (!restoreFile) return;
    setRestoring(true);
    try {
      const fd = new FormData();
      fd.append("file", restoreFile);
      fd.append("confirm", restoreConfirm);
      await staffApi.post("/settings/backup/restore", fd, { headers: { "Content-Type": "multipart/form-data" } });
      alert("Restored successfully. Reloading...");
      window.location.reload();
    } catch (e: any) { alert(e.response?.data?.detail || "Restore failed"); }
    finally { setRestoring(false); }
  };

  useEffect(() => {
    staffApi.get("/settings/").then(r => { setForm(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await staffApi.patch("/settings/", form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) { alert(e.response?.data?.detail || "Failed to save"); }
    finally { setSaving(false); }
  };

  const uploadLogo = async (file: File) => {
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await staffApi.post("/settings/logo", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setForm({ ...form, logo_url: res.data.logo_url });
    } catch { alert("Failed to upload logo"); }
    finally { setUploadingLogo(false); }
  };

  const inp = { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const };
  const lbl = { fontSize: 13, fontWeight: 500, color: "#475569", display: "block", marginBottom: 5 } as const;
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading...</div>;

  return (
    <div style={{ padding: 32, maxWidth: 900 }}>
      <PageHeader title="Company Settings" subtitle="Business information used in invoices, emails and shop frontend"
        action={
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? "Saving..." : saved ? "✓ Saved!" : "Save Changes"}
          </button>
        }
      />

      {/* Logo */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Company Logo</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 100, height: 100, borderRadius: 12, border: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {form.logo_url
              ? <img src={`${API_BASE}${form.logo_url}`} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              : <span style={{ fontSize: 32 }}>🏢</span>}
          </div>
          <div>
            <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
            <button onClick={() => logoRef.current?.click()} disabled={uploadingLogo} className="btn-outline">
              {uploadingLogo ? "Uploading..." : "Upload Logo"}
            </button>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "6px 0 0" }}>PNG, JPG, SVG — Max 2MB. Recommended: 200×200px</p>
          </div>
        </div>
      </div>

      {/* Basic Info */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Basic Information</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Company Name *</label>
            <input style={inp} value={form.company_name || ""} onChange={e => set("company_name", e.target.value)} placeholder="Your Company Name" />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Tagline</label>
            <input style={inp} value={form.tagline || ""} onChange={e => set("tagline", e.target.value)} placeholder="Premium glass materials for India" />
          </div>
          <div>
            <label style={lbl}>Email</label>
            <input style={inp} type="email" value={form.email || ""} onChange={e => set("email", e.target.value)} placeholder="hello@company.in" />
          </div>
          <div>
            <label style={lbl}>Phone</label>
            <input style={inp} value={form.phone || ""} onChange={e => set("phone", e.target.value)} placeholder="+91 98765 43210" />
          </div>
          <div>
            <label style={lbl}>Mobile</label>
            <input style={inp} value={form.mobile || ""} onChange={e => set("mobile", e.target.value)} placeholder="+91 98765 43210" />
          </div>
          <div>
            <label style={lbl}>Website</label>
            <input style={inp} value={form.website || ""} onChange={e => set("website", e.target.value)} placeholder="https://epozy.in" />
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Business Address</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Address Line 1</label>
            <input style={inp} value={form.address_line1 || ""} onChange={e => set("address_line1", e.target.value)} placeholder="Shop No, Street, Area" />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Address Line 2</label>
            <input style={inp} value={form.address_line2 || ""} onChange={e => set("address_line2", e.target.value)} placeholder="Landmark (optional)" />
          </div>
          <div>
            <label style={lbl}>City</label>
            <input style={inp} value={form.city || ""} onChange={e => set("city", e.target.value)} placeholder="Kochi" />
          </div>
          <div>
            <label style={lbl}>State</label>
            <select style={inp} value={form.state || "Kerala"} onChange={e => {
              const st = INDIAN_STATES.find(s => s.name === e.target.value);
              setForm((f: any) => ({ ...f, state: e.target.value, state_code: st?.code || f.state_code }));
            }}>
              {INDIAN_STATES.map(s => <option key={s.code} value={s.name}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Pincode</label>
            <input style={inp} value={form.pincode || ""} onChange={e => set("pincode", e.target.value)} placeholder="682001" maxLength={6} />
          </div>
          <div>
            <label style={lbl}>Country</label>
            <input style={inp} value={form.country || "India"} onChange={e => set("country", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Tax Info */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Tax & Legal</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={lbl}>GSTIN</label>
            <input style={inp} value={form.gstin || ""} onChange={e => set("gstin", e.target.value.toUpperCase())} placeholder="32XXXXX0000X1ZX" maxLength={15} />
          </div>
          <div>
            <label style={lbl}>PAN</label>
            <input style={inp} value={form.pan || ""} onChange={e => set("pan", e.target.value.toUpperCase())} placeholder="XXXXX0000X" maxLength={10} />
          </div>
        </div>
      </div>

      {/* Bank Details */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>Bank Details</h2>
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>Shown on invoices for bank transfer payments</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={lbl}>Bank Name</label>
            <input style={inp} value={form.bank_name || ""} onChange={e => set("bank_name", e.target.value)} placeholder="State Bank of India" />
          </div>
          <div>
            <label style={lbl}>Account Number</label>
            <input style={inp} value={form.bank_account_number || ""} onChange={e => set("bank_account_number", e.target.value)} placeholder="XXXXXXXXXXXX" />
          </div>
          <div>
            <label style={lbl}>IFSC Code</label>
            <input style={inp} value={form.bank_ifsc || ""} onChange={e => set("bank_ifsc", e.target.value.toUpperCase())} placeholder="SBIN0000000" maxLength={11} />
          </div>
          <div>
            <label style={lbl}>Branch</label>
            <input style={inp} value={form.bank_branch || ""} onChange={e => set("bank_branch", e.target.value)} placeholder="MG Road, Kochi" />
          </div>
        </div>
      </div>

      {/* Invoice Settings */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Invoice Settings</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={lbl}>Invoice Prefix</label>
            <input style={inp} value={form.invoice_prefix || "INV"} onChange={e => set("invoice_prefix", e.target.value.toUpperCase())} placeholder="INV" maxLength={10} />
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 0" }}>e.g. INV → INV-2506-0001</p>
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Payment Terms</label>
            <textarea style={{ ...inp, height: 70, resize: "vertical" as const }} value={form.invoice_terms || ""} onChange={e => set("invoice_terms", e.target.value)} placeholder="Payment due within 30 days. Late payments subject to 2% interest per month." />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={lbl}>Invoice Footer Note</label>
            <input style={inp} value={form.invoice_footer || ""} onChange={e => set("invoice_footer", e.target.value)} placeholder="Thank you for your business!" />
          </div>
        </div>
      </div>
      {/* Backup & Restore */}
  <div className="card" style={{ padding: 24, marginBottom: 20 }}>
    <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>Backup & Restore</h2>
    <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>Database backups (settings, products, orders, accounting)</p>

    <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
      <button onClick={runBackup} disabled={backingUp} className="btn-primary">
        {backingUp ? "Backing up..." : "Backup Now"}
      </button>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <input type="checkbox" checked={form.auto_backup_enabled || false}
          onChange={e => set("auto_backup_enabled", e.target.checked)} />
        Auto-backup daily at
        <input type="time" style={{ ...inp, width: 110, padding: "5px 8px" }}
          value={form.auto_backup_time || "02:00"}
          onChange={e => set("auto_backup_time", e.target.value)} />
      </label>
      <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
        Keep for
        <input type="number" style={{ ...inp, width: 60, padding: "5px 8px" }}
          value={form.auto_backup_retention_days ?? 7}
          onChange={e => set("auto_backup_retention_days", parseInt(e.target.value) || 7)} />
        days
      </label>
    </div>

    <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ borderBottom: "1px solid #e2e8f0", color: "#64748b", textAlign: "left" }}>
          <th style={{ padding: "6px 4px" }}>File</th>
          <th style={{ padding: "6px 4px" }}>Size</th>
          <th style={{ padding: "6px 4px" }}>Created</th>
          <th style={{ padding: "6px 4px" }}></th>
        </tr>
      </thead>
      <tbody>
        {backups.map(b => (
          <tr key={b.filename} style={{ borderBottom: "1px solid #f1f5f9" }}>
            <td style={{ padding: "6px 4px" }}>{b.filename}</td>
            <td style={{ padding: "6px 4px" }}>{(b.size_bytes / 1024 / 1024).toFixed(2)} MB</td>
            <td style={{ padding: "6px 4px" }}>{new Date(b.created_at).toLocaleString()}</td>
            <td style={{ padding: "6px 4px", display: "flex", gap: 8 }}>
              <button onClick={() => downloadBackup(b.filename)} style={{ color: "#2563eb", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Download</button>
              <button onClick={() => deleteBackup(b.filename)} style={{ color: "#dc2626", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Delete</button>
            </td>
          </tr>
        ))}
        {backups.length === 0 && <tr><td colSpan={4} style={{ padding: 12, color: "#94a3b8" }}>No backups yet</td></tr>}
      </tbody>
    </table>

    <div style={{ marginTop: 20, padding: 16, background: "#fef2f2", borderRadius: 8, border: "1px solid #fecaca" }}>
  <h3 style={{ fontSize: 13, fontWeight: 600, color: "#991b1b", margin: "0 0 8px" }}>Restore from backup</h3>
  <p style={{ fontSize: 12, color: "#991b1b", margin: "0 0 10px" }}>
    This replaces your current database with the selected backup. Cannot be undone.
  </p>

  <select style={{ ...inp, marginBottom: 10 }} value={selectedBackup} onChange={e => setSelectedBackup(e.target.value)}>
    <option value="">Select an existing backup…</option>
    {backups.map(b => (
      <option key={b.filename} value={b.filename}>
        {b.filename} — {new Date(b.created_at).toLocaleString()}
      </option>
    ))}
  </select>

  <p style={{ fontSize: 12, color: "#991b1b", margin: "0 0 6px" }}>— or upload a backup file from elsewhere —</p>
  <input type="file" accept=".dump" onChange={e => { setRestoreFile(e.target.files?.[0] || null); setSelectedBackup(""); }} style={{ fontSize: 13, marginBottom: 10 }} />

  <br />
  <input placeholder='Type RESTORE to confirm' value={restoreConfirm}
    onChange={e => setRestoreConfirm(e.target.value)}
    style={{ ...inp, width: 220, display: "inline-block", marginRight: 8 }} />

  <button
    onClick={selectedBackup ? doRestoreExisting : doRestore}
    disabled={restoring || restoreConfirm.trim().toUpperCase() !== "RESTORE" || (!selectedBackup && !restoreFile)}
    className="btn-primary" style={{ background: "#dc2626" }}>
    {restoring ? "Restoring..." : "Restore Database"}
  </button>
</div>
  </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={save} disabled={saving} className="btn-primary" style={{ minWidth: 140 }}>
          {saving ? "Saving..." : saved ? "✓ Saved!" : "Save All Changes"}
        </button>
      </div>
    </div>
  );
}
