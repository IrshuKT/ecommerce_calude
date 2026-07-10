"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/store/cart";
import { useAuthStore } from "@/store/auth";
import api from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8000";

export default function CartPage() {
  const { items, loading, hydrated, fetchCart, updateQuantity, removeItem, clearCart, total } = useCartStore();
  const { user } = useAuthStore();
  const router = useRouter();
  const [couponCode, setCouponCode] = useState("");
  const [couponMsg, setCouponMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [discount, setDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (user) fetchCart();
  }, [user]);

  const subtotal = total();
  const gstRate = 0.18;
  const taxableAmount = subtotal - discount;
  const gstAmount = taxableAmount * gstRate;
  const grandTotal = taxableAmount + gstAmount;

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setApplying(true);
    setCouponMsg(null);
    try {
      const res = await api.post("/coupons/validate", {
        code: couponCode.toUpperCase(),
        order_amount: subtotal,
      });
      setDiscount(res.data.discount_amount);
      setAppliedCoupon(couponCode.toUpperCase());
      setCouponMsg({ type: "success", text: `Coupon applied! You save ₹${res.data.discount_amount.toLocaleString("en-IN")}` });
    } catch (e: any) {
      setCouponMsg({ type: "error", text: e.response?.data?.detail || "Invalid coupon code" });
      setDiscount(0);
      setAppliedCoupon("");
    } finally { setApplying(false); }
  };

  const removeCoupon = () => {
    setDiscount(0);
    setAppliedCoupon("");
    setCouponCode("");
    setCouponMsg(null);
  };

  const proceedToCheckout = () => {
    if (!user) { router.push("/login?next=/checkout"); return; }
    router.push("/checkout");
  };

  if (loading && !hydrated) {
    return (
      <div style={{ maxWidth: 600, margin: "80px auto", padding: "0 24px", textAlign: "center", color: "#94a3b8" }}>
        Loading cart...
      </div>
    );
  }

  if (items.length === 0) return (
    <div style={{ maxWidth: 600, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
      <div style={{ fontSize: 72, marginBottom: 16 }}>🛒</div>
      <h2 style={{ fontSize: 22, fontWeight: 600, color: "#1e293b", margin: "0 0 8px" }}>Your cart is empty</h2>
      <p style={{ color: "#64748b", marginBottom: 24 }}>Add some glass products to get started.</p>
      <Link href="/shop" style={{ display: "inline-block", padding: "12px 28px", background: "#0284c7", color: "white", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>
        Browse Products
      </Link>
    </div>
  );

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#1e293b", margin: "0 0 24px" }}>
        Shopping Cart <span style={{ fontSize: 16, color: "#64748b", fontWeight: 400 }}>({items.length} {items.length === 1 ? "item" : "items"})</span>
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
        {/* Cart items */}
        <div>
          <div className="card" style={{ overflow: "hidden" }}>
            {items.map((item, idx) => {
              const area = item.custom_width_ft && item.custom_height_ft
                ? item.custom_width_ft * item.custom_height_ft : null;
              const outOfStock = item.stock_qty != null && item.stock_qty < item.quantity;

              return (
                <div key={item.id} style={{
                  padding: 20, borderBottom: idx < items.length - 1 ? "1px solid #f1f5f9" : "none",
                  display: "flex", gap: 16, alignItems: "flex-start",
                }}>
                  {/* Image */}
                  <div style={{ width: 80, height: 80, borderRadius: 8, overflow: "hidden", background: "#f1f5f9", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {item.primary_image
                      ? <img src={`${API_BASE}${item.primary_image}`} alt={item.product_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontSize: 28 }}>🪟</span>}
                  </div>

                  {/* Details */}
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", margin: "0 0 4px" }}>{item.product_name}</h3>

                    {/* Attributes */}
                    {Object.entries(item.selected_attributes || {}).length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                        {Object.entries(item.selected_attributes).map(([k, v]) => (
                          <span key={k} style={{ fontSize: 11, background: "#f1f5f9", color: "#475569", padding: "2px 8px", borderRadius: 4 }}>
                            {k}: {v}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Dimensions */}
                    {area && (
                      <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 6px" }}>
                        {item.custom_width_ft}ft × {item.custom_height_ft}ft = {area.toFixed(2)} sq.ft
                      </p>
                    )}

                    <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 6px" }}>SKU: {item.sku}</p>

                    {outOfStock && (
                      <p style={{ fontSize: 12, color: "#dc2626", margin: "0 0 8px", fontWeight: 500 }}>
                        Only {item.stock_qty} left in stock — reduce quantity to check out
                      </p>
                    )}

                    {/* Quantity controls */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", border: "1px solid #e2e8f0", borderRadius: 7, overflow: "hidden" }}>
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          style={{ width: 32, height: 32, border: "none", background: "#f8fafc", cursor: "pointer", fontSize: 16, color: "#475569" }}>−</button>
                        <span style={{ width: 36, textAlign: "center", fontSize: 14, fontWeight: 600 }}>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          style={{ width: 32, height: 32, border: "none", background: "#f8fafc", cursor: "pointer", fontSize: 16, color: "#475569" }}>+</button>
                      </div>
                      <button onClick={() => removeItem(item.id)}
                        style={{ fontSize: 13, color: "#dc2626", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        Remove
                      </button>
                    </div>
                  </div>

                  {/* Price */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                      ₹{item.line_total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                    {area ? (
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>₹{item.unit_price}/sqft × {area.toFixed(2)} sqft</div>
                    ) : (
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>₹{item.unit_price} × {item.quantity}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            <Link href="/shop" style={{ fontSize: 14, color: "#0284c7", textDecoration: "none" }}>← Continue Shopping</Link>
            <button onClick={clearCart} style={{ fontSize: 13, color: "#dc2626", background: "none", border: "none", cursor: "pointer" }}>
              Clear Cart
            </button>
          </div>
        </div>

        {/* Order summary */}
        <div>
          <div className="card" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1e293b", margin: "0 0 20px" }}>Order Summary</h2>

            {/* Line items summary */}
            <div style={{ marginBottom: 16 }}>
              {items.map(item => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#475569", marginBottom: 6 }}>
                  <span style={{ flex: 1, marginRight: 8 }}>{item.product_name} × {item.quantity}</span>
                  <span>₹{item.line_total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#475569", marginBottom: 8 }}>
                <span>Subtotal</span>
                <span>₹{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              {discount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#16a34a", marginBottom: 8 }}>
                  <span>Discount ({appliedCoupon})</span>
                  <span>−₹{discount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#475569", marginBottom: 8 }}>
                <span>GST (18%)</span>
                <span>₹{gstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700, color: "#1e293b", paddingTop: 10, borderTop: "1px solid #e2e8f0" }}>
                <span>Total</span>
                <span>₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Coupon */}
            {!appliedCoupon ? (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: "#475569", display: "block", marginBottom: 6 }}>Coupon Code</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 7, border: "1px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", outline: "none", textTransform: "uppercase" }}
                    placeholder="Enter code"
                    value={couponCode}
                    onChange={e => setCouponCode(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === "Enter" && applyCoupon()}
                  />
                  <button onClick={applyCoupon} disabled={applying}
                    style={{ padding: "8px 14px", borderRadius: 7, background: "#0284c7", color: "white", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
                    {applying ? "..." : "Apply"}
                  </button>
                </div>
                {couponMsg && (
                  <p style={{ fontSize: 12, color: couponMsg.type === "success" ? "#16a34a" : "#dc2626", margin: "6px 0 0" }}>
                    {couponMsg.text}
                  </p>
                )}
              </div>
            ) : (
              <div style={{ marginBottom: 16, padding: "10px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#16a34a", fontWeight: 500 }}>✓ {appliedCoupon} applied</span>
                <button onClick={removeCoupon} style={{ fontSize: 12, color: "#94a3b8", background: "none", border: "none", cursor: "pointer" }}>Remove</button>
              </div>
            )}

            <button onClick={proceedToCheckout}
              style={{ width: "100%", padding: "13px", borderRadius: 8, background: "#0284c7", color: "white", border: "none", cursor: "pointer", fontSize: 15, fontWeight: 600 }}>
              {user ? "Proceed to Checkout →" : "Login to Checkout →"}
            </button>

            {!user && (
              <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", marginTop: 10 }}>
                <Link href="/login" style={{ color: "#0284c7" }}>Sign in</Link> or <Link href="/register" style={{ color: "#0284c7" }}>Register</Link> to checkout
              </p>
            )}
          </div>

          {/* Trust badges */}
          <div style={{ marginTop: 16, padding: 16, background: "white", borderRadius: 10, border: "1px solid #e2e8f0" }}>
            {[["🔒", "Secure Checkout"], ["🧾", "GST Invoice Included"], ["📦", "All Kerala Delivery"]].map(([icon, text]) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#475569", marginBottom: 8 }}>
                <span>{icon}</span><span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}