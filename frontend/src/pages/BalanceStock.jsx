import { useEffect, useMemo, useState } from "react";
import { api, errMsg } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

const columns = [
  { key: "conference", label: "Conference Name", width: 160 },
  { key: "group", label: "Group Name", width: 130 },
  { key: "item", label: "Item", width: 200 },
  { key: "shade", label: "Shade", width: 100 },
  { key: "stock_qty", label: "Stock Qty", width: 110, numeric: true },
  { key: "ordered_qty", label: "Ordered Qty", width: 120, numeric: true },
  { key: "balance", label: "Balance", width: 110, numeric: true },
];

export default function BalanceStock() {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({});
  const [onlyShort, setOnlyShort] = useState(false);

  const load = () => api.balanceStock().then(setData).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const active = Object.entries(filters).filter(([, v]) => v && v.trim());
    return data.rows
      .filter((r) => (onlyShort ? r.balance < 0 : true))
      .filter((r) =>
        active.every(([k, v]) => String(r[k] ?? "").toLowerCase().includes(v.trim().toLowerCase()))
      );
  }, [data, filters, onlyShort]);

  const totals = rows.reduce(
    (a, r) => ({
      stock: a.stock + r.stock_qty,
      ordered: a.ordered + r.ordered_qty,
      balance: a.balance + r.balance,
    }),
    { stock: 0, ordered: 0, balance: 0 }
  );

  if (!data) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div data-testid="balance-stock-page">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Balance Stock</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Stock sheet quantity minus order sheet quantity, matched on Item + Shade · red means short
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={onlyShort ? "default" : "outline"}
            data-testid="only-short-btn"
            onClick={() => setOnlyShort((s) => !s)}
          >
            Short only ({data.short_lines})
          </Button>
          <Button variant="outline" data-testid="refresh-balance-btn" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid-panel overflow-auto max-h-[72vh]" data-testid="balance-grid">
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
                    data-testid={`balance-filter-${c.key}`}
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
                  Nothing to show.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr
                key={`${r.item}-${r.shade}`}
                className="row-hover"
                style={{ background: r.balance < 0 ? "#FDECEA" : r.balance === 0 ? "#FFFFFF" : "#EEF7EA" }}
                data-testid={`balance-row-${i}`}
              >
                <td className="border-r border-b border-[#c9d3e0] text-center text-[10px] text-muted-foreground h-8">
                  {i + 1}
                </td>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`border-r border-b border-[#c9d3e0] px-2 text-sm mono ${
                      c.numeric ? "text-right" : ""
                    } ${c.key === "balance" ? (r.balance < 0 ? "text-destructive font-semibold" : "font-semibold") : ""}`}
                    data-testid={`balance-cell-${i}-${c.key}`}
                  >
                    {r[c.key] === "" ? "—" : r[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0">
            <tr className="bg-[#0A2540] text-white">
              <td className="px-2 py-2 text-xs">Σ</td>
              <td colSpan={4} className="px-2 py-2 text-xs">{rows.length} lines shown</td>
              <td className="px-2 py-2 text-xs text-right mono" data-testid="balance-total-stock">{totals.stock}</td>
              <td className="px-2 py-2 text-xs text-right mono" data-testid="balance-total-ordered">{totals.ordered}</td>
              <td className="px-2 py-2 text-xs text-right mono" data-testid="balance-total">{totals.balance}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
