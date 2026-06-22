interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  width?: number;
}
interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyText?: string;
  keyField?: string;
}
export default function DataTable<T extends Record<string, any>>({ columns, data, loading, emptyText = "No data found", keyField = "id" }: DataTableProps<T>) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
            {columns.map((col) => (
              <th key={col.key} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", width: col.width }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={columns.length} style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading...</td></tr>
          ) : data.length === 0 ? (
            <tr><td colSpan={columns.length} style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>{emptyText}</td></tr>
          ) : data.map((row, i) => (
            <tr key={row[keyField] ?? i} style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.1s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              {columns.map((col) => (
                <td key={col.key} style={{ padding: "12px 16px", color: "#334155", verticalAlign: "middle" }}>
                  {col.render ? col.render(row) : row[col.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
