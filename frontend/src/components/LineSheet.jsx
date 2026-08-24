import { useCallback, useEffect, useMemo, useState } from "react";
import { api, errMsg } from "../lib/api";
import { useSheet } from "../lib/useSheet";
import { SheetCell, Datalists } from "./SheetCell";
import { SheetToolbar } from "./SheetToolbar";
import { SheetContextMenu } from "./SheetContextMenu";
import { FilterPopover } from "./FilterPopover";
import { useWindowRows } from "../lib/useWindowRows";
import { SheetFrame, StatStrip } from "./SheetFrame";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { Trash2, Filter, FilterX } from "lucide-react";

// Editable sheet for the company sent / arrived line collections.
export const LineSheet = ({
  sheetKey,
  title,
  subtitle,
  headerColor,
  prefix,
  extraColumns = [],
  extraValue,
  onSaved,
  toolbarExtras,
  stats,
}) => {
  const [lookups, setLookups] = useState({ groups: [], items: [], shades: [] });
  const [showFilters, setShowFilters] = useState(true);
  const [hidden, setHidden] = useState([]);
  const [menu, setMenu] = useState(null);

  useEffect(() => { api.lookups().then(setLookups); }, []);

  const allColumns = useMemo(() => ([
    { key: "group", label: "Group Name", width: 150, options: lookups.groups, upper: true },
    { key: "item", label: "Item Name", width: 220, options: lookups.items, upper: true },
    { key: "shade", label: "Shade", width: 100 },
    { key: "quantity", label: "Quantity", width: 110, numeric: true },
    { key: "date", label: "Date", width: 120 },
    { key: "remark", label: "Remark", width: 200 },
  ]), [lookups]);

  const columns = allColumns.filter((c) => !hidden.includes(c.key));
  const blankRow = { group: "SH ROLL", item: "", shade: "", quantity: "", date: "", remark: "" };

  const blankZeros = (rows) => rows.map((r) => ({ ...r, quantity: r.quantity || "" }));
  const normalize = (r) => ({
    id: r.id || null,
    row_index: r.row_index ?? 0,
    group: r.group || "",
    item: r.item || "",
    shade: String(r.shade ?? ""),
    quantity: Number(r.quantity) || 0,
    date: r.date || "",
    remark: r.remark || "",
  });

  const load = useCallback(() => api.lineRows(sheetKey).then(blankZeros), [sheetKey]);
  const saveRows = useCallback(
    (rows) => api.saveLineRows(sheetKey, rows.map(normalize)).then((res) => { onSaved?.(); return res; }),
    [sheetKey] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const replaceRows = useCallback(
    (rows) => api.replaceLineRows(sheetKey, rows.map(normalize)).then((res) => { onSaved?.(); return res; }),
    [sheetKey] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const sheetBase = useSheet({
    columns, allColumns, load, save: saveRows, replace: replaceRows,
    remove: (id) => api.deleteLineRow(sheetKey, id).then((r) => { onSaved?.(); return r; }),
    blankRow, minRows: 15,
  });
  const sheet = { ...sheetBase, onContextMenu: setMenu };
  const win = useWindowRows(sheetBase.filtered.length);
  useEffect(() => { sheetBase.setEnsureVisible(win.scrollToRow); }, [win.scrollToRow]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalQty = sheet.filtered.reduce((a, { row }) => a + (Number(row.quantity) || 0), 0);

  return (
    <SheetFrame
      testId={`${prefix}page`}
      title={title}
      subtitle={subtitle}
      stats={stats}
      actions={
        <>
          <SheetToolbar sheet={sheet} prefix={prefix} />
          <Input
            data-testid={`${prefix}global-search`}
            value={sheet.search}
            onChange={(e) => sheet.setSearch(e.target.value)}
            placeholder="SEARCH ANY COLUMN"
            className="h-8 w-40 text-xs"
          />
          <Button variant="outline" size="sm" className="h-8 text-[10px]" data-testid={`${prefix}toggle-filters-btn`} onClick={() => setShowFilters((s) => !s)}>
            <Filter className="h-3.5 w-3.5 mr-1" /> FILTERS{sheet.filterCount ? ` (${sheet.filterCount})` : ""}
          </Button>
          {sheet.filterCount > 0 && (
            <Button variant="outline" size="sm" className="h-8 text-[10px]" data-testid={`${prefix}clear-filters-btn`} onClick={sheet.clearFilters}>
              <FilterX className="h-3.5 w-3.5 mr-1" /> CLEAR
            </Button>
          )}
          {toolbarExtras}
        </>
      }
    >
      <div className="sheet-scroll" data-testid={`${prefix}grid`} ref={win.scrollRef} onScroll={win.onScroll}>
        <table className="border-collapse w-max min-w-full">
          <thead className="sticky top-0 z-10">
            <tr className="text-white" style={{ background: headerColor }}>
              <th className="w-12 border-r border-black/20 px-2 py-2 text-xs font-semibold">SR</th>
              {columns.map((c) => (
                <th key={c.key} className="border-r border-black/20 px-2 py-2 text-xs font-bold uppercase tracking-wide text-left"
                  style={{ width: c.width, minWidth: c.width }}>
                  {c.label}
                </th>
              ))}
              {extraColumns.map((c) => (
                <th key={c.key} className="border-r border-black/20 px-2 py-2 text-xs font-bold uppercase tracking-wide text-right"
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
                      prefix={prefix}
                    />
                  </th>
                ))}
                {extraColumns.map((c) => (
                  <th key={c.key} className="border-r border-b border-[color:var(--sheet-border)]" />
                ))}
                <th className="border-b border-[color:var(--sheet-border)]" />
              </tr>
            )}
          </thead>
          <tbody>
            {win.padTop > 0 && (
              <tr aria-hidden style={{ height: win.padTop }}><td colSpan={columns.length + extraColumns.length + 2} /></tr>
            )}
            {sheet.filtered.slice(win.start, win.end).map(({ row, idx }) => (
              <tr key={row.id || row._local || idx} className="bg-[color:var(--sheet-bg)]" style={{ height: win.rowHeight }} data-testid={`${prefix}row-${idx}`}>
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
                    testId={`${prefix}cell-${idx}-${c.key}`}
                    onChange={(v) => sheet.setCell(idx, c.key, v)}
                    onKeyDown={sheet.onKeyDown}
                    onPaste={sheet.onPaste}
                  />
                ))}
                {extraColumns.map((c) => {
                  const v = extraValue?.(row, c.key);
                  return (
                    <td
                      key={c.key}
                      data-testid={`${prefix}extra-${idx}-${c.key}`}
                      className={`border-r border-b border-[color:var(--sheet-border)] px-2 text-sm mono text-right font-semibold ${
                        c.key === "balance_qty" && Number(v) > 0 ? "text-[#0066FF]" : ""
                      }`}
                    >
                      {v === "" || v == null ? "—" : v}
                    </td>
                  );
                })}
                <td className="border-b border-[color:var(--sheet-border)] text-center">
                  <button data-testid={`${prefix}delete-row-${idx}`} onClick={() => sheet.deleteRow(idx)}
                    className="p-1 hover:text-destructive transition-colors duration-150">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {win.padBottom > 0 && (
              <tr aria-hidden style={{ height: win.padBottom }}><td colSpan={columns.length + extraColumns.length + 2} /></tr>
            )}
          </tbody>
          <tfoot className="sticky bottom-0">
            <tr className="bg-[#0A2540] text-white">
              <td className="px-2 py-2 text-xs">Σ</td>
              <td colSpan={Math.max(1, columns.length - 3)} className="px-2 py-2 text-xs">
                {sheet.dataCount} rows shown
              </td>
              <td className="px-2 py-2 text-xs text-right mono" data-testid={`${prefix}total-qty`}>{totalQty}</td>
              <td colSpan={2 + extraColumns.length + 1} />
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
};
