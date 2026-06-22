export default function Alert({ type = "error", message, onClose }: { type?: "error"|"success"|"info"; message: string; onClose?: () => void }) {
  const colors = { error: { bg: "#fef2f2", border: "#fecaca", text: "#b91c1c" }, success: { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d" }, info: { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" } };
  const c = colors[type];
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.bg, color: c.text, fontSize: 14 }}>
      <span style={{ flex: 1 }}>{message}</span>
      {onClose && <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.6, color: "inherit", fontSize: 16 }}>✕</button>}
    </div>
  );
}
