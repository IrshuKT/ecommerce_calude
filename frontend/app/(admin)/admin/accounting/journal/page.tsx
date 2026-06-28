"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import PageHeader from "@/components/admin/PageHeader";

const VOUCHER_COLORS: Record<string, { bg: string; color: string }> = {
  sales_invoice:    { bg: "#dbeafe", color: "#1d4ed8" },
  sales_return:     { bg: "#fef9c3", color: "#854d0e" },
  purchase_invoice: { bg: "#ede9fe", color: "#6d28d9" },
  purchase_return:  { bg: "#fce7f3", color: "#9d174d" },
  receipt:          { bg: "#dcfce7", color: "#166534" },
  payment:          { bg: "#fee2e2", color: "#991b1b" },
  journal:          { bg: "#f1f5f9", color: "#475569" },
};

export default function JournalPage() {
  const [journals, setJournals] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [voucherType, setVoucherType] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [jForm, setJForm] = useState({
    voucher_date: new Date().toISOString().split("T")[0],
    narration: "",
    reference: "",
    voucher_type: "journal"
  });
  const [lines, setLines] = useState([
    { account_code: "", debit: "", credit: "", narration: "" },
    { account_code: "", debit: "", credit: "", narration: "" },
  ]);


  const load = async () => {
    setLoading(true);
    try {
      const [jr, ar] = await Promise.all([
        api.get(`/journals/?limit=100${fromDate ? `&from_date=${fromDate}` : ""}${toDate ? `&to_date=${toDate}` : ""}`).catch(() => ({ data: [] })),
        api.get("/journals/accounts/").catch(() => ({ data: [] })),
      ]);
      setJournals(Array.isArray(jr.data) ? jr.data : jr.data?.items || []);
      setAccounts(Array.isArray(ar.data) ? ar.data : []);
    } catch { setJournals([]); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [fromDate, toDate]);

  const addLine = () => setLines([...lines, { account_code: "", debit: "", credit: "", narration: "" }]);
  const removeLine = (i: number) => lines.length > 2 && setLines(lines.filter((_, idx) => idx !== i));
  const updateLine = (i: number, key: string, val: string) => {
    setLines(lines.map((l, idx) => idx === i ? { ...l, [key]: val } : l));
  };

  const totalDebit = lines.reduce((s, l) => s + parseFloat(l.debit || "0"), 0);
  const totalCredit = lines.reduce((s, l) => s + parseFloat(l.credit || "0"), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const saveJournal = async () => {
    if (!jForm.narration) { alert("Narration is required"); return; }
    if (!isBalanced) { alert(`Journal is not balanced. Difference: ₹${Math.abs(totalDebit - totalCredit).toFixed(2)}`); return; }
    const validLines = lines.filter(l => l.account_code && (parseFloat(l.debit || "0") > 0 || parseFloat(l.credit || "0") > 0));
    if (validLines.length < 2) { alert("At least 2 lines required"); return; }

    setSaving(true);
    try {
      await api.post("/journals/", {
        voucher_date: jForm.voucher_date,
        voucherType: jForm.voucher_type,
        narration: jForm.narration,
        reference: jForm.reference,
        lines: validLines.map(l => ({
          account_code: l.account_code,
          debit: parseFloat(l.debit || "0"),
          credit: parseFloat(l.credit || "0"),
          narration: l.narration,
        })),
      });
      setShowForm(false);
      setLines([{ account_code: "", debit: "", credit: "", narration: "" }, { account_code: "", debit: "", credit: "", narration: "" }]);
      setJForm({ voucher_date: new Date().toISOString().split("T")[0], narration: "", reference: "",voucher_type:"" });
      load();
    } catch (e: any) { alert(e.response?.data?.detail || "Failed to save"); }
    finally { setSaving(false); }
  };

  const fmt = (n: any) => parseFloat(n) > 0 ? `₹${parseFloat(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—";
  const inp = { padding: "8px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" as const };

  return (
    <div style={{ padding: 32 }}>
      <PageHeader title="Journal Entries" subtitle="All double-entry bookkeeping transactions"
        action={<button className="btn-primary" onClick={() => setShowForm(!showForm)}>+ Manual Entry</button>} />

      {/* Manual Journal Form */}
      {showForm && (
        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Manual Journal Entry</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
  <div>
    <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>Voucher Type *</label>
    <select style={inp} value={jForm.voucher_type} onChange={e => setJForm({ ...jForm, voucher_type: e.target.value })}>
      <option value="journal">Journal</option>
      <option value="receipt">Receipt</option>
      <option value="payment">Payment</option>
      <option value="credit_note">Credit Note</option>
      <option value="debit_note">Debit Note</option>
    </select>
  </div>
  <div>
    <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>Date *</label>
    <input type="date" style={inp} value={jForm.voucher_date} onChange={e => setJForm({ ...jForm, voucher_date: e.target.value })} />
  </div>
  <div>
    <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>Reference</label>
    <input style={inp} value={jForm.reference} onChange={e => setJForm({ ...jForm, reference: e.target.value })} placeholder="Eg: Bank stmt ref" />
  </div>
  <div>
    <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>Narration *</label>
    <input style={inp} value={jForm.narration} onChange={e => setJForm({ ...jForm, narration: e.target.value })} placeholder="Purpose of entry" />
  </div>
</div>

          {/* Lines */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                {["Account *", "Narration", "Debit ₹", "Credit ₹", ""].map(h => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748b" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "6px 6px", minWidth: 200 }}>
                    <select style={inp} value={line.account_code} onChange={e => updateLine(i, "account_code", e.target.value)}>
  <option value="">Select account</option>
  {accounts.map((a: any) => (
    <option key={a.id} value={a.code}>{a.code} — {a.name}</option>
  ))}
</select>
                  </td>
                  <td style={{ padding: "6px 6px" }}>
                    <input style={inp} value={line.narration} onChange={e => updateLine(i, "narration", e.target.value)} placeholder="Line note" />
                  </td>
                  <td style={{ padding: "6px 6px", width: 120 }}>
                    <input type="number" style={{ ...inp, background: parseFloat(line.debit || "0") > 0 ? "#eff6ff" : "white" }}
                      value={line.debit} onChange={e => { updateLine(i, "debit", e.target.value); if (e.target.value) updateLine(i, "credit", ""); }}
                      placeholder="0.00" />
                  </td>
                  <td style={{ padding: "6px 6px", width: 120 }}>
                    <input type="number" style={{ ...inp, background: parseFloat(line.credit || "0") > 0 ? "#f0fdf4" : "white" }}
                      value={line.credit} onChange={e => { updateLine(i, "credit", e.target.value); if (e.target.value) updateLine(i, "debit", ""); }}
                      placeholder="0.00" />
                  </td>
                  <td style={{ padding: "6px 6px", width: 40 }}>
                    <button onClick={() => removeLine(i)} disabled={lines.length <= 2}
                      style={{ background: "#fee2e2", border: "none", borderRadius: 5, color: "#dc2626", cursor: lines.length <= 2 ? "not-allowed" : "pointer", padding: "4px 8px", opacity: lines.length <= 2 ? 0.4 : 1 }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #e2e8f0" }}>
                <td colSpan={2} style={{ padding: "8px 10px", fontWeight: 700 }}>Total</td>
                <td style={{ padding: "8px 10px", fontWeight: 700, color: "#0284c7" }}>₹{totalDebit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                <td style={{ padding: "8px 10px", fontWeight: 700, color: "#16a34a" }}>₹{totalCredit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                <td />
              </tr>
              <tr>
                <td colSpan={5} style={{ padding: "4px 10px", fontSize: 13, color: isBalanced ? "#16a34a" : "#dc2626", fontWeight: 500 }}>
                  {isBalanced ? "✓ Balanced" : `⚠ Not balanced — difference ₹${Math.abs(totalDebit - totalCredit).toFixed(2)}`}
                </td>
              </tr>
            </tfoot>
          </table>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={addLine} className="btn-outline" style={{ fontSize: 13 }}>+ Add Line</button>
            <button onClick={saveJournal} disabled={saving || !isBalanced} className="btn-primary">{saving ? "Saving..." : "Post Journal"}</button>
            <button onClick={() => setShowForm(false)} className="btn-outline">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ padding: 16, marginBottom: 20, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>From Date</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", outline: "none" }} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>To Date</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", outline: "none" }} />
        </div>
        <div>
          <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>Type</label>
          <select value={voucherType} onChange={e => setVoucherType(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", outline: "none" }}>
            <option value="all">All Types</option>
            {Object.keys(VOUCHER_COLORS).map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <button onClick={() => { setFromDate(""); setToDate(""); setVoucherType("all"); }}
          style={{ padding: "8px 16px", borderRadius: 7, border: "1px solid #e2e8f0", background: "white", color: "#64748b", cursor: "pointer", fontSize: 13 }}>
          Clear
        </button>
      </div>

      {/* Journal list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>Loading...</div>
      ) : journals.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📒</div>
          <p style={{ color: "#64748b" }}>No journal entries yet.</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          {journals
            .filter(j => voucherType === "all" || j.voucher_type === voucherType)
            .map((journal: any) => {
              const c = VOUCHER_COLORS[journal.voucher_type] || VOUCHER_COLORS.journal;
              const isExp = expanded === journal.id;
              const totalDr = (journal.lines || []).reduce((s: number, l: any) => s + parseFloat(l.debit || 0), 0);
              const totalCr = (journal.lines || []).reduce((s: number, l: any) => s + parseFloat(l.credit || 0), 0);

              return (
                <div key={journal.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <div onClick={() => setExpanded(isExp ? null : journal.id)}
                    style={{ padding: "14px 20px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={e => (e.currentTarget.style.background = "white")}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 4, background: c.bg, color: c.color, textTransform: "uppercase", whiteSpace: "nowrap" }}>
                        {journal.voucher_type.replace(/_/g, " ")}
                      </span>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", margin: 0 }}>{journal.voucher_number}</p>
                        {journal.narration && <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>{journal.narration}</p>}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <span style={{ fontSize: 13, color: "#64748b" }}>{new Date(journal.voucher_date).toLocaleDateString("en-IN")}</span>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>₹{totalDr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                      <span style={{ fontSize: 16, color: "#94a3b8", transform: isExp ? "rotate(180deg)" : "none", transition: "transform 0.2s", display: "inline-block" }}>▾</span>
                    </div>
                  </div>

                  {isExp && (
                    <div style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0", padding: "0 20px 16px" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                            {["Account", "Narration", "Debit", "Credit"].map(h => (
                              <th key={h} style={{ textAlign: h === "Debit" || h === "Credit" ? "right" : "left", padding: "6px 10px", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(journal.lines || []).map((line: any, i: number) => (
                            <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "8px 10px", fontWeight: 500 }}>
                                {line.account?.code} — {line.account?.name || `#${line.account_id}`}
                              </td>
                              <td style={{ padding: "8px 10px", color: "#64748b" }}>{line.narration || "—"}</td>
                              <td style={{ padding: "8px 10px", textAlign: "right", color: "#0284c7", fontWeight: parseFloat(line.debit) > 0 ? 600 : 400 }}>{fmt(line.debit)}</td>
                              <td style={{ padding: "8px 10px", textAlign: "right", color: "#16a34a", fontWeight: parseFloat(line.credit) > 0 ? 600 : 400 }}>{fmt(line.credit)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: "2px solid #e2e8f0" }}>
                            <td colSpan={2} style={{ padding: "8px 10px", fontWeight: 700 }}>Total</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#0284c7" }}>₹{totalDr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#16a34a" }}>₹{totalCr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                          </tr>
                          <tr>
                            <td colSpan={4} style={{ padding: "4px 10px", fontSize: 12, color: Math.abs(totalDr - totalCr) < 0.01 ? "#16a34a" : "#dc2626" }}>
                              {Math.abs(totalDr - totalCr) < 0.01 ? "✓ Balanced" : `⚠ Difference: ₹${Math.abs(totalDr - totalCr).toFixed(2)}`}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                      {journal.reference && <p style={{ fontSize: 12, color: "#94a3b8", margin: "8px 10px 0" }}>Reference: {journal.reference}</p>}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}