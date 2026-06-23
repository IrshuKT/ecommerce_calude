import Link from "next/link";

export default function Footer() {
  return (
    <footer style={{ background: "#1e293b", color: "#94a3b8", marginTop: "auto" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 32, marginBottom: 32 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ width: 26, height: 26, borderRadius: 6, background: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                  <rect x="2" y="2" width="6" height="6" rx="1" fill="white" opacity="0.9"/>
                  <rect x="10" y="2" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
                  <rect x="2" y="10" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
                  <rect x="10" y="10" width="6" height="6" rx="1" fill="white" opacity="0.9"/>
                </svg>
              </div>
              <span style={{ fontSize: 16, fontWeight: 600, color: "white" }}>GlassStore</span>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>Premium glass materials for homes, offices and projects across India.</p>
          </div>
          <div>
            <h4 style={{ color: "white", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Shop</h4>
            {[["All Products", "/shop"], ["Featured", "/shop?featured=true"], ["Categories", "/shop"]].map(([label, href]) => (
              <div key={label} style={{ marginBottom: 8 }}><Link href={href} style={{ color: "#94a3b8", textDecoration: "none", fontSize: 13 }}>{label}</Link></div>
            ))}
          </div>
          <div>
            <h4 style={{ color: "white", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Account</h4>
            {[["My Orders", "/account/orders"], ["My Invoices", "/account/invoices"], ["Profile", "/account"]].map(([label, href]) => (
              <div key={label} style={{ marginBottom: 8 }}><Link href={href} style={{ color: "#94a3b8", textDecoration: "none", fontSize: 13 }}>{label}</Link></div>
            ))}
          </div>
          <div>
            <h4 style={{ color: "white", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Contact</h4>
            <p style={{ fontSize: 13, margin: "0 0 6px" }}>📞 +91 98765 43210</p>
            <p style={{ fontSize: 13, margin: "0 0 6px" }}>✉️ hello@glassstore.in</p>
            <p style={{ fontSize: 13, margin: 0 }}>📍 Kerala, India</p>
          </div>
        </div>
        <div style={{ borderTop: "1px solid #334155", paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <p style={{ fontSize: 12, margin: 0 }}>© 2025 GlassStore. All rights reserved.</p>
          <p style={{ fontSize: 12, margin: 0 }}>GST Registered | Pan India Delivery</p>
        </div>
      </div>
    </footer>
  );
}
