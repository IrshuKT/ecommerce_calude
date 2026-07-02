"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    requested: { bg: "#fef9c3", color: "#854d0e" },
    approved:  { bg: "#dcfce7", color: "#166534" },
    rejected:  { bg: "#fee2e2", color: "#991b1b" },
  };
  const c = colors[status] || { bg: "#f1f5f9", color: "#475569" };
  return (
    <span style={{ padding: "3px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: c.bg, color: c.color, textTransform: "capitalize" }}>
      {status}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9", fontSize: 14 }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ fontWeight: 500, color: "#1e293b", textAlign: "right", maxWidth: "60%" }}>{value}</span>
    </div>
  );
}

export default function SalesReturnDetailPage() {
  const { returnNumber: rawReturnNumber } = useParams();
  const returnNumber = decodeURIComponent(rawReturnNumber as string);
  const router = useRouter();
  const [ret, setRet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (returnNumber) load();
  }, [returnNumber]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/sales-returns/${returnNumber}`);
      setRet(res.data);
    } catch {
      setError("Failed to load return");
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: any) => `₹${parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const approve = async () => {
    if (!window.confirm("Approve this return? This will restock items and post a credit note.")) return;
    setProcessing(true);
    try {
      await api.patch(`/sales-returns/${returnNumber}/approve`, {});
      await load();
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to approve return");
    } finally {
      setProcessing(false);
    }
  };

  const reject = async () => {
    const reason = window.prompt("Reason for rejection (optional):") || "";
    setProcessing(true);
    try {
      await api.patch(`/sales-returns/${returnNumber}/reject`, null, { params: { reason } });
      await load();
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to reject return");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading return...</div>;
  if (!ret) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>{error || "Return not found"}</div>;

  return (
    <div style={{ padding: 32, maxWidth: 1000 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <button onClick={() => router.back()} style={{ fontSize: 13, color: "#475569", background: "none", border: "none", cursor: "pointer", marginBottom: 8 }}>← Back</button>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: 0 }}>Return {ret.return_number}</h1>
        </div>
        <StatusBadge status={ret.status} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#475569", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Return Info</h2>
          <InfoRow label="Return Date" value={new Date(ret.return_date).toLocaleDateString("en-IN")} />
          <InfoRow label="Customer" value={ret.customer?.name || ret.customer_name || "—"} />
          {ret.invoice_id && <InfoRow label="Linked Invoice ID" value={`#${ret.invoice_id}`} />}
          {ret.reason && <InfoRow label="Reason" value={ret.reason} />}
          {ret.credit_note_number && <InfoRow label="Credit Note #" value={ret.credit_note_number} />}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#475569", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Amount Summary</h2>
          <InfoRow label="Subtotal" value={fmt(ret.subtotal)} />
          {parseFloat(ret.cgst_amount) > 0 && <InfoRow label="CGST" value={fmt(ret.cgst_amount)} />}
          {parseFloat(ret.sgst_amount) > 0 && <InfoRow label="SGST" value={fmt(ret.sgst_amount)} />}
          {parseFloat(ret.igst_amount) > 0 && <InfoRow label="IGST" value={fmt(ret.igst_amount)} />}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
            <span>Total</span>
            <span>{fmt(ret.total_amount)}</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: "#475569", margin: "0 0 16px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Returned Items</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
              {["Product", "HSN", "Qty", "Unit Price", "GST %", "Restock", "Total"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ret.items?.map((item: any) => (
              <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "12px 10px", fontWeight: 500, color: "#1e293b" }}>{item.product_name}</td>
                <td style={{ padding: "12px 10px", fontSize: 12, color: "#94a3b8" }}>{item.hsn_code || "—"}</td>
                <td style={{ padding: "12px 10px" }}>{parseFloat(item.quantity)}</td>
                <td style={{ padding: "12px 10px" }}>{fmt(item.unit_price)}</td>
                <td style={{ padding: "12px 10px" }}>{parseFloat(item.gst_rate)}%</td>
                <td style={{ padding: "12px 10px" }}>{item.restock ? "✓" : "—"}</td>
                <td style={{ padding: "12px 10px", fontWeight: 600 }}>{fmt(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ret.status === "requested" && (
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={approve} disabled={processing}
            style={{ padding: "10px 20px", background: processing ? "#93c5fd" : "#0284c7", color: "#fff", border: "none", borderRadius: 7, fontWeight: 600, fontSize: 14, cursor: processing ? "default" : "pointer" }}>
            {processing ? "Processing…" : "✅ Approve Return"}
          </button>
          <button onClick={reject} disabled={processing}
            style={{ padding: "9px 20px", background: "#fff", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 7, fontWeight: 500, fontSize: 13, cursor: processing ? "default" : "pointer" }}>
            🚫 Reject
          </button>
        </div>
      )}
    </div>
  );
}