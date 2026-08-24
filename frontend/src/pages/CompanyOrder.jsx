import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import { RefreshCw, FileSpreadsheet, FileText } from "lucide-react";

const columns = [
  { key: "group", label: "Group Name", width: 160 },
  { key: "item", label: "Item Name", width: 240 },
  { key: "shade", label: "Shade", width: 100 },
  { key: "ordered_qty", label: "Ordered Qty", width: 120, numeric: true },
  { key: "stock_qty", label: "In House Stock", width: 130, numeric: true },
  { key: "to_order", label: "Qty To Order", width: 130, numeric: true },
];

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function CompanyOrder() {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({});
  const [pendingOnly, setPendingOnly] = useState(true);

  const load = (pending = pendingOnly) =>
    api.companyOrder(pending).then(setData).catch((e) => toast.error(String(e)));

  useEffect(() => { load(pendingOnly); }, [pendingOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    if (!data) return [];
    const active = Object.entries(filters).filter(([, v]) => v && v.trim());
    return data.rows.filter((r) =>
      active.every(([k, v]) => String(r[k] ?? "").toLowerCase().includes(v.trim().toLowerCase()))
    );
  }, [data, filters]);

  const totals = rows.reduce(
    (a, r) => ({
      ordered: a.ordered + r.ordered_qty,
      stock: a.stock + r.stock_qty,
      order: a.order + r.to_order,
    }),
    { ordered: 0, stock: 0, order: 0 }
  );

  const download = (kind) => {
    window.open(`${API}/company-order/export.${kind}?pending_only=${pendingOnly}`, "_blank");
  };

  if (!data) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div data-testid="company-order-page">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Company Order</h1>
          <p className="text-sm text-muted-foreground mt-1">
            What must be ordered from the company to fulfil every conference order (ordered qty − in house stock)
          </p>
        </div>
        <div className="flex flex-wrap gap-2 uppercase">
          <Button
            variant={pendingOnly ? "default" : "outline"}
            data-testid="pending-only-btn"
            onClick={() => setPendingOnly((p) => !p)}
          >
            {pendingOnly ? "SHOWING SHORTAGE ONLY" : "SHOWING ALL ITEMS"}
          </Button>
          <Button variant="outline" data-testid="export-excel-btn" onClick={() => download("xlsx")}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> EXPORT EXCEL
          </Button>
          <Button variant="outline" data-testid="export-pdf-btn" onClick={() => download("pdf")}>
            <FileText className="h-4 w-4 mr-1" /> EXPORT PDF
          </Button>
          <Button variant="outline" data-testid="refresh-company-btn" onClick={() => load()}>
            <RefreshCw className="h-4 w-4 mr-1" /> REFRESH
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        {[
          ["Lines to order", data.total_lines, "stat-lines"],
          ["Total ordered qty", data.total_ordered, "stat-ordered"],
          ["Total qty to order", data.total_to_order, "stat-to-order"],
        ].map(([label, value, tid]) => (
          <div key={tid} className="grid-panel stat-panel p-4" data-testid={tid}>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="mt-2 text-2xl font-black mono">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid-panel overflow-auto max-h-[65vh]" data-testid="company-grid">
        <table className="border-collapse w-max min-w-full">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#0A2540] text-white">
              <th className="w-12 border-r border-[#123a5c] px-2 py-2 text-xs font-semibold">SR</th>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`border-r border-[#123a5c] px-2 py-2 text-xs font-bold uppercase tracking-wide ${
                    c.numeric ? "text-right" : "text-left"
                  }`}
                  style={{ width: c.width, minWidth: c.width }}
                >
                  {c.label}
                </th>
              ))}
            </tr>
            <tr className="bg-[#eef2f7]">
              <th />
              {columns.map((c) => (
                <th key={c.key} className="border-r border-b border-[#c9d3e0] p-1">
                  <Input
                    data-testid={`company-filter-${c.key}`}
                    value={filters[c.key] || ""}
                    onChange={(e) => setFilters({ ...filters, [c.key]: e.target.value })}
                    placeholder="filter"
                    className="h-7 text-xs"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="p-4 text-sm text-muted-foreground">
                  Nothing to order — in house stock covers every conference order.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr
                key={`${r.group}-${r.item}-${r.shade}`}
                className="row-hover bg-white"
                data-testid={`company-row-${i}`}
              >
                <td className="border-r border-b border-[#c9d3e0] text-center text-[10px] text-muted-foreground h-8">
                  {i + 1}
                </td>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`border-r border-b border-[#c9d3e0] px-2 text-sm mono ${
                      c.numeric ? "text-right" : ""
                    } ${c.key === "to_order" && r.to_order > 0 ? "font-bold text-[#0066FF]" : ""}`}
                    data-testid={`company-cell-${i}-${c.key}`}
                  >
                    {String(r[c.key] ?? "").trim() === "" ? "—" : r[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0">
            <tr className="bg-[#3F6F52] text-white">
              <td className="px-2 py-2 text-xs">Σ</td>
              <td colSpan={3} className="px-2 py-2 text-xs">{rows.length} lines shown</td>
              <td className="px-2 py-2 text-xs text-right mono" data-testid="company-total-ordered">{totals.ordered}</td>
              <td className="px-2 py-2 text-xs text-right mono" data-testid="company-total-stock">{totals.stock}</td>
              <td className="px-2 py-2 text-xs text-right mono" data-testid="company-total-to-order">{totals.order}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
