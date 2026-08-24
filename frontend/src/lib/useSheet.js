import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { matchRow, activeCount } from "./filters";

const AUTOSAVE_MS = 900;

// Spreadsheet engine: keyboard nav, excel paste, filters, autosave, undo/redo.
export function useSheet({ columns, allColumns, load, save, replace, remove, blankRow, minRows = 12 }) {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | dirty | saving | saved | error
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState("");
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
    const next = rowsRef.current.slice();
    next[idx] = { ...next[idx], ...patch };
    if (idx >= next.length - 1) next.push(newRow(next.length));
    commit(next);
    dirty.current.add(idx);
    scheduleSave();
  };

  const setCell = (idx, key, value) => applyPatch(idx, { [key]: value });
  const setRow = (idx, patch) => applyPatch(idx, patch);

  const wrapCache = useRef(new Map());

  const filtered = useMemo(() => {
    // reuse the {row, idx} wrapper of unchanged rows so a keystroke allocates one object, not N
    const cache = wrapCache.current;
    const next = new Map();
    const all = rows.map((r, i) => {
      const hit = cache.get(r);
      const w = hit && hit.idx === i ? hit : { row: r, idx: i };
      next.set(r, w);
      return w;
    });
    wrapCache.current = next;
    const colsByKey = Object.fromEntries(columns.map((c) => [c.key, c]));
    const anyFilter = Object.values(filters || {}).some((f) => f && typeof f === "object");
    if (!anyFilter && !search.trim()) return all;
    return all.filter(({ row }) => isBlank(row) || matchRow(row, filters, colsByKey, search));
  }, [rows, filters, columns, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const ensureRef = useRef(null);

  const focusCell = (r, c) => {
    const el = inputs.current[`${r}-${c}`];
    if (el) { el.focus(); el.select?.(); return; }
    // row may be outside the rendered window: scroll it in, then focus
    ensureRef.current?.(r);
    requestAnimationFrame(() => {
      const el2 = inputs.current[`${r}-${c}`];
      if (el2) { el2.focus(); el2.select?.(); }
    });
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

  const applyMatrix = (matrix, startRow, startCol, repeatTo = null) => {
    const cols = cfg.current.columns;
    pushHistory();
    const next = [...rowsRef.current];
    // repeat the copied block across the target range, like Excel
    const rowSpan = repeatTo ? Math.max(matrix.length, repeatTo.r2 - startRow + 1) : matrix.length;
    const colSpan = repeatTo
      ? Math.max(matrix[0]?.length || 0, repeatTo.c2 - startCol + 1)
      : matrix[0]?.length || 0;
    for (let ri = 0; ri < rowSpan; ri++) {
      const target = startRow + ri;
      while (next.length <= target) next.push(newRow(next.length));
      const line = matrix[ri % matrix.length];
      const patch = {};
      for (let ci = 0; ci < colSpan; ci++) {
        const col = cols[startCol + ci];
        if (!col) continue;
        const val = line[ci % line.length];
        patch[col.key] = col.numeric ? String(val).replace(/[^0-9.]/g, "") : String(val).trim();
      }
      next[target] = { ...next[target], ...patch };
      dirty.current.add(target);
    }
    while (next.length < startRow + rowSpan + 1) next.push(newRow(next.length));
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
    const p = selRef.current;
    selRef.current = s;
    // a single-cell anchor that didn't move needs no re-render
    if (p && p.r1 === r && p.c1 === c && p.r2 === r && p.c2 === c) return;
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
    const multi = b.r1 !== b.r2 || b.c1 !== b.c2;
    if (matrix.length) applyMatrix(matrix, b.r1, b.c1, multi ? b : null);
  };

  // ---- fill (drag the corner handle): block-aware, unlimited rows ----
  const fillStart = (rowIndex, colIndex) => {
    const b = selBounds();
    const inSel = b && rowIndex >= b.r1 && rowIndex <= b.r2 && colIndex >= b.c1 && colIndex <= b.c2;
    const src = inSel ? b : { r1: rowIndex, r2: rowIndex, c1: colIndex, c2: colIndex };
    const f = { src, to: src.r2 };
    fillRef.current = f;
    setFill(f);
  };

  const fillOver = (rowIndex) => {
    const f = fillRef.current;
    if (!f || f.to === rowIndex) return;
    const n = { ...f, to: rowIndex };
    fillRef.current = n;
    setFill(n);
  };

  const fillEnd = () => {
    const f = fillRef.current;
    fillRef.current = null;
    setFill(null);
    if (!f) return;
    const cols = cfg.current.columns;
    const { src } = f;
    const height = src.r2 - src.r1 + 1;
    const down = f.to > src.r2;
    const up = f.to < src.r1;
    if (!down && !up) return;
    pushHistory();
    const next = [...rowsRef.current];
    const block = [];
    for (let r = src.r1; r <= src.r2; r++) block.push(next[r] || {});

    if (down) {
      for (let r = src.r2 + 1; r <= f.to; r++) {
        while (next.length <= r) next.push(newRow(next.length));
        const source = block[(r - src.r1) % height];
        const patch = {};
        for (let c = src.c1; c <= src.c2; c++) if (cols[c]) patch[cols[c].key] = source[cols[c].key] ?? "";
        next[r] = { ...next[r], ...patch };
        dirty.current.add(r);
      }
      if (f.to >= next.length - 1) next.push(newRow(next.length));
    } else {
      for (let r = src.r1 - 1; r >= Math.max(0, f.to); r--) {
        const offset = ((src.r1 - r) % height + height - 1) % height;
        const source = block[height - 1 - offset];
        const patch = {};
        for (let c = src.c1; c <= src.c2; c++) if (cols[c]) patch[cols[c].key] = source[cols[c].key] ?? "";
        next[r] = { ...next[r], ...patch };
        dirty.current.add(r);
      }
    }
    commit(next);
    scheduleSave();
  };

  const isInFill = (idx, colIndex) => {
    if (!fill) return false;
    const { src, to } = fill;
    if (colIndex < src.c1 || colIndex > src.c2) return false;
    return idx >= Math.min(src.r1, to) && idx <= Math.max(src.r2, to);
  };

  const upRef = useRef(null);
  upRef.current = () => { selecting.current = false; stopAutoScroll(); fillEnd(); };

  useEffect(() => {
    const up = () => upRef.current?.();
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- unlimited drag: auto-scroll + row index from pointer position ----
  const scrollElRef = useRef(null);
  const autoRef = useRef({ raf: 0, dy: 0, y: 0 });

  const gridEl = () => scrollElRef.current || document.querySelector(".sheet-scroll");
  const winRecalcRef = useRef(null);

  const rowFromPointer = (clientY) => {
    const el = gridEl();
    if (!el) return null;
    const head = el.querySelector("thead");
    const headH = head ? head.offsetHeight : 0;
    const box = el.getBoundingClientRect();
    const y = clientY - box.top - headH + el.scrollTop;
    const idx = Math.floor(y / 33);
    if (idx < 0) return 0;
    return idx;
  };

  const stopAutoScroll = () => {
    if (autoRef.current.raf) cancelAnimationFrame(autoRef.current.raf);
    autoRef.current.raf = 0;
    autoRef.current.dy = 0;
  };

  const tickAutoScroll = () => {
    const el = gridEl();
    const a = autoRef.current;
    if (!el || !a.dy || (!selecting.current && !fillRef.current)) { stopAutoScroll(); return; }
    el.scrollTop += a.dy;
    winRecalcRef.current?.();
    const r = rowFromPointer(a.y);
    if (r != null) {
      if (fillRef.current) fillOver(r);
      else if (selecting.current) extendTo(r, selRef.current?.c2 ?? 0);
    }
    a.raf = requestAnimationFrame(tickRef.current);
  };
  const tickRef = useRef(null);
  tickRef.current = tickAutoScroll;

  const moveRef = useRef(null);
  moveRef.current = (e) => {
    if (!selecting.current && !fillRef.current) return;
    const el = gridEl();
    if (!el) return;
    const box = el.getBoundingClientRect();
    const a = autoRef.current;
    a.y = e.clientY;
    // auto-scroll whenever the cursor reaches the last (or first) row visible in the viewport
    const r = rowFromPointer(e.clientY);
    const head = el.querySelector("thead");
    const foot = el.querySelector("tfoot");
    const headH = head ? head.offsetHeight : 0;
    const footH = foot ? foot.offsetHeight : 0;
    const usable = Math.max(3 * 33, el.clientHeight - headH - footH);
    const firstVisible = Math.floor(el.scrollTop / 33);
    const lastVisible = Math.floor((el.scrollTop + usable) / 33) - 1;
    const pastBottom = e.clientY > Math.min(box.bottom, window.innerHeight) - 6;
    if (r >= lastVisible - 1 || pastBottom) a.dy = 28;
    else if (r <= firstVisible + 1 && el.scrollTop > 0) a.dy = -28;
    else a.dy = 0;
    if (a.dy && !a.raf) a.raf = requestAnimationFrame(tickRef.current);
    if (!a.dy) stopAutoScroll();
    // keep tracking the row under the cursor even where rows are not mounted yet
    if (r != null) {
      if (fillRef.current) fillOver(r);
      else if (selecting.current) extendTo(r, selRef.current?.c2 ?? 0);
    }
  };

  // registered once: re-registering per render would cancel the auto-scroll loop
  useEffect(() => {
    const h = (e) => moveRef.current?.(e);
    window.addEventListener("mousemove", h);
    return () => { window.removeEventListener("mousemove", h); stopAutoScroll(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lastDataRow = () => {
    const rws = rowsRef.current;
    for (let i = rws.length - 1; i >= 0; i--) if (!isBlank(rws[i])) return i;
    return 0;
  };

  const selectAll = () => {
    const s = { r1: 0, c1: 0, r2: lastDataRow(), c2: cfg.current.columns.length - 1 };
    selRef.current = s;
    setSel(s);
  };

  useEffect(() => {
    const handler = (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const b = selBounds();
      const multi = b && (b.r1 !== b.r2 || b.c1 !== b.c2);
      const key = e.key.toLowerCase();
      if (e.shiftKey && ["arrowdown", "arrowup", "arrowright", "arrowleft"].includes(key)) {
        if (!b) return;
        e.preventDefault();
        const s = selRef.current;
        const to = {
          arrowdown: { r2: lastDataRow(), c2: s.c2 },
          arrowup: { r2: 0, c2: s.c2 },
          arrowright: { r2: s.r2, c2: cfg.current.columns.length - 1 },
          arrowleft: { r2: s.r2, c2: 0 },
        }[key];
        const n = { ...s, ...to };
        selRef.current = n;
        setSel(n);
        return;
      }
      if (key === "a") { e.preventDefault(); selectAll(); }
      else if (key === "d" && b) { e.preventDefault(); fillDownSelection(); }
      else if (key === "c" && multi) { e.preventDefault(); copySelection(); }
      else if (key === "x" && multi) { e.preventDefault(); cutSelection(); }
      else if (key === "v" && multi) { e.preventDefault(); pasteSelection(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e) => {
      if (e.key !== "Delete") return;
      const b = selBounds();
      if (!b || (b.r1 === b.r2 && b.c1 === b.c2)) return;
      e.preventDefault();
      clearSelection();
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

  const dataCount = useMemo(
    () => filtered.reduce((n, { row }) => (isBlank(row) ? n : n + 1), 0),
    [filtered] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return {
    rows, filtered, filters, setFilters, setCell, setRow, onKeyDown, onPaste,
    dataCount,
    search, setSearch,
    setFilter: (key, f) => setFilters((prev) => ({ ...prev, [key]: f })),
    clearFilters: () => { setFilters({}); setSearch(""); },
    filterCount: activeCount(filters) + (search.trim() ? 1 : 0),
    status, flush, deleteRow, refresh, inputs,
    setEnsureVisible: (fn) => { ensureRef.current = fn; },
    setScrollEl: (el) => { scrollElRef.current = el; },
    setWindowRecalc: (fn) => { winRecalcRef.current = fn; },
    selectAll,
    selInfo: (() => {
      const s = sel;
      if (!s) return null;
      const rows_ = Math.abs(s.r2 - s.r1) + 1;
      const cols_ = Math.abs(s.c2 - s.c1) + 1;
      return { rows: rows_, cols: cols_, cells: rows_ * cols_ };
    })(),
    undo, redo, canUndo: histSize.past > 0, canRedo: histSize.future > 0,
    fillStart, fillOver, isInFill,
    selectStart, selectOver, isSelected, hasSelection: !!(sel && (sel.r1 !== sel.r2 || sel.c1 !== sel.c2)),
    copySelection, cutSelection, pasteSelection, clearSelection,
    insertRow, duplicateRow, clearRow, setAnchor, fillDownSelection,
  };
}
