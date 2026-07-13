"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import staffApi from "@/lib/staffApi";
import PageHeader from "@/components/admin/PageHeader";

export default function PurchaseDetailPage() {
  const { purchaseNumber } = useParams();
  const router = useRouter();
  const [purchase, setPurchase] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (purchaseNumber) {
      staffApi.get(`/purchases/${purchaseNumber}`)
        .then(r => setPurchase(r.data))
        .catch(() => setPurchase(null))
        .finally(() => setLoading(false));
    }
  }, [purchaseNumber]);

  const fmt = (n: any) => `₹${parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const statusColors: Record<string, { bg: string; color: string }> = {
    draft:     { bg: "#f1f5f9", color: "#475569" },
    ordered:   { bg: "#dbeafe", color: "#1d4ed8" },
    received:  { bg: "#dcfce7", color: "#166534" },
    cancelled: { bg: "#fee2e2", color: "#991b1b" },
    invoiced:  { bg: "#ede9fe", color: "#6d28d9" },
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading purchase...</div>;
  if (!purchase) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <p style={{ color: "#64748b" }}>Purchase not found.</p>
      <button onClick={() => router.back()} style={{ color: "#0284c7", background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>← Go back</button>
    </div>
  );

  const c = statusColors[purchase.status] || { bg: "#f1f5f9", color: "#475569" };

  return (
    <div style={{ padding: 32, maxWidth: 900 }}>
      <PageHeader
        title={`Purchase ${purchase.purchase_number}`}
        subtitle={`Created on ${new Date(purchase.created_at).toLocaleDateString("en-IN", { dateStyle: "long" })}`}
        action={<button className="btn-outline" onClick={() => router.back()}>← Back</button>}
      />

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 4px" }}>Status</p>
          <span style={{ fontSize: 13, fontWeight: 600, padding: "4px 12px", borderRadius: 20, background: c.bg, color: c.color, textTransform: "capitalize" }}>
            {purchase.status}
          </span>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 4px" }}>Grand Total</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: "#1e293b", margin: 0 }}>{fmt(purchase.grand_total)}</p>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 4px" }}>Balance Due</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: parseFloat(purchase.balance_due) > 0 ? "#dc2626" : "#16a34a", margin: 0 }}>
            {fmt(purchase.balance_due)}
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Purchase Info */}
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#475569", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Purchase Info</h2>
          {[
            { label: "Purchase #", value: purchase.purchase_number },
            { label: "Purchase Date", value: new Date(purchase.purchase_date).toLocaleDateString("en-IN") },
            { label: "Vendor Invoice #", value: purchase.vendor_invoice_number || "—" },
            { label: "Vendor Invoice Date", value: purchase.vendor_invoice_date ? new Date(purchase.vendor_invoice_date).toLocaleDateString("en-IN") : "—" },
            { label: "Due Date", value: purchase.due_date ? new Date(purchase.due_date).toLocaleDateString("en-IN") : "—" },
            { label: "GST Type", value: purchase.is_interstate ? "Inter-state (IGST)" : "Intra-state (CGST+SGST)" },
          ].map(row => (
            <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
              <span style={{ color: "#64748b" }}>{row.label}</span>
              <span style={{ fontWeight: 500, color: "#1e293b" }}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Price Breakdown */}
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#475569", margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Price Breakdown</h2>
          {[
            { label: "Subtotal", value: fmt(purchase.subtotal) },
            { label: "Discount", value: fmt(purchase.discount_amount) },
            { label: "Taxable Amount", value: fmt(purchase.taxable_amount) },
            ...(parseFloat(purchase.cgst_amount) > 0 ? [{ label: "CGST", value: fmt(purchase.cgst_amount) }] : []),
            ...(parseFloat(purchase.sgst_amount) > 0 ? [{ label: "SGST", value: fmt(purchase.sgst_amount) }] : []),
            ...(parseFloat(purchase.igst_amount) > 0 ? [{ label: "IGST", value: fmt(purchase.igst_amount) }] : []),
            { label: "Total Tax", value: fmt(purchase.total_tax) },
          ].map(row => (
            <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
              <span style={{ color: "#64748b" }}>{row.label}</span>
              <span style={{ fontWeight: 500 }}>{row.value}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
            <span>Grand Total</span>
            <span>{fmt(purchase.grand_total)}</span>
          </div>
        </div>
      </div>

      {/* Items table */}
      <div className="card" style={{ padding: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: "#475569", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Purchase Items ({purchase.items?.length || 0})
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                {["#", "Product", "HSN", "Qty", "Unit", "Unit Price", "Taxable", "GST %", "Tax Amt", "Line Total", "Received"].map(h => (
                  <th key={h} style={{ padding: "10px 10px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748b", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {purchase.items?.map((item: any, i: number) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px" }}>{i + 1}</td>
                  <td style={{ padding: "10px", fontWeight: 500, color: "#1e293b" }}>{item.product_name}</td>
                  <td style={{ padding: "10px", color: "#94a3b8" }}>{item.hsn_code || "—"}</td>
                  <td style={{ padding: "10px" }}>{parseFloat(item.quantity).toFixed(2)}</td>
                  <td style={{ padding: "10px", color: "#64748b" }}>{item.unit}</td>
                  <td style={{ padding: "10px" }}>{fmt(item.unit_price)}</td>
                  <td style={{ padding: "10px" }}>{fmt(item.taxable_amount)}</td>
                  <td style={{ padding: "10px", textAlign: "center" }}>{parseFloat(item.gst_rate)}%</td>
                  <td style={{ padding: "10px" }}>
                    {fmt(purchase.is_interstate ? item.igst_amount : parseFloat(item.cgst_amount || 0) + parseFloat(item.sgst_amount || 0))}
                  </td>
                  <td style={{ padding: "10px", fontWeight: 600 }}>{fmt(item.line_total)}</td>
                  <td style={{ padding: "10px" }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: parseFloat(item.received_qty) >= parseFloat(item.quantity) ? "#16a34a" : "#d97706" }}>
                      {parseFloat(item.received_qty || 0).toFixed(2)} / {parseFloat(item.quantity).toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {purchase.notes && (
          <div style={{ marginTop: 16, padding: 12, background: "#f8fafc", borderRadius: 7 }}>
            <p style={{ fontSize: 13, color: "#475569", margin: 0 }}><strong>Notes:</strong> {purchase.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
