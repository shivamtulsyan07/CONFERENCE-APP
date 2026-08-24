// Advanced filter engine shared by every grid.
export const TEXT_OPS = [
  { id: "contains", label: "Contains" },
  { id: "not_contains", label: "Does not contain" },
  { id: "equals", label: "Equals" },
  { id: "not_equals", label: "Not equal to" },
  { id: "starts", label: "Starts with" },
  { id: "ends", label: "Ends with" },
  { id: "empty", label: "Is empty", noValue: true },
  { id: "not_empty", label: "Is not empty", noValue: true },
];

export const NUM_OPS = [
  { id: "equals", label: "=" },
  { id: "not_equals", label: "≠" },
  { id: "gt", label: ">" },
  { id: "gte", label: "≥" },
  { id: "lt", label: "<" },
  { id: "lte", label: "≤" },
  { id: "between", label: "Between", two: true },
  { id: "empty", label: "Is empty", noValue: true },
  { id: "not_empty", label: "Is not empty", noValue: true },
];

export const opsFor = (column) => (column?.numeric ? NUM_OPS : TEXT_OPS);

export const emptyFilter = () => ({ op: "contains", v1: "", v2: "", selected: [] });

export const isActive = (f) =>
  !!f && ((f.selected && f.selected.length > 0) || f.op === "empty" || f.op === "not_empty" || String(f.v1 ?? "").trim() !== "");

const num = (v) => {
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? null : n;
};

const matchOp = (raw, f, column) => {
  const s = String(raw ?? "").trim();
  if (f.op === "empty") return s === "";
  if (f.op === "not_empty") return s !== "";
  const q = String(f.v1 ?? "").trim();
  if (q === "" && f.op !== "between") return true;

  if (column?.numeric) {
    const a = num(s);
    const b = num(q);
    const c = num(f.v2);
    if (a === null) return false;
    switch (f.op) {
      case "equals": return b === null || a === b;
      case "not_equals": return b === null || a !== b;
      case "gt": return b !== null && a > b;
      case "gte": return b !== null && a >= b;
      case "lt": return b !== null && a < b;
      case "lte": return b !== null && a <= b;
      case "between": return (b === null || a >= b) && (c === null || a <= c);
      default: return true;
    }
  }

  const hay = s.toLowerCase();
  const needle = q.toLowerCase();
  switch (f.op) {
    case "contains": return hay.includes(needle);
    case "not_contains": return !hay.includes(needle);
    case "equals": return hay === needle;
    case "not_equals": return hay !== needle;
    case "starts": return hay.startsWith(needle);
    case "ends": return hay.endsWith(needle);
    default: return true;
  }
};

export const matchRow = (row, filters, colsByKey, search = "") => {
  const s = String(search || "").trim().toLowerCase();
  if (s) {
    const anywhere = Object.values(colsByKey).some((c) =>
      String(row[c.key] ?? "").toLowerCase().includes(s)
    );
    if (!anywhere) return false;
  }
  return Object.entries(filters || {}).every(([key, f]) => {
    if (!isActive(f)) return true;
    const column = colsByKey[key];
    const raw = row[key];
    if (f.selected?.length) {
      const v = String(raw ?? "").trim();
      if (!f.selected.includes(v)) return false;
    }
    return matchOp(raw, f, column);
  });
};

export const activeCount = (filters) =>
  Object.values(filters || {}).filter(isActive).length;

export const sortRows = (rows, sort, colsByKey) => {
  if (!sort?.key) return rows;
  const column = colsByKey[sort.key];
  const dir = sort.dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = a[sort.key], y = b[sort.key];
    if (column?.numeric) return ((num(x) ?? 0) - (num(y) ?? 0)) * dir;
    return String(x ?? "").localeCompare(String(y ?? ""), undefined, { numeric: true }) * dir;
  });
};

export const distinctValues = (rows, key) => {
  const set = new Set();
  rows.forEach((r) => {
    const v = String(r[key] ?? "").trim();
    if (v !== "") set.add(v);
  });
  return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
};
