interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}
export default function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "#1e293b", margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 14, color: "#64748b", margin: "4px 0 0" }}>{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
