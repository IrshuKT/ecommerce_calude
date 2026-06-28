"use client";
import { useState } from "react";
import api from "@/lib/api";
import PageHeader from "@/components/admin/PageHeader";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("pl");
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split("T")[0]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    setData(null);
    try {
      let res;
      if (activeTab === "pl") res = await api.get(`/reports/profit-loss?from_date=${fromDate}&to_date=${toDate}`);
      else if (activeTab === "tb") res = await api.get(`/reports/trial-balance?as_of_date=${toDate}`);
      else if (activeTab === "bs") res = await api.get(`/reports/balance-sheet?as_of_date=${toDate}`);
      else if (activeTab === "gstr1") res = await api.get(`/gst/gstr1?month=${month}&year=${year}`);
      else if (activeTab === "gstr3b") res = await api.get(`/gst/gstr3b?month=${month}&year=${year}`);
      setData(res?.data);
    } catch (e: any) { alert(e.response?.data?.detail || "Failed to load report"); }
    finally { setLoading(false); }
  };

  const tabs = [
    { key: "pl",     label: "Profit & Loss" },
    { key: "tb",     label: "Trial Balance" },
    { key: "bs",     label: "Balance Sheet" },
    { key: "gstr1",  label: "GSTR-1" },
    { key: "gstr3b", label: "GSTR-3B" },
  ];

  const isGST = activeTab === "gstr1" || activeTab === "gstr3b";

  return (
    <div style={{ padding: 32 }}>
      <PageHeader title="Reports" subtitle="Financial reports and GST returns" />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid #e2e8f0", paddingBottom: 0 }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => { setActiveTab(t.key); setData(null); }} style={{
  padding: "8px 16px",
  fontSize: 14,
  fontWeight: activeTab === t.key ? 600 : 400,
  color: activeTab === t.key ? "#0284c7" : "#64748b",
  background: "transparent",
  border: 0,
  borderBottom:
    activeTab === t.key
      ? "2px solid #0284c7"
      : "2px solid transparent",
  cursor: "pointer",
  marginBottom: -1,
}}>{t.label}</button>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          {isGST ? (
            <>
              <div><label className="label">Month</label>
                <select className="input-field" style={{ width: 140 }} value={month} onChange={(e) => setMonth(parseInt(e.target.value))}>
                  {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div><label className="label">Year</label>
                <input type="number" className="input-field" style={{ width: 100 }} value={year} onChange={(e) => setYear(parseInt(e.target.value))} />
              </div>
            </>
          ) : (
            <>
              <div><label className="label">From Date</label><input type="date" className="input-field" style={{ width: 160 }} value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
              <div><label className="label">To Date</label><input type="date" className="input-field" style={{ width: 160 }} value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
            </>
          )}
          <button className="btn-primary" onClick={fetchReport} disabled={loading}>{loading ? "Loading..." : "Generate"}</button>
        </div>
      </div>

      {/* Report output */}
      {data && (
        <div className="card" style={{ padding: 24 }}>
          {activeTab === "pl" && <PLReport data={data} />}
          {activeTab === "tb" && <TBReport data={data} />}
          {activeTab === "bs" && <BSReport data={data} />}
          {activeTab === "gstr1" && <GSTR1Report data={data} />}
          {activeTab === "gstr3b" && <GSTR3BReport data={data} />}
        </div>
      )}
    </div>
  );
}

