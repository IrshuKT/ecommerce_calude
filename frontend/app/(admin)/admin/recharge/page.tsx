"use client";

import { useEffect, useState } from "react";
import posApi from "@/lib/posApi";

import { useStaffAuthStore } from "@/store/staffAuth";

type Operator = "jio" | "airtel" | "vi" | "bsnl";

type OperatorStats = { balance: number; today_total: number };
type WalletBalances = Record<Operator, OperatorStats>;

const OPERATORS: { key: Operator; label: string; color: string }[] = [
  { key: "jio", label: "Jio", color: "#0284c7" },
  { key: "airtel", label: "Airtel", color: "#dc2626" },
  { key: "vi", label: "Vi", color: "#7c3aed" },
  { key: "bsnl", label: "BSNL", color: "#16a34a" },
];

export default function RechargePage() {
  const staffUser = useStaffAuthStore((s) => s.user);
  const canTopup = staffUser?.role === "admin" || staffUser?.role === "manager";
  const [balances, setBalances] = useState<WalletBalances | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Operator | null>(null);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topupOperator, setTopupOperator] = useState<Operator | null>(null);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupMode, setTopupMode] = useState("cash");
  const [topupNotes, setTopupNotes] = useState("");
  const [topupSubmitting, setTopupSubmitting] = useState(false);
  const [topupError, setTopupError] = useState<string | null>(null);
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [commissionOperator, setCommissionOperator] = useState<Operator>("jio");
  const [commissionAmount, setCommissionAmount] = useState("");
  const [commissionMonth, setCommissionMonth] = useState(new Date().getMonth() + 1);
  const [commissionYear, setCommissionYear] = useState(new Date().getFullYear());
  const [commissionMode, setCommissionMode] = useState("bank_transfer");
  const [commissionNotes, setCommissionNotes] = useState("");
  const [commissionSubmitting, setCommissionSubmitting] = useState(false);
  const [commissionError, setCommissionError] = useState<string | null>(null);

  async function loadBalances() {
    setLoading(true);
    try {
      const res = await posApi.get("/recharge/wallet-balance");
      setBalances(res.data);
    } catch {
      setBalances(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBalances();
  }, []);

  function openOperator(op: Operator) {
    setSelected(op);
    setAmount("");
    setNotes("");
    setError(null);
  }

  async function submitRecharge() {
    if (!selected) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setError("Enter a valid amount");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await posApi.post("/recharge/entries", {
        operator: selected,
        amount: amt,
        notes: notes || null,
      });
      setSelected(null);
      loadBalances();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to save recharge");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitTopup() {
    if (!topupOperator) return;
    const amt = parseFloat(topupAmount);
    if (!amt || amt <= 0) {
      setTopupError("Enter a valid amount");
      return;
    }
    setTopupSubmitting(true);
    setTopupError(null);
    try {
      await posApi.post("/recharge/wallet-topup", {
        operator: topupOperator,
        amount: amt,
        payment_mode: topupMode,
        notes: topupNotes || null,
      });
      setTopupOperator(null);
      loadBalances();
    } catch (err: any) {
      setTopupError(err?.response?.data?.detail || "Failed to top up wallet");
    } finally {
      setTopupSubmitting(false);
    }
  }

  async function submitCommission() {
    const amt = parseFloat(commissionAmount);
    if (!amt || amt <= 0) {
      setCommissionError("Enter a valid amount");
      return;
    }
    setCommissionSubmitting(true);
    setCommissionError(null);
    try {
      await posApi.post("/recharge/commission", {
        operator: commissionOperator,
        amount: amt,
        period_month: commissionMonth,
        period_year: commissionYear,
        payment_mode: commissionMode,
        notes: commissionNotes || null,
      });
      setShowCommissionModal(false);
      setCommissionAmount("");
      setCommissionNotes("");
    } catch (err: any) {
      setCommissionError(err?.response?.data?.detail || "Failed to record commission");
    } finally {
      setCommissionSubmitting(false);
    }
  }


  return (
    <div style={{ padding: 32 }}>
      {showCommissionModal && (
        <div
          className="modal-backdrop"
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16,
          }}
          onClick={() => setShowCommissionModal(false)}
        >
          <div
            style={{ background: "white", borderRadius: 12, padding: 24, width: "100%", maxWidth: 380 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Record Monthly Commission</h3>

            <label style={{ fontSize: 13, fontWeight: 500, color: "#334155", display: "block", marginBottom: 6 }}>
              Operator
            </label>
            <select
              value={commissionOperator}
              onChange={(e) => setCommissionOperator(e.target.value as Operator)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, marginBottom: 12 }}
            >
              {OPERATORS.map((op) => (
                <option key={op.key} value={op.key}>{op.label}</option>
              ))}
            </select>

            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: "#334155", display: "block", marginBottom: 6 }}>
                  Month
                </label>
                <select
                  value={commissionMonth}
                  onChange={(e) => setCommissionMonth(Number(e.target.value))}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Date(2000, m - 1).toLocaleString("default", { month: "long" })}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: "#334155", display: "block", marginBottom: 6 }}>
                  Year
                </label>
                <input
                  type="number"
                  value={commissionYear}
                  onChange={(e) => setCommissionYear(Number(e.target.value))}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14 }}
                />
              </div>
            </div>

            <label style={{ fontSize: 13, fontWeight: 500, color: "#334155", display: "block", marginBottom: 6 }}>
              Amount Received
            </label>
            <input
              type="number"
              min={0}
              value={commissionAmount}
              onChange={(e) => setCommissionAmount(e.target.value)}
              placeholder="0.00"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 15, marginBottom: 12 }}
            />

            <label style={{ fontSize: 13, fontWeight: 500, color: "#334155", display: "block", marginBottom: 6 }}>
              Payment Mode
            </label>
            <select
              value={commissionMode}
              onChange={(e) => setCommissionMode(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, marginBottom: 12 }}
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
            </select>

            <label style={{ fontSize: 13, fontWeight: 500, color: "#334155", display: "block", marginBottom: 6 }}>
              Notes (optional)
            </label>
            <input
              value={commissionNotes}
              onChange={(e) => setCommissionNotes(e.target.value)}
              placeholder="Reference number, distributor name"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, marginBottom: 16 }}
            />

            {commissionError && <div style={{ fontSize: 13, color: "#dc2626", marginBottom: 12 }}>{commissionError}</div>}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowCommissionModal(false)}
                style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #e2e8f0", background: "white", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={submitCommission}
                disabled={commissionSubmitting}
                style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "#16a34a", color: "white", cursor: "pointer", opacity: commissionSubmitting ? 0.6 : 1 }}
              >
                {commissionSubmitting ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "#1e293b", margin: 0 }}>Recharge</h1>
        {canTopup && (
          <button
            onClick={() => {
              setCommissionAmount("");
              setCommissionNotes("");
              setCommissionError(null);
              setShowCommissionModal(true);
            }}
            style={{
              padding: "8px 16px", borderRadius: 8, border: "1px solid #16a34a",
              background: "white", color: "#16a34a", fontSize: 13, fontWeight: 500, cursor: "pointer",
            }}
          >
            💰 Record Monthly Commission
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        {OPERATORS.map((op) => {
          const stats = balances?.[op.key];
          const outOfBalance = stats ? stats.balance <= 0 : false;
          return (
            <div
              key={op.key}
              onClick={() => !loading && !outOfBalance && openOperator(op.key)}
              style={{
                background: "white", border: "1px solid #e2e8f0", borderRadius: 12,
                padding: 20, cursor: outOfBalance ? "not-allowed" : "pointer",
                opacity: outOfBalance ? 0.6 : 1,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { if (!outOfBalance) (e.currentTarget as HTMLElement).style.borderColor = op.color; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, background: `${op.color}15`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: op.color, fontWeight: 700, fontSize: 14,
                }}>
                  {op.label.charAt(0)}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#1e293b" }}>{op.label}</div>
              </div>

              {loading ? (
                <div style={{ color: "#94a3b8", fontSize: 13 }}>Loading…</div>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 2 }}>Wallet Balance</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: outOfBalance ? "#dc2626" : "#1e293b", marginBottom: 10 }}>
                    ₹{(stats?.balance ?? 0).toFixed(2)}
                  </div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                    Today: <span style={{ color: "#475569", fontWeight: 500 }}>₹{(stats?.today_total ?? 0).toFixed(2)}</span>
                  </div>
                  {outOfBalance && (
                    <div style={{ fontSize: 11, color: "#dc2626", marginTop: 8, fontWeight: 500 }}>
                      Insufficient balance — top up required
                    </div> 
                  )}
                   {canTopup && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTopupOperator(op.key);
                        setTopupAmount("");
                        setTopupNotes("");
                        setTopupError(null);
                      }}
                      style={{
                        marginTop: 10, width: "100%", padding: "6px 0", borderRadius: 6,
                        border: `1px solid ${op.color}`, background: "white", color: op.color,
                        fontSize: 12, fontWeight: 500, cursor: "pointer",
                      }}
                    >
                      + Top up wallet
                    </button>
                  )}
                </>
              )}
              
            </div>
          );
        })}
        
      </div>
 

      {selected && (
        <div
          className="modal-backdrop"
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16,
          }}
          onClick={() => setSelected(null)}
        >
          <div
            style={{ background: "white", borderRadius: 12, padding: 24, width: "100%", maxWidth: 360 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
              {OPERATORS.find((o) => o.key === selected)?.label} Recharge
            </h3>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>
              Balance available: ₹{(balances?.[selected]?.balance ?? 0).toFixed(2)}
            </div>

            <label style={{ fontSize: 13, fontWeight: 500, color: "#334155", display: "block", marginBottom: 6 }}>
              Amount
            </label>
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 15, marginBottom: 12 }}
            />

            <label style={{ fontSize: 13, fontWeight: 500, color: "#334155", display: "block", marginBottom: 6 }}>
              Notes (optional)
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Mobile number / customer name"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, marginBottom: 16 }}
            />

            {error && <div style={{ fontSize: 13, color: "#dc2626", marginBottom: 12 }}>{error}</div>}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setSelected(null)}
                style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #e2e8f0", background: "white", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={submitRecharge}
                disabled={submitting}
                style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "#0284c7", color: "white", cursor: "pointer", opacity: submitting ? 0.6 : 1 }}
              >
                {submitting ? "Saving…" : "Save"}
              </button>
            </div>

          </div>
        </div>
      )}
      {topupOperator && (
        <div
          className="modal-backdrop"
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16,
          }}
          onClick={() => setTopupOperator(null)}
        >
          <div
            style={{ background: "white", borderRadius: 12, padding: 24, width: "100%", maxWidth: 360 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
              Top up {OPERATORS.find((o) => o.key === topupOperator)?.label} Wallet
            </h3>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>
              Current balance: ₹{(balances?.[topupOperator]?.balance ?? 0).toFixed(2)}
            </div>

            <label style={{ fontSize: 13, fontWeight: 500, color: "#334155", display: "block", marginBottom: 6 }}>
              Amount
            </label>
            <input
              type="number"
              min={0}
              value={topupAmount}
              onChange={(e) => setTopupAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 15, marginBottom: 12 }}
            />

            <label style={{ fontSize: 13, fontWeight: 500, color: "#334155", display: "block", marginBottom: 6 }}>
              Payment Mode
            </label>
            <select
              value={topupMode}
              onChange={(e) => setTopupMode(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, marginBottom: 12 }}
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="bank_transfer">Bank Transfer</option>
            </select>

            <label style={{ fontSize: 13, fontWeight: 500, color: "#334155", display: "block", marginBottom: 6 }}>
              Notes (optional)
            </label>
            <input
              value={topupNotes}
              onChange={(e) => setTopupNotes(e.target.value)}
              placeholder="Reference / distributor name"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, marginBottom: 16 }}
            />

            {topupError && <div style={{ fontSize: 13, color: "#dc2626", marginBottom: 12 }}>{topupError}</div>}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setTopupOperator(null)}
                style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1px solid #e2e8f0", background: "white", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={submitTopup}
                disabled={topupSubmitting}
                style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: "#16a34a", color: "white", cursor: "pointer", opacity: topupSubmitting ? 0.6 : 1 }}
              >
                {topupSubmitting ? "Saving…" : "Top up"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}