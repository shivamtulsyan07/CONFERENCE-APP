import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const AUTOSAVE_MS = 900;

// Spreadsheet engine: keyboard nav, excel paste, filters, autosave, undo/redo.
export function useSheet({ columns, allColumns, load, save, replace, remove, blankRow, minRows = 12 }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | dirty | saving | saved | error
  const [filters, setFilters] = useState({});
  const [histSize, setHistSize] = useState({ past: 0, future: 0 });
  const [fill, setFill] = useState(null); // { col, key, value, from, to }
  const [sel, setSel] = useState(null); // { r1, c1, r2, c2 }
  const selRef = useRef(null);
  const selecting = useRef(false);

  const inputs = useRef({});
  const dirty = useRef(new Set());
  const timer = useRef(null);
  const rowsRef = useRef([]);
  const hist = useRef({ past: [], future: [] });
  const cfg = useRef({ blankRow, minRows, columns, allColumns, save, replace, remove, load });
  cfg.current = { blankRow, minRows, columns, allColumns: allColumns || columns, save, replace, remove, load };

  const newRow = (i) => ({ ...cfg.current.blankRow, _local: `l${i}-${Math.random().toString(36).slice(2)}` });

  const pad = useCallback((list) => {
    const out = [...list];
    while (out.length < cfg.current.minRows) out.push(newRow(out.length));
    // always keep one trailing blank row so the last row is safe to type into
    const last = out[out.length - 1];
    if (!last || !isBlank(last)) out.push(newRow(out.length));
    return out;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    cfg.current.allColumns.forEach((c) => { o[c.key] = r[c.key] ?? ""; });
    return o;
  };

  const isBlank = (r) =>
    cfg.current.allColumns.every(
      (c) => String(r[c.key] ?? "").trim() === String(cfg.current.blankRow[c.key] ?? "").trim()
    );

  const flush = useCallback(async () => {
    const indices = [...dirty.current];
    const payload = indices
      .map((i) => ({ i, row: rowsRef.current[i] }))
      .filter(({ row }) => row && (!isBlank(row) || row.id))
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
    if (e.shiftKey && ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      const s = selRef.current || { r1: r, c1: c, r2: r, c2: c };
      const d = { ArrowDown: [1, 0], ArrowUp: [-1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
      extendTo(Math.max(0, s.r2 + d[0]), Math.min(lastCol, Math.max(0, s.c2 + d[1])));
      return;
    }
    if (e.key === "Enter" || (e.key === "ArrowDown" && !e.shiftKey)) {
      e.preventDefault(); focusCell(r + 1, c); setAnchor(r + 1, c);
    } else if (e.key === "ArrowUp") {
      e.preventDefault(); focusCell(r - 1, c); setAnchor(r - 1, c);
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) { if (c > 0) { focusCell(r, c - 1); setAnchor(r, c - 1); } else { focusCell(r - 1, lastCol); setAnchor(r - 1, lastCol); } }
      else if (c < lastCol) { focusCell(r, c + 1); setAnchor(r, c + 1); }
      else { focusCell(r + 1, 0); setAnchor(r + 1, 0); }
    }
  };

  const applyMatrix = (matrix, startRow, startCol) => {
    const cols = cfg.current.columns;
    pushHistory();
    const next = [...rowsRef.current];
    matrix.forEach((line, ri) => {
      const target = startRow + ri;
      while (next.length <= target) next.push(newRow(next.length));
      const patch = {};
      line.forEach((val, ci) => {
        const col = cols[startCol + ci];
        if (!col) return;
        patch[col.key] = col.numeric ? String(val).replace(/[^0-9.]/g, "") : String(val).trim();
      });
      next[target] = { ...next[target], ...patch };
      dirty.current.add(target);
    });
    while (next.length < startRow + matrix.length + 1) next.push(newRow(next.length));
    commit(next);
    scheduleSave();
  };

  const onPaste = (e, startRow, startCol) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    if (!text.includes("\t") && !text.includes("\n")) return;
    e.preventDefault();
    const matrix = text.replace(/\r/g, "").split("\n").filter((l) => l.trim() !== "").map((l) => l.split("\t"));
    applyMatrix(matrix, startRow, startCol);
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

  const setAnchor = (r, c) => {
    const s = { r1: r, c1: c, r2: r, c2: c };
    selRef.current = s;
    setSel(s);
  };

  const extendTo = (r, c) => {
    const s = selRef.current;
    if (!s) return setAnchor(r, c);
    const n = { ...s, r2: r, c2: c };
    selRef.current = n;
    setSel(n);
  };

  const selectStart = (r, c, shift) => {
    selecting.current = true;
    if (shift) extendTo(r, c);
    else setAnchor(r, c);
  };

  const selectOver = (r, c) => {
    if (!selecting.current) return;
    extendTo(r, c);
  };

  const isSelected = (r, c) => {
    const s = sel;
    if (!s) return false;
    if (s.r1 === s.r2 && s.c1 === s.c2) return false;
    return (
      r >= Math.min(s.r1, s.r2) && r <= Math.max(s.r1, s.r2) &&
      c >= Math.min(s.c1, s.c2) && c <= Math.max(s.c1, s.c2)
    );
  };

  const selBounds = () => {
    const s = selRef.current;
    if (!s) return null;
    return {
      r1: Math.min(s.r1, s.r2), r2: Math.max(s.r1, s.r2),
      c1: Math.min(s.c1, s.c2), c2: Math.max(s.c1, s.c2),
    };
  };

  const selectionText = () => {
    const b = selBounds();
    if (!b) return "";
    const cols = cfg.current.columns;
    const lines = [];
    for (let r = b.r1; r <= b.r2; r++) {
      const row = rowsRef.current[r] || {};
      const cells = [];
      for (let c = b.c1; c <= b.c2; c++) cells.push(String(row[cols[c].key] ?? ""));
      lines.push(cells.join("\t"));
    }
    return lines.join("\n");
  };

  const copySelection = async () => {
    const text = selectionText();
    if (!text) return false;
    try { await navigator.clipboard.writeText(text); } catch (e) { /* clipboard blocked */ }
    return true;
  };

  const clearSelection = () => {
    const b = selBounds();
    if (!b) return;
    const cols = cfg.current.columns;
    pushHistory();
    const next = [...rowsRef.current];
    for (let r = b.r1; r <= b.r2; r++) {
      if (!next[r]) continue;
      const patch = {};
      for (let c = b.c1; c <= b.c2; c++) patch[cols[c].key] = "";
      next[r] = { ...next[r], ...patch };
      dirty.current.add(r);
    }
    commit(next);
    scheduleSave();
  };

  const cutSelection = async () => {
    const ok = await copySelection();
    if (ok) clearSelection();
  };

  const pasteSelection = async () => {
    const b = selBounds();
    if (!b) return;
    let text = "";
    try { text = await navigator.clipboard.readText(); } catch (e) { return; }
    if (!text) return;
    const matrix = text.replace(/\r/g, "").split("\n").filter((l) => l !== "").map((l) => l.split("\t"));
    if (matrix.length) applyMatrix(matrix, b.r1, b.c1);
  };

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
    const up = () => { selecting.current = false; fillEnd(); };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const b = selBounds();
      const multi = b && (b.r1 !== b.r2 || b.c1 !== b.c2);
      const key = e.key.toLowerCase();
      if (key === "c" && multi) { e.preventDefault(); copySelection(); }
      else if (key === "x" && multi) { e.preventDefault(); cutSelection(); }
      else if (key === "v" && multi) { e.preventDefault(); pasteSelection(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const fillDownSelection = () => {
    const b = selBounds();
    if (!b) return;
    const cols = cfg.current.columns;
    pushHistory();
    const next = [...rowsRef.current];
    const srcRow = next[b.r1] || {};
    for (let r = b.r1 + 1; r <= b.r2; r++) {
      if (!next[r]) continue;
      const patch = {};
      for (let c = b.c1; c <= b.c2; c++) patch[cols[c].key] = srcRow[cols[c].key] ?? "";
      next[r] = { ...next[r], ...patch };
      dirty.current.add(r);
    }
    commit(next);
    scheduleSave();
  };

  const insertRow = async (idx, where = "above") => {
    pushHistory();
    const at = where === "below" ? idx + 1 : idx;
    const next = [...rowsRef.current];
    next.splice(at, 0, newRow(at));
    commit(next);
    await pushWhole(next);
  };

  const duplicateRow = async (idx) => {
    pushHistory();
    const src = rowsRef.current[idx];
    if (!src) return;
    const copy = { ...src, id: undefined, _local: `l${idx}-${Math.random().toString(36).slice(2)}` };
    const next = [...rowsRef.current];
    next.splice(idx + 1, 0, copy);
    commit(next);
    await pushWhole(next);
  };

  const clearRow = (idx) => {
    pushHistory();
    const next = [...rowsRef.current];
    if (!next[idx]) return;
    next[idx] = { ...next[idx], ...cfg.current.blankRow };
    dirty.current.add(idx);
    commit(next);
    scheduleSave();
  };

  const deleteRow = async (idx) => {
    pushHistory();
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
    selectStart, selectOver, isSelected, hasSelection: !!(sel && (sel.r1 !== sel.r2 || sel.c1 !== sel.c2)),
    copySelection, cutSelection, pasteSelection, clearSelection,
    insertRow, duplicateRow, clearRow, setAnchor, fillDownSelection,
  };
}
