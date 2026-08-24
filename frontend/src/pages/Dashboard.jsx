import { useEffect, useMemo, useRef, useState } from "react";
import { api, money, errMsg } from "../lib/api";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { Maximize2, Minimize2, RefreshCw, AlertTriangle, Factory, Boxes, Users } from "lucide-react";

const N = (n) => Number(n || 0).toLocaleString("en-IN");

const Tile = ({ label, value, sub, tone = "base", testId }) => {
  const tones = {
    base: "text-[#e8edf5]",
    good: "text-[#7CE28A]",
    warn: "text-[#FFC44D]",
    bad: "text-[#FF6B6B]",
    accent: "text-[#63A9FF]",
  };
  return (
    <div
      data-testid={testId}
      className="group relative border border-[#1e2836] bg-[#0d131c] px-3 py-2.5 transition-colors duration-200 hover:border-[#2e3f56] hover:bg-[#111925]"
    >
      <div className="text-[10px] uppercase tracking-[0.14em] text-[#67778e] truncate">{label}</div>
      <div className={`mt-1 text-xl lg:text-2xl font-black leading-none mono ${tones[tone]}`}>{value}</div>
      {sub ? <div className="mt-1 text-[10px] text-[#5b6b81] truncate mono">{sub}</div> : null}
      <span className="absolute left-0 top-0 h-full w-[2px] bg-[#1e2836] group-hover:bg-[#63A9FF] transition-colors duration-200" />
    </div>
  );
};

