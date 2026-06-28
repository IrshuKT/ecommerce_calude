"use client";
import Logo from "@/components/ui/Logo";
import { PublicSettingsProvider, usePublicSettings } from "@/app/context/PublicSettingsContext";

function AuthLayoutInner({ children }: { children: React.ReactNode }) {
  const settings = usePublicSettings();

  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      <div style={{ display: "none", width: "50%", background: "#0284c7", flexDirection: "column", justifyContent: "space-between", padding: 48 }} className="auth-left">
        <Logo />
        <div>
          <h1 style={{ fontSize: 36, fontWeight: 300, color: "white", lineHeight: 1.3, marginBottom: 16 }}>
            Quality glass<br/><span style={{ fontWeight: 700 }}>delivered to you.</span>
          </h1>
          <p style={{ color: "#bae6fd", fontSize: 18, lineHeight: 1.6, maxWidth: 320 }}>
            {settings.tagline || "Premium glass materials for homes, offices, and projects across India. GST invoices included with every order."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 32, color: "#bae6fd", fontSize: 14 }}>
          <span>🪟 500+ products</span>
          <span>📦 {settings.state || "Kerala"} delivery</span>
          <span>🧾 GST compliant</span>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ width: "100%", maxWidth: 420 }}>
          <div style={{ marginBottom: 32 }}><Logo /></div>
          {children}
        </div>
      </div>
      <style>{`@media(min-width:1024px){.auth-left{display:flex !important;}}`}</style>
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicSettingsProvider>
      <AuthLayoutInner>{children}</AuthLayoutInner>
    </PublicSettingsProvider>
  );
}