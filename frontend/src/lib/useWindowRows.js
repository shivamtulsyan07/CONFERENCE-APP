import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// Renders only the rows near the viewport so big sheets stay fast.
export function useWindowRows(total, rowHeight = 33, overscan = 14) {
  const scrollRef = useRef(null);
  const [range, setRange] = useState({ start: 0, end: 60 });

  const raf = useRef(0);
  const recompute = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const el = scrollRef.current;
      if (!el) return;
      const visible = Math.ceil((el.clientHeight || 600) / rowHeight);
      const start = Math.max(0, Math.floor(el.scrollTop / rowHeight) - overscan);
      const end = Math.min(total, start + visible + overscan * 2);
      setRange((p) => (p.start === start && p.end === end ? p : { start, end }));
    });
  }, [total, rowHeight, overscan]);

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  useLayoutEffect(() => { recompute(); }, [recompute]);

  useEffect(() => {
    const onResize = () => recompute();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [recompute]);

  const scrollToRow = useCallback((i) => {
    const el = scrollRef.current;
    if (!el) return;
    const top = i * rowHeight;
    if (top < el.scrollTop) el.scrollTop = Math.max(0, top - rowHeight * 3);
    else if (top > el.scrollTop + el.clientHeight - rowHeight * 2) el.scrollTop = top - el.clientHeight + rowHeight * 4;
    else return; // already visible: no scroll, no recompute
    recompute();
  }, [rowHeight, recompute]);

  return {
    scrollRef,
    onScroll: recompute,
    start: range.start,
    end: range.end,
    padTop: range.start * rowHeight,
    padBottom: Math.max(0, (total - range.end) * rowHeight),
    scrollToRow,
    rowHeight,
  };
}