const fmt = (n: any) => `₹${parseFloat(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

function Section({ title, items, total, color = "#1e293b" }: any) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color, borderBottom: "1px solid #e2e8f0", paddingBottom: 8, marginBottom: 12 }}>{title}</h3>
      {items?.map((item: any) => (
        <div key={item.code} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 14, color: "#475569" }}>
          <span>{item.code} — {item.name}</span>
          <span style={{ fontWeight: 500 }}>{fmt(item.amount || item.balance)}</span>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 15, fontWeight: 700, borderTop: "1px solid #e2e8f0", marginTop: 8, color }}>
        <span>Total {title}</span><span>{fmt(total)}</span>
      </div>
    </div>
  );
}

function PLReport({ data }: any) {
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Profit & Loss Statement</h2>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>{data.period?.from} to {data.period?.to}</p>
      <Section title="Income" items={data.income?.items} total={data.income?.total} color="#16a34a" />
      <Section title="Expenses" items={data.expenses?.items} total={data.expenses?.total} color="#dc2626" />
      <div style={{ padding: 16, borderRadius: 10, background: data.is_profit ? "#f0fdf4" : "#fef2f2", marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 700, color: data.is_profit ? "#16a34a" : "#dc2626" }}>
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
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Trial Balance</h2>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>As of {data.as_of_date}</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead><tr style={{ borderBottom: "2px solid #e2e8f0" }}>
          <th style={{ textAlign: "left", padding: "8px 0", color: "#64748b" }}>Account</th>
          <th style={{ textAlign: "right", padding: "8px 0", color: "#64748b" }}>Debit</th>
          <th style={{ textAlign: "right", padding: "8px 0", color: "#64748b" }}>Credit</th>
        </tr></thead>
        <tbody>
          {data.accounts?.map((a: any) => (
            <tr key={a.code} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "7px 0" }}>{a.code} — {a.name}</td>
              <td style={{ textAlign: "right", padding: "7px 0" }}>{a.debit > 0 ? fmt(a.debit) : ""}</td>
              <td style={{ textAlign: "right", padding: "7px 0" }}>{a.credit > 0 ? fmt(a.credit) : ""}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr style={{ borderTop: "2px solid #e2e8f0", fontWeight: 700 }}>
          <td style={{ padding: "8px 0" }}>Total</td>
          <td style={{ textAlign: "right" }}>{fmt(data.total_debit)}</td>
          <td style={{ textAlign: "right" }}>{fmt(data.total_credit)}</td>
        </tr></tfoot>
      </table>
      <p style={{ marginTop: 12, fontSize: 13, color: data.balanced ? "#16a34a" : "#dc2626" }}>
        {data.balanced ? "✓ Books are balanced" : "⚠ Books are not balanced"}
      </p>
    </div>
  );
}

function BSReport({ data }: any) {
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Balance Sheet</h2>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>As of {data.as_of_date}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
        <Section title="Assets" items={data.assets?.items} total={data.assets?.total} color="#0284c7" />
        <div>
          <Section title="Liabilities" items={data.liabilities?.items} total={data.liabilities?.total} color="#dc2626" />
          <Section title="Equity" items={data.equity?.items} total={data.equity?.total} color="#7c3aed" />
        </div>
      </div>
    </div>
  );
}

function GSTR1Report({ data }: any) {
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>GSTR-1 — Outward Supplies</h2>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>Period: {data.period}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total Invoices", value: data.summary?.total_invoices },
          { label: "Taxable Value", value: fmt(data.summary?.total_taxable_value) },
          { label: "Total GST", value: fmt(data.summary?.total_tax) },
          { label: "IGST", value: fmt(data.summary?.total_igst) },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: 16 }}>
            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 4px" }}>{s.label}</p>
            <p style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{s.value}</p>
          </div>
        ))}
      </div>
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>B2C Invoices ({data.b2c_invoices?.length})</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead><tr style={{ borderBottom: "1px solid #e2e8f0", color: "#64748b" }}>
          {["Invoice #","Date","Customer","Taxable","CGST","SGST","IGST","Total"].map(h => <th key={h} style={{ textAlign: "left", padding: "6px 8px" }}>{h}</th>)}
        </tr></thead>
        <tbody>
          {data.b2c_invoices?.map((inv: any) => (
            <tr key={inv.invoice_number} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "6px 8px", fontWeight: 500 }}>{inv.invoice_number}</td>
              <td style={{ padding: "6px 8px" }}>{new Date(inv.invoice_date).toLocaleDateString("en-IN")}</td>
              <td style={{ padding: "6px 8px" }}>{inv.customer_name}</td>
              <td style={{ padding: "6px 8px" }}>{fmt(inv.taxable_value)}</td>
              <td style={{ padding: "6px 8px" }}>{fmt(inv.cgst)}</td>
              <td style={{ padding: "6px 8px" }}>{fmt(inv.sgst)}</td>
              <td style={{ padding: "6px 8px" }}>{fmt(inv.igst)}</td>
              <td style={{ padding: "6px 8px", fontWeight: 600 }}>{fmt(inv.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GSTR3BReport({ data }: any) {
  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>GSTR-3B Summary</h2>
      <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>Period: {data.period}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#16a34a", marginBottom: 16 }}>Outward Supplies (Tax Liability)</h3>
          {[
            { label: "Taxable Value", value: fmt(data.outward_supplies?.taxable_value) },
            { label: "CGST",          value: fmt(data.outward_supplies?.cgst) },
            { label: "SGST",          value: fmt(data.outward_supplies?.sgst) },
            { label: "IGST",          value: fmt(data.outward_supplies?.igst) },
            { label: "Total Tax",     value: fmt(data.outward_supplies?.total_tax) },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14, borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ color: "#475569" }}>{r.label}</span><span style={{ fontWeight: 600 }}>{r.value}</span>
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#0284c7", marginBottom: 16 }}>Input Tax Credit</h3>
          {[
            { label: "CGST ITC", value: fmt(data.input_tax_credit?.cgst) },
            { label: "SGST ITC", value: fmt(data.input_tax_credit?.sgst) },
            { label: "IGST ITC", value: fmt(data.input_tax_credit?.igst) },
            { label: "Total ITC", value: fmt(data.input_tax_credit?.total_itc) },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14, borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ color: "#475569" }}>{r.label}</span><span style={{ fontWeight: 600 }}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 20, padding: 20, borderRadius: 10, background: "#fef9c3", border: "1px solid #fde047" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 700, color: "#854d0e" }}>
          <span>Net Tax Payable</span><span>{fmt(data.net_tax_payable)}</span>
        </div>
      </div>
    </div>
  );
}
