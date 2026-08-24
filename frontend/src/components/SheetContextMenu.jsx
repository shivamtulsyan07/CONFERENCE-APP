import { useEffect } from "react";
import {
  Copy, Scissors, ClipboardPaste, Eraser, ArrowUpToLine, ArrowDownToLine,
  Trash2, CopyPlus, EyeOff, Eye, ArrowDownWideNarrow,
} from "lucide-react";

const Item = ({ icon: Icon, label, hint, onClick, testId, danger }) => (
  <button
    data-testid={testId}
    onClick={onClick}
    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors duration-150 hover:bg-muted ${
      danger ? "text-destructive" : ""
    }`}
  >
    <Icon className="h-3.5 w-3.5 shrink-0" />
    <span className="flex-1 uppercase tracking-wide">{label}</span>
    {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
  </button>
);

const Sep = () => <div className="my-1 border-t border-border" />;

// Excel-style right click menu for a sheet cell.
export const SheetContextMenu = ({ menu, close, sheet, hidden, setHidden, columns }) => {
  useEffect(() => {
    if (!menu) return;
    const off = () => close();
    window.addEventListener("click", off);
    window.addEventListener("scroll", off, true);
    return () => {
      window.removeEventListener("click", off);
      window.removeEventListener("scroll", off, true);
    };
  }, [menu, close]);

  if (!menu) return null;
  const { x, y, row, col, column } = menu;
  const run = (fn) => () => { close(); fn(); };

  return (
    <div
      data-testid="sheet-context-menu"
      onClick={(e) => e.stopPropagation()}
      className="fixed z-50 w-60 py-1 bg-[color:var(--sheet-bg)] border border-border rounded-md shadow-lg rise"
      style={{ left: Math.min(x, window.innerWidth - 250), top: Math.min(y, window.innerHeight - 380) }}
    >
      <Item testId="ctx-cut" icon={Scissors} label="Cut" hint="⌘X" onClick={run(sheet.cutSelection)} />
      <Item testId="ctx-copy" icon={Copy} label="Copy" hint="⌘C" onClick={run(sheet.copySelection)} />
      <Item testId="ctx-paste" icon={ClipboardPaste} label="Paste" hint="⌘V" onClick={run(sheet.pasteSelection)} />
      <Sep />
      <Item testId="ctx-clear-cell" icon={Eraser} label="Clear contents" onClick={run(sheet.clearSelection)} />
      <Item testId="ctx-fill-down" icon={ArrowDownWideNarrow} label="Fill down in selection"
        onClick={run(() => sheet.fillDownSelection?.())} />
      <Sep />
      <Item testId="ctx-insert-above" icon={ArrowUpToLine} label="Insert row above"
        onClick={run(() => sheet.insertRow(row, "above"))} />
      <Item testId="ctx-insert-below" icon={ArrowDownToLine} label="Insert row below"
        onClick={run(() => sheet.insertRow(row, "below"))} />
      <Item testId="ctx-duplicate-row" icon={CopyPlus} label="Duplicate row"
        onClick={run(() => sheet.duplicateRow(row))} />
      <Item testId="ctx-clear-row" icon={Eraser} label="Clear row" onClick={run(() => sheet.clearRow(row))} />
      <Item testId="ctx-delete-row" icon={Trash2} label="Delete row" danger
        onClick={run(() => sheet.deleteRow(row))} />
      <Sep />
      <Item testId="ctx-hide-column" icon={EyeOff} label={`Hide column: ${column?.label || ""}`}
        onClick={run(() => setHidden([...hidden, column.key]))} />
      {hidden.length > 0 && (
        <Item testId="ctx-show-columns" icon={Eye} label={`Show all columns (${hidden.length} hidden)`}
          onClick={run(() => setHidden([]))} />
      )}
    </div>
  );
};
