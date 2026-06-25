"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { useCompanyStore } from "@/store/company";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8000";

export default function CustomerInvoicePage() {
  const { invoiceNumber } = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { settings, load: loadCompany } = useCompanyStore();

  useEffect(() => {
    loadCompany();
    if (invoiceNumber) {
      api.get(`/invoices/${invoiceNumber}`)
        .then(r => setInvoice(r.data))
        .catch(() => setInvoice(null))
        .finally(() => setLoading(false));
    }
  }, [invoiceNumber]);

  const fmt = (n: any) => `₹${parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  const company = settings || {};

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading invoice...</div>;
  if (!invoice) return <div style={{ padding: 40, textAlign: "center" }}>Invoice not found. <button onClick={() => router.back()} style={{ color: "#0284c7", background: "none", border: "none", cursor: "pointer" }}>Go back</button></div>;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 20, justifyContent: "space-between" }} className="no-print">
        <button onClick={() => router.back()} style={{ fontSize: 13, color: "#475569", background: "none", border: "none", cursor: "pointer" }}>← Back</button>
        <button onClick={() => window.print()} className="btn-outline">🖨️ Print / Download</button>
      </div>

      <div className="card" style={{ padding: 40 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            {company.logo_url && <img src={`${API_BASE}${company.logo_url}`} alt="Logo" style={{ height: 50, marginBottom: 8, objectFit: "contain" }} />}
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", margin: "0 0 4px" }}>{company.company_name || "GlassStore"}</h2>
            {company.address_line1 && <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 2px" }}>{company.address_line1}</p>}
            {company.city && <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 2px" }}>{company.city}, {company.state} — {company.pincode}</p>}
            {company.gstin && <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 2px" }}>GSTIN: {company.gstin}</p>}
            {company.phone && <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>📞 {company.phone}</p>}
          </div>
          <div style={{ textAlign: "right" }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: "#0284c7", margin: "0 0 8px" }}>TAX INVOICE</h1>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", margin: "0 0 4px" }}>#{invoice.invoice_number}</p>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 8px" }}>
              {new Date(invoice.invoice_date).toLocaleDateString("en-IN", { dateStyle: "long" })}
            </p>
            <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 4,
              background: invoice.status === "paid" ? "#dcfce7" : "#fef9c3",
              color: invoice.status === "paid" ? "#166534" : "#854d0e", textTransform: "capitalize" }}>
              {invoice.status.replace("_", " ")}
            </span>
          </div>
        </div>

        {/* Bill To */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 28, padding: 16, background: "#f8fafc", borderRadius: 8 }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Bill To</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", margin: "0 0 2px" }}>{invoice.billing_name}</p>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 2px" }}>{invoice.billing_line1}</p>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 2px" }}>{invoice.billing_city}, {invoice.billing_state} — {invoice.billing_pincode}</p>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>📞 {invoice.billing_phone}</p>
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.1em" }}>GST Info</p>
            <p style={{ fontSize: 13, color: "#475569", margin: "0 0 4px" }}>Type: <strong>{invoice.is_interstate ? "Inter-state (IGST)" : "Intra-state (CGST+SGST)"}</strong></p>
            {invoice.customer_gstin && <p style={{ fontSize: 13, color: "#475569", margin: 0 }}>GSTIN: <strong>{invoice.customer_gstin}</strong></p>}
          </div>
        </div>

        {/* Items */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24, fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#1e293b", color: "white" }}>
              {["#", "Product", "HSN", "Qty", "Rate", "Taxable", "GST", "Total"].map(h => (
                <th key={h} style={{ padding: "10px", textAlign: "left", fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoice.items?.map((item: any, i: number) => (
              <tr key={item.id} style={{ borderBottom: "1px solid #e2e8f0", background: i % 2 === 0 ? "white" : "#f8fafc" }}>
                <td style={{ padding: "10px" }}>{i + 1}</td>
                <td style={{ padding: "10px", fontWeight: 500 }}>{item.product_name}</td>
                <td style={{ padding: "10px", color: "#64748b" }}>{item.hsn_code || "—"}</td>
                <td style={{ padding: "10px" }}>{parseFloat(item.quantity).toFixed(2)} {item.unit}</td>
                <td style={{ padding: "10px" }}>{fmt(item.unit_price)}</td>
                <td style={{ padding: "10px" }}>{fmt(item.taxable_amount)}</td>
                <td style={{ padding: "10px" }}>{invoice.is_interstate ? `${item.igst_rate}% IGST` : `${item.cgst_rate}%+${item.sgst_rate}%`}</td>
                <td style={{ padding: "10px", fontWeight: 600 }}>{fmt(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
          <div style={{ width: 280 }}>
            {[
              { label: "Subtotal", value: fmt(invoice.subtotal) },
              ...(parseFloat(invoice.discount_amount) > 0 ? [{ label: "Discount", value: `−${fmt(invoice.discount_amount)}` }] : []),
              { label: "Taxable Amount", value: fmt(invoice.taxable_amount) },
              ...(parseFloat(invoice.cgst_amount) > 0 ? [{ label: "CGST", value: fmt(invoice.cgst_amount) }] : []),
              ...(parseFloat(invoice.sgst_amount) > 0 ? [{ label: "SGST", value: fmt(invoice.sgst_amount) }] : []),
              ...(parseFloat(invoice.igst_amount) > 0 ? [{ label: "IGST", value: fmt(invoice.igst_amount) }] : []),
            ].map(r => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, color: "#475569", borderBottom: "1px solid #f1f5f9" }}>
                <span>{r.label}</span><span>{r.value}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", fontSize: 17, fontWeight: 700, color: "#1e293b", borderTop: "2px solid #1e293b", marginTop: 4 }}>
              <span>Grand Total</span><span>{fmt(invoice.grand_total)}</span>
            </div>
          </div>
        </div>

        {/* Bank details */}
        {company.bank_name && (
          <div style={{ padding: 14, background: "#f8fafc", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
            <p style={{ fontWeight: 600, color: "#475569", margin: "0 0 6px" }}>Bank Details</p>
            <p style={{ color: "#64748b", margin: "0 0 2px" }}>Bank: {company.bank_name} | A/C: {company.bank_account_number}</p>
            <p style={{ color: "#64748b", margin: 0 }}>IFSC: {company.bank_ifsc} | Branch: {company.bank_branch}</p>
          </div>
        )}

        {/* Terms */}
        {company.invoice_terms && (
          <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 8px" }}><strong>Terms:</strong> {company.invoice_terms}</p>
        )}
        <p style={{ fontSize: 12, color: "#94a3b8", margin: 0, textAlign: "center" }}>
          {company.invoice_footer || "Thank you for your business!"}
        </p>
      </div>

      <style>{`@media print { .no-print { display: none !important; } body { background: white; } .card { box-shadow: none; border: none; } }`}</style>
    </div>
  );
}
