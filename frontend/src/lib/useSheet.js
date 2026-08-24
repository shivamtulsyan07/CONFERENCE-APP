import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const AUTOSAVE_MS = 900;

// Spreadsheet engine: keyboard nav, excel paste, filters, autosave, undo/redo.
export function useSheet({ columns, load, save, replace, remove, blankRow, minRows = 12 }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | dirty | saving | saved | error
  const [filters, setFilters] = useState({});
  const [histSize, setHistSize] = useState({ past: 0, future: 0 });
  const [fill, setFill] = useState(null); // { col, key, value, from, to }

  const inputs = useRef({});
  const dirty = useRef(new Set());
  const timer = useRef(null);
  const rowsRef = useRef([]);
  const hist = useRef({ past: [], future: [] });
  const cfg = useRef({ blankRow, minRows, columns, save, replace, remove, load });
  cfg.current = { blankRow, minRows, columns, save, replace, remove, load };

  const newRow = (i) => ({ ...cfg.current.blankRow, _local: `l${i}-${Math.random().toString(36).slice(2)}` });

  const pad = useCallback((list) => {
    const out = [...list];
    while (out.length < cfg.current.minRows) out.push(newRow(out.length));
    return out;
  }, []);

  const commit = (next) => {
    rowsRef.current = next;
    setRows(next);
  };

  const refresh = useCallback(async () => {
    const data = await cfg.current.load();
    dirty.current = new Set();
    commit(pad(data));
    setStatus("idle");
  }, [pad]);

  useEffect(() => { refresh(); }, [refresh]);

  const rowValues = (r) => {
    const o = { status: r.status || "not_ready" };
    cfg.current.columns.forEach((c) => { o[c.key] = r[c.key] ?? ""; });
    return o;
  };

  const isBlank = (r) => cfg.current.columns.every((c) => String(r[c.key] ?? "").trim() === "");

  const flush = useCallback(async () => {
    const indices = [...dirty.current];
    const payload = indices
      .map((i) => ({ i, row: rowsRef.current[i] }))
      .filter(({ row }) => row && !isBlank(row))
      .map(({ row, i }) => ({ _i: i, id: row.id || null, row_index: row.row_index ?? i, ...rowValues(row) }));
    dirty.current = new Set();
    if (!payload.length) { setStatus("idle"); return; }
    setStatus("saving");
    try {
      const res = await cfg.current.save(payload.map(({ _i, ...rest }) => rest));
      (res?.saved || []).forEach(({ index, id }) => {
        const localIdx = payload[index]?._i;
        if (localIdx != null && rowsRef.current[localIdx] && !rowsRef.current[localIdx].id) {
          const next = [...rowsRef.current];
          next[localIdx] = { ...next[localIdx], id };
          commit(next);
        }
      });
      setStatus("saved");
    } catch (e) {
      payload.forEach(({ _i }) => dirty.current.add(_i));
      setStatus("error");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleSave = () => {
    setStatus("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, AUTOSAVE_MS);
  };

  const pushHistory = () => {
    hist.current.past.push(rowsRef.current);
    if (hist.current.past.length > 200) hist.current.past.shift();
    hist.current.future = [];
    setHistSize({ past: hist.current.past.length, future: 0 });
  };

  const applyPatch = (idx, patch) => {
    pushHistory();
    const next = rowsRef.current.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    if (idx >= next.length - 1) next.push(newRow(next.length));
    commit(next);
    dirty.current.add(idx);
    scheduleSave();
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
    const matrix = text.replace(/\r/g, "").split("\n").filter((l) => l.trim() !== "").map((l) => l.split("\t"));
    pushHistory();
    const next = [...rowsRef.current];
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
      dirty.current.add(target);
    });
    while (next.length < startRow + matrix.length + 1) next.push(newRow(next.length));
    commit(next);
    scheduleSave();
  };

  // Make the server match `target` exactly (used by undo / redo / delete).
  const pushWhole = async (target) => {
    if (timer.current) clearTimeout(timer.current);
    dirty.current = new Set();
    setStatus("saving");
    try {
      await cfg.current.replace(
        target.filter((r) => !isBlank(r)).map((r, i) => ({ id: null, row_index: i, ...rowValues(r) }))
      );
      await refresh();
      setStatus("saved");
    } catch (e) {
      setStatus("error");
    }
  };

  const step = async (from, to) => {
    if (!hist.current[from].length) return;
    const prev = rowsRef.current;
    const target = hist.current[from].pop();
    hist.current[to].push(prev);
    setHistSize({ past: hist.current.past.length, future: hist.current.future.length });
    commit(target);
    await pushWhole(target);
  };

  const undo = useCallback(() => step("past", "future"), []); // eslint-disable-line react-hooks/exhaustive-deps
  const redo = useCallback(() => step("future", "past"), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if (key === "r") { e.preventDefault(); redo(); }
      else if (key === "s") { e.preventDefault(); flush(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, flush]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const fillRef = useRef(null);

  const fillStart = (idx, colIndex, key, value) => {
    const f = { col: colIndex, key, value, from: idx, to: idx };
    fillRef.current = f;
    setFill(f);
  };

  const fillOver = (idx) => {
    if (!fillRef.current) return;
    const f = { ...fillRef.current, to: idx };
    fillRef.current = f;
    setFill(f);
  };

  const fillEnd = () => {
    const f = fillRef.current;
    fillRef.current = null;
    setFill(null);
    if (!f) return;
    const start = Math.min(f.from, f.to);
    const end = Math.max(f.from, f.to);
    if (start === end) return;
    pushHistory();
    const next = [...rowsRef.current];
    for (let i = start; i <= end; i++) {
      while (next.length <= i) next.push(newRow(next.length));
      next[i] = { ...next[i], [f.key]: f.value };
      dirty.current.add(i);
    }
    if (end >= next.length - 1) next.push(newRow(next.length));
    commit(next);
    scheduleSave();
  };

  const isInFill = (idx, colIndex) => {
    if (!fill || fill.col !== colIndex) return false;
    return idx >= Math.min(fill.from, fill.to) && idx <= Math.max(fill.from, fill.to);
  };

  useEffect(() => {
    const up = () => fillEnd();
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteRow = async (idx) => {    pushHistory();
    const row = rowsRef.current[idx];
    const next = pad(rowsRef.current.filter((_, i) => i !== idx));
    commit(next);
    dirty.current = new Set();
    if (row?.id) {
      setStatus("saving");
      try { await cfg.current.remove(row.id); setStatus("saved"); }
      catch (e) { setStatus("error"); }
    }
  };

  return {
    rows, filtered, filters, setFilters, setCell, setRow, onKeyDown, onPaste,
    status, flush, deleteRow, refresh, inputs,
    undo, redo, canUndo: histSize.past > 0, canRedo: histSize.future > 0,
    fillStart, fillOver, isInFill,
  };
}
