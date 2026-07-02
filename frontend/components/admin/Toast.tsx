"use client";
import { useEffect } from "react";

export type ToastType = "success" | "error" | "info";

export interface ToastData {
  message: string;
  type: ToastType;
}

export default function Toast({ toast, onClose }: { toast: ToastData | null; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const colors: Record<ToastType, { bg: string; color: string; border: string }> = {
    success: { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" },
    error:   { bg: "#fef2f2", color: "#991b1b", border: "#fecaca" },
    info:    { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  };
  const c = colors[toast.type];

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        zIndex: 1000,
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
        borderRadius: 10,
        padding: "12px 16px",
        fontSize: 14,
        fontWeight: 500,
        maxWidth: 380,
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        animation: "toast-in 0.2s ease-out",
      }}
    >
      <span style={{ flex: 1, lineHeight: 1.4 }}>{toast.message}</span>
      <button
        onClick={onClose}
        style={{ background: "none", border: "none", cursor: "pointer", color: c.color, fontSize: 16, lineHeight: 1, padding: 0, opacity: 0.6 }}
      >
        ×
      </button>
      <style jsx>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}