const Panel = ({ title, icon: Icon, right, children, testId, className = "" }) => (
  <section
    data-testid={testId}
    className={`flex flex-col min-h-0 border border-[#1e2836] bg-[#0b1017] ${className}`}
  >
    <header className="flex items-center justify-between gap-2 border-b border-[#1e2836] px-3 py-2 bg-[#0d131c] shrink-0">
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-3.5 w-3.5 text-[#63A9FF]" /> : null}
        <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#c3cede]">{title}</h3>
      </div>
      <div className="text-[10px] mono text-[#5b6b81]">{right}</div>
    </header>
    <div className="min-h-0 flex-1 overflow-auto">{children}</div>
  </section>
);

const Th = ({ children, right }) => (
  <th
    className={`sticky top-0 z-10 bg-[#101825] border-b border-[#1e2836] px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7d8ea6] whitespace-nowrap ${
      right ? "text-right" : "text-left"
    }`}
  >
    {children}
  </th>
);

const Td = ({ children, right, tone, mono = true }) => (
  <td
    className={`border-b border-[#161f2b] px-2 py-1.5 text-xs whitespace-nowrap ${right ? "text-right" : ""} ${
      mono ? "mono" : ""
    } ${tone || "text-[#c8d3e2]"}`}
  >
    {children}
  </td>
);

const Empty = ({ text }) => (
  <p className="px-3 py-4 text-xs text-[#5b6b81]">{text}</p>
);

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(false);
  const [full, setFull] = useState(false);
  const wrapRef = useRef(null);

  const load = () => {
    setLoading(true);
    return api
      .overview()
      .then(setD)
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const onChange = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFull = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await wrapRef.current?.requestFullscreen();
    } catch {
      setFull((f) => !f);
    }
  };

  const seed = async () => {
    const r = await api.seed();
    toast[r.seeded ? "success" : "info"](r.seeded ? "Sample sheet loaded" : r.message);
    load();
  };

  const k = d?.kpis;
  const ready = d?.status_counts?.ready || 0;
  const readyPct = useMemo(
    () => (k?.order_rows ? Math.round((100 * ready) / k.order_rows) : 0),
    [k, ready]
  );

  return (
    <div
      ref={wrapRef}
      data-testid="dashboard-page"
      className={`bg-[#070b11] text-[#e8edf5] ${
        full ? "fixed inset-0 z-[60] overflow-auto p-3" : "-m-4 lg:-m-8 p-3 lg:p-5 min-h-[calc(100vh-3.5rem)]"
      }`}
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#1e2836] pb-3">
        <div>
          <h1 className="text-lg lg:text-2xl font-black tracking-tight uppercase">
            Operations Control Room
          </h1>
          <p className="text-[11px] text-[#67778e] mono mt-0.5">
            conference demand · in-house stock · company pipeline
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            data-testid="seed-btn"
            onClick={seed}
            className="h-8 border-[#243044] bg-transparent text-[11px] uppercase tracking-wide text-[#a8b6c9] hover:bg-[#131c28] hover:text-white"
          >
            Load sample data
          </Button>
          <Button
            variant="outline"
            size="sm"
            data-testid="refresh-btn"
            onClick={load}
            className="h-8 border-[#243044] bg-transparent text-[11px] uppercase tracking-wide text-[#a8b6c9] hover:bg-[#131c28] hover:text-white"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            data-testid="fullscreen-btn"
            onClick={toggleFull}
            className="h-8 bg-[#63A9FF] text-[#07111f] text-[11px] font-bold uppercase tracking-wide hover:bg-[#8cc0ff]"
          >
            {full ? <Minimize2 className="h-3.5 w-3.5 mr-1.5" /> : <Maximize2 className="h-3.5 w-3.5 mr-1.5" />}
            {full ? "Exit full screen" : "Full screen"}
          </Button>
        </div>
      </div>

      {!d ? (
        <p className="mt-6 text-xs text-[#5b6b81] mono">Loading dashboard…</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2">
            <Tile testId="kpi-order-qty" label="Conference qty" value={N(k.order_qty)} sub={`${N(k.order_rows)} rows`} tone="accent" />
            <Tile testId="kpi-order-value" label="Order value" value={money(k.order_amount)} sub={`${N(k.billed_rows)} billed / ${N(k.unbilled_rows)} not`} />
            <Tile testId="kpi-stock-qty" label="In house stock" value={N(k.stock_qty)} sub={`${N(k.stock_lines)} lines`} tone="good" />
            <Tile testId="kpi-shortfall" label="To order from company" value={N(k.shortfall_qty)} sub={`${N(k.shortfall_lines)} short lines`} tone={k.shortfall_qty > 0 ? "bad" : "good"} />
            <Tile testId="kpi-pending-company" label="Pending at company" value={N(k.pending_company_qty)} sub={`${N(k.pending_company_lines)} lines awaited`} tone={k.pending_company_qty > 0 ? "warn" : "good"} />
            <Tile testId="kpi-arrived" label="Sent / arrived" value={`${N(k.sent_qty)} / ${N(k.arrived_qty)}`} sub="company pipeline" />
            <Tile testId="kpi-ready" label="Rows ready" value={`${readyPct}%`} sub={`${N(ready)} of ${N(k.order_rows)} rows`} tone={readyPct >= 80 ? "good" : "warn"} />
          </div>

          <div className="mt-2 grid grid-cols-1 xl:grid-cols-3 gap-2">
            <Panel
              testId="panel-pending-company"
              title="Pending reminder — with company"
              icon={AlertTriangle}
              right={`${d.pending_company.length} lines`}
              className="max-h-[380px]"
            >
              {d.pending_company.length === 0 ? (
                <Empty text="Nothing pending. All sent quantities have arrived." />
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <Th>Group</Th><Th>Item</Th><Th>Shade</Th>
                      <Th right>Sent</Th><Th right>Arrived</Th><Th right>Pending</Th><Th>Last sent</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.pending_company.map((r, i) => (
                      <tr key={i} className="hover:bg-[#111925] transition-colors duration-150">
                        <Td>{r.group || "—"}</Td>
                        <Td tone="text-[#e8edf5]">{r.item}</Td>
                        <Td>{r.shade || "—"}</Td>
                        <Td right>{N(r.sent_qty)}</Td>
                        <Td right tone="text-[#7CE28A]">{N(r.arrived_qty)}</Td>
                        <Td right tone="text-[#FFC44D] font-bold">{N(r.balance_qty)}</Td>
                        <Td tone="text-[#67778e]">{r.last_date || "—"}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            <Panel
              testId="panel-shortfalls"
              title="Shortfall — order from company"
              icon={Factory}
              right={`${d.shortfalls.length} lines`}
              className="max-h-[380px]"
            >
              {d.shortfalls.length === 0 ? (
                <Empty text="No shortage. In-house stock covers all conference demand." />
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <Th>Group</Th><Th>Item</Th><Th>Shade</Th>
                      <Th right>Demand</Th><Th right>Stock</Th><Th right>To order</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.shortfalls.map((r, i) => (
                      <tr key={i} className="hover:bg-[#111925] transition-colors duration-150">
                        <Td>{r.group || "—"}</Td>
                        <Td tone="text-[#e8edf5]">{r.item}</Td>
                        <Td>{r.shade || "—"}</Td>
                        <Td right>{N(r.ordered_qty)}</Td>
                        <Td right>{N(r.stock_qty)}</Td>
                        <Td right tone="text-[#FF6B6B] font-bold">{N(r.to_order)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            <Panel
              testId="panel-top-items"
              title="Top items by quantity"
              icon={Boxes}
              right={`${d.item_wise.length} items`}
              className="max-h-[380px]"
            >
              {d.item_wise.length === 0 ? (
                <Empty text="No items ordered yet." />
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <Th>Item</Th><Th>Group</Th><Th right>Qty</Th><Th right>Rows</Th><Th right>Parties</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.item_wise.map((r, i) => (
                      <tr key={i} className="hover:bg-[#111925] transition-colors duration-150">
                        <Td tone="text-[#e8edf5]">{r.item}</Td>
                        <Td>{r.group || "—"}</Td>
                        <Td right tone="text-[#63A9FF] font-bold">{N(r.qty)}</Td>
                        <Td right>{N(r.rows)}</Td>
                        <Td right>{N(r.parties)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>

          <div className="mt-2">
            <Panel
              testId="panel-party-wise"
              title="Party wise conference summary"
              icon={Users}
              right={`${d.party_wise.length} parties`}
              className={full ? "max-h-[calc(100vh-430px)]" : "max-h-[460px]"}
            >
              {d.party_wise.length === 0 ? (
                <Empty text="No party orders yet." />
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <Th>Party</Th><Th right>Rows</Th><Th right>Items</Th><Th right>Qty</Th>
                      <Th right>Value</Th><Th right>Ready</Th><Th right>Pending</Th>
                      <Th right>Billed</Th><Th>Readiness</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.party_wise.map((p, i) => (
                      <tr key={i} className="hover:bg-[#111925] transition-colors duration-150" data-testid={`party-row-${i}`}>
                        <Td mono={false} tone="text-[#e8edf5] font-medium">{p.party}</Td>
                        <Td right>{N(p.rows)}</Td>
                        <Td right>{N(p.items)}</Td>
                        <Td right tone="text-[#63A9FF] font-bold">{N(p.qty)}</Td>
                        <Td right>{money(p.amount)}</Td>
                        <Td right tone="text-[#7CE28A]">{N(p.ready)}</Td>
                        <Td right tone={p.pending ? "text-[#FFC44D]" : "text-[#5b6b81]"}>{N(p.pending)}</Td>
                        <Td right>{N(p.billed)}</Td>
                        <Td>
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <div className="h-1.5 w-20 bg-[#1a2432]">
                              <div
                                className="h-full bg-[#7CE28A] transition-all duration-500"
                                style={{ width: `${p.ready_pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] mono text-[#7d8ea6]">{p.ready_pct}%</span>
                          </div>
                        </Td>
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
