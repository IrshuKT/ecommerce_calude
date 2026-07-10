"use client";

import { useEffect, useState } from "react";
import posApi from "@/lib/posApi";

type SaleSummary = {
  id: number;
  sale_number: string;
  total_amount: number;
  status: string;
  created_at: string;
};

type SaleDetail = {
  sale_number: string;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  status: string;
  created_at: string;
  items: { product_name: string; sku: string; quantity: number; unit_price: number; line_total: number }[];
  payments: { method: string; amount: number }[];
};

export default function POSHistoryPage() {
  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SaleDetail | null>(null);
  const [voiding, setVoiding] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await posApi.get("/pos/sales");
      setSales(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function openSale(sale_number: string) {
    const res = await posApi.get(`/pos/sales/${encodeURIComponent(sale_number)}`);
    setSelected(res.data);
  }

  async function voidSale() {
    if (!selected) return;
    if (!confirm(`Void sale ${selected.sale_number}? This restocks all items.`)) return;
    setVoiding(true);
    try {
      await posApi.post(`/pos/sales/${encodeURIComponent(selected.sale_number)}/void`);
      setSelected(null);
      load();
    } finally {
      setVoiding(false);
    }
  }

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "#1e293b", margin: 0 }}>POS Sales History</h1>
        <a href="/admin/pos" style={{ fontSize: 13, color: "#0284c7", textDecoration: "none" }}>
          + New Sale
        </a>
      </div>

      <div className="card" style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc", color: "#64748b", textAlign: "left" }}>
              <th style={{ padding: "10px 16px" }}>Sale #</th>
              <th style={{ padding: "10px 16px", textAlign: "right" }}>Total</th>
              <th style={{ padding: "10px 16px" }}>Status</th>
              <th style={{ padding: "10px 16px" }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} style={{ textAlign: "center", padding: 24, color: "#94a3b8" }}>Loading…</td></tr>
            )}
            {!loading && sales.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: "center", padding: 24, color: "#94a3b8" }}>No POS sales yet</td></tr>
            )}
            {sales.map((s) => (
              <tr
                key={s.id}
                onClick={() => openSale(s.sale_number)}
                style={{ borderTop: "1px solid #e2e8f0", cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
              >
                <td style={{ padding: "10px 16px", fontWeight: 500 }}>{s.sale_number}</td>
                <td style={{ padding: "10px 16px", textAlign: "right" }}>{s.total_amount.toFixed(2)}</td>
                <td style={{ padding: "10px 16px" }}>
                  <span style={{
                    padding: "2px 10px", borderRadius: 20, fontSize: 12,
                    background: s.status === "voided" ? "#fee2e2" : "#dcfce7",
                    color: s.status === "voided" ? "#991b1b" : "#166534",
                    textTransform: "capitalize",
                  }}>
                    {s.status}
                  </span>
                </td>
                <td style={{ padding: "10px 16px", color: "#64748b" }}>
                  {new Date(s.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16,
          }}
          onClick={() => setSelected(null)}
        >
          <div
            style={{ background: "white", borderRadius: 12, padding: 24, width: "100%", maxWidth: 420 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 4 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{selected.sale_number}</h3>
              <span style={{
                padding: "2px 10px", borderRadius: 20, fontSize: 12,
                background: selected.status === "voided" ? "#fee2e2" : "#dcfce7",
                color: selected.status === "voided" ? "#991b1b" : "#166534",
                textTransform: "capitalize",
              }}>
                {selected.status}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>
              {new Date(selected.created_at).toLocaleString()}
            </div>

            <table style={{ width: "100%", fontSize: 13, marginBottom: 16 }}>
              <tbody>
                {selected.items.map((i, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px dashed #e2e8f0" }}>
                    <td style={{ padding: "6px 0" }}>
                      {i.product_name}
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{i.sku}</div>
                    </td>
                    <td style={{ padding: "6px 0", textAlign: "center" }}>×{i.quantity}</td>
                    <td style={{ padding: "6px 0", textAlign: "right" }}>{i.line_total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ fontSize: 13, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Subtotal</span><span>{selected.subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Discount</span><span>-{selected.discount_amount.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, fontSize: 15, borderTop: "1px solid #e2e8f0", paddingTop: 4, marginTop: 4 }}>
                <span>Total</span><span>{selected.total_amount.toFixed(2)}</span>
              </div>
            </div>

            <div style={{ fontSize: 13, marginBottom: 20 }}>
              <div style={{ color: "#94a3b8", marginBottom: 4 }}>Payment</div>
              {selected.payments.map((p, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", textTransform: "capitalize" }}>
                  <span>{p.method}</span><span>{p.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setSelected(null)}
                style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid #e2e8f0", background: "white", cursor: "pointer" }}
              >
                Close
              </button>
              {selected.status !== "voided" && (
                <button
                  onClick={voidSale}
                  disabled={voiding}
                  style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", background: "#dc2626", color: "white", cursor: "pointer" }}
                >
                  {voiding ? "Voiding…" : "Void Sale"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
