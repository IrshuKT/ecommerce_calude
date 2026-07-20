"use client";

import { useState, useEffect, useCallback } from "react";
import staffApi from "@/lib/staffApi";

const fmt = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);

// ─── main component ───────────────────────────────────────────────────────────
export default function OpeningBalancePage() {
  const [tab, setTab] = useState("customer"); // "customer" | "vendor" | "ledger"
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [posted, setPosted] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // form rows
  const [rows, setRows] = useState([
    { party_id: "", amount: "", as_of_date: today(), narration: "" },
  ]);

  function today() {
    return new Date().toISOString().split("T")[0];
  }

  // ── fetch data ───────────────────────────────────────────────────────────
  const fetchPosted = useCallback(async () => {
    try {
      const r = await staffApi.get("/journals/opening-balances");
      setPosted(Array.isArray(r.data) ? r.data : []);
    } catch {
      /* silent */
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      const r = await staffApi.get("/users/?limit=100");
      const data = Array.isArray(r.data) ? r.data : r.data?.items || [];
      setCustomers(data.filter((u) => u.role === "customer"));
    } catch {
      /* silent */
    }
  }, []);

  const fetchVendors = useCallback(async () => {
    try {
      const r = await staffApi.get("/vendors/?limit=100");
      const data = Array.isArray(r.data) ? r.data : r.data?.items || [];
      setVendors(data);
    } catch {
      /* silent */
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const r = await staffApi.get("/journals/accounts/all");
      const data = Array.isArray(r.data) ? r.data : r.data?.items || [];
      // Exclude system/equity accounts — opening balance equity itself
      // shouldn't be picked as the "other side" of its own entry.
      setAccounts(data.filter((a) => a.code !== "3900" && a.is_active));
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    fetchPosted();
    fetchCustomers();
    fetchVendors();
    fetchAccounts();
  }, [fetchPosted, fetchCustomers, fetchVendors, fetchAccounts]);

  // ── form helpers ─────────────────────────────────────────────────────────
  const addRow = () =>
    setRows((r) => [
      ...r,
      { party_id: "", amount: "", as_of_date: today(), narration: "" },
    ]);

  const removeRow = (i) =>
    setRows((r) => r.filter((_, idx) => idx !== i));

  const updateRow = (i, field, value) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));

  const resetForm = () => {
    setRows([{ party_id: "", amount: "", as_of_date: today(), narration: "" }]);
    setError("");
    setSuccess("");
  };

  // ── submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError("");
    setSuccess("");

    // validate
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.party_id) { setError(`Row ${i + 1}: select a ${tab === "ledger" ? "ledger account" : tab}`); return; }
      if (!r.amount || isNaN(r.amount) || Number(r.amount) === 0) {
        setError(`Row ${i + 1}: enter a valid amount`); return;
      }
      if (!r.as_of_date) { setError(`Row ${i + 1}: select a date`); return; }
    }

    const entries = rows.map((r) => ({
      party_type: tab,
      party_id: Number(r.party_id),
      amount: Number(r.amount),
      as_of_date: r.as_of_date,
      narration: r.narration || undefined,
    }));

    setSaving(true);
    try {
      const r = await staffApi.post("/journals/opening-balances", {
        entries,
        as_of_date: rows[0].as_of_date,
      });
      const data = r.data;
      setSuccess(`✓ Posted ${data.posted} opening balance${data.posted > 1 ? "s" : ""} successfully`);
      resetForm();
      fetchPosted();
    } catch (e) {
      setError(e.response?.data?.detail || e.message || "Failed to post");
    } finally {
      setSaving(false);
    }
  };

  // ── delete ───────────────────────────────────────────────────────────────
  const handleDelete = async (journalId, partyName) => {
    if (!confirm(`Delete opening balance for ${partyName}? This will reverse the journal entry.`)) return;
    try {
      await staffApi.delete(`/journals/opening-balances/${journalId}`);
      fetchPosted();
    } catch (e) {
      alert(e.response?.data?.detail || "Delete failed");
    }
  };

  // ── party list for current tab ───────────────────────────────────────────
  const partyList = tab === "customer" ? customers : tab === "vendor" ? vendors : accounts;
  const postedForTab = posted.filter((p) => p.party_type === tab);

  // ── already-posted party ids (to show badge) ────────────────────────────
  const postedIds = new Set(postedForTab.map((p) => String(p.party_id)));

  const tabLabel = { customer: "Customers", vendor: "Vendors", ledger: "Ledger Accounts" }[tab];
  const tabSingular = { customer: "customer", vendor: "vendor", ledger: "ledger account" }[tab];

  const descriptionText = {
    customer: "DR Accounts Receivable → CR Opening Balance Equity",
    vendor: "DR Opening Balance Equity → CR Accounts Payable",
    ledger: "Posted against the account's natural balance side → CR/DR Opening Balance Equity",
  }[tab];

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "24px", maxWidth: "100%", margin: "0 auto", fontFamily: "inherit" }}>

      {/* ── page header ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: 0 }}>
          Opening Balances
        </h1>
        <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 14 }}>
          Set starting balances for customers, vendors, and ledger accounts when migrating to this system
        </p>
      </div>

      {/* ── tab switcher ── */}
      <div style={{ display: "flex", gap: 0, marginBottom: 24, borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0", width: "fit-content" }}>
        {["customer", "vendor", "ledger"].map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); resetForm(); }}
            style={{
              padding: "9px 28px",
              border: "none",
              background: tab === t ? "#0ea5e9" : "#fff",
              color: tab === t ? "#fff" : "#475569",
              fontWeight: tab === t ? 600 : 400,
              fontSize: 14,
              cursor: "pointer",
              textTransform: "capitalize",
              transition: "all 0.15s",
            }}
          >
            {t === "customer" ? "👤 Customers" : t === "vendor" ? "🏭 Vendors" : "📒 Ledger Accounts"}
          </button>
        ))}
      </div>

      {/* ── entry form (full width) ── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#0f172a" }}>
              Add Opening Balance — {tabLabel}
            </h2>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#94a3b8" }}>
              {descriptionText}
            </p>
          </div>

          <div style={{ padding: 20 }}>
            {/* column headers */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 140px 140px 1fr 36px",
              gap: 8, marginBottom: 8,
            }}>
              {[tab === "customer" ? "Customer *" : tab === "vendor" ? "Vendor *" : "Account *", "Amount (₹) *", "As of Date *", "Narration", ""].map((h, i) => (
                <div key={i} style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {h}
                </div>
              ))}
            </div>

            {/* rows */}
            {rows.map((row, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 140px 140px 1fr 36px", gap: 8, marginBottom: 8 }}>

                {/* party select */}
                <select
                  value={row.party_id}
                  onChange={(e) => updateRow(i, "party_id", e.target.value)}
                  style={selectStyle(!!row.party_id)}
                >
                  <option value="">Select {tabSingular}…</option>
                  {partyList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {tab === "ledger" ? `${p.code} — ${p.name}` : p.name} {postedIds.has(String(p.id)) ? "✓" : ""}
                    </option>
                  ))}
                </select>

                {/* amount */}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={row.amount}
                  onChange={(e) => updateRow(i, "amount", e.target.value)}
                  style={inputStyle}
                />

                {/* date */}
                <input
                  type="date"
                  value={row.as_of_date}
                  onChange={(e) => updateRow(i, "as_of_date", e.target.value)}
                  style={inputStyle}
                />

                {/* narration */}
                <input
                  type="text"
                  placeholder={`Opening balance - ${tabSingular} name`}
                  value={row.narration}
                  onChange={(e) => updateRow(i, "narration", e.target.value)}
                  style={inputStyle}
                />

                {/* remove */}
                <button
                  onClick={() => removeRow(i)}
                  disabled={rows.length === 1}
                  style={{
                    border: "1px solid #fca5a5",
                    background: rows.length === 1 ? "#f8fafc" : "#fff5f5",
                    color: rows.length === 1 ? "#cbd5e1" : "#ef4444",
                    borderRadius: 6,
                    cursor: rows.length === 1 ? "default" : "pointer",
                    fontSize: 16,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  ×
                </button>
              </div>
            ))}

            {/* alerts */}
            {error && (
              <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, color: "#dc2626", fontSize: 13, marginTop: 12 }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ padding: "10px 14px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, color: "#16a34a", fontSize: 13, marginTop: 12 }}>
                {success}
              </div>
            )}

            {/* actions */}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={addRow} style={outlineBtn}>
                + Add Row
              </button>
              <button onClick={handleSubmit} disabled={saving} style={primaryBtn}>
                {saving ? "Posting…" : `Post ${rows.length > 1 ? `${rows.length} ` : ""}Opening Balance${rows.length > 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>

      {/* ── posted balances (full width, below form) ── */}
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#0f172a" }}>
              Posted Balances — {tabLabel}
            </h2>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#94a3b8" }}>
              {postedForTab.length} {tabSingular}{postedForTab.length !== 1 ? "s" : ""} with opening balance
            </p>
          </div>
          <span style={{
            background: postedForTab.length > 0 ? "#dbeafe" : "#f1f5f9",
            color: postedForTab.length > 0 ? "#1d4ed8" : "#94a3b8",
            borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 600,
          }}>
            {postedForTab.length}
          </span>
        </div>

        {postedForTab.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
            No opening balances posted yet for {tabLabel.toLowerCase()}
          </div>
        ) : (
          <div style={{ maxHeight: 480, overflowY: "auto" }}>
            {/* header row */}
            <div style={{
              display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 90px",
              padding: "10px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0",
            }}>
              {[tab === "ledger" ? "Account" : "Name", "Voucher #", "Date", "Amount", ""].map((h, i) => (
                <div key={i} style={{
                  fontSize: 11, fontWeight: 600, color: "#94a3b8",
                  textTransform: "uppercase", letterSpacing: "0.04em",
                  textAlign: i === 3 ? "right" : i === 4 ? "center" : "left",
                }}>
                  {h}
                </div>
              ))}
            </div>

            {postedForTab.map((p) => (
              <div key={p.journal_id} style={{
                display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 90px",
                alignItems: "center",
                padding: "12px 20px", borderBottom: "1px solid #f8fafc",
                transition: "background 0.1s",
              }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.party_name}
                </div>
                <div style={{ fontSize: 13, color: "#64748b" }}>
                  {p.voucher_number}
                </div>
                <div style={{ fontSize: 13, color: "#64748b" }}>
                  {p.voucher_date}
                </div>
                <div style={{ textAlign: "right", fontWeight: 700, fontSize: 15, color: "#0ea5e9" }}>
                  {fmt(p.amount)}
                </div>
                <div style={{ textAlign: "center" }}>
                  <button
                    onClick={() => handleDelete(p.journal_id, p.party_name)}
                    style={{
                      background: "none", border: "none", color: "#ef4444",
                      fontSize: 12, cursor: "pointer", padding: "2px 8px",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {/* total */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 20px", background: "#f8fafc", borderTop: "2px solid #e2e8f0",
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Total Opening Balance</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                {fmt(postedForTab.reduce((s, p) => s + p.amount, 0))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── info box ── */}
      <div style={{
        marginTop: 20, padding: "14px 18px", background: "#eff6ff",
        border: "1px solid #bfdbfe", borderRadius: 10, fontSize: 13, color: "#1e40af",
      }}>
        <strong>ℹ️ Note:</strong> Opening balances are posted as journal entries tagged to the selected {tabSingular}.
        {tab !== "ledger" && ` They appear as the first row in the ${tabSingular}'s statement of account.`}
        {" "}Each {tabSingular} can only have one opening balance —
        delete the existing entry before re-posting.
      </div>
    </div>
  );
}

// ─── shared styles ─────────────────────────────────────────────────────────
const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  fontSize: 13,
  color: "#0f172a",
  background: "#fff",
  boxSizing: "border-box",
  outline: "none",
};

const selectStyle = (hasValue) => ({
  ...inputStyle,
  color: hasValue ? "#0f172a" : "#94a3b8",
});

const primaryBtn = {
  padding: "9px 22px",
  background: "#0ea5e9",
  color: "#fff",
  border: "none",
  borderRadius: 7,
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

const outlineBtn = {
  padding: "9px 18px",
  background: "#fff",
  color: "#475569",
  border: "1px solid #e2e8f0",
  borderRadius: 7,
  fontWeight: 500,
  fontSize: 14,
  cursor: "pointer",
};