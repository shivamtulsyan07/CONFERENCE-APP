import { useEffect, useState } from "react";
import { api, errMsg } from "../lib/api";
import { useGridFilter } from "../lib/useGridFilter";
import { FilterPopover } from "../components/FilterPopover";
import { SheetFrame } from "../components/SheetFrame";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import { RefreshCw, FilterX } from "lucide-react";

const columns = [
  { key: "group", label: "Group Name", width: 150 },
  { key: "item", label: "Item", width: 220 },
  { key: "shade", label: "Shade", width: 110 },
  { key: "stock_qty", label: "Stock Qty", width: 120, numeric: true },
  { key: "ordered_qty", label: "Ordered Qty", width: 130, numeric: true },
  { key: "balance", label: "Balance", width: 120, numeric: true },
];

export default function BalanceStock() {
  const [data, setData] = useState(null);
  const [onlyShort, setOnlyShort] = useState(false);
  const grid = useGridFilter(
    (data?.rows || []).filter((r) => (onlyShort ? r.balance < 0 : true)),
    columns
  );

  const load = () => api.balanceStock().then(setData).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []);

  const totals = grid.visible.reduce(
    (a, r) => ({
      stock: a.stock + r.stock_qty,
      ordered: a.ordered + r.ordered_qty,
      balance: a.balance + r.balance,
    }),
    { stock: 0, ordered: 0, balance: 0 }
  );

  if (!data) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <SheetFrame
      testId="balance-stock-page"
      title="Balance Stock"
      subtitle="In House Stock plus order pending with the company, minus Conference Order and Shop Sales (Group + Item + Shade) · red means short"
      actions={
        <>
          <Input
            data-testid="balance-global-search"
            value={grid.search}
            onChange={(e) => grid.setSearch(e.target.value)}
            placeholder="SEARCH ANY COLUMN"
            className="h-8 w-44 text-xs"
          />
          {grid.activeCount > 0 && (
            <Button variant="outline" size="sm" className="h-8 text-[10px]" data-testid="balance-clear-filters-btn" onClick={grid.clearAll}>
              <FilterX className="h-3.5 w-3.5 mr-1" /> CLEAR ({grid.activeCount})
            </Button>
          )}
          <Button variant={onlyShort ? "default" : "outline"} size="sm" className="h-8 text-[10px]" data-testid="only-short-btn" onClick={() => setOnlyShort((s) => !s)}>
            SHORT ONLY ({data.short_lines})
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-[10px]" data-testid="refresh-balance-btn" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> REFRESH
          </Button>
        </>
      }
    >
      <div className="sheet-scroll" data-testid="balance-grid">
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
                    prefix="balance-"
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
                className="row-hover text-[#0A2540]"
                style={{ background: r.balance < 0 ? "#FDECEA" : r.balance === 0 ? "#FFFFFF" : "#EEF7EA" }}
                data-testid={`balance-row-${i}`}
              >
                <td className="border-r border-b border-[color:var(--sheet-border)] text-center text-[10px] text-muted-foreground h-8">
                  {i + 1}
                </td>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`border-r border-b border-[color:var(--sheet-border)] px-2 text-sm mono ${
                      c.numeric ? "text-right" : ""
                    } ${c.key === "balance" ? (r.balance < 0 ? "text-destructive font-semibold" : "font-semibold") : ""}`}
                    data-testid={`balance-cell-${i}-${c.key}`}
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
              <td className="px-2 py-2 text-xs text-right mono" data-testid="balance-total-stock">{totals.stock}</td>
              <td className="px-2 py-2 text-xs text-right mono" data-testid="balance-total-ordered">{totals.ordered}</td>
              <td className="px-2 py-2 text-xs text-right mono" data-testid="balance-total">{totals.balance}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </SheetFrame>
  );
}
