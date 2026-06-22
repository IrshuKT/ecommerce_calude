interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: string;
  color?: string;
}
export default function StatCard({ label, value, sub, icon, color = "#0284c7" }: StatCardProps) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>{label}</p>
          <p style={{ fontSize: 26, fontWeight: 700, color: "#1e293b", margin: "6px 0 4px" }}>{value}</p>
          {sub && <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>{sub}</p>}
        </div>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
          {icon}
        </div>
      </div>
    </div>
  );
}
