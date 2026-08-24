import { useCallback, useEffect, useState } from "react";
import { api, errMsg, money, STATUS_META } from "../lib/api";
import { useSheet } from "../lib/useSheet";
import { SheetCell, Datalists } from "../components/SheetCell";
import { SheetToolbar } from "../components/SheetToolbar";
import { SheetContextMenu } from "../components/SheetContextMenu";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import { Trash2, Wand2, Filter } from "lucide-react";

export default function OrderSheet() {
  const [lookups, setLookups] = useState({ parties: [], conferences: [], groups: [], items: [], shades: [], bill_nos: [], party_pages: {} });
  const [showFilters, setShowFilters] = useState(true);
  const [hidden, setHidden] = useState([]);
  const [menu, setMenu] = useState(null);

  useEffect(() => { api.lookups().then(setLookups); }, []);

  const allColumns = [
    { key: "party_name", label: "Party Name", width: 250, options: lookups.parties, upper: true },
    { key: "page", label: "Page No.", width: 80, numeric: true },
    { key: "conference", label: "Conference Name", width: 160, options: lookups.conferences, upper: true },
    { key: "group", label: "Group Name", width: 130, options: lookups.groups, upper: true },
    { key: "item", label: "Item", width: 180, options: lookups.items, upper: true },
    { key: "shade", label: "Shade", width: 90 },
    { key: "qty", label: "Qty", width: 70, numeric: true },
    { key: "mtr", label: "MTR", width: 105 },
    { key: "bill_no", label: "Bill Number", width: 115, options: lookups.bill_nos, upper: true },
    { key: "rate", label: "Rate", width: 90, numeric: true },
  ];
  const columns = allColumns.filter((c) => !hidden.includes(c.key));

  const blankRow = {
    party_name: "", page: "", conference: "", group: "SH ROLL", item: "", shade: "",
    qty: "", mtr: "", bill_no: "", rate: "", amount: "", status: "not_ready",
  };

  const blankZeros = (rows) =>
    rows.map((r) => ({ ...r, qty: r.qty || "", rate: r.rate || "", amount: r.amount || "" }));

  const load = useCallback(() => api.orderRows().then(blankZeros), []);
  const normalize = (r) => ({
    ...r,
    page: String(r.page ?? ""),
    shade: String(r.shade ?? ""),
    qty: Number(r.qty) || 0,
    rate: Number(r.rate) || 0,
  });

  const saveRows = useCallback((rows) => api.saveOrderRows(rows.map(normalize)), []);
  const replaceRows = useCallback((rows) => api.replaceOrderRows(rows.map(normalize)), []);

  const sheetBase = useSheet({ columns, allColumns, load, save: saveRows, replace: replaceRows, remove: api.deleteOrderRow, blankRow, minRows: 15 });
  const sheet = { ...sheetBase, onContextMenu: setMenu };

  const onCell = (idx, col, value) => {
    if (col.key === "party_name") {
      const page = lookups.party_pages?.[value];
      sheet.setRow(idx, page ? { party_name: value, page } : { party_name: value });
      return;
    }
    sheet.setCell(idx, col.key, value);
  };

  const handleSave = () => sheet.flush();

  const cycleStatus = (idx) => {
    const order = ["not_ready", "arrived", "ready"];
    const cur = sheet.rows[idx].status || "not_ready";
    sheet.setRow(idx, { status: order[(order.indexOf(cur) + 1) % 3] });
  };

  const autoMark = async () => {
    try {
      await api.autoStatus();
      await sheet.refresh();
      toast.success("Row colours updated from In House Order stock");
    } catch (e) { toast.error(errMsg(e)); }
  };

  const totals = sheet.filtered.reduce(
    (a, { row }) => ({
      qty: a.qty + (Number(row.qty) || 0),
      amount: a.amount + (Number(row.qty) || 0) * (Number(row.rate) || 0),
    }),
    { qty: 0, amount: 0 }
  );

  return (
    <div data-testid="order-sheet-page">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Conference Stock</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Type and Tab/Enter like Excel · click-drag to select a range, then Cmd/Ctrl + C / X / V · drag the blue corner handle to copy a cell down · click the SR number to change row colour
          </p>
        </div>
        <div className="flex flex-wrap gap-2 uppercase items-center">
          <SheetToolbar sheet={sheet} />
          <Button variant="outline" data-testid="toggle-filters-btn" onClick={() => setShowFilters((s) => !s)}>
            <Filter className="h-4 w-4 mr-1" /> FILTERS
          </Button>
          <Button variant="outline" data-testid="auto-status-btn" onClick={autoMark}>
            <Wand2 className="h-4 w-4 mr-1" /> AUTO COLOUR FROM IN HOUSE STOCK          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-3 text-xs">
        {Object.entries(STATUS_META).map(([k, m]) => (
          <span key={k} className="flex items-center gap-2" data-testid={`legend-${k}`}>
            <span className="h-3 w-5 border border-[#c9d3e0]" style={{ background: m.color }} />
            {m.text}
          </span>
        ))}
      </div>

      <div className="grid-panel overflow-auto max-h-[70vh]" data-testid="order-grid">
        <table className="border-collapse w-max min-w-full">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#3F6F52] text-white">
              <th className="w-12 border-r border-[#2f5540] px-2 py-2 text-xs font-semibold">SR</th>
              {columns.map((c) => (
                <th key={c.key} className="border-r border-[#2f5540] px-2 py-2 text-xs font-bold uppercase tracking-wide text-left"
                  style={{ width: c.width, minWidth: c.width }}>
                  {c.label}
                </th>
              ))}
              <th className="w-16 px-2 py-2 text-xs font-semibold">Del</th>
            </tr>
            {showFilters && (
              <tr className="bg-[#eef2f7]">
                <th />
                {columns.map((c) => (
                  <th key={c.key} className="border-r border-b border-[#c9d3e0] p-1">
                    <Input
                      data-testid={`filter-${c.key}`}
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
              <tr key={row.id || row._local || idx} style={{ background: STATUS_META[row.status || "not_ready"].color }}
                data-testid={`order-row-${idx}`}>
                <td className="border-r border-b border-[#c9d3e0] text-center p-0">
                  <button
                    data-testid={`status-toggle-${idx}`}
                    title={STATUS_META[row.status || "not_ready"].text}
                    onClick={() => cycleStatus(idx)}
                    className="w-full h-8 text-[10px] text-[#0A2540]/70 hover:bg-black/10 transition-colors duration-150"
                  >
                    {idx + 1}
                  </button>
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
                    testId={`cell-${idx}-${c.key}`}
                    onChange={(v) => onCell(idx, c, v)}
                    onKeyDown={sheet.onKeyDown}
                    onPaste={sheet.onPaste}
                  />
                ))}
                <td className="border-b border-[#c9d3e0] text-center">
                  <button data-testid={`delete-row-${idx}`} onClick={() => sheet.deleteRow(idx)}
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
              <td colSpan={5} className="px-2 py-2 text-xs">{sheet.filtered.length} rows shown</td>
              <td className="px-2 py-2 text-xs text-right mono" data-testid="total-qty">{totals.qty}</td>
              <td colSpan={2} className="px-2 py-2 text-xs text-right">Value</td>
              <td className="px-2 py-2 text-xs text-right mono" data-testid="total-amount">{money(totals.amount)}</td>
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
