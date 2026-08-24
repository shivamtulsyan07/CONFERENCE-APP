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
}) => {
  const listId = column.options ? `dl-${column.key}` : undefined;
  return (
    <td
      className="border-r border-b border-[#c9d3e0] p-0 align-middle"
      style={{ width: column.width, minWidth: column.width }}
    >
      <input
        ref={(el) => { if (el) inputs.current[`${rowIndex}-${colIndex}`] = el; }}
        data-testid={testId}
        list={listId}
        value={value ?? ""}
        onChange={(e) => onChange(column.numeric ? e.target.value.replace(/[^0-9.]/g, "") : e.target.value)}
        onKeyDown={(e) => onKeyDown(e, rowIndex, colIndex)}
        onPaste={(e) => onPaste(e, rowIndex, colIndex)}
        className={`w-full h-8 px-2 bg-transparent outline-none text-sm mono focus:bg-white focus:ring-2 focus:ring-inset focus:ring-[#0066FF] ${
          column.numeric ? "text-right" : ""
        } ${column.upper ? "uppercase" : ""}`}
      />
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
