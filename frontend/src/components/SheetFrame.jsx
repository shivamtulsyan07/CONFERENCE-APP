import { useRef, useState, useEffect } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

// Full-height frame used by every sheet: compact header, fixed toolbar, grid scrolls inside.
export const SheetFrame = ({ title, subtitle, actions, stats, children, testId, footNote }) => {
  const ref = useRef(null);
  const [full, setFull] = useState(false);

  useEffect(() => {
    const onChange = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFull = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setFull(false);
      } else {
        await ref.current?.requestFullscreen();
        setFull(true);
      }
    } catch {
      setFull((v) => !v);
    }
  };

  return (
    <div
      ref={ref}
      data-testid={testId}
      className={`sheet-page bg-background text-foreground ${full ? "fixed inset-0 z-[60] p-2" : ""}`}
    >
      <div className="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-2 px-1 pb-2">
        <div className="min-w-0">
          <h1 className="text-base md:text-lg font-black uppercase tracking-tight leading-none truncate">{title}</h1>
          {subtitle && <p className="text-[11px] text-muted-foreground mt-1 leading-snug line-clamp-1">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 ml-auto">
          {actions}
          <button
            data-testid={`${testId}-fullscreen-btn`}
            onClick={toggleFull}
            title="Full screen"
            className="flex items-center gap-1.5 h-8 px-2.5 border border-border text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground hover:border-accent transition-colors duration-200"
          >
            {full ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            {full ? "Exit" : "Full screen"}
          </button>
        </div>
      </div>

      {stats && <div className="shrink-0 px-1 pb-2">{stats}</div>}

      {children}

      {footNote && <div className="shrink-0 px-1 pt-1 text-[10px] text-muted-foreground mono">{footNote}</div>}
    </div>
  );
};

export const StatStrip = ({ items }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
    {items.map(([label, value, tid]) => (
      <div key={tid} data-testid={tid} className="border border-border bg-[color:var(--sheet-bg)] px-3 py-2">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground truncate">{label}</div>
        <div className="mt-0.5 text-lg font-black mono leading-none">{value}</div>
      </div>
    ))}
  </div>
);
