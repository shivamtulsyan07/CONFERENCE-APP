import { useCallback, useEffect, useState } from "react";
import { api, errMsg } from "../lib/api";
import { useSheet } from "../lib/useSheet";
import { SheetCell, Datalists } from "../components/SheetCell";
import { SheetToolbar } from "../components/SheetToolbar";
import { useWindowRows } from "../lib/useWindowRows";
import { SheetFrame } from "../components/SheetFrame";
import { SheetContextMenu } from "../components/SheetContextMenu";
import { FilterPopover } from "../components/FilterPopover";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import { Trash2, Filter, FilterX } from "lucide-react";

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
  const win = useWindowRows(sheetBase.filtered.length);
  useEffect(() => { sheetBase.setEnsureVisible(win.scrollToRow); }, [win.scrollToRow]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { sheetBase.setScrollEl(win.scrollRef.current); sheetBase.setWindowRecalc(win.onScroll); }); // eslint-disable-line react-hooks/exhaustive-deps

  const totalQty = sheet.filtered.reduce((a, { row }) => a + (Number(row.quantity) || 0), 0);

  return (
    <SheetFrame
      testId="stock-sheet-page"
      title="In House Stock"
      subtitle="Each Group + Item + Shade is one line · click-drag a range then Cmd/Ctrl + C/X/V · drag the blue corner to fill down"
      actions={
        <>
          <SheetToolbar sheet={sheet} prefix="stock-" />
          <Input
            data-testid="stock-global-search"
            value={sheet.search}
            onChange={(e) => sheet.setSearch(e.target.value)}
            placeholder="SEARCH ANY COLUMN"
            className="h-8 w-44 text-xs"
          />
          <Button variant="outline" size="sm" className="h-8 text-[10px]" data-testid="stock-toggle-filters-btn" onClick={() => setShowFilters((s) => !s)}>
            <Filter className="h-3.5 w-3.5 mr-1" /> FILTERS{sheet.filterCount ? ` (${sheet.filterCount})` : ""}
          </Button>
          {sheet.filterCount > 0 && (
            <Button variant="outline" size="sm" className="h-8 text-[10px]" data-testid="stock-clear-filters-btn" onClick={sheet.clearFilters}>
              <FilterX className="h-3.5 w-3.5 mr-1" /> CLEAR
            </Button>
          )}
        </>
      }
    >
      <div className="sheet-scroll" data-testid="stock-grid" ref={win.scrollRef} onScroll={win.onScroll}>
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
              <tr className="bg-[color:var(--sheet-head2)]">
                <th />
                {columns.map((c) => (
                  <th key={c.key} className="border-r border-b border-[color:var(--sheet-border)] p-1">
                    <FilterPopover
                      column={c}
                      filter={sheet.filters[c.key]}
                      onChange={(f) => sheet.setFilter(c.key, f)}
                      rows={sheet.rows}
                      prefix="stock-"
                    />
                  </th>
                ))}
                <th className="border-b border-[color:var(--sheet-border)]" />
              </tr>
            )}
          </thead>
          <tbody>
            {win.padTop > 0 && (
              <tr aria-hidden style={{ height: win.padTop }}><td colSpan={columns.length + 2} /></tr>
            )}
            {sheet.filtered.slice(win.start, win.end).map(({ row, idx }) => (
              <tr key={row.id || row._local || idx} className="bg-[color:var(--sheet-bg)]" style={{ height: win.rowHeight }} data-testid={`stock-row-${idx}`}>
                <td className="border-r border-b border-[color:var(--sheet-border)] text-center text-[10px] text-muted-foreground h-8">
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
                <td className="border-b border-[color:var(--sheet-border)] text-center">
                  <button data-testid={`stock-delete-row-${idx}`} onClick={() => sheet.deleteRow(idx)}
                    className="p-1 hover:text-destructive transition-colors duration-150">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {win.padBottom > 0 && (
              <tr aria-hidden style={{ height: win.padBottom }}><td colSpan={columns.length + 2} /></tr>
            )}
          </tbody>
          <tfoot className="sticky bottom-0">
            <tr className="bg-[#0A2540] text-white">
              <td className="px-2 py-2 text-xs">Σ</td>
              <td colSpan={2} className="px-2 py-2 text-xs">{sheet.dataCount} lines shown</td>
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
    </SheetFrame>
  );
}
