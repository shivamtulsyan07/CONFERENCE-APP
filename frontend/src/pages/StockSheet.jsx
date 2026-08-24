import { useCallback, useEffect, useState } from "react";
import { api, errMsg } from "../lib/api";
import { useSheet } from "../lib/useSheet";
import { SheetCell, Datalists } from "../components/SheetCell";
import { SheetToolbar } from "../components/SheetToolbar";
import { SheetContextMenu } from "../components/SheetContextMenu";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import { Trash2, Filter } from "lucide-react";

export default function StockSheet() {
  const [lookups, setLookups] = useState({ conferences: [], groups: [], items: [], shades: [] });
  const [showFilters, setShowFilters] = useState(true);
  const [hidden, setHidden] = useState([]);
  const [menu, setMenu] = useState(null);

  useEffect(() => { api.lookups().then(setLookups); }, []);

  const allColumns = [
    { key: "group", label: "Group Name", width: 150, options: lookups.groups, upper: true },
    { key: "item", label: "Item Name", width: 250, options: lookups.items, upper: true },
    { key: "shade", label: "Shade", width: 120 },
    { key: "quantity", label: "Quantity", width: 120, numeric: true },
  ];
  const columns = allColumns.filter((c) => !hidden.includes(c.key));

  const blankRow = { group: "SH ROLL", item: "", shade: "", quantity: "" };

  const blankZeros = (rows) => rows.map((r) => ({ ...r, quantity: r.quantity || "" }));
  const load = useCallback(() => api.stockRows().then(blankZeros), []);
  const normalize = (r) => ({
    group: r.group || "",
    item: r.item || "",
    shade: String(r.shade ?? ""),
    quantity: Number(r.quantity) || 0,
    id: r.id || null,
    row_index: r.row_index ?? 0,
  });

  const saveRows = useCallback((rows) => api.saveStockRows(rows.map(normalize)), []);
  const replaceRows = useCallback((rows) => api.replaceStockRows(rows.map(normalize)), []);

  const sheetBase = useSheet({ columns, allColumns, load, save: saveRows, replace: replaceRows, remove: api.deleteStockRow, blankRow, minRows: 15 });
  const sheet = { ...sheetBase, onContextMenu: setMenu };

  const totalQty = sheet.filtered.reduce((a, { row }) => a + (Number(row.quantity) || 0), 0);

  return (
    <div data-testid="stock-sheet-page">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">In House Stock</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Each Item + Shade is one line · click-drag to select a range, then Cmd/Ctrl + C / X / V · drag the blue corner handle to copy a cell down
          </p>
        </div>
        <div className="flex gap-2 uppercase items-center">
          <SheetToolbar sheet={sheet} prefix="stock-" />
          <Button variant="outline" data-testid="stock-toggle-filters-btn" onClick={() => setShowFilters((s) => !s)}>
            <Filter className="h-4 w-4 mr-1" /> FILTERS
          </Button>
        </div>
      </div>

      <div className="grid-panel overflow-auto max-h-[70vh] max-w-5xl" data-testid="stock-grid">
        <table className="border-collapse w-max min-w-full">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#3E6E85] text-white">
              <th className="w-12 border-r border-[#2c5163] px-2 py-2 text-xs font-semibold">SR</th>
              {columns.map((c) => (
                <th key={c.key} className="border-r border-[#2c5163] px-2 py-2 text-xs font-bold uppercase tracking-wide text-left"
                  style={{ width: c.width, minWidth: c.width }}>
                  {c.label}
                </th>
              ))}
              <th className="w-14 px-2 py-2 text-xs font-semibold">Del</th>
            </tr>
            {showFilters && (
              <tr className="bg-[#eef2f7]">
                <th />
                {columns.map((c) => (
                  <th key={c.key} className="border-r border-b border-[#c9d3e0] p-1">
                    <Input
                      data-testid={`stock-filter-${c.key}`}
                      value={sheet.filters[c.key] || ""}
                      onChange={(e) => sheet.setFilters({ ...sheet.filters, [c.key]: e.target.value })}
                      placeholder="filter"
                      className="h-7 text-xs"
                    />
                  </th>
                ))}
                <th className="border-b border-[#c9d3e0]" />
              </tr>
            )}
          </thead>
          <tbody>
            {sheet.filtered.map(({ row, idx }) => (
              <tr key={row.id || row._local || idx} className="bg-white" data-testid={`stock-row-${idx}`}>
                <td className="border-r border-b border-[#c9d3e0] text-center text-[10px] text-muted-foreground h-8">
                  {idx + 1}
                </td>
                {columns.map((c, ci) => (
                  <SheetCell
                    key={c.key}
                    column={c}
                    value={row[c.key]}
                    rowIndex={idx}
                    colIndex={ci}
                    inputs={sheet.inputs}
                    sheet={sheet}
                    testId={`stock-cell-${idx}-${c.key}`}
                    onChange={(v) => sheet.setCell(idx, c.key, v)}
                    onKeyDown={sheet.onKeyDown}
                    onPaste={sheet.onPaste}
                  />
                ))}
                <td className="border-b border-[#c9d3e0] text-center">
                  <button data-testid={`stock-delete-row-${idx}`} onClick={() => sheet.deleteRow(idx)}
                    className="p-1 hover:text-destructive transition-colors duration-150">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0">
            <tr className="bg-[#0A2540] text-white">
              <td className="px-2 py-2 text-xs">Σ</td>
              <td colSpan={2} className="px-2 py-2 text-xs">{sheet.filtered.length} lines shown</td>
              <td />
              <td className="px-2 py-2 text-xs text-right mono" data-testid="stock-total-qty">{totalQty}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <Datalists columns={columns} />
      <SheetContextMenu
        menu={menu}
        close={() => setMenu(null)}
        sheet={sheet}
        hidden={hidden}
        setHidden={setHidden}
        columns={allColumns}
      />
    </div>
  );
}
