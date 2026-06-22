export default function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="2" y="2" width="6" height="6" rx="1" fill="white" opacity="0.9"/>
          <rect x="10" y="2" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
          <rect x="2" y="10" width="6" height="6" rx="1" fill="white" opacity="0.6"/>
          <rect x="10" y="10" width="6" height="6" rx="1" fill="white" opacity="0.9"/>
        </svg>
      </div>
      <span style={{ fontSize: 18, fontWeight: 600, color: "#1e293b", letterSpacing: "-0.3px" }}>
        Glass<span style={{ color: "#0284c7" }}>Store</span>
      </span>
    </div>
  );
}
