import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useGridFilter } from "../lib/useGridFilter";
import { FilterPopover } from "../components/FilterPopover";
import { SheetFrame, StatStrip } from "../components/SheetFrame";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import { RefreshCw, FileSpreadsheet, FileText, FilterX } from "lucide-react";

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
  const [pendingOnly, setPendingOnly] = useState(true);
  const grid = useGridFilter(data?.rows || [], columns);

  const load = (pending = pendingOnly) =>
    api.companyOrder(pending).then(setData).catch((e) => toast.error(String(e)));

  useEffect(() => { load(pendingOnly); }, [pendingOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = grid.visible.reduce(
    (a, r) => ({
      ordered: a.ordered + r.ordered_qty,
      stock: a.stock + r.stock_qty,
      order: a.order + r.to_order,
    }),
    { ordered: 0, stock: 0, order: 0 }
  );

  const download = (kind) =>
    window.open(`${API}/company-order/export.${kind}?pending_only=${pendingOnly}`, "_blank");

  if (!data) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <SheetFrame
      testId="company-order-page"
      title="Company Order"
      subtitle="What must be ordered from the company (ordered qty − in house stock)"
      actions={
        <>
          <Input
            data-testid="company-global-search"
            value={grid.search}
            onChange={(e) => grid.setSearch(e.target.value)}
            placeholder="SEARCH ANY COLUMN"
            className="h-8 w-44 text-xs"
          />
          {grid.activeCount > 0 && (
            <Button variant="outline" size="sm" className="h-8 text-[10px]" data-testid="company-clear-filters-btn" onClick={grid.clearAll}>
              <FilterX className="h-3.5 w-3.5 mr-1" /> CLEAR ({grid.activeCount})
            </Button>
          )}
          <Button variant={pendingOnly ? "default" : "outline"} size="sm" className="h-8 text-[10px]" data-testid="pending-only-btn" onClick={() => setPendingOnly((p) => !p)}>
            {pendingOnly ? "SHORTAGE ONLY" : "ALL ITEMS"}
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-[10px]" data-testid="export-excel-btn" onClick={() => download("xlsx")}>
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> EXCEL
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-[10px]" data-testid="export-pdf-btn" onClick={() => download("pdf")}>
            <FileText className="h-3.5 w-3.5 mr-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-[10px]" data-testid="refresh-company-btn" onClick={() => load()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> REFRESH
          </Button>
        </>
      }
      stats={
        <StatStrip
          items={[
            ["Lines to order", data.total_lines, "stat-lines"],
            ["Total ordered qty", data.total_ordered, "stat-ordered"],
            ["Total qty to order", data.total_to_order, "stat-to-order"],
            ["In house stock", data.total_stock, "stat-stock"],
          ]}
        />
      }
    >
      <div className="sheet-scroll" data-testid="company-grid">
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
                    prefix="company-"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.visible.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="p-4 text-sm text-muted-foreground">
                  Nothing to order — in house stock covers every conference order.
                </td>
              </tr>
            )}
            {grid.visible.map((r, i) => (
              <tr
                key={`${r.group}-${r.item}-${r.shade}`}
                className="row-hover bg-[color:var(--sheet-bg)]"
                data-testid={`company-row-${i}`}
              >
                <td className="border-r border-b border-[color:var(--sheet-border)] text-center text-[10px] text-muted-foreground h-8">
                  {i + 1}
                </td>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`border-r border-b border-[color:var(--sheet-border)] px-2 text-sm mono ${
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
              <td colSpan={3} className="px-2 py-2 text-xs">{grid.visible.length} lines shown</td>
              <td className="px-2 py-2 text-xs text-right mono" data-testid="company-total-ordered">{totals.ordered}</td>
              <td className="px-2 py-2 text-xs text-right mono" data-testid="company-total-stock">{totals.stock}</td>
              <td className="px-2 py-2 text-xs text-right mono" data-testid="company-total-to-order">{totals.order}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </SheetFrame>
  );
}
