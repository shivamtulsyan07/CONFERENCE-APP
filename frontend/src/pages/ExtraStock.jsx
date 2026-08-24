import { useEffect, useState } from "react";
import { api, errMsg } from "../lib/api";
import { useGridFilter } from "../lib/useGridFilter";
import { FilterPopover } from "../components/FilterPopover";
import { SheetFrame, StatStrip } from "../components/SheetFrame";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import { RefreshCw, FilterX, FileSpreadsheet, FileText } from "lucide-react";

const columns = [
  { key: "group", label: "Group Name", width: 150 },
  { key: "item", label: "Item", width: 220 },
  { key: "shade", label: "Shade", width: 110 },
  { key: "sent_qty", label: "Sent Qty", width: 120, numeric: true },
  { key: "arrived_qty", label: "Arrived Qty", width: 130, numeric: true },
  { key: "extra_qty", label: "Extra Qty", width: 120, numeric: true },
  { key: "last_date", label: "Last Arrived", width: 130 },
];

export default function ExtraStock() {
  const [data, setData] = useState(null);
  const grid = useGridFilter(data?.rows || [], columns);

  const load = () => api.extraStock().then(setData).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []);

  const download = (kind) => {
    window.open(`${process.env.REACT_APP_BACKEND_URL}/api/extra-stock/export.${kind}`, "_blank");
  };

  const totals = grid.visible.reduce(
    (a, r) => ({ sent: a.sent + r.sent_qty, arrived: a.arrived + r.arrived_qty, extra: a.extra + r.extra_qty }),
    { sent: 0, arrived: 0, extra: 0 }
  );

  if (!data) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <SheetFrame
      testId="extra-stock-page"
      title="Extra Stock"
      subtitle="Arrived from the company more than what was sent to them (Group + Item + Shade) — surplus you did not order"
      actions={
        <>
          <Input
            data-testid="extra-global-search"
            value={grid.search}
            onChange={(e) => grid.setSearch(e.target.value)}
            placeholder="SEARCH ANY COLUMN"
            className="h-8 w-44 text-xs"
          />
          {grid.activeCount > 0 && (
            <Button variant="outline" size="sm" className="h-8 text-[10px]" data-testid="extra-clear-filters-btn" onClick={grid.clearAll}>
              <FilterX className="h-3.5 w-3.5 mr-1" /> CLEAR ({grid.activeCount})
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-8 text-[10px]" data-testid="extra-export-excel-btn" onClick={() => download("xlsx")}>
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> EXCEL
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-[10px]" data-testid="extra-export-pdf-btn" onClick={() => download("pdf")}>
            <FileText className="h-3.5 w-3.5 mr-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-[10px]" data-testid="refresh-extra-btn" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> REFRESH
          </Button>
        </>
      }
      stats={
        <StatStrip
          items={[
            ["Extra lines", data.total_lines, "extra-stat-lines"],
            ["Total extra qty", data.total_extra, "extra-stat-qty"],
            ["Arrived on these lines", data.total_arrived, "extra-stat-arrived"],
            ["Sent on these lines", data.total_sent, "extra-stat-sent"],
          ]}
        />
      }
    >
      <div className="sheet-scroll" data-testid="extra-grid">
        <table className="border-collapse w-max min-w-full">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#3F6F52] text-white">
              <th className="w-12 border-r border-black/20 px-2 py-2 text-xs font-semibold">SR</th>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`border-r border-black/20 px-2 py-2 text-xs font-bold uppercase tracking-wide ${c.numeric ? "text-right" : "text-left"}`}
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
                    prefix="extra-"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.visible.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="p-4 text-sm text-muted-foreground">
                  No extra stock — nothing arrived beyond what was sent to the company.
                </td>
              </tr>
            )}
            {grid.visible.map((r, i) => (
              <tr
                key={`${r.group}-${r.item}-${r.shade}`}
                className="row-hover text-[#0A2540]"
                style={{ background: "#EEF7EA" }}
                data-testid={`extra-row-${i}`}
              >
                <td className="border-r border-b border-[color:var(--sheet-border)] text-center text-[10px] text-muted-foreground h-8">
                  {i + 1}
                </td>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`border-r border-b border-[color:var(--sheet-border)] px-2 text-sm mono ${c.numeric ? "text-right" : ""} ${
                      c.key === "extra_qty" ? "font-semibold" : ""
                    }`}
                    data-testid={`extra-cell-${i}-${c.key}`}
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
              <td className="px-2 py-2 text-xs text-right mono" data-testid="extra-total-sent">{totals.sent}</td>
              <td className="px-2 py-2 text-xs text-right mono" data-testid="extra-total-arrived">{totals.arrived}</td>
              <td className="px-2 py-2 text-xs text-right mono" data-testid="extra-total-extra">{totals.extra}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </SheetFrame>
  );
}
