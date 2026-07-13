"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import staffApi from "@/lib/staffApi";

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9", fontSize: 14 }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ fontWeight: 500, color: "#1e293b", textAlign: "right", maxWidth: "60%" }}>{value}</span>
    </div>
  );
}

export default function ReceiptDetailPage() {
  const { receiptNumber: raw } = useParams();
  const receiptNumber = decodeURIComponent(raw as string);
  const router = useRouter();
  const [receipt, setReceipt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (receiptNumber) {
      staffApi.get(`/receipts/${receiptNumber}`)
        .then(r => setReceipt(r.data))
        .catch(() => setError("Failed to load receipt"))
        .finally(() => setLoading(false));
    }
  }, [receiptNumber]);

  const fmt = (n: any) => `₹${parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading receipt...</div>;
  if (!receipt) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>{error || "Receipt not found"}</div>;

  return (
    <div style={{ padding: 32, maxWidth: 800 }}>
      <button onClick={() => router.back()} style={{ fontSize: 13, color: "#475569", background: "none", border: "none", cursor: "pointer", marginBottom: 8 }}>← Back</button>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: "0 0 20px" }}>Receipt {receipt.receipt_number}</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#475569", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Receipt Info</h2>
          <InfoRow label="Date" value={new Date(receipt.receipt_date).toLocaleDateString("en-IN")} />
          <InfoRow label="Customer" value={receipt.customer_name || `#${receipt.customer_id}`} />
{receipt.invoice_number && <InfoRow label="Against Invoice" value={receipt.invoice_number} />}
          <InfoRow label="Payment Mode" value={<span style={{ textTransform: "uppercase" }}>{receipt.payment_mode}</span>} />
          {receipt.reference_number && <InfoRow label="Reference #" value={receipt.reference_number} />}
          {receipt.bank_account && <InfoRow label="Bank Account" value={receipt.bank_account} />}
          {receipt.narration && <InfoRow label="Narration" value={receipt.narration} />}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#475569", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Amount</h2>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#16a34a" }}>{fmt(receipt.amount)}</div>
          <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>Received from customer</p>
        </div>
      </div>
    </div>
  );
}