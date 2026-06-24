"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function OrderSuccessContent() {
  const params = useSearchParams();
  const order = params.get("order");
  const method = params.get("method");

  return (
    <div style={{ maxWidth: 500, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
      <div style={{ fontSize: 72, marginBottom: 16 }}>🎉</div>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: "#1e293b", margin: "0 0 8px" }}>Order Placed!</h1>
      <p style={{ fontSize: 16, color: "#64748b", margin: "0 0 8px" }}>
        Your order <strong style={{ color: "#0284c7" }}>{order}</strong> has been placed successfully.
      </p>
      {method === "cod" && <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 24px" }}>Pay cash when your order arrives.</p>}
      {method === "razorpay" && <p style={{ fontSize: 14, color: "#16a34a", margin: "0 0 24px" }}>✓ Payment received. GST invoice has been generated.</p>}
      <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: 16, marginBottom: 24 }}>
        <p style={{ fontSize: 13, color: "#475569", margin: 0 }}>🧾 A GST invoice has been generated for your order. You can download it from My Orders.</p>
      </div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
        <Link href="/account/orders" style={{ padding: "11px 24px", borderRadius: 8, background: "#0284c7", color: "white", textDecoration: "none", fontWeight: 600, fontSize: 14 }}>Track Order</Link>
        <Link href="/shop" style={{ padding: "11px 24px", borderRadius: 8, border: "1px solid #e2e8f0", color: "#475569", textDecoration: "none", fontSize: 14 }}>Continue Shopping</Link>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<div style={{ padding: 60, textAlign: "center" }}>Loading...</div>}>
      <OrderSuccessContent />
    </Suspense>
  );
}
