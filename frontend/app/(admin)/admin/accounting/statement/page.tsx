"use client";
import { useState } from "react";
import api from "@/lib/api";
import PageHeader from "@/components/admin/PageHeader";

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  "Sales Invoice":   { bg: "#dbeafe", color: "#1d4ed8" },
  "Sales Return":    { bg: "#fef9c3", color: "#854d0e" },
  "Receipt":         { bg: "#dcfce7", color: "#166534" },
  "Purchase":        { bg: "#ede9fe", color: "#6d28d9" },
  "Purchase Return": { bg: "#fce7f3", color: "#9d174d" },
  "Payment":         { bg: "#fee2e2", color: "#991b1b" },
};

export default function StatementPage() {
  const [mode, setMode] = useState<"customer" | "vendor">("customer");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statement, setStatement] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  const loadAll = async () => {
    if (selected) return;
    setSearching(true);
    try {
      const url = mode === "customer" ? `/users/?limit=50` : `/vendors/?limit=50`;
      const r = await api.get(url);
      const data = Array.isArray(r.data) ? r.data : r.data?.items || [];
      const filtered = mode === "customer"
        ? data.filter((u: any) => u.role === "customer")
        : data;
      setSearchResults(filtered.slice(0, 8));
    } catch { }
    finally { setSearching(false); }
  };

  const searchParty = async (q: string) => {
    setSearch(q);
    setSelected(null);
    if (q.length < 2) {
      loadAll();
      return;
    }
    setSearching(true);
    try {
      const url = mode === "customer"
        ? `/users/?search=${q}&limit=8`
        : `/vendors/?search=${q}`;
      const r = await api.get(url);
      const data = Array.isArray(r.data) ? r.data : r.data?.items || [];
      const filtered = mode === "customer"
        ? data.filter((u: any) => u.role === "customer")
        : data;
      setSearchResults(filtered.slice(0, 8));
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  };

  const selectParty = (party: any) => {
    setSelected(party);
    setSearch(party.name);
    setSearchResults([]);
    setStatement(null);
  };

  const loadStatement = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append("from_date", fromDate);
      if (toDate) params.append("to_date", toDate);
      const url = mode === "customer"
        ? `/journals/statement/customer/${selected.id}?${params}`
        : `/journals/statement/vendor/${selected.id}?${params}`;
      const r = await api.get(url);
      setStatement(r.data);
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to load statement");
    } finally { setLoading(false); }
  };

  const fmt = (n: number) => n > 0 ? `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—";
  const inp = { padding: "8px 12px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", outline: "none" };

  return (
    <div style={{ padding: 32 }}>
      <PageHeader title="Statement of Account" subtitle="View transaction history for any customer or vendor" />

      {/* Mode toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {(["customer", "vendor"] as const).map(m => (
          <button key={m}
            onClick={() => { setMode(m); setSelected(null); setSearch(""); setStatement(null); setSearchResults([]); }}
            style={{ padding: "8px 24px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600,
              background: mode === m ? "#0284c7" : "#f1f5f9", color: mode === m ? "white" : "#64748b" }}>
            {m === "customer" ? "👥 Customer" : "🏭 Vendor"}
          </button>
        ))}
      </div>

      {/* Search & filters */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 12, alignItems: "end" }}>
          <div style={{ position: "relative" }}>
            <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>
              Search {mode === "customer" ? "Customer" : "Vendor"} *
            </label>
            <input
              style={{ ...inp, width: "100%", boxSizing: "border-box" as const }}
              value={search}
              onChange={e => searchParty(e.target.value)}
              onFocus={loadAll}
              placeholder={`Type name to search ${mode}...`}
            />
            {searching && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#94a3b8", zIndex: 50, marginTop: 4 }}>
                Searching...
              </div>
            )}
            {!searching && searchResults.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", zIndex: 50, marginTop: 4 }}>
                {searchResults.map((p: any) => (
                  <div key={p.id} onClick={() => selectParty(p)}
                    style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f1f5f9", fontSize: 14 }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={e => (e.currentTarget.style.background = "white")}>
                    <span style={{ fontWeight: 500 }}>{p.name}</span>
                    <span style={{ color: "#94a3b8", fontSize: 12, marginLeft: 8 }}>{p.email || p.code || p.phone}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>From Date</label>
            <input type="date" style={inp} value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>To Date</label>
            <input type="date" style={inp} value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <button onClick={loadStatement} disabled={!selected || loading}
            style={{ padding: "8px 24px", borderRadius: 7, background: selected ? "#0284c7" : "#e2e8f0", color: selected ? "white" : "#94a3b8", border: "none", cursor: selected ? "pointer" : "not-allowed", fontSize: 14, fontWeight: 600, height: 38 }}>
            {loading ? "Loading..." : "Get Statement"}
          </button>
        </div>
      </div>

      {/* Statement */}
      {statement && (
        <>
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", margin: "0 0 4px" }}>
                  {statement.customer?.name || statement.vendor?.name}
                </h2>
                <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
                  {statement.customer?.email || statement.vendor?.code} &nbsp;|&nbsp;
                  {statement.customer?.phone || statement.vendor?.phone}
                </p>
              </div>
              <button onClick={() => window.print()}
                style={{ padding: "8px 16px", borderRadius: 7, border: "1px solid #e2e8f0", background: "white", cursor: "pointer", fontSize: 13, color: "#475569" }}>
                🖨 Print
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 16 }}>
              {mode === "customer" ? <>
                <SummaryCard label="Total Invoiced" value={`₹${statement.summary.total_invoiced.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} color="#1d4ed8" />
                <SummaryCard label="Total Returns" value={`₹${statement.summary.total_returns.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} color="#854d0e" />
                <SummaryCard label="Total Received" value={`₹${statement.summary.total_received.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} color="#166534" />
                <SummaryCard label="Balance Due" value={`₹${statement.summary.closing_balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} color={statement.summary.closing_balance > 0 ? "#dc2626" : "#166534"} />
              </> : <>
                <SummaryCard label="Total Purchases" value={`₹${statement.summary.total_purchases.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} color="#6d28d9" />
                <SummaryCard label="Total Returns" value={`₹${statement.summary.total_returns.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} color="#9d174d" />
                <SummaryCard label="Total Paid" value={`₹${statement.summary.total_paid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} color="#991b1b" />
                <SummaryCard label="Balance Payable" value={`₹${statement.summary.closing_balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`} color={statement.summary.closing_balance > 0 ? "#dc2626" : "#166534"} />
              </>}
            </div>
          </div>

          <div className="card" style={{ overflow: "hidden" }}>
            {statement.transactions.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: "#94a3b8" }}>No transactions found for this period.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Date", "Type", "Reference", "Debit (Dr)", "Credit (Cr)", "Balance"].map(h => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: h === "Debit (Dr)" || h === "Credit (Cr)" || h === "Balance" ? "right" : "left", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {statement.transactions.map((t: any, i: number) => {
                    const c = TYPE_COLORS[t.type] || { bg: "#f1f5f9", color: "#475569" };
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                        onMouseLeave={e => (e.currentTarget.style.background = "white")}>
                        <td style={{ padding: "10px 16px", color: "#64748b" }}>
                          {new Date(t.date).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 4, background: c.bg, color: c.color }}>
                            {t.type}
                          </span>
                        </td>
                        <td style={{ padding: "10px 16px", fontWeight: 500, color: "#1e293b", fontFamily: "monospace" }}>{t.reference}</td>
                        <td style={{ padding: "10px 16px", textAlign: "right", color: "#1d4ed8", fontWeight: t.debit > 0 ? 600 : 400 }}>{fmt(t.debit)}</td>
                        <td style={{ padding: "10px 16px", textAlign: "right", color: "#166534", fontWeight: t.credit > 0 ? 600 : 400 }}>{fmt(t.credit)}</td>
                        <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: t.balance > 0 ? "#dc2626" : t.balance < 0 ? "#166534" : "#64748b" }}>
                          ₹{Math.abs(t.balance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          <span style={{ fontSize: 10, marginLeft: 4, color: "#94a3b8" }}>{t.balance > 0 ? "Dr" : t.balance < 0 ? "Cr" : ""}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid #e2e8f0", background: "#f8fafc" }}>
                    <td colSpan={3} style={{ padding: "10px 16px", fontWeight: 700 }}>Closing Balance</td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: "#1d4ed8" }}>
                      ₹{statement.transactions.reduce((s: number, t: any) => s + t.debit, 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, color: "#166534" }}>
                      ₹{statement.transactions.reduce((s: number, t: any) => s + t.credit, 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 700, fontSize: 15, color: statement.summary.closing_balance > 0 ? "#dc2626" : "#166534" }}>
                      ₹{Math.abs(statement.summary.closing_balance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      <span style={{ fontSize: 11, marginLeft: 4 }}>{statement.summary.closing_balance > 0 ? "Dr" : "Cr"}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: "12px 16px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
      <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 4px" }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 700, color, margin: 0 }}>{value}</p>
    </div>
  );
}