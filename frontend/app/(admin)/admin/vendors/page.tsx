"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import staffApi from "@/lib/staffApi";
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
    try { const res = await staffApi.get("/vendors/"); setVendors(res.data || []); }
    catch { setVendors([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await staffApi.post("/vendors/", { ...form, credit_days: parseInt(form.credit_days) });
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
