import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Shared spreadsheet grid engine: keyboard nav, excel paste, filters, dirty tracking.
export function useSheet({ columns, load, save, remove, blankRow, minRows = 12 }) {
  const [rows, setRows] = useState([]);
  const [dirty, setDirty] = useState(new Set());
  const [filters, setFilters] = useState({});
  const [saving, setSaving] = useState(false);
  const inputs = useRef({});

  const cfg = useRef({ blankRow, minRows, columns });
  cfg.current = { blankRow, minRows, columns };

  const newRow = (i) => ({ ...cfg.current.blankRow, _local: `l${i}-${Math.random().toString(36).slice(2)}` });

  const pad = useCallback((list) => {
    const out = [...list];
    while (out.length < cfg.current.minRows) out.push(newRow(out.length));
    return out;
  }, []);

  const refresh = useCallback(async () => {
    const data = await load();
    setRows(pad(data));
    setDirty(new Set());
  }, [load, pad]);

  useEffect(() => { refresh(); }, [refresh]);

  const applyPatch = (idx, patch) => {
    setRows((prev) => {
      const next = prev.map((r, i) => (i === idx ? { ...r, ...patch } : r));
      if (idx >= next.length - 1) next.push(newRow(next.length));
      return next;
    });
    setDirty((d) => new Set(d).add(idx));
  };

  const setCell = (idx, key, value) => applyPatch(idx, { [key]: value });
  const setRow = (idx, patch) => applyPatch(idx, patch);

  const filtered = useMemo(() => {
    const active = Object.entries(filters).filter(([, v]) => v && v.trim());
    const all = rows.map((r, i) => ({ row: r, idx: i }));
    if (!active.length) return all;
    return all.filter(({ row }) =>
      active.every(([k, v]) => String(row[k] ?? "").toLowerCase().includes(v.trim().toLowerCase()))
    );
  }, [rows, filters]);

  const focusCell = (r, c) => {
    const el = inputs.current[`${r}-${c}`];
    if (el) { el.focus(); el.select?.(); }
  };

  const onKeyDown = (e, r, c) => {
    const lastCol = cfg.current.columns.length - 1;
    if (e.key === "Enter" || (e.key === "ArrowDown" && !e.shiftKey)) {
      e.preventDefault(); focusCell(r + 1, c);
    } else if (e.key === "ArrowUp") {
      e.preventDefault(); focusCell(r - 1, c);
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) { if (c > 0) focusCell(r, c - 1); else focusCell(r - 1, lastCol); }
      else if (c < lastCol) focusCell(r, c + 1);
      else focusCell(r + 1, 0);
    }
  };

  const onPaste = (e, startRow, startCol) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text || (!text.includes("\t") && !text.includes("\n"))) return;
    e.preventDefault();
    const cols = cfg.current.columns;
    const matrix = text
      .replace(/\r/g, "")
      .split("\n")
      .filter((l) => l.trim() !== "")
      .map((l) => l.split("\t"));

    setRows((prev) => {
      const next = [...prev];
      matrix.forEach((line, ri) => {
        const target = startRow + ri;
        while (next.length <= target) next.push(newRow(next.length));
        const patch = {};
        line.forEach((val, ci) => {
          const col = cols[startCol + ci];
          if (!col) return;
          patch[col.key] = col.numeric ? String(val).replace(/[^0-9.]/g, "") : val.trim();
        });
        next[target] = { ...next[target], ...patch };
      });
      while (next.length < startRow + matrix.length + 1) next.push(newRow(next.length));
      return next;
    });
    setDirty((d) => {
      const n = new Set(d);
      matrix.forEach((_, ri) => n.add(startRow + ri));
      return n;
    });
  };

  const persist = async () => {
    const payload = [...dirty]
      .map((i) => ({ row: rows[i], i }))
      .filter(({ row }) => row)
      .map(({ row, i }) => {
        const clean = { id: row.id || null, row_index: row.row_index ?? i, status: row.status };
        cfg.current.columns.forEach((c) => { clean[c.key] = row[c.key]; });
        return clean;
      });
    if (!payload.length) return { saved: 0 };
    setSaving(true);
    try {
      const data = await save(payload);
      setRows(pad(data));
      setDirty(new Set());
      return { saved: payload.length };
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = async (idx) => {
    const row = rows[idx];
    if (row?.id) await remove(row.id);
    setRows((prev) => pad(prev.filter((_, i) => i !== idx)));
    setDirty(new Set());
  };

  return {
    rows, filtered, filters, setFilters, setCell, setRow, onKeyDown, onPaste,
    persist, saving, dirtyCount: dirty.size, deleteRow, refresh, inputs,
  };
}
