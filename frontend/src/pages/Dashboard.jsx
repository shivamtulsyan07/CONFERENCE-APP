import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, money, errMsg } from "../lib/api";
import { Button } from "../components/ui/button";
import { HaanaAssistant } from "../components/HaanaAssistant";
import { toast } from "sonner";
import { Maximize2, Minimize2, RefreshCw, AlertTriangle, Factory, Boxes, Users, FilterX, Brain, ChevronRight } from "lucide-react";

const N = (n) => Number(n || 0).toLocaleString("en-IN");

const TONES = {
  base: "text-[color:var(--dash-text)]",
  good: "text-[color:var(--tone-good)]",
  warn: "text-[color:var(--tone-warn)]",
  bad: "text-[color:var(--tone-bad)]",
  accent: "text-[color:var(--tone-accent)]",
};

const Tile = ({ label, value, sub, tone = "base", testId, onClick }) => (
  <button
    type="button"
    data-testid={testId}
    onClick={onClick}
    className="group relative text-left border border-[color:var(--dash-line)] bg-[color:var(--dash-head)] px-3 py-2.5 transition-colors duration-200 hover:border-[color:var(--tone-accent)] hover:bg-[color:var(--dash-hover)]"
  >
    <div className="flex items-center justify-between gap-1">
      <span className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--dash-dim)] truncate">{label}</span>
      <ChevronRight className="h-3 w-3 text-[color:var(--dash-line)] group-hover:text-[color:var(--tone-accent)] transition-colors duration-200" />
    </div>
    <div className={`mt-1 text-xl lg:text-2xl font-black leading-none mono ${TONES[tone]}`}>{value}</div>
    {sub ? <div className="mt-1 text-[10px] text-[color:var(--dash-dim)] truncate mono">{sub}</div> : null}
    <span className="absolute left-0 top-0 h-full w-[2px] bg-[color:var(--dash-line)] group-hover:bg-[color:var(--tone-accent)] transition-colors duration-200" />
  </button>
);

const Panel = ({ title, icon: Icon, right, children, testId, className = "" }) => (
  <section data-testid={testId} className={`flex flex-col min-h-0 border border-[color:var(--dash-line)] bg-[color:var(--dash-panel)] ${className}`}>
    <header className="flex items-center justify-between gap-2 border-b border-[color:var(--dash-line)] px-3 py-2 bg-[color:var(--dash-head)] shrink-0">
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-3.5 w-3.5 text-[color:var(--tone-accent)]" /> : null}
        <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--dash-text)]">{title}</h3>
      </div>
      <div className="text-[10px] mono text-[color:var(--dash-dim)]">{right}</div>
    </header>
    <div className="min-h-0 flex-1 overflow-auto">{children}</div>
  </section>
);

const Th = ({ children, right }) => (
  <th className={`sticky top-0 z-10 bg-[color:var(--dash-head)] border-b border-[color:var(--dash-line)] px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[color:var(--dash-dim)] whitespace-nowrap ${right ? "text-right" : "text-left"}`}>
    {children}
  </th>
);

const Td = ({ children, right, tone, mono = true }) => (
  <td className={`border-b border-[color:var(--dash-line)] px-2 py-1.5 text-xs whitespace-nowrap ${right ? "text-right" : ""} ${mono ? "mono" : ""} ${tone || "text-[color:var(--dash-text)]"}`}>
    {children}
  </td>
);

const Empty = ({ text }) => <p className="px-3 py-4 text-xs text-[color:var(--dash-dim)]">{text}</p>;

