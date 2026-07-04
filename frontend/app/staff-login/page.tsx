"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import staffApi from "@/lib/staffApi";
import { useStaffAuthStore } from "@/store/staffAuth";

export default function StaffLoginPage() {
  const router = useRouter();
  const setSession = useStaffAuthStore((s) => s.setSession);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const form = new URLSearchParams();
      form.set("username", username);
      form.set("password", password);
      const res = await staffApi.post("/admin/staff-login", form, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      const { access_token, user_id, name, role, menus } = res.data;
      setSession(access_token, { id: user_id, name, role }, menus);
      router.push("/admin");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const inp = {
    width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0",
    fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const,
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
      <form onSubmit={submit} style={{ width: 360, background: "white", padding: 32, borderRadius: 12, border: "1px solid #e2e8f0" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", margin: "0 0 4px" }}>Staff Login</h1>
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 24px" }}>Sign in with your staff account</p>

        <label style={{ fontSize: 13, fontWeight: 500, color: "#475569", display: "block", marginBottom: 5 }}>Email or Phone</label>
        <input style={{ ...inp, marginBottom: 16 }} value={username} onChange={e => setUsername(e.target.value)} required />

        <label style={{ fontSize: 13, fontWeight: 500, color: "#475569", display: "block", marginBottom: 5 }}>Password</label>
        <input type="password" style={{ ...inp, marginBottom: 20 }} value={password} onChange={e => setPassword(e.target.value)} required />

        {error && (
          <p style={{ color: "#dc2626", fontSize: 13, background: "#fee2e2", padding: "8px 12px", borderRadius: 6, margin: "0 0 16px" }}>{error}</p>
        )}

        <button type="submit" disabled={loading} style={{
          width: "100%", padding: "10px", borderRadius: 8, border: "none", cursor: loading ? "default" : "pointer",
          background: "#0284c7", color: "white", fontSize: 14, fontWeight: 600,
        }}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}