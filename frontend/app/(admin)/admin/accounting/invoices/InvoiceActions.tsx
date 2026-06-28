"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { useSettings } from "@/hooks/useSettings";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8000";


interface Props {
  invoiceNumber: string;
  status: string;
  onRefresh: () => void;
}
 
export function InvoiceActions({ invoiceNumber, status, onRefresh }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
 
  const confirm = async () => {
    if (!window.confirm("Confirm this invoice? This will:\n• Post journal entries (AR, Sales, GST)\n• Deduct stock from inventory\n\nThis cannot be undone.")) return;
    setConfirming(true);
    setError("");
    try {
      const r = await api.post(`/invoices/${invoiceNumber}/confirm`, {});
      onRefresh();
    } catch (e: any) {
      setError(e.response?.data?.detail || "Confirm failed");
    } finally {
      setConfirming(false);
    }
  };
 
  const cancel = async () => {
    if (!window.confirm("Cancel this invoice? This action cannot be undone.")) return;
    setCancelling(true);
    setError("");
    try {
      await api.post(`/invoices/${invoiceNumber}/cancel`, {});
      onRefresh();
    } catch (e: any) {
      setError(e.response?.data?.detail || "Cancel failed");
    } finally {
      setCancelling(false);
    }
  };
 
  if (status === "paid" || status === "partially_paid" || status === "cancelled") {
    return null; // no actions for these statuses
  }
 
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {error && (
        <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, color: "#dc2626", fontSize: 12 }}>
          {error}
        </div>
      )}
 
      {status === "draft" && (
        <button
          onClick={confirm}
          disabled={confirming}
          style={{
            padding: "10px 20px",
            background: confirming ? "#93c5fd" : "#0284c7",
            color: "#fff",
            border: "none",
            borderRadius: 7,
            fontWeight: 600,
            fontSize: 14,
            cursor: confirming ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {confirming ? "⏳ Confirming…" : "✅ Confirm Invoice"}
        </button>
      )}
 
      {(status === "draft" || status === "confirmed") && (
        <button
          onClick={cancel}
          disabled={cancelling}
          style={{
            padding: "9px 20px",
            background: "#fff",
            color: "#dc2626",
            border: "1px solid #fca5a5",
            borderRadius: 7,
            fontWeight: 500,
            fontSize: 13,
            cursor: cancelling ? "default" : "pointer",
          }}
        >
          {cancelling ? "Cancelling…" : "🚫 Cancel Invoice"}
        </button>
      )}
 
      {/* info box for draft */}
      {status === "draft" && (
        <div style={{ padding: "10px 12px", background: "#fefce8", border: "1px solid #fde68a", borderRadius: 6, fontSize: 12, color: "#92400e", marginTop: 4 }}>
          <strong>Draft</strong> — Confirm to post accounting entries and deduct stock.
        </div>
      )}
    </div>
  );
}
 
 
// ─────────────────────────────────────────────────────────────────────────────
// Also add "+ Manual Invoice" button to your InvoicesPage (invoices/page.tsx)
// Add this inside the PageHeader or above the filter buttons:
// ─────────────────────────────────────────────────────────────────────────────
 
export function ManualInvoiceButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push("/admin/accounting/invoices/create")}
      style={{
        padding: "9px 20px",
        background: "#0284c7",
        color: "#fff",
        border: "none",
        borderRadius: 7,
        fontWeight: 600,
        fontSize: 14,
        cursor: "pointer",
      }}
    >
      + Manual Invoice
    </button>
  );
}

