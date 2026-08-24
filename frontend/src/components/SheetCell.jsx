import { memo } from "react";

export const SheetCell = memo(({
  value,
  colIndex,
  rowIndex,
  column,
  onChange,
  onKeyDown,
  onPaste,
  inputs,
  testId,
  sheet,
}) => {
  const listId = column.options ? `dl-${column.key}` : undefined;
  const inFill = sheet?.isInFill?.(rowIndex, colIndex);
  const selected = sheet?.isSelected?.(rowIndex, colIndex);
  return (
    <td
      className={`relative border-r border-b border-[color:var(--sheet-border)] p-0 align-middle ${
        inFill ? "ring-2 ring-inset ring-[#0066FF]/60" : ""
      } ${selected ? "bg-[#0066FF]/15" : ""}`}
      style={{ width: column.width, minWidth: column.width }}
      onMouseEnter={() => { sheet?.fillOver?.(rowIndex); sheet?.selectOver?.(rowIndex, colIndex); }}
      onContextMenu={(e) => {
        if (!sheet?.onContextMenu) return;
        e.preventDefault();
        if (!sheet.isSelected(rowIndex, colIndex)) sheet.setAnchor?.(rowIndex, colIndex);
        sheet.onContextMenu({ x: e.clientX, y: e.clientY, row: rowIndex, col: colIndex, column });
      }}
    >
      <input
        ref={(el) => {
          const k = `${rowIndex}-${colIndex}`;
          if (el) inputs.current[k] = el;
          else delete inputs.current[k];
        }}
        data-testid={testId}
        list={listId}
        value={value ?? ""}
        onMouseDown={(e) => sheet?.selectStart?.(rowIndex, colIndex, e.shiftKey)}
        onChange={(e) => onChange(column.numeric ? e.target.value.replace(/[^0-9.]/g, "") : e.target.value)}
        onKeyDown={(e) => onKeyDown(e, rowIndex, colIndex)}
        onPaste={(e) => onPaste(e, rowIndex, colIndex)}
        className={`w-full h-8 px-2 bg-transparent outline-none text-sm mono focus:bg-[color:var(--sheet-bg)] focus:ring-2 focus:ring-inset focus:ring-[#0066FF] ${
          column.numeric ? "text-right" : ""
        } ${column.upper ? "uppercase" : ""}`}
      />
      {sheet?.fillStart && (
        <span
          data-testid={`fill-handle-${rowIndex}-${column.key}`}
          title="Drag to copy down"
          onMouseDown={(e) => {
            e.preventDefault();
            sheet.fillStart(rowIndex, colIndex);
          }}
          className="sheet-fill-handle"
        />
      )}
    </td>
  );
}, (a, b) =>
  a.value === b.value &&
  a.rowIndex === b.rowIndex &&
  a.colIndex === b.colIndex &&
  a.column === b.column &&
  a.sheet.isInFill(a.rowIndex, a.colIndex) === b.sheet.isInFill(b.rowIndex, b.colIndex) &&
  a.sheet.isSelected(a.rowIndex, a.colIndex) === b.sheet.isSelected(b.rowIndex, b.colIndex)
);

export const Datalists = ({ columns }) =>
  columns
    .filter((c) => c.options)
    .map((c) => (
      <datalist id={`dl-${c.key}`} key={c.key}>
        {c.options.map((o) => (
          <option value={o} key={o} />
        ))}
      </datalist>
    ));
