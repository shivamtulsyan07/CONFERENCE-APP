export const SheetCell = ({
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
      className={`relative border-r border-b border-[#c9d3e0] p-0 align-middle ${
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
        ref={(el) => { if (el) inputs.current[`${rowIndex}-${colIndex}`] = el; }}
        data-testid={testId}
        list={listId}
        value={value ?? ""}
        onMouseDown={(e) => sheet?.selectStart?.(rowIndex, colIndex, e.shiftKey)}
        onChange={(e) => onChange(column.numeric ? e.target.value.replace(/[^0-9.]/g, "") : e.target.value)}
        onKeyDown={(e) => onKeyDown(e, rowIndex, colIndex)}
        onPaste={(e) => onPaste(e, rowIndex, colIndex)}
        className={`w-full h-8 px-2 bg-transparent outline-none text-sm mono focus:bg-white focus:ring-2 focus:ring-inset focus:ring-[#0066FF] ${
          column.numeric ? "text-right" : ""
        } ${column.upper ? "uppercase" : ""}`}
      />
      {sheet?.fillStart && (
        <span
          data-testid={`fill-handle-${rowIndex}-${column.key}`}
          title="Drag to copy down"
          onMouseDown={(e) => {
            e.preventDefault();
            sheet.fillStart(rowIndex, colIndex, column.key, value ?? "");
          }}
          className="sheet-fill-handle"
        />
      )}
    </td>
  );
};

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
