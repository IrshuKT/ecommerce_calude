"use client";

import { useState, useRef, useEffect } from "react";
import posApi from "@/lib/posApi";
import { useSettings } from "@/hooks/useSettings";

// ─── Types ──────────────────────────────────────────────────────────────────

type SearchResult = {
  variant_id: number;
  sku: string;
  product_name: string;
  retail_price: number;
  stock_qty: number;
};

type CartLine = {
  variant_id: number;
  sku: string;
  product_name: string;
  unit_price: number;
  quantity: number;
};

type PaymentLine = {
  method: "cash" | "card" | "upi";
  amount: string;
};

type ReceiptData = {
  sale_number: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  customer_display_name: string;
  items: { product_name: string; sku: string; quantity: number; unit_price: number; line_total: number }[];
  payments: { method: string; amount: number }[];
  created_at: string;
};

type CustomerResult = {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  role: string;
};

// NEW: held sale summary (list) + full detail (resume)
type HeldSaleSummary = {
  sale_number: string;
  total_amount: number;
  customer_display_name: string;
  created_at: string;
};

type HeldSaleDetail = {
  sale_number: string;
  discount_amount: number;
  customer_id: number | null;
  walk_in_name: string | null;
  notes: string | null;
  items: { variant_id: number; sku: string; product_name: string; quantity: number; unit_price: number }[];
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function POSPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState("0");
  const [showCheckout, setShowCheckout] = useState(false);
  const [payments, setPayments] = useState<PaymentLine[]>([{ method: "cash", amount: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const settings = useSettings();

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerTab, setCustomerTab] = useState<"existing" | "walkin">("walkin");
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: number; name: string } | null>(null);
  const [walkInName, setWalkInName] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);

  const customerDisplayName = selectedCustomer?.name || walkInName || "Cash Customer";

  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── NEW: hold-sale state ──────────────────────────────────────────────
  const [activeSaleNumber, setActiveSaleNumber] = useState<string | null>(null); // null = new sale
  const [saving, setSaving] = useState(false);
  const [showHeldModal, setShowHeldModal] = useState(false);
  const [heldSales, setHeldSales] = useState<HeldSaleSummary[]>([]);
  const [loadingHeld, setLoadingHeld] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  function printPreview() {
  setShowPreview(true);
}

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const subtotal = cart.reduce((sum, l) => sum + l.unit_price * l.quantity, 0);
  const discountNum = parseFloat(discount) || 0;
  const total = Math.max(subtotal - discountNum, 0);

  // ─── Search ────────────────────────────────────────────────────────────

  async function handleSearch(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await posApi.get("/pos/products/search", { params: { q: value } });
      setResults(res.data);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || !query.trim()) return;
    try {
      const res = await posApi.get(`/pos/products/barcode/${encodeURIComponent(query.trim())}`);
      addToCart(res.data);
      setQuery("");
      setResults([]);
    } catch {
      if (results.length === 1) {
        addToCart(results[0]);
        setQuery("");
        setResults([]);
      }
    }
  }

  function addToCart(product: SearchResult) {
    setCart((prev) => {
      const existing = prev.find((l) => l.variant_id === product.variant_id);
      if (existing) {
        return prev.map((l) =>
          l.variant_id === product.variant_id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...prev,
        {
          variant_id: product.variant_id,
          sku: product.sku,
          product_name: product.product_name,
          unit_price: product.retail_price,
          quantity: 1,
        },
      ];
    });
    setQuery("");
    setResults([]);
    searchInputRef.current?.focus();
  }

  function updateQty(variant_id: number, quantity: number) {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((l) => l.variant_id !== variant_id));
      return;
    }
    setCart((prev) => prev.map((l) => (l.variant_id === variant_id ? { ...l, quantity } : l)));
  }

  function removeLine(variant_id: number) {
    setCart((prev) => prev.filter((l) => l.variant_id !== variant_id));
  }

  // ─── Customer selection ─────────────────────────────────────────────────

  async function searchCustomers(q: string) {
    setCustomerQuery(q);
    if (q.length < 1) {
      setCustomerResults([]);
      return;
    }
    try {
      const r = await posApi.get(`/users/?limit=50`);
      const data = Array.isArray(r.data) ? r.data : r.data?.items || [];
      const filtered = data.filter(
        (u: CustomerResult) =>
          u.role === "customer" &&
          (u.name?.toLowerCase().includes(q.toLowerCase()) ||
            u.phone?.includes(q) ||
            u.email?.toLowerCase().includes(q.toLowerCase()))
      );
      setCustomerResults(filtered.slice(0, 8));
    } catch {
      setCustomerResults([]);
    }
  }

  function pickCustomer(c: CustomerResult) {
    setSelectedCustomer({ id: c.id, name: c.name });
    setWalkInName("");
    setShowCustomerModal(false);
    setCustomerQuery("");
    setCustomerResults([]);
  }

  function confirmWalkIn() {
    setSelectedCustomer(null);
    setShowCustomerModal(false);
  }

  function resetToCashCustomer() {
    setSelectedCustomer(null);
    setWalkInName("");
    setShowCustomerModal(false);
  }

  // ─── Payments ─────────────────────────────────────────────────────────────

  const paymentsTotal = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const paymentsMatch = Math.abs(paymentsTotal - total) < 0.005;

  function addPaymentLine() {
    setPayments((prev) => [...prev, { method: "cash", amount: "" }]);
  }

  function updatePayment(index: number, patch: Partial<PaymentLine>) {
    setPayments((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function removePayment(index: number) {
    setPayments((prev) => prev.filter((_, i) => i !== index));
  }

  function openCheckout() {
  if (cart.length === 0) return;
  setShowPreview(false); // close preview if it was open
  setPayments([{ method: "cash", amount: total.toFixed(2) }]);
  setError(null);
  setShowCheckout(true);
}

  // ── UPDATED: routes to held-sale checkout endpoint when editing a held sale ──
  async function completeSale() {
    if (!paymentsMatch) {
      setError(`Payments (${paymentsTotal.toFixed(2)}) must equal total (${total.toFixed(2)})`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        items: cart.map((l) => ({
          variant_id: l.variant_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
        })),
        payments: payments.map((p) => ({ method: p.method, amount: parseFloat(p.amount) || 0 })),
        discount_amount: discountNum,
        customer_id: selectedCustomer?.id ?? null,
        walk_in_name: walkInName || null,
      };

      const res = activeSaleNumber
        ? await posApi.post(`/pos/sales/held/${encodeURIComponent(activeSaleNumber)}/checkout`, body)
        : await posApi.post("/pos/sales", body);

      setReceipt(res.data);
      setShowCheckout(false);
      resetSaleState();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to complete sale");
    } finally {
      setSubmitting(false);
    }
  }

  function startNewSale() {
    setReceipt(null);
    searchInputRef.current?.focus();
  }

  // ── NEW: shared reset after checkout / new-sale / discard ──────────────
  function resetSaleState() {
    setCart([]);
    setDiscount("0");
    setSelectedCustomer(null);
    setWalkInName("");
    setActiveSaleNumber(null);
  }

  // ── NEW: Save (hold) the current cart ───────────────────────────────────
  async function saveSale() {
    if (cart.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        items: cart.map((l) => ({
          variant_id: l.variant_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
        })),
        discount_amount: discountNum,
        customer_id: selectedCustomer?.id ?? null,
        walk_in_name: walkInName || null,
      };

      if (activeSaleNumber) {
        await posApi.patch(`/pos/sales/held/${encodeURIComponent(activeSaleNumber)}`, body);
      } else {
        const res = await posApi.post("/pos/sales/hold", body);
        setActiveSaleNumber(res.data.sale_number);
      }
      resetSaleState();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to save sale");
    } finally {
      setSaving(false);
    }
  }

  // ── NEW: Held sales list / resume / discard ─────────────────────────────
  async function openHeldSales() {
    setShowHeldModal(true);
    setLoadingHeld(true);
    try {
      const res = await posApi.get("/pos/sales/held");
      setHeldSales(res.data);
    } catch {
      setHeldSales([]);
    } finally {
      setLoadingHeld(false);
    }
  }

  async function resumeSale(sale_number: string) {
    try {
      const res = await posApi.get<HeldSaleDetail>(`/pos/sales/held/${encodeURIComponent(sale_number)}`);
      const data = res.data;
      setCart(
        data.items.map((i) => ({
          variant_id: i.variant_id,
          sku: i.sku,
          product_name: i.product_name,
          unit_price: i.unit_price,
          quantity: i.quantity,
        }))
      );
      setDiscount(String(data.discount_amount ?? 0));
      setWalkInName(data.walk_in_name || "");
      setSelectedCustomer(
        data.customer_id ? { id: data.customer_id, name: data.walk_in_name || "Customer" } : null
      );
      setActiveSaleNumber(data.sale_number);
      setShowHeldModal(false);
      searchInputRef.current?.focus();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to resume sale");
    }
  }

  async function discardSale(sale_number: string) {
    try {
      await posApi.delete(`/pos/sales/held/${encodeURIComponent(sale_number)}`);
      setHeldSales((prev) => prev.filter((s) => s.sale_number !== sale_number));
      if (activeSaleNumber === sale_number) {
        resetSaleState();
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to discard sale");
    }
  }

  // ─── Receipt view ───────────────────────────────────────────────────────

  if (receipt) {
    return (
      <div className="max-w-md mx-auto py-8 print:py-0">
        <div className="bg-white border rounded-lg p-6 print:border-0 print:shadow-none" id="receipt">
          <h2 className="text-xl font-semibold text-center mb-1">Sale Receipt</h2>
           {settings && (
          <div className="text-center mb-3 pb-2" style={{ borderBottom: "1px dashed #cbd5e1" }}>
            <div className="font-bold text-base">{settings.company_name}</div>
            {settings.address_line1 && (
              <div className="text-xs text-gray-500">
                {settings.address_line1}{settings.city ? `, ${settings.city}` : ""}
              </div>
            )}
            {settings.phone && <div className="text-xs text-gray-500">Ph: {settings.phone}</div>}
            {settings.gstin && <div className="text-xs text-gray-500">GSTIN: {settings.gstin}</div>}
          </div>
        )}
          <p className="text-center text-sm text-gray-500 mb-1">{receipt.sale_number}</p>
          <p className="text-center text-sm text-gray-700 font-medium mb-2">{receipt.customer_display_name}</p>
          <p className="text-xs text-gray-400 mb-4">{new Date(receipt.created_at).toLocaleString()}</p>
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-1">Item</th>
                <th className="py-1 text-right">Qty</th>
                <th className="py-1 text-right">Price</th>
                <th className="py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items.map((i, idx) => (
                <tr key={idx} className="border-b border-dashed">
                  <td className="py-1">{i.product_name}<div className="text-xs text-gray-400">{i.sku}</div></td>
                  <td className="py-1 text-right">{i.quantity}</td>
                  <td className="py-1 text-right">{i.unit_price.toFixed(2)}</td>
                  <td className="py-1 text-right">{i.line_total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
       <div className="space-y-1 text-sm mb-4">
  <div className="flex justify-between"><span>Subtotal</span><span>{receipt.subtotal.toFixed(2)}</span></div>
  {receipt.discount_amount > 0 && (
    <div className="flex justify-between"><span>Discount</span><span>-{receipt.discount_amount.toFixed(2)}</span></div>
  )}
  <div className="flex justify-between"><span>Tax (incl.)</span><span>{(receipt.tax_amount ?? 0).toFixed(2)}</span></div>
  <div className="flex justify-between font-semibold text-base border-t pt-1">
    <span>Total</span><span>{receipt.total_amount.toFixed(2)}</span>
  </div>
</div>
          <div className="text-sm mb-6">
            <div className="text-gray-500 mb-1">Payment</div>
            {receipt.payments.map((p, idx) => (
              <div key={idx} className="flex justify-between capitalize">
                <span>{p.method}</span><span>{p.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-gray-400">Thank you!</p>
        </div>
        <div className="flex gap-3 mt-4 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex-1 bg-gray-800 text-white rounded-lg py-2 font-medium"
          >
            Print
          </button>
          <button
            onClick={startNewSale}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 font-medium"
          >
            New Sale
          </button>
        </div>
      </div>
    );
  }

  // ─── Main POS layout ────────────────────────────────────────────────────

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
      {/* Left: search + cart */}
      <div className="lg:col-span-2 space-y-4">
        {/* NEW: top bar — active sale indicator + Held Sales button */}
        <div className="flex items-center justify-between">
          <div>
            {activeSaleNumber && (
              <span className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 text-sm font-medium px-3 py-1.5 rounded-lg border border-amber-200">
                Editing held sale: {activeSaleNumber}
                <button
                  onClick={() => resetSaleState()}
                  className="text-amber-500 hover:text-amber-700"
                  title="Start a new sale instead"
                >
                  ✕
                </button>
              </span>
            )}
          </div>
          <button
            onClick={openHeldSales}
            className="text-sm font-medium border rounded-lg px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
          >
            🧾 Held Sales
          </button>
        </div>

        <div className="relative">
          <input
            ref={searchInputRef}
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Scan barcode or search product name / SKU..."
            className="w-full border rounded-lg px-4 py-3 text-lg"
            autoFocus
          />
          {results.length > 0 && (
            <div className="absolute z-10 w-full bg-white border rounded-lg mt-1 shadow-lg max-h-72 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={r.variant_id}
                  onClick={() => addToCart(r)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 flex justify-between items-center border-b last:border-0"
                >
                  <div>
                    <div className="font-medium">{r.product_name}</div>
                    <div className="text-xs text-gray-400">{r.sku} · stock {r.stock_qty}</div>
                  </div>
                  <div className="font-medium">{r.retail_price.toFixed(2)}</div>
                </button>
              ))}
            </div>
          )}
          {searching && <div className="absolute right-4 top-3 text-sm text-gray-400">searching…</div>}
        </div>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left px-4 py-2">Item</th>
                <th className="text-right px-4 py-2">Price</th>
                <th className="text-center px-4 py-2">Qty</th>
                <th className="text-right px-4 py-2">Total</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {cart.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-gray-400 py-10">
                    Cart is empty — scan or search to add items
                  </td>
                </tr>
              )}
              {cart.map((line) => (
                <tr key={line.variant_id} className="border-t">
                  <td className="px-4 py-2">
                    <div className="font-medium">{line.product_name}</div>
                    <div className="text-xs text-gray-400">{line.sku}</div>
                  </td>
                  <td className="px-4 py-2 text-right">{line.unit_price.toFixed(2)}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => updateQty(line.variant_id, line.quantity - 1)}
                        className="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200"
                      >
                        −
                      </button>
                      <span className="w-8 text-center">{line.quantity}</span>
                      <button
                        onClick={() => updateQty(line.variant_id, line.quantity + 1)}
                        className="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200"
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right font-medium">
                    {(line.unit_price * line.quantity).toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => removeLine(line.variant_id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right: summary + checkout */}
      <div className="border rounded-lg p-5 h-fit space-y-4">
        <h3 className="font-semibold text-lg">Summary</h3>

        <div className="bg-gray-50 rounded-lg px-3 py-2">
  <div className="text-xs text-gray-400 mb-1">Customer</div>
  {selectedCustomer ? (
    <div className="flex items-center justify-between">
      <span className="font-medium text-sm">{selectedCustomer.name}</span>
      <button onClick={resetToCashCustomer} className="text-blue-600 text-sm">Change</button>
    </div>
  ) : (
    <div className="flex items-center justify-between gap-2">
      <input
        value={walkInName}
        onChange={(e) => setWalkInName(e.target.value)}
        placeholder="Cash Customer"
        className="flex-1 bg-transparent outline-none font-medium text-sm border-b border-transparent focus:border-blue-400"
      />
      <button onClick={() => setShowCustomerModal(true)} className="text-blue-600 text-sm whitespace-nowrap">
        Pick registered
      </button>
    </div>
  )}
</div>

        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span>{subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span>Discount</span>
          <input
            type="number"
            min={0}
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            className="w-24 border rounded px-2 py-1 text-right"
          />
        </div>
        <div className="flex justify-between font-semibold text-lg border-t pt-2">
          <span>Total</span>
          <span>{total.toFixed(2)}</span>
        </div>

        {error && <div className="text-sm text-red-500">{error}</div>}

        {/* NEW: Save + Checkout side by side */}
        <div className="flex gap-2">
          <button
            onClick={saveSale}
            disabled={cart.length === 0 || saving}
            className="flex-1 border border-blue-600 text-blue-600 rounded-lg py-3 font-medium disabled:opacity-40"
          >
            {saving ? "Saving…" : activeSaleNumber ? "Update Save" : "Save"}
          </button>
          <button
            onClick={openCheckout}
            disabled={cart.length === 0}
            className="flex-1 bg-blue-600 text-white rounded-lg py-3 font-medium disabled:opacity-40"
          >
            Checkout
          </button>
        </div>
      </div>

      {/* NEW: Pre-checkout confirmation preview */}
{showPreview && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4 print:static print:bg-white print:p-0">
    <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4 print:shadow-none print:rounded-none" id="preview-slip">
      <div className="flex items-center justify-between print:hidden">
        <h3 className="font-semibold text-lg">Confirm with Customer</h3>
        <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600">✕</button>
      </div>

      <div className="text-center">
        <h2 className="text-lg font-semibold">Order Confirmation</h2>
        <p className="text-xs text-gray-400 mt-1">Not a valid receipt — for confirmation only</p>
        <p className="text-sm text-gray-700 font-medium mt-2">{customerDisplayName}</p>
        {activeSaleNumber && <p className="text-xs text-gray-400">{activeSaleNumber}</p>}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="py-1">Item</th>
            <th className="py-1 text-right">Qty</th>
            <th className="py-1 text-right">Price</th>
            <th className="py-1 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {cart.map((line) => (
            <tr key={line.variant_id} className="border-b border-dashed">
              <td className="py-1">{line.product_name}<div className="text-xs text-gray-400">{line.sku}</div></td>
              <td className="py-1 text-right">{line.quantity}</td>
              <td className="py-1 text-right">{line.unit_price.toFixed(2)}</td>
              <td className="py-1 text-right">{(line.unit_price * line.quantity).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="space-y-1 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span>{subtotal.toFixed(2)}</span></div>
        <div className="flex justify-between"><span>Discount</span><span>-{discountNum.toFixed(2)}</span></div>
        <div className="flex justify-between font-semibold text-base border-t pt-1">
          <span>Total</span><span>{total.toFixed(2)}</span>
        </div>
      </div>

      <p className="text-center text-xs text-gray-400 print:mt-4">Please confirm before payment</p>

      <div className="flex gap-3 pt-2 print:hidden">
        <button onClick={() => setShowPreview(false)} className="flex-1 border rounded-lg py-2 font-medium">
          Close
        </button>
       <button onClick={() => window.print()} className="flex-1 bg-gray-800 text-white rounded-lg py-2 font-medium">
  Print
</button>
      </div>
    </div>
  </div>
)}

      {/* Checkout modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-semibold text-lg">Payment</h3>
            <div className="text-sm text-gray-500">
              Total due: <span className="font-semibold text-gray-900">{total.toFixed(2)}</span>
            </div>

            <div className="space-y-2">
              {payments.map((p, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select
                    value={p.method}
                    onChange={(e) => updatePayment(idx, { method: e.target.value as PaymentLine["method"] })}
                    className="border rounded px-2 py-2 text-sm"
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="upi">UPI</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={p.amount}
                    onChange={(e) => updatePayment(idx, { amount: e.target.value })}
                    placeholder="Amount"
                    className="flex-1 border rounded px-3 py-2 text-sm"
                  />
                  {payments.length > 1 && (
                    <button onClick={() => removePayment(idx)} className="text-red-500 text-sm px-2">
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button onClick={addPaymentLine} className="text-blue-600 text-sm font-medium">
                + Split payment
              </button>
            </div>

            <div className={`text-sm ${paymentsMatch ? "text-green-600" : "text-red-500"}`}>
              Entered: {paymentsTotal.toFixed(2)} / {total.toFixed(2)}
            </div>

            {error && <div className="text-sm text-red-500">{error}</div>}
           <div className="flex justify-center">
  <button
    onClick={printPreview}
    className="text-sm font-medium border rounded-lg px-4 py-2 hover:bg-gray-50"
  >
    🖨️ Preview before confirming
  </button>
</div>


            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowCheckout(false)}
                className="flex-1 border rounded-lg py-2 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={completeSale}
                disabled={submitting || !paymentsMatch}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 font-medium disabled:opacity-40"
              >
                {submitting ? "Processing…" : "Complete Sale"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer picker modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-semibold text-lg">Select Customer</h3>

            <div className="flex gap-2 border-b">
              <button
                onClick={() => setCustomerTab("walkin")}
                className={`px-3 py-2 text-sm font-medium border-b-2 ${
                  customerTab === "walkin" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"
                }`}
              >
                Walk-in name
              </button>
              <button
                onClick={() => setCustomerTab("existing")}
                className={`px-3 py-2 text-sm font-medium border-b-2 ${
                  customerTab === "existing" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"
                }`}
              >
                Existing customer
              </button>
            </div>

            {customerTab === "walkin" ? (
              <div className="space-y-3">
                <input
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                  placeholder="Customer name (optional)"
                  className="w-full border rounded-lg px-3 py-2"
                  autoFocus
                />
                <p className="text-xs text-gray-400">
                  Just a label on the receipt — this won't create a customer record.
                </p>
              </div>
            ) : (
              <div className="relative">
                <input
                  value={customerQuery}
                  onChange={(e) => searchCustomers(e.target.value)}
                  placeholder="Search name, phone, or email..."
                  className="w-full border rounded-lg px-3 py-2"
                  autoFocus
                />
                {customerResults.length > 0 && (
                  <div className="border rounded-lg mt-2 max-h-56 overflow-y-auto">
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => pickCustomer(c)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-0"
                      >
                        <div className="font-medium text-sm">{c.name}</div>
                        <div className="text-xs text-gray-400">{c.phone || c.email}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={resetToCashCustomer}
                className="flex-1 border rounded-lg py-2 text-sm font-medium"
              >
                Use Cash Customer
              </button>
              {customerTab === "walkin" && (
                <button
                  onClick={confirmWalkIn}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium"
                >
                  Confirm
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* NEW: Held Sales modal */}
      {showHeldModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Held Sales</h3>
              <button onClick={() => setShowHeldModal(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>

            {loadingHeld ? (
              <div className="text-center text-gray-400 py-8">Loading…</div>
            ) : heldSales.length === 0 ? (
              <div className="text-center text-gray-400 py-8">No held sales</div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {heldSales.map((s) => (
                  <div
                    key={s.sale_number}
                    className="flex items-center justify-between border rounded-lg px-4 py-3"
                  >
                    <div>
                      <div className="font-medium text-sm">{s.sale_number}</div>
                      <div className="text-xs text-gray-400">
                        {s.customer_display_name} · {new Date(s.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-sm">{s.total_amount.toFixed(2)}</span>
                      <button
                        onClick={() => resumeSale(s.sale_number)}
                        className="text-blue-600 text-sm font-medium"
                      >
                        Resume
                      </button>
                      <button
                        onClick={() => discardSale(s.sale_number)}
                        className="text-red-500 text-sm font-medium"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}