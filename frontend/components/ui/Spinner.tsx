export default function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = size === "sm" ? 16 : size === "lg" ? 32 : 20;
  return (
    <>
      <div style={{ width: s, height: s, border: `${size === "sm" ? 2 : 3}px solid currentColor`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