const Select = ({ label, value, options, onChange, testId }) => (
  <label className="flex items-center gap-1.5">
    <span className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--dash-dim)]">{label}</span>
    <select
      data-testid={testId}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 max-w-[190px] border border-[color:var(--dash-line)] bg-[color:var(--dash-head)] px-2 text-[11px] text-[color:var(--dash-text)] outline-none focus:border-[color:var(--tone-accent)] transition-colors duration-200"
    >
      <option value="">ALL</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  </label>
);

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(false);
  const [full, setFull] = useState(false);
  const [f, setF] = useState({ conference: "", group: "", party: "", item: "" });
  const fRef = useRef(f);
  fRef.current = f;
  const wrapRef = useRef(null);
  const navigate = useNavigate();

  const load = useCallback((filters) => {
    setLoading(true);
    return api
      .overview(filters ?? fRef.current)
      .then(setD)
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(f); }, [f, load]);

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
        await wrapRef.current?.requestFullscreen();
        setFull(true);
      }
    } catch {
      setFull((v) => !v);
    }
  };

  const seed = async () => {
    const r = await api.seed();
    toast[r.seeded ? "success" : "info"](r.seeded ? "Sample sheet loaded" : r.message);
    load(f);
  };

  // drill down: open the target sheet pre-searched with the most specific active filter
  const drill = (path, term) => {
    const q = term || f.item || f.party || f.group || f.conference || "";
    navigate(q ? `${path}?q=${encodeURIComponent(q)}` : path);
  };

  const opts = d?.filter_options || { conferences: [], groups: [], parties: [], items: [] };
  const k = d?.kpis;
  const ready = d?.status_counts?.ready || 0;
  const readyPct = useMemo(() => (k?.order_rows ? Math.round((100 * ready) / k.order_rows) : 0), [k, ready]);
  const filterCount = Object.values(f).filter(Boolean).length;

  const chips = useMemo(() => {
    const base = [];
    if (f.party) base.push(`What is the position of ${f.party}?`);
    if (f.group) base.push(`What must I order in group ${f.group}?`);
    base.push("What is pending with the company?", "Which party has the most pending rows?", "Top 5 items to order from the company");
    return base.slice(0, 4);
  }, [f.party, f.group]);

  return (
    <div
      ref={wrapRef}
      data-testid="dashboard-page"
      className={`bg-[color:var(--dash-bg)] text-[color:var(--dash-text)] overflow-auto h-full ${
        full ? "fixed inset-0 z-[60] p-3" : "p-2"
      }`}
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[color:var(--dash-line)] pb-3">
        <div>
          <h1 className="text-lg lg:text-2xl font-black tracking-tight uppercase">Operations Control Room</h1>
          <p className="text-[11px] text-[color:var(--dash-dim)] mono mt-0.5">conference demand · in-house stock · company pipeline</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" data-testid="seed-btn" onClick={seed}
            className="h-8 border-[color:var(--dash-line)] bg-transparent text-[11px] uppercase tracking-wide text-[color:var(--dash-dim)] hover:bg-[color:var(--dash-hover)] hover:text-white">
            Load sample data
          </Button>
          <Button variant="outline" size="sm" data-testid="refresh-btn" onClick={() => load()}
            className="h-8 border-[color:var(--dash-line)] bg-transparent text-[11px] uppercase tracking-wide text-[color:var(--dash-dim)] hover:bg-[color:var(--dash-hover)] hover:text-white">
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" data-testid="fullscreen-btn" onClick={toggleFull}
            className="h-8 bg-[color:var(--tone-accent)] text-[color:var(--dash-bg)] text-[11px] font-bold uppercase tracking-wide hover:bg-[color:var(--tone-accent)]">
            {full ? <Minimize2 className="h-3.5 w-3.5 mr-1.5" /> : <Maximize2 className="h-3.5 w-3.5 mr-1.5" />}
            {full ? "Exit full screen" : "Full screen"}
          </Button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 border border-[color:var(--dash-line)] bg-[color:var(--dash-panel)] px-3 py-2" data-testid="global-filter-bar">
        <Select label="Conference" testId="filter-conference" value={f.conference} options={opts.conferences}
          onChange={(v) => setF((p) => ({ ...p, conference: v }))} />
        <Select label="Group" testId="filter-group" value={f.group} options={opts.groups}
          onChange={(v) => setF((p) => ({ ...p, group: v }))} />
        <Select label="Party" testId="filter-party" value={f.party} options={opts.parties}
          onChange={(v) => setF((p) => ({ ...p, party: v }))} />
        <Select label="Item" testId="filter-item" value={f.item} options={opts.items}
          onChange={(v) => setF((p) => ({ ...p, item: v }))} />
        {filterCount > 0 && (
          <button data-testid="clear-filters-btn" onClick={() => setF({ conference: "", group: "", party: "", item: "" })}
            className="flex items-center gap-1 border border-[color:var(--dash-line)] px-2 py-1 text-[10px] uppercase tracking-wide text-[color:var(--tone-warn)] hover:border-[color:var(--tone-warn)] transition-colors duration-200">
            <FilterX className="h-3 w-3" /> Clear ({filterCount})
          </button>
        )}
        <span className="text-[10px] mono text-[color:var(--dash-dim)] ml-auto">filters apply to every tile & table</span>
      </div>

      {!d ? (
        <p className="mt-6 text-xs text-[color:var(--dash-dim)] mono">Loading dashboard…</p>
      ) : (
        <>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2">
            <Tile testId="kpi-order-qty" label="Conference qty" value={N(k.order_qty)} sub={`${N(k.order_rows)} rows`} tone="accent" onClick={() => drill("/orders")} />
            <Tile testId="kpi-order-value" label="Order value" value={money(k.order_amount)} sub={`${N(k.billed_rows)} billed / ${N(k.unbilled_rows)} not`} onClick={() => drill("/orders")} />
            <Tile testId="kpi-stock-qty" label="In house stock" value={N(k.stock_qty)} sub={`${N(k.stock_lines)} lines`} tone="good" onClick={() => drill("/stock")} />
            <Tile testId="kpi-shortfall" label="To order from company" value={N(k.shortfall_qty)} sub={`${N(k.shortfall_lines)} short lines`} tone={k.shortfall_qty > 0 ? "bad" : "good"} onClick={() => drill("/company-order")} />
            <Tile testId="kpi-pending-company" label="Pending at company" value={N(k.pending_company_qty)} sub={`${N(k.pending_company_lines)} lines awaited`} tone={k.pending_company_qty > 0 ? "warn" : "good"} onClick={() => drill("/company-balance")} />
            <Tile testId="kpi-arrived" label="Sent / arrived" value={`${N(k.sent_qty)} / ${N(k.arrived_qty)}`} sub="company pipeline" onClick={() => drill("/stock-arrived")} />
            <Tile testId="kpi-ready" label="Rows ready" value={`${readyPct}%`} sub={`${N(ready)} of ${N(k.order_rows)} rows`} tone={readyPct >= 80 ? "good" : "warn"} onClick={() => drill("/summary")} />
          </div>

          <div className="mt-2 grid grid-cols-1 xl:grid-cols-3 gap-2">
            <Panel testId="panel-pending-company" title="Pending reminder — with company" icon={AlertTriangle}
              right={`${d.pending_company.length} lines`} className="max-h-[380px]">
              {d.pending_company.length === 0 ? (
                <Empty text="Nothing pending. All sent quantities have arrived." />
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr><Th>Group</Th><Th>Item</Th><Th>Shade</Th><Th right>Sent</Th><Th right>Arrived</Th><Th right>Pending</Th><Th>Last sent</Th></tr>
                  </thead>
                  <tbody>
                    {d.pending_company.map((r, i) => (
                      <tr key={`${r.group}-${r.item}-${r.shade}`} onClick={() => drill("/company-balance", r.item)}
                        className="cursor-pointer hover:bg-[color:var(--dash-hover)] transition-colors duration-150" data-testid={`pending-row-${i}`}>
                        <Td>{r.group || "—"}</Td>
                        <Td tone="text-[color:var(--dash-text)]">{r.item}</Td>
                        <Td>{r.shade || "—"}</Td>
                        <Td right>{N(r.sent_qty)}</Td>
                        <Td right tone="text-[color:var(--tone-good)]">{N(r.arrived_qty)}</Td>
                        <Td right tone="text-[color:var(--tone-warn)] font-bold">{N(r.balance_qty)}</Td>
                        <Td tone="text-[color:var(--dash-dim)]">{r.last_date || "—"}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            <Panel testId="panel-shortfalls" title="Shortfall — order from company" icon={Factory}
              right={`${d.shortfalls.length} lines`} className="max-h-[380px]">
              {d.shortfalls.length === 0 ? (
                <Empty text="No shortage. In-house stock covers all conference demand." />
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr><Th>Group</Th><Th>Item</Th><Th>Shade</Th><Th right>Demand</Th><Th right>Stock</Th><Th right>To order</Th></tr>
                  </thead>
                  <tbody>
                    {d.shortfalls.map((r, i) => (
                      <tr key={`${r.group}-${r.item}-${r.shade}`} onClick={() => drill("/company-order", r.item)}
                        className="cursor-pointer hover:bg-[color:var(--dash-hover)] transition-colors duration-150" data-testid={`shortfall-row-${i}`}>
                        <Td>{r.group || "—"}</Td>
                        <Td tone="text-[color:var(--dash-text)]">{r.item}</Td>
                        <Td>{r.shade || "—"}</Td>
                        <Td right>{N(r.ordered_qty)}</Td>
                        <Td right>{N(r.stock_qty)}</Td>
                        <Td right tone="text-[color:var(--tone-bad)] font-bold">{N(r.to_order)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            <Panel testId="panel-haana" title="Haana — ask your data" icon={Brain} right="claude sonnet 4.6" className="h-[380px]">
              <HaanaAssistant suggestionsFor={chips} />
            </Panel>
          </div>

          <div className="mt-2 grid grid-cols-1 xl:grid-cols-3 gap-2">
            <Panel testId="panel-party-wise" title="Party wise conference summary" icon={Users}
              right={`${d.party_wise.length} parties`} className={`xl:col-span-2 ${full ? "max-h-[calc(100vh-470px)]" : "max-h-[440px]"}`}>
              {d.party_wise.length === 0 ? (
                <Empty text="No party orders yet." />
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <Th>Party</Th><Th right>Rows</Th><Th right>Items</Th><Th right>Qty</Th>
                      <Th right>Value</Th><Th right>Ready</Th><Th right>Pending</Th><Th right>Billed</Th><Th>Readiness</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.party_wise.map((p, i) => (
                      <tr key={p.party} onClick={() => setF((prev) => ({ ...prev, party: p.party }))}
                        className="cursor-pointer hover:bg-[color:var(--dash-hover)] transition-colors duration-150" data-testid={`party-row-${i}`}>
                        <Td mono={false} tone="text-[color:var(--dash-text)] font-medium">{p.party}</Td>
                        <Td right>{N(p.rows)}</Td>
                        <Td right>{N(p.items)}</Td>
                        <Td right tone="text-[color:var(--tone-accent)] font-bold">{N(p.qty)}</Td>
                        <Td right>{money(p.amount)}</Td>
                        <Td right tone="text-[color:var(--tone-good)]">{N(p.ready)}</Td>
                        <Td right tone={p.pending ? "text-[color:var(--tone-warn)]" : "text-[color:var(--dash-dim)]"}>{N(p.pending)}</Td>
                        <Td right>{N(p.billed)}</Td>
                        <Td>
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <div className="h-1.5 w-20 bg-[color:var(--dash-line)]">
                              <div className="h-full bg-[color:var(--tone-good)] transition-all duration-500" style={{ width: `${p.ready_pct}%` }} />
                            </div>
                            <span className="text-[10px] mono text-[color:var(--dash-dim)]">{p.ready_pct}%</span>
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            <Panel testId="panel-top-items" title="Top items by quantity" icon={Boxes}
              right={`${d.item_wise.length} items`} className={full ? "max-h-[calc(100vh-470px)]" : "max-h-[440px]"}>
              {d.item_wise.length === 0 ? (
                <Empty text="No items ordered yet." />
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr><Th>Item</Th><Th>Group</Th><Th right>Qty</Th><Th right>Rows</Th><Th right>Parties</Th></tr>
                  </thead>
                  <tbody>
                    {d.item_wise.map((r, i) => (
                      <tr key={`${r.group}-${r.item}`} onClick={() => setF((prev) => ({ ...prev, item: r.item }))}
                        className="cursor-pointer hover:bg-[color:var(--dash-hover)] transition-colors duration-150" data-testid={`item-row-${i}`}>
                        <Td tone="text-[color:var(--dash-text)]">{r.item}</Td>
                        <Td>{r.group || "—"}</Td>
                        <Td right tone="text-[color:var(--tone-accent)] font-bold">{N(r.qty)}</Td>
                        <Td right>{N(r.rows)}</Td>
                        <Td right>{N(r.parties)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
