import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useGridFilter } from "../lib/useGridFilter";
import { FilterPopover } from "../components/FilterPopover";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import { RefreshCw, FilterX } from "lucide-react";

const columns = [
  { key: "group", label: "Group Name", width: 170 },
  { key: "item", label: "Item Name", width: 260 },
  { key: "shade", label: "Shade", width: 120 },
  { key: "quantity", label: "Quantity", width: 130, numeric: true },
];

export default function OrderSummary() {
  const [data, setData] = useState(null);
  const grid = useGridFilter(data?.rows || [], columns);

  const load = () => api.orderSummary().then(setData).catch((e) => toast.error(String(e)));
  useEffect(() => { load(); }, []);

  const totalQty = grid.visible.reduce((a, r) => a + r.quantity, 0);

  if (!data) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div data-testid="order-summary-page">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Conference Order Summary</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Item-wise total ordered quantity, grouped by Group + Item + Shade
          </p>
        </div>
        <div className="flex flex-wrap gap-2 uppercase items-center">
          <Input
            data-testid="summary-global-search"
            value={grid.search}
            onChange={(e) => grid.setSearch(e.target.value)}
            placeholder="SEARCH ANY COLUMN"
            className="h-9 w-52 text-xs"
          />
          {grid.activeCount > 0 && (
            <Button variant="outline" data-testid="summary-clear-filters-btn" onClick={grid.clearAll}>
              <FilterX className="h-4 w-4 mr-1" /> CLEAR FILTERS ({grid.activeCount})
            </Button>
          )}
          <Button variant="outline" data-testid="refresh-summary-btn" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-1" /> REFRESH
          </Button>
        </div>
      </div>

      <div className="grid-panel overflow-auto max-h-[72vh] max-w-4xl" data-testid="summary-grid">
        <table className="border-collapse w-max min-w-full">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#3F6F52] text-white">
              <th className="w-12 border-r border-[#2f5540] px-2 py-2 text-xs font-semibold">SR</th>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`border-r border-[#2f5540] px-2 py-2 text-xs font-bold uppercase tracking-wide ${
                    c.numeric ? "text-right" : "text-left"
                  }`}
                  style={{ width: c.width, minWidth: c.width }}
                >
                  {c.label}
                  {grid.sort?.key === c.key && (grid.sort.dir === "asc" ? " ↑" : " ↓")}
                </th>
              ))}
            </tr>
            <tr className="bg-[#eef2f7]">
              <th />
              {columns.map((c) => (
                <th key={c.key} className="border-r border-b border-[#c9d3e0] p-1">
                  <FilterPopover
                    column={c}
                    filter={grid.filters[c.key]}
                    onChange={(f) => grid.setFilter(c.key, f)}
                    rows={data.rows}
                    sort={grid.sort}
                    onSort={grid.setSort}
                    prefix="summary-"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.visible.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="p-4 text-sm text-muted-foreground">
                  Nothing to show.
                </td>
              </tr>
            )}
            {grid.visible.map((r, i) => (
              <tr
                key={`${r.group}-${r.item}-${r.shade}`}
                className="row-hover bg-white"
                data-testid={`summary-row-${i}`}
              >
                <td className="border-r border-b border-[#c9d3e0] text-center text-[10px] text-muted-foreground h-8">
                  {i + 1}
                </td>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`border-r border-b border-[#c9d3e0] px-2 text-sm mono ${
                      c.numeric ? "text-right font-semibold" : ""
                    }`}
                    data-testid={`summary-cell-${i}-${c.key}`}
                  >
                    {String(r[c.key] ?? "").trim() === "" ? "—" : r[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0">
            <tr className="bg-[#0A2540] text-white">
              <td className="px-2 py-2 text-xs">Σ</td>
              <td colSpan={3} className="px-2 py-2 text-xs">{grid.visible.length} lines shown</td>
              <td className="px-2 py-2 text-xs text-right mono" data-testid="summary-total-qty">{totalQty}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
