"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCartStore } from "@/store/cart";
import { useAuthStore } from "@/store/auth";
import api from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8000";

interface Address {
  id: number;
  label: string;
  full_name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  state_code: string;
  pincode: string;
  is_default: boolean;
}

const INDIAN_STATES = [
  { name: "Andhra Pradesh", code: "37" }, { name: "Arunachal Pradesh", code: "12" },
  { name: "Assam", code: "18" }, { name: "Bihar", code: "10" },
  { name: "Chhattisgarh", code: "22" }, { name: "Goa", code: "30" },
  { name: "Gujarat", code: "24" }, { name: "Haryana", code: "06" },
  { name: "Himachal Pradesh", code: "02" }, { name: "Jharkhand", code: "20" },
  { name: "Karnataka", code: "29" }, { name: "Kerala", code: "32" },
  { name: "Madhya Pradesh", code: "23" }, { name: "Maharashtra", code: "27" },
  { name: "Manipur", code: "14" }, { name: "Meghalaya", code: "17" },
  { name: "Mizoram", code: "15" }, { name: "Nagaland", code: "13" },
  { name: "Odisha", code: "21" }, { name: "Punjab", code: "03" },
  { name: "Rajasthan", code: "08" }, { name: "Sikkim", code: "11" },
  { name: "Tamil Nadu", code: "33" }, { name: "Telangana", code: "36" },
  { name: "Tripura", code: "16" }, { name: "Uttar Pradesh", code: "09" },
  { name: "Uttarakhand", code: "05" }, { name: "West Bengal", code: "19" },
  { name: "Delhi", code: "07" }, { name: "Jammu & Kashmir", code: "01" },
  { name: "Ladakh", code: "38" }, { name: "Puducherry", code: "34" },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { items, total, clearCart } = useCartStore();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "razorpay">("razorpay");
  const [placing, setPlacing] = useState(false);
  const [step, setStep] = useState<"address" | "payment" | "confirm">("address");

  const [addrForm, setAddrForm] = useState({
    label: "Home", full_name: user?.name || "", phone: "",
    line1: "", line2: "", city: "", state: "Kerala", state_code: "32", pincode: "",
  });
  const [savingAddr, setSavingAddr] = useState(false);

  const subtotal = total();
  const gstAmount = subtotal * 0.18;
  const grandTotal = subtotal + gstAmount;

  useEffect(() => {
    if (!user) { router.replace("/login"); return; }
    if (items.length === 0) { router.replace("/cart"); return; }
    loadAddresses();
  }, [user]);

  const loadAddresses = async () => {
    try {
      const res = await api.get("/users/addresses");
      setAddresses(res.data || []);
      const def = res.data?.find((a: Address) => a.is_default);
      if (def) setSelectedAddressId(def.id);
      else if (res.data?.length) setSelectedAddressId(res.data[0].id);
      else setShowAddressForm(true);
    } catch { setShowAddressForm(true); }
  };

  const saveAddress = async () => {
    setSavingAddr(true);
    try {
      const res = await api.post("/users/addresses", addrForm);
      await loadAddresses();
      setSelectedAddressId(res.data.id);
      setShowAddressForm(false);
    } catch (e: any) { alert(e.response?.data?.detail || "Failed to save address"); }
    finally { setSavingAddr(false); }
  };

  const placeOrder = async () => {
    if (!selectedAddressId) { alert("Please select a delivery address"); return; }
    setPlacing(true);
    try {
      const res = await api.post("/orders/", {
        address_id: selectedAddressId,
        payment_method: paymentMethod,
      });
      const orderNumber = res.data.order_number;
      const orderTotal = res.data.total_amount;

      if (paymentMethod === "cod") {
        clearCart();
        router.push(`/order-success?order=${orderNumber}&method=cod`);
        return;
      }

      // Razorpay
      const rzRes = await api.post("/payments/create-razorpay-order", { order_number: orderNumber });

      const options = {
        key: rzRes.data.key,
        amount: rzRes.data.amount,
        currency: "INR",
        name: "GlassStore",
        description: `Order ${orderNumber}`,
        order_id: rzRes.data.razorpay_order_id,
        handler: async (response: any) => {
          try {
            await api.post("/payments/verify", {
              order_number: orderNumber,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            clearCart();
            router.push(`/order-success?order=${orderNumber}&method=razorpay`);
          } catch { alert("Payment verification failed. Contact support."); }
        },
        prefill: { name: user?.name, },
        theme: { color: "#0284c7" },
        modal: { ondismiss: () => setPlacing(false) },
      };

      if (typeof window !== "undefined" && (window as any).Razorpay) {
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        alert("Razorpay not loaded. Please refresh and try again.");
        setPlacing(false);
      }
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to place order");
      setPlacing(false);
    }
  };

  const selectedAddress = addresses.find(a => a.id === selectedAddressId);
  const inp = { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const };
  const lbl = { fontSize: 13, fontWeight: 500, color: "#475569", display: "block", marginBottom: 5 } as const;

  return (
    <>
      {/* Load Razorpay SDK */}
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1e293b", margin: "0 0 8px" }}>Checkout</h1>

        {/* Steps */}
        <div style={{ display: "flex", gap: 0, marginBottom: 32, borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0" }}>
          {[["address", "1", "Delivery Address"], ["payment", "2", "Payment"], ["confirm", "3", "Confirm"]].map(([s, num, label]) => {
            const isActive = step === s;
            const isDone = (step === "payment" && s === "address") || (step === "confirm" && (s === "address" || s === "payment"));
            return (
              <div key={s} style={{ flex: 1, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, background: isActive ? "#eff6ff" : isDone ? "#f0fdf4" : "white", borderRight: "1px solid #e2e8f0" }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: isActive ? "#0284c7" : isDone ? "#16a34a" : "#e2e8f0", color: isActive || isDone ? "white" : "#94a3b8" }}>
                  {isDone ? "✓" : num}
                </div>
                <span style={{ fontSize: 14, fontWeight: isActive ? 600 : 400, color: isActive ? "#0284c7" : isDone ? "#16a34a" : "#64748b" }}>{label}</span>
              </div>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>
          {/* Left panel */}
          <div>
            {/* STEP 1: Address */}
            {step === "address" && (
              <div className="card" style={{ padding: 24 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 20px" }}>Delivery Address</h2>

                {/* Existing addresses */}
                {addresses.map(addr => (
                  <div key={addr.id} onClick={() => setSelectedAddressId(addr.id)}
                    style={{ padding: 16, borderRadius: 8, border: `2px solid ${selectedAddressId === addr.id ? "#0284c7" : "#e2e8f0"}`, marginBottom: 12, cursor: "pointer", background: selectedAddressId === addr.id ? "#f0f9ff" : "white", transition: "all 0.15s" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, background: "#f1f5f9", padding: "2px 8px", borderRadius: 4, color: "#475569" }}>{addr.label}</span>
                          {addr.is_default && <span style={{ fontSize: 11, background: "#dbeafe", color: "#1d4ed8", padding: "1px 6px", borderRadius: 3, fontWeight: 500 }}>Default</span>}
                        </div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", margin: "0 0 2px" }}>{addr.full_name}</p>
                        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 2px" }}>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</p>
                        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 2px" }}>{addr.city}, {addr.state} — {addr.pincode}</p>
                        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>📞 {addr.phone}</p>
                      </div>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${selectedAddressId === addr.id ? "#0284c7" : "#e2e8f0"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {selectedAddressId === addr.id && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#0284c7" }} />}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add new address */}
                {!showAddressForm ? (
                  <button onClick={() => setShowAddressForm(true)} style={{ width: "100%", padding: "12px", borderRadius: 8, border: "1px dashed #cbd5e1", background: "white", color: "#64748b", cursor: "pointer", fontSize: 14, marginBottom: 16 }}>
                    + Add New Address
                  </button>
                ) : (
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 20, marginBottom: 16 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 16px" }}>New Address</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={lbl}>Label</label>
                        <select style={inp} value={addrForm.label} onChange={e => setAddrForm({ ...addrForm, label: e.target.value })}>
                          {["Home", "Office", "Other"].map(l => <option key={l}>{l}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={lbl}>Full Name *</label>
                        <input style={inp} value={addrForm.full_name} onChange={e => setAddrForm({ ...addrForm, full_name: e.target.value })} placeholder="Full name" />
                      </div>
                      <div>
                        <label style={lbl}>Phone *</label>
                        <input style={inp} value={addrForm.phone} onChange={e => setAddrForm({ ...addrForm, phone: e.target.value })} placeholder="10-digit mobile" maxLength={10} />
                      </div>
                      <div>
                        <label style={lbl}>Pincode *</label>
                        <input style={inp} value={addrForm.pincode} onChange={e => setAddrForm({ ...addrForm, pincode: e.target.value })} placeholder="6-digit pincode" maxLength={6} />
                      </div>
                      <div style={{ gridColumn: "1/-1" }}>
                        <label style={lbl}>Address Line 1 *</label>
                        <input style={inp} value={addrForm.line1} onChange={e => setAddrForm({ ...addrForm, line1: e.target.value })} placeholder="House/Flat no, Street, Area" />
                      </div>
                      <div style={{ gridColumn: "1/-1" }}>
                        <label style={lbl}>Address Line 2</label>
                        <input style={inp} value={addrForm.line2} onChange={e => setAddrForm({ ...addrForm, line2: e.target.value })} placeholder="Landmark (optional)" />
                      </div>
                      <div>
                        <label style={lbl}>City *</label>
                        <input style={inp} value={addrForm.city} onChange={e => setAddrForm({ ...addrForm, city: e.target.value })} placeholder="City" />
                      </div>
                      <div>
                        <label style={lbl}>State *</label>
                        <select style={inp} value={addrForm.state} onChange={e => {
                          const st = INDIAN_STATES.find(s => s.name === e.target.value);
                          setAddrForm({ ...addrForm, state: e.target.value, state_code: st?.code || "" });
                        }}>
                          {INDIAN_STATES.map(s => <option key={s.code} value={s.name}>{s.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                      <button onClick={saveAddress} disabled={savingAddr} style={{ padding: "9px 20px", borderRadius: 7, background: "#0284c7", color: "white", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500 }}>
                        {savingAddr ? "Saving..." : "Save Address"}
                      </button>
                      <button onClick={() => setShowAddressForm(false)} style={{ padding: "9px 16px", borderRadius: 7, border: "1px solid #e2e8f0", background: "white", color: "#64748b", cursor: "pointer", fontSize: 14 }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <button onClick={() => selectedAddressId && setStep("payment")} disabled={!selectedAddressId}
                  style={{ width: "100%", padding: "12px", borderRadius: 8, background: selectedAddressId ? "#0284c7" : "#e2e8f0", color: selectedAddressId ? "white" : "#94a3b8", border: "none", cursor: selectedAddressId ? "pointer" : "not-allowed", fontSize: 15, fontWeight: 600 }}>
                  Continue to Payment →
                </button>
              </div>
            )}

            {/* STEP 2: Payment */}
            {step === "payment" && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Payment Method</h2>
                  <button onClick={() => setStep("address")} style={{ fontSize: 13, color: "#0284c7", background: "none", border: "none", cursor: "pointer" }}>← Change Address</button>
                </div>

                {/* Delivery summary */}
                {selectedAddress && (
                  <div style={{ padding: 12, background: "#f8fafc", borderRadius: 8, marginBottom: 20, fontSize: 13, color: "#475569" }}>
                    <span style={{ fontWeight: 500 }}>Delivering to: </span>
                    {selectedAddress.full_name}, {selectedAddress.line1}, {selectedAddress.city}, {selectedAddress.state} — {selectedAddress.pincode}
                  </div>
                )}

                {/* Payment options */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                  {[
                    { value: "razorpay", label: "Pay Online", desc: "UPI, Cards, Net Banking, Wallets via Razorpay", icon: "💳" },
                    { value: "cod", label: "Cash on Delivery", desc: "Pay when your order arrives", icon: "💵" },
                  ].map(opt => (
                    <div key={opt.value} onClick={() => setPaymentMethod(opt.value as any)}
                      style={{ padding: 16, borderRadius: 8, border: `2px solid ${paymentMethod === opt.value ? "#0284c7" : "#e2e8f0"}`, cursor: "pointer", background: paymentMethod === opt.value ? "#f0f9ff" : "white", display: "flex", alignItems: "center", gap: 14, transition: "all 0.15s" }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${paymentMethod === opt.value ? "#0284c7" : "#e2e8f0"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {paymentMethod === opt.value && <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#0284c7" }} />}
                      </div>
                      <span style={{ fontSize: 22 }}>{opt.icon}</span>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#1e293b" }}>{opt.label}</div>
                        <div style={{ fontSize: 13, color: "#64748b" }}>{opt.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={() => setStep("confirm")}
                  style={{ width: "100%", padding: "12px", borderRadius: 8, background: "#0284c7", color: "white", border: "none", cursor: "pointer", fontSize: 15, fontWeight: 600 }}>
                  Review Order →
                </button>
              </div>
            )}

            {/* STEP 3: Confirm */}
            {step === "confirm" && (
              <div className="card" style={{ padding: 24 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 20px" }}>Review & Place Order</h2>

                {/* Address */}
                <div style={{ marginBottom: 20, padding: 14, background: "#f8fafc", borderRadius: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Delivery Address</span>
                    <button onClick={() => setStep("address")} style={{ fontSize: 12, color: "#0284c7", background: "none", border: "none", cursor: "pointer" }}>Change</button>
                  </div>
                  {selectedAddress && (
                    <p style={{ fontSize: 13, color: "#475569", margin: 0 }}>
                      {selectedAddress.full_name} — {selectedAddress.line1}, {selectedAddress.city}, {selectedAddress.state} {selectedAddress.pincode}
                    </p>
                  )}
                </div>

                {/* Payment */}
                <div style={{ marginBottom: 20, padding: 14, background: "#f8fafc", borderRadius: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Payment Method</span>
                    <button onClick={() => setStep("payment")} style={{ fontSize: 12, color: "#0284c7", background: "none", border: "none", cursor: "pointer" }}>Change</button>
                  </div>
                  <p style={{ fontSize: 13, color: "#475569", margin: 0 }}>
                    {paymentMethod === "razorpay" ? "💳 Pay Online (Razorpay)" : "💵 Cash on Delivery"}
                  </p>
                </div>

                {/* Items */}
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#475569", margin: "0 0 10px" }}>Order Items</p>
                  {items.map(item => (
                    <div key={item.variant_id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475569", marginBottom: 6, padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
                      <span>{item.product_name} × {item.quantity}</span>
                      <span style={{ fontWeight: 500 }}>₹{(item.price * item.quantity).toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>

                <button onClick={placeOrder} disabled={placing}
                  style={{ width: "100%", padding: "14px", borderRadius: 8, background: placing ? "#64748b" : "#16a34a", color: "white", border: "none", cursor: placing ? "not-allowed" : "pointer", fontSize: 16, fontWeight: 700 }}>
                  {placing ? "Placing Order..." : paymentMethod === "cod" ? `Place Order — ₹${grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : `Pay ₹${grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
                </button>

                <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", marginTop: 10 }}>
                  By placing this order you agree to our terms. GST invoice will be generated automatically.
                </p>
              </div>
            )}
          </div>

          {/* Right — Order summary */}
          <div className="card" style={{ padding: 20, position: "sticky", top: 80 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>Order Summary</h3>
            {items.map(item => (
              <div key={item.variant_id} style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center" }}>
                <div style={{ width: 44, height: 44, borderRadius: 6, background: "#f1f5f9", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {item.primary_image
                    ? <img src={`${API_BASE}${item.primary_image}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: 18 }}>🪟</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "#1e293b", margin: "0 0 2px" }}>{item.product_name}</p>
                  <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>Qty: {item.quantity}</p>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600 }}>₹{(item.price * item.quantity).toLocaleString("en-IN")}</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 12, marginTop: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475569", marginBottom: 6 }}>
                <span>Subtotal</span><span>₹{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475569", marginBottom: 10 }}>
                <span>GST (18%)</span><span>₹{gstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                <span>Total</span><span>₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
