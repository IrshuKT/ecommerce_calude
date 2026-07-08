"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import PageHeader from "@/components/admin/PageHeader";

export default function NewCustomerPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [field]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone) {
      setError("Name, email and phone are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post("/users/", {
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password || undefined,
      });
      router.push("/admin/customers");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to create customer");
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 32, maxWidth: 480 }}>
      <PageHeader title="Add Customer" subtitle="Create a walk-in or manual customer record" />

      <div className="card" style={{ padding: 24, marginTop: 16 }}>
        <form onSubmit={handleSubmit}>
          {error && (
            <div
              style={{
                background: "#fef2f2",
                color: "#dc2626",
                fontSize: 13,
                padding: "8px 12px",
                borderRadius: 6,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}>Name *</label>
              <input value={form.name} onChange={handleChange("name")} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Email *</label>
              <input type="email" value={form.email} onChange={handleChange("email")} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Phone *</label>
              <input value={form.phone} onChange={handleChange("phone")} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Password (optional)</label>
              <input
                type="password"
                value={form.password}
                onChange={handleChange("password")}
                style={inputStyle}
                placeholder="Leave blank if customer won't log in"
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: "#0284c7",
                color: "#fff",
                border: "none",
                padding: "8px 20px",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 500,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving..." : "Create Customer"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/admin/customers")}
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                padding: "8px 20px",
                borderRadius: 6,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  display: "block",
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #e2e8f0",
  fontSize: 14,
  boxSizing: "border-box",
};