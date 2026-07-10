"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { useSettings } from "@/hooks/useSettings";
import { ManualInvoiceButton } from "../InvoiceActions";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8000";


export default function InvoiceDetailPage() {
  const settings = useSettings();
  const { invoiceNumber: rawInvoiceNumber } = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const invoiceNumber = decodeURIComponent(rawInvoiceNumber as string);

  useEffect(() => {
    if (invoiceNumber) {
      api.get(`/invoices/${invoiceNumber}`)
        .then(r => setInvoice(r.data))
        .catch(() => setInvoice(null))
        .finally(() => setLoading(false));
    }
  }, [invoiceNumber]);

  const fmt = (n: any) => `₹${parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const printInvoice = () => window.print();

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading invoice...</div>;
  if (!invoice) return <div style={{ padding: 40, textAlign: "center" }}>Invoice not found</div>;

  return (
    <div style={{ padding: 16, maxWidth: 900 }}>
      {/* Actions */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24, justifyContent: "space-between", alignItems: "center" }} className="no-print">
        <button onClick={() => router.back()} style={{ fontSize: 13, color: "#475569", background: "none", border: "none", cursor: "pointer" }}>← Back</button>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={printInvoice} className="btn-outline">🖨️ Print</button>
        </div>
      </div>

      {/* Invoice */}
      <div className="card" style={{ padding: 40 }} id="invoice-print">
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {settings?.logo_url ? (
          <img src={`${API_BASE}${settings.logo_url}`} alt="Logo"
            style={{ width: 40, height: 40, objectFit: "contain", borderRadius: 8 }} />
        ) : (
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="2" y="2" width="6" height="6" rx="1" fill="white" opacity="0.9"/>
              <rect x="10" y="2" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
              <rect x="2" y="10" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
              <rect x="10" y="10" width="6" height="6" rx="1" fill="white" opacity="0.9"/>
            </svg>
          </div>
        )}
        <span style={{ fontSize: 20, fontWeight: 700, color: "#1e293b" }}>
          {settings?.company_name || "GlassStore"}
        </span>
      </div>
      <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 2px" }}>
        {[settings?.address_line1, settings?.city, settings?.state].filter(Boolean).join(", ")}
      </p>
      <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 2px" }}>
        GSTIN: {settings?.gstin || "—"}
      </p>
      <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
        📞 {settings?.phone || settings?.mobile || "—"}
      </p>
    </div>

          <div style={{ textAlign: "right" }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: "#0284c7", margin: "0 0 8px" }}>TAX INVOICE</h1>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", margin: "0 0 4px" }}>#{invoice.invoice_number}</p>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 4px" }}>Date: {new Date(invoice.invoice_date).toLocaleDateString("en-IN", { dateStyle: "long" })}</p>
            {/* <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 4, background: invoice.status === "paid" ? "#dcfce7" : "#fef9c3", color: invoice.status === "paid" ? "#166534" : "#854d0e", textTransform: "capitalize" }}>
              {invoice.status.replace("_", " ")}
            </span> */}
          </div>
        </div>

        {/* Bill To */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 34, marginBottom: 16, padding: 16, background: "#f8fafc", borderRadius: 8 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#000000", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Bill To</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", margin: "0 0 2px" }}>{invoice.billing_name}</p>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 2px" }}>{invoice.billing_line1}{invoice.billing_line2 ? `, ${invoice.billing_line2}` : ""}</p>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 2px" }}>{invoice.billing_city}, {invoice.billing_state} — {invoice.billing_pincode}</p>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>📞 {invoice.billing_phone}</p>
            {invoice.customer_gstin && <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>GSTIN: {invoice.customer_gstin}</p>}
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#000000", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Invoice Details</p>
            <div style={{ fontSize: 13, color: "#64748b" }}>
              <p style={{ margin: "0 0 4px" }}>GST Type: <strong style={{ color: "#1e293b" }}>{invoice.is_interstate ? "Inter-state (IGST)" : "Intra-state (CGST+SGST)"}</strong></p>
              {invoice.order_id && <p style={{ margin: "0 0 4px" }}>Order: <strong style={{ color: "#1e293b" }}>#{invoice.order_id}</strong></p>}
            </div>
          </div>
        </div>

        {/* Items table */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24, fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#1e293b", color: "white" }}>
              {["#", "Description", "HSN", "Qty", "Unit", "Rate", "Taxable", "GST %", "GST Amt", "Total"].map(h => (
                <th key={h} style={{ padding: "10px 10px", textAlign: h === "#" ? "center" : "left", fontSize: 12, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoice.items?.map((item: any, i: number) => (
              <tr key={item.id} style={{ borderBottom: "1px solid #e2e8f0", background: i % 2 === 0 ? "white" : "#f8fafc" }}>
                <td style={{ padding: "10px", textAlign: "center", color: "#64748b" }}>{i + 1}</td>
                <td style={{ padding: "10px", fontWeight: 500, color: "#1e293b" }}>{item.product_name}</td>
                <td style={{ padding: "10px", color: "#64748b", fontSize: 12 }}>{item.hsn_code || "—"}</td>
                <td style={{ padding: "10px" }}>{parseFloat(item.quantity).toFixed(2)}</td>
                <td style={{ padding: "10px", color: "#64748b" }}>{item.unit}</td>
                <td style={{ padding: "10px" }}>{fmt(item.unit_price)}</td>
                <td style={{ padding: "10px" }}>{fmt(item.taxable_amount)}</td>
                <td style={{ padding: "10px", textAlign: "center" }}>{parseFloat(item.gst_rate)}%</td>
                <td style={{ padding: "10px" }}>
                  {invoice.is_interstate
                    ? fmt(item.igst_amount)
                    : fmt(parseFloat(item.cgst_amount) + parseFloat(item.sgst_amount))}
                </td>
                <td style={{ padding: "10px", fontWeight: 600 }}>{fmt(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

{/* Totals */}
<div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
  <div style={{ width: 280 }}>
    {[
      { label: "Subtotal", value: fmt(invoice.subtotal) },
      ...(parseFloat(invoice.discount_amount) > 0 ? [{ label: "Discount", value: `− ${fmt(invoice.discount_amount)}` }] : []),
      { label: "Taxable Amount", value: fmt(invoice.taxable_amount) },
      ...(parseFloat(invoice.cgst_amount) > 0 ? [{ label: "CGST", value: fmt(invoice.cgst_amount) }] : []),
      ...(parseFloat(invoice.sgst_amount) > 0 ? [{ label: "SGST", value: fmt(invoice.sgst_amount) }] : []),
      ...(parseFloat(invoice.igst_amount) > 0 ? [{ label: "IGST", value: fmt(invoice.igst_amount) }] : []),
      ...(parseFloat(invoice.shipping_charge) > 0 ? [{ label: "Shipping", value: fmt(invoice.shipping_charge) }] : []),
      ...(parseFloat(invoice.round_off) !== 0 ? [{
        label: "Round Off",
        value: `${parseFloat(invoice.round_off) > 0 ? "+ " : "− "}${fmt(Math.abs(parseFloat(invoice.round_off)))}`
      }] : []),
    ].map(row => (
      <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "1px 0", fontSize: 13, color: "#475569" }}>
        <span>{row.label}</span><span>{row.value}</span>
      </div>
    ))}
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0 0", fontSize: 16, fontWeight: 700, color: "#1e293b", borderTop: "1.5px solid #1e293b", marginTop: 3 }}>
      <span>Grand Total</span><span>{fmt(invoice.grand_total)}</span>
    </div>
    {parseFloat(invoice.balance_due) > 0 && (
      <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0 0", fontSize: 13, color: "#dc2626" }}>
        <span>Balance Due</span><span style={{ fontWeight: 600 }}>{fmt(invoice.balance_due)}</span>
      </div>
    )}
  </div>
</div>

        {/* GST Summary */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>GST Summary</p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                {["HSN Code", "Taxable Value", invoice.is_interstate ? "IGST Rate" : "CGST Rate", invoice.is_interstate ? "IGST Amount" : "CGST Amount", ...(!invoice.is_interstate ? ["SGST Rate", "SGST Amount"] : []), "Total Tax"].map(h => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#475569" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoice.items?.map((item: any) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "8px 10px" }}>{item.hsn_code || "—"}</td>
                  <td style={{ padding: "8px 10px" }}>{fmt(item.taxable_amount)}</td>
                  {invoice.is_interstate ? (
                    <>
                      <td style={{ padding: "8px 10px" }}>{parseFloat(item.igst_rate)}%</td>
                      <td style={{ padding: "8px 10px" }}>{fmt(item.igst_amount)}</td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: "8px 10px" }}>{parseFloat(item.cgst_rate)}%</td>
                      <td style={{ padding: "8px 10px" }}>{fmt(item.cgst_amount)}</td>
                      <td style={{ padding: "8px 10px" }}>{parseFloat(item.sgst_rate)}%</td>
                      <td style={{ padding: "8px 10px" }}>{fmt(item.sgst_amount)}</td>
                    </>
                  )}
                  <td style={{ padding: "8px 10px", fontWeight: 600 }}>
                    {fmt(invoice.is_interstate ? item.igst_amount : parseFloat(item.cgst_amount) + parseFloat(item.sgst_amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>This is a computer generated invoice.</p>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "2px 0 0" }}>Thank you for your business!</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ width: 120, borderTop: "1px solid #1e293b", paddingTop: 8, marginTop: 32 }}>
              <p style={{ fontSize: 12, color: "#475569", margin: 0, textAlign: "center" }}>Authorised Signatory</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
  @media print {
    /* Hide everything */
    body * { visibility: hidden; }
    
    /* Show only the invoice div and its children */
    #invoice-print, #invoice-print * { visibility: visible; }
    
    /* Position it at top-left */
    #invoice-print {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      padding: 20px;
      box-shadow: none;
      border: none;
    }

    /* Hide action buttons */
    .no-print { display: none !important; }
  }
`}</style>
    </div>
  );
}
