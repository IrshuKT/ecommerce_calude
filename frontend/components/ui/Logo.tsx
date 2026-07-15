"use client";
import { usePublicSettings } from "@/app/context/PublicSettingsContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8000";

export default function Logo() {
  const settings = usePublicSettings();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 32, height: 32, borderRadius: 7, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
        {settings.logo_url
          ? <img src={`${API_BASE}${settings.logo_url}`} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          : <div style={{ width: 32, height: 32, borderRadius: 7, background: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="2" width="6" height="6" rx="1" fill="white" opacity="0.9"/>
                <rect x="10" y="2" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
                <rect x="2" y="10" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
                <rect x="10" y="10" width="6" height="6" rx="1" fill="white" opacity="0.9"/>
              </svg>
            </div>
        }
      </div>
      <span style={{ fontSize: 17, fontWeight: 600, color: "#1e293b" }}>
        {settings.company_name || "Epozy"}
      </span>
    </div>
  );
}