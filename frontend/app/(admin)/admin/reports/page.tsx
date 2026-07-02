"use client";
import { useState,useEffect } from "react";
import api from "@/lib/api";
import Link from "next/link";
import PageHeader from "@/components/admin/PageHeader";

// ─── menu structure ─────────────────────────────────────────────────────────
const MENU = [
  {
    group: "Accounting",
    icon: "📊",
    items: [
      { key: "pl",  label: "Profit & Loss" },
      { key: "tb",  label: "Trial Balance" },
      { key: "bs",  label: "Balance Sheet" },
      { key: "cashbook", label: "Cash Book"  },
      { key: "daybook",  label: "Day Book"   },
      { key: "ledger",   label: "Ledger"     },
    ],
  },
  {
    group: "Inventory",
    icon: "📦",
    items: [
      { key: "stock",      label: "Stock Report"    },
      { key: "stockvalue", label: "Stock Valuation" },
    ],
  },
  {
    group: "GST Returns",
    icon: "🧾",
    items: [
      { key: "gstr1",  label: "GSTR-1"  },
      { key: "gstr3b", label: "GSTR-3B" },
    ],
  },
];

const isGSTTab   = (k: string) => k === "gstr1" || k === "gstr3b";
const isLedger   = (k: string) => k === "ledger";
const isAsOfOnly = (k: string) => k === "tb" || k === "bs" || k === "stockvalue";

const fmt = (n: any) =>
  `₹${parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

// ─── page ────────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const today    = new Date().toISOString().split("T")[0];
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                     .toISOString().split("T")[0];

  // sidebar: which groups are open
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(MENU.map((g) => [g.group, true]))
  );
  const toggleGroup = (g: string) =>
    setOpenGroups((prev) => ({ ...prev, [g]: !prev[g] }));

  const [active,    setActive]    = useState("pl");
  const [fromDate,  setFromDate]  = useState(firstDay);
  const [toDate,    setToDate]    = useState(today);
  const [month,     setMonth]     = useState(new Date().getMonth() + 1);
  const [year,      setYear]      = useState(new Date().getFullYear());
  const [accountId, setAccountId] = useState("");
  const [data,      setData]      = useState<any>(null);
  const [loading,   setLoading]   = useState(false);

  const handleSelect = (key: string) => { setActive(key); setData(null); };
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    api.get("/accounting/accounts")
      .then((r) => {
        console.log("accounts:", r.data); // ← check browser console
        setAccounts(r.data?.accounts ?? []);
      })
      .catch((e) => console.error("accounts fetch failed:", e));
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    setData(null);
    try {
      const params = `from_date=${fromDate}&to_date=${toDate}`;
      const asOf   = `as_of_date=${toDate}`;
      const gst    = `month=${month}&year=${year}`;
      let res;

      if      (active === "pl")         res = await api.get(`/reports/profit-loss?${params}`);
      else if (active === "tb")         res = await api.get(`/reports/trial-balance?${asOf}`);
      else if (active === "bs")         res = await api.get(`/reports/balance-sheet?${asOf}`);
      else if (active === "cashbook")   res = await api.get(`/reports/cash-book?${params}`);
      else if (active === "daybook")    res = await api.get(`/reports/day-book?${params}`);
      else if (active === "ledger") res = await api.get(`/reports/ledger?account_code=${accountId}&${params}`);
      else if (active === "stockvalue") res = await api.get(`/reports/stock-value?${asOf}`);
      else if (active === "gstr1")      res = await api.get(`/gst/gstr1?${gst}`);
      else if (active === "gstr3b")     res = await api.get(`/gst/gstr3b?${gst}`);

      setData(res?.data);
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  const activeLabel =
    MENU.flatMap((g) => g.items).find((i) => i.key === active)?.label ?? "";
  const activeGroup =
    MENU.find((g) => g.items.some((i) => i.key === active))?.group ?? "";

  

  return (
    <div style={{ display: "flex", height: "calc(100vh - 64px)", overflow: "hidden" }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside style={{
        width: 220,
        flexShrink: 0,
        background: "#f8fafc",
        borderRight: "1px solid #e2e8f0",
        overflowY: "auto",
        padding: "16px 0",
      }}>
        <p style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "#94a3b8",
          padding: "0 16px 12px",
          margin: 0,
        }}>Reports</p>

        {MENU.map((group) => {
          const isOpen = openGroups[group.group];
          return (
            <div key={group.group}>
              {/* group header / toggle */}
              <button
                onClick={() => toggleGroup(group.group)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "9px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#334155",
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span>{group.icon}</span>
                  {group.group}
                </span>
                {/* chevron */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"
                  style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* items */}
              {isOpen && group.items.map((item) => {
                const isActive = active === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => handleSelect(item.key)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      width: "100%",
                      padding: "8px 16px 8px 40px",
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? "#0284c7" : "#64748b",
                      background: isActive ? "#e0f2fe" : "transparent",
                      border: 0,
                      borderRight: isActive ? "3px solid #0284c7" : "3px solid transparent",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    {/* dot indicator */}
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: isActive ? "#0284c7" : "#cbd5e1",
                      marginRight: 10, flexShrink: 0,
                    }} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          );
        })}
      </aside>

      {/* ── Main panel ───────────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflowY: "auto", padding: 32 }}>
        {/* breadcrumb */}
        <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 4px" }}>
          Reports › {activeGroup}
        </p>
        <PageHeader title={activeLabel} subtitle="Generate and view financial reports" />

        {/* Filters */}
        <div className="card" style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>

            {isGSTTab(active) ? (
              <>
                <div>
                  <label className="label">Month</label>
                  <select className="input-field" style={{ width: 140 }} value={month}
                    onChange={(e) => setMonth(parseInt(e.target.value))}>
                    {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
                      .map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Year</label>
                  <input type="number" className="input-field" style={{ width: 100 }}
                    value={year} onChange={(e) => setYear(parseInt(e.target.value))} />
                </div>
              </>
            ) : isAsOfOnly(active) ? (
              <div>
                <label className="label">As of Date</label>
                <input type="date" className="input-field" style={{ width: 160 }}
                  value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            ) : (
              <>
                <div>
                  <label className="label">From Date</label>
                  <input type="date" className="input-field" style={{ width: 160 }}
                    value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                </div>
                <div>
                  <label className="label">To Date</label>
                  <input type="date" className="input-field" style={{ width: 160 }}
                    value={toDate} onChange={(e) => setToDate(e.target.value)} />
                </div>
              </>
            )}

            {isLedger(active) && (
  <div>
    <label className="label">Account</label>  {/* ← add this */}
    <select className="input-field" style={{ width: 260 }} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
      <option value="">— Select Account —</option>
      {["asset","liability","equity","income","expense"].map((type) => {
        const group = accounts.filter((a: any) => a.account_type === type);
        if (!group.length) return null;
        return (
          <optgroup key={type} label={type.charAt(0).toUpperCase() + type.slice(1)}>
            {group.map((a: any) => (
              <option key={a.id} value={a.code}>
                {a.code} — {a.name}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  </div>
)}

            <button className="btn-primary" onClick={fetchReport} disabled={loading}>
              {loading ? "Loading…" : "Generate"}
            </button>
          </div>
        </div>

        {/* Report output */}
        {data && (
          <div className="card" style={{ padding: 24 }}>
            {active === "pl"         && <PLReport         data={data} />}
            {active === "tb"         && <TBReport         data={data} />}
            {active === "bs"         && <BSReport         data={data} />}
            {active === "cashbook"   && <CashBookReport   data={data} />}
            {active === "daybook"    && <DayBookReport    data={data} />}
            {active === "ledger"     && <LedgerReport     data={data} />}
            {active === "stock"      && <StockReport      data={data} />}
            {active === "stockvalue" && <StockValueReport data={data} />}
            {active === "gstr1"      && <GSTR1Report      data={data} />}
            {active === "gstr3b"     && <GSTR3BReport     data={data} />}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── shared helpers ──────────────────────────────────────────────────────────
function ReportTable({ headers, rows, footer }: {
  headers: string[];
  rows: any[][];
  footer?: any[];
}) {
  const rightAlign = new Set(["Debit","Credit","Amount","Balance","Dr","Cr","Rate","Value","Total","Qty","Stock"]);
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e2e8f0", background: "#f8fafc" }}>
            {headers.map((h) => (
              <th key={h} style={{
                textAlign: rightAlign.has(h) ? "right" : "left",
                padding: "8px 10px",
                color: "#64748b",
                fontWeight: 600,
                fontSize: 12,
                whiteSpace: "nowrap",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
              {row.map((cell, j) => (
                <td key={j} style={{
                  padding: "7px 10px",
                  textAlign: rightAlign.has(headers[j]) ? "right" : "left",
                }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr style={{ borderTop: "2px solid #e2e8f0", fontWeight: 700, background: "#f8fafc" }}>
              {footer.map((cell, j) => (
                <td key={j} style={{
                  padding: "8px 10px",
                  textAlign: rightAlign.has(headers[j]) ? "right" : "left",
                }}>{cell}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function SummaryCards({ cards }: { cards: { label: string; value: any; color?: string }[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, marginBottom: 24 }}>
      {cards.map((c) => (
        <div key={c.label} style={{ padding: "14px 18px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
          <p style={{ fontSize: 11, color: "#94a3b8", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{c.label}</p>
          <p style={{ fontSize: 17, fontWeight: 700, margin: 0, color: c.color || "#1e293b" }}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

function ReportTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px" }}>{title}</h2>
      <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>{sub}</p>
    </div>
  );
}

function Section({ title, items, total, color = "#1e293b" }: any) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color, borderBottom: "1px solid #e2e8f0", paddingBottom: 8, marginBottom: 10 }}>{title}</h3>
      {items?.map((item: any) => (
        <div key={item.code} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, color: "#475569" }}>
          <span>{item.code} — {item.name}</span>
          <span style={{ fontWeight: 500 }}>{fmt(item.amount ?? item.balance)}</span>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 14, fontWeight: 700, borderTop: "1px solid #e2e8f0", marginTop: 6, color }}>
        <span>Total {title}</span><span>{fmt(total)}</span>
      </div>
    </div>
  );
}

// ─── report components ────────────────────────────────────────────────────────
function PLReport({ data }: any) {
  return (
    <div>
      <ReportTitle title="Profit & Loss Statement" sub={`${data.period?.from} to ${data.period?.to}`} />
      <Section title="Income"   items={data.income?.items}   total={data.income?.total}   color="#16a34a" />
      <Section title="Expenses" items={data.expenses?.items} total={data.expenses?.total} color="#dc2626" />
      <div style={{ padding: 16, borderRadius: 10, background: data.is_profit ? "#f0fdf4" : "#fef2f2" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, fontWeight: 700, color: data.is_profit ? "#16a34a" : "#dc2626" }}>
          <span>Net {data.is_profit ? "Profit" : "Loss"}</span>
          <span>{fmt(Math.abs(data.net_profit))}</span>
        </div>
      </div>
    </div>
  );
}

function TBReport({ data }: any) {
  return (
    <div>
      <ReportTitle title="Trial Balance" sub={`As of ${data.as_of_date}`} />
      <ReportTable
        headers={["Account", "Debit", "Credit"]}
        rows={(data.accounts ?? []).map((a: any) => [
          `${a.code} — ${a.name}`,
          a.debit  > 0 ? fmt(a.debit)  : "",
          a.credit > 0 ? fmt(a.credit) : "",
        ])}
        footer={["Total", fmt(data.total_debit), fmt(data.total_credit)]}
      />
      <p style={{ marginTop: 12, fontSize: 13, color: data.balanced ? "#16a34a" : "#dc2626" }}>
        {data.balanced ? "✓ Books are balanced" : "⚠ Books are not balanced"}
      </p>
    </div>
  );
}

function BSReport({ data }: any) {
  return (
    <div>
      <ReportTitle title="Balance Sheet" sub={`As of ${data.as_of_date}`} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
        <Section title="Assets" items={data.assets?.items} total={data.assets?.total} color="#0284c7" />
        <div>
          <Section title="Liabilities" items={data.liabilities?.items} total={data.liabilities?.total} color="#dc2626" />
          <Section title="Equity"      items={data.equity?.items}      total={data.equity?.total}      color="#7c3aed" />
        </div>
      </div>
    </div>
  );
}

function CashBookReport({ data }: any) {
  return (
    <div>
      <ReportTitle title="Cash Book" sub={`${data.from_date} to ${data.to_date}`} />
      <SummaryCards cards={[
        { label: "Opening Balance", value: fmt(data.opening_balance) },
        { label: "Total Receipts",  value: fmt(data.total_receipts),  color: "#16a34a" },
        { label: "Total Payments",  value: fmt(data.total_payments),  color: "#dc2626" },
        { label: "Closing Balance", value: fmt(data.closing_balance), color: "#0284c7" },
      ]} />
      <ReportTable
        headers={["Date", "Particulars", "Voucher #", "Type", "Debit", "Credit", "Balance"]}
        rows={(data.entries ?? []).map((e: any) => [
          new Date(e.date).toLocaleDateString("en-IN"),
          e.particulars,
          e.voucher_no,
          e.type === "receipt" ? "Receipt" : "Payment",
          e.type === "receipt" ? fmt(e.amount) : "",
          e.type === "payment" ? fmt(e.amount) : "",
          fmt(e.balance),
        ])}
      />
    </div>
  );
}

function DayBookReport({ data }: any) {
  return (
    <div>
      <ReportTitle title="Day Book" sub={`${data.from_date} to ${data.to_date}`} />
      <SummaryCards cards={[
        { label: "Total Entries", value: data.total_entries ?? (data.entries?.length ?? 0) },
        { label: "Total Debit",   value: fmt(data.total_debit),  color: "#0284c7" },
        { label: "Total Credit",  value: fmt(data.total_credit), color: "#7c3aed" },
      ]} />
      <ReportTable
        headers={["Date", "Voucher #", "Type", "Account", "Narration", "Debit", "Credit"]}
        rows={(data.entries ?? []).map((e: any) => [
          new Date(e.date).toLocaleDateString("en-IN"),
          e.voucher_no,
          e.voucher_type,
          e.account_name,
          e.narration,
          e.debit  > 0 ? fmt(e.debit)  : "",
          e.credit > 0 ? fmt(e.credit) : "",
        ])}
        footer={["", "", "", "", "Total", fmt(data.total_debit), fmt(data.total_credit)]}
      />
    </div>
  );
}

function LedgerReport({ data }: any) {
  return (
    <div>
      <ReportTitle title={`Ledger — ${data.account_name ?? ""}`} sub={`${data.from_date} to ${data.to_date}`} />
      <SummaryCards cards={[
        { label: "Opening Balance", value: fmt(data.opening_balance) },
        { label: "Total Debit",     value: fmt(data.total_debit),     color: "#0284c7" },
        { label: "Total Credit",    value: fmt(data.total_credit),    color: "#7c3aed" },
        { label: "Closing Balance", value: fmt(data.closing_balance), color: "#1e293b" },
      ]} />
      <ReportTable
        headers={["Date", "Particulars", "Voucher #", "Debit", "Credit", "Balance"]}
        rows={(data.entries ?? []).map((e: any) => [
          new Date(e.date).toLocaleDateString("en-IN"),
          e.particulars,
          e.voucher_no,
          e.debit  > 0 ? fmt(e.debit)  : "",
          e.credit > 0 ? fmt(e.credit) : "",
          fmt(e.running_balance),
        ])}
        footer={["", "Closing Balance", "", fmt(data.total_debit), fmt(data.total_credit), fmt(data.closing_balance)]}
      />
    </div>
  );
}

function StockReport({ data }: any) {
  return (
    <div>
      <ReportTitle title="Stock Report" sub={`${data.from_date} to ${data.to_date}`} />
      <SummaryCards cards={[
        { label: "Total Products",  value: data.total_variants ?? (data.items?.length ?? 0) },
        { label: "Total In",        value: `${data.total_return_qty ?? 0} units`, color: "#16a34a" },
        { label: "Total Out",       value: `${data.total_sold_qty ?? 0} units`,   color: "#dc2626" },
        { label: "Low Stock Items", value: data.low_stock_count ?? 0,             color: "#f59e0b" },
      ]} />
      <ReportTable
        headers={["Product", "SKU", "Attributes", "Opening", "Sold", "Returned", "Current Stock", "Low Threshold"]}
        rows={(data.items ?? []).map((item: any) => {
          const opening = item.current_stock + item.sold_qty - item.returned_qty;
          return [
            item.product_name,
            item.sku,
            item.attributes || "—",
            opening,
            item.sold_qty,
            item.returned_qty,
            <span key="cs" style={{
              fontWeight: 600,
              color: item.is_low_stock ? "#dc2626" : "#16a34a",
            }}>
              {item.current_stock}
            </span>,
            item.low_threshold,
          ];
        })}
      />
    </div>
  );
}

function StockValueReport({ data }: any) {
  return (
    <div>
      <ReportTitle title="Stock Valuation" sub={`As of ${data.as_of_date}`} />
      <SummaryCards cards={[
        { label: "Total Products", value: data.items?.length ?? 0 },
        { label: "Total Qty",      value: data.total_qty ?? "—" },
        { label: "Total Value",    value: fmt(data.total_value), color: "#0284c7" },
      ]} />
      <ReportTable
        headers={["Product", "SKU", "Attributes", "Qty", "Cost Price", "Retail Price", "Value"]}
        rows={(data.items ?? []).map((item: any) => [
          item.product_name,        
          item.sku,
          item.attributes || "—",  
          item.qty,
          fmt(item.cost_price),     
          fmt(item.retail_price),  
          fmt(item.value),
        ])}
        footer={["", "", "", "", "", "Total", fmt(data.total_value)]}
      />
    </div>
  );
}

function GSTR1Report({ data }: any) {
  return (
    <div>
      <ReportTitle title="GSTR-1 — Outward Supplies" sub={`Period: ${data.period}`} />
      <SummaryCards cards={[
        { label: "Total Invoices", value: data.summary?.total_invoices },
        { label: "Taxable Value",  value: fmt(data.summary?.total_taxable_value) },
        { label: "Total GST",      value: fmt(data.summary?.total_tax) },
        { label: "IGST",           value: fmt(data.summary?.total_igst) },
      ]} />
      <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>B2C Invoices ({data.b2c_invoices?.length})</h3>
      <ReportTable
        headers={["Invoice #", "Date", "Customer", "Taxable", "CGST", "SGST", "IGST", "Total"]}
        rows={(data.b2c_invoices ?? []).map((inv: any) => [
          inv.invoice_number,
          new Date(inv.invoice_date).toLocaleDateString("en-IN"),
          inv.customer_name,
          fmt(inv.taxable_value),
          fmt(inv.cgst),
          fmt(inv.sgst),
          fmt(inv.igst),
          fmt(inv.total),
        ])}
      />
    </div>
  );
}

function GSTR3BReport({ data }: any) {
  return (
    <div>
      <ReportTitle title="GSTR-3B Summary" sub={`Period: ${data.period}`} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div style={{ padding: 20, background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "#16a34a", marginBottom: 16 }}>Outward Supplies (Tax Liability)</h3>
          {[
            { label: "Taxable Value", value: fmt(data.outward_supplies?.taxable_value) },
            { label: "CGST",          value: fmt(data.outward_supplies?.cgst) },
            { label: "SGST",          value: fmt(data.outward_supplies?.sgst) },
            { label: "IGST",          value: fmt(data.outward_supplies?.igst) },
            { label: "Total Tax",     value: fmt(data.outward_supplies?.total_tax) },
          ].map((r) => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ color: "#475569" }}>{r.label}</span>
              <span style={{ fontWeight: 600 }}>{r.value}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: 20, background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "#0284c7", marginBottom: 16 }}>Input Tax Credit</h3>
          {[
            { label: "CGST ITC",  value: fmt(data.input_tax_credit?.cgst) },
            { label: "SGST ITC",  value: fmt(data.input_tax_credit?.sgst) },
            { label: "IGST ITC",  value: fmt(data.input_tax_credit?.igst) },
            { label: "Total ITC", value: fmt(data.input_tax_credit?.total_itc) },
          ].map((r) => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ color: "#475569" }}>{r.label}</span>
              <span style={{ fontWeight: 600 }}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 20, padding: 20, borderRadius: 10, background: "#fef9c3", border: "1px solid #fde047" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, fontWeight: 700, color: "#854d0e" }}>
          <span>Net Tax Payable</span>
          <span>{fmt(data.net_tax_payable)}</span>
        </div>
      </div>
    </div>
  );
}