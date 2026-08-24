import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useGridFilter } from "../lib/useGridFilter";
import { FilterPopover } from "../components/FilterPopover";
import { SheetFrame } from "../components/SheetFrame";
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
    <SheetFrame
      testId="order-summary-page"
      title="Conference Order Summary"
      subtitle="Item-wise total ordered quantity, grouped by Group + Item + Shade"
      actions={
        <>
          <Input
            data-testid="summary-global-search"
            value={grid.search}
            onChange={(e) => grid.setSearch(e.target.value)}
            placeholder="SEARCH ANY COLUMN"
            className="h-8 w-44 text-xs"
          />
          {grid.activeCount > 0 && (
            <Button variant="outline" size="sm" className="h-8 text-[10px]" data-testid="summary-clear-filters-btn" onClick={grid.clearAll}>
              <FilterX className="h-3.5 w-3.5 mr-1" /> CLEAR ({grid.activeCount})
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-8 text-[10px]" data-testid="refresh-summary-btn" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> REFRESH
          </Button>
        </>
      }
    >
      <div className="sheet-scroll" data-testid="summary-grid">
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
            <tr className="bg-[color:var(--sheet-head2)]">
              <th />
              {columns.map((c) => (
                <th key={c.key} className="border-r border-b border-[color:var(--sheet-border)] p-1">
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
                className="row-hover bg-[color:var(--sheet-bg)]"
                data-testid={`summary-row-${i}`}
              >
                <td className="border-r border-b border-[color:var(--sheet-border)] text-center text-[10px] text-muted-foreground h-8">
                  {i + 1}
                </td>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`border-r border-b border-[color:var(--sheet-border)] px-2 text-sm mono ${
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
    </SheetFrame>
  );
}
