"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9", fontSize: 14 }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ fontWeight: 500, color: "#1e293b", textAlign: "right", maxWidth: "60%" }}>{value}</span>
    </div>
  );
}

export default function PaymentVoucherDetailPage() {
  const { paymentNumber: raw } = useParams();
  const paymentNumber = decodeURIComponent(raw as string);
  const router = useRouter();
  const [payment, setPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (paymentNumber) {
      api.get(`/payment-vouchers/${paymentNumber}`)
        .then(r => setPayment(r.data))
        .catch(() => setError("Failed to load payment voucher"))
        .finally(() => setLoading(false));
    }
  }, [paymentNumber]);

  const fmt = (n: any) => `₹${parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading payment...</div>;
  if (!payment) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>{error || "Payment voucher not found"}</div>;

  return (
    <div style={{ padding: 32, maxWidth: 800 }}>
      <button onClick={() => router.back()} style={{ fontSize: 13, color: "#475569", background: "none", border: "none", cursor: "pointer", marginBottom: 8 }}>← Back</button>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: "0 0 20px" }}>Payment {payment.payment_number}</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#475569", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Payment Info</h2>
          <InfoRow label="Date" value={new Date(payment.payment_date).toLocaleDateString("en-IN")} />
          <InfoRow label="Vendor" value={payment.vendor_name || `#${payment.vendor_id}`} />
{payment.purchase_number && <InfoRow label="Against Purchase" value={payment.purchase_number} />}
          <InfoRow label="Payment Mode" value={<span style={{ textTransform: "uppercase" }}>{payment.payment_mode}</span>} />
          {payment.reference_number && <InfoRow label="Reference #" value={payment.reference_number} />}
          {payment.bank_account && <InfoRow label="Bank Account" value={payment.bank_account} />}
          {payment.narration && <InfoRow label="Narration" value={payment.narration} />}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#475569", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Amount</h2>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#dc2626" }}>{fmt(payment.amount)}</div>
          <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 8 }}>Paid to vendor</p>
        </div>
      </div>
    </div>
  );
}