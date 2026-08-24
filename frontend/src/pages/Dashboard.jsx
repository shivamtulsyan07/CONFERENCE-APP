import { useEffect, useState } from "react";
import { api, money, errMsg, STATUS_META } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Rows3, IndianRupee, Boxes, ReceiptText } from "lucide-react";

const Stat = ({ label, value, icon: Icon, testId }) => (
  <div className="grid-panel stat-panel p-4 sm:p-6" data-testid={testId}>
    <div className="flex items-center justify-between">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <Icon className="h-4 w-4 text-accent" />
    </div>
    <div className="mt-3 text-2xl sm:text-3xl font-black tracking-tight mono">{value}</div>
  </div>
);

export default function Dashboard() {
  const [s, setS] = useState(null);
  const load = () => api.stats().then(setS).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []);

  const seed = async () => {
    const r = await api.seed();
    toast[r.seeded ? "success" : "info"](r.seeded ? "Sample sheet loaded" : r.message);
    load();
  };

  if (!s) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div>
      <PageHeader
        testId="dashboard-page"
        title="Operations Dashboard"
        subtitle="Conference order, stock readiness and party-wise dispatch position"
        action={<Button variant="outline" data-testid="seed-btn" onClick={seed}>Load sample data</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Order rows" value={s.total_rows} icon={Rows3} testId="stat-rows" />
        <Stat label="Total qty ordered" value={s.total_qty} icon={Boxes} testId="stat-qty" />
        <Stat label="Order value" value={money(s.total_amount)} icon={IndianRupee} testId="stat-amount" />
        <Stat label="Billed / unbilled" value={`${s.billed_rows} / ${s.unbilled_rows}`} icon={ReceiptText} testId="stat-billed" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="grid-panel p-4 sm:p-6" data-testid="panel-status">
          <h3 className="text-xl font-semibold tracking-tight">Stock readiness</h3>
          <ul className="mt-4 space-y-3">
            {Object.entries(STATUS_META).map(([k, m]) => (
              <li key={k} className="flex items-center justify-between text-sm border-b border-border pb-2">
                <span className="flex items-center gap-2">
                  <span className="h-3 w-5 border border-[#c9d3e0]" style={{ background: m.color }} />
                  {m.text}
                </span>
                <span className="mono font-semibold" data-testid={`status-count-${k}`}>
                  {s.status_counts?.[k] || 0}
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between text-sm">
              <span>Stock lines / units</span>
              <span className="mono font-semibold">{s.stock_lines} / {s.stock_qty}</span>
            </li>
          </ul>
        </div>

        <div className="grid-panel p-4 sm:p-6 lg:col-span-2" data-testid="chart-party-wise">
          <h3 className="text-xl font-semibold tracking-tight">Party-wise quantity</h3>
          {s.party_wise.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-4">No order rows yet.</p>
          ) : (
            <div className="h-64 mt-4">
              <ResponsiveContainer>
                <BarChart data={s.party_wise}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="party" tick={{ fontSize: 10 }} interval={0} height={50} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="ready" stackId="a" fill="#7CAE5C" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="pending" stackId="a" fill="#0066FF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <div className="grid-panel p-4 sm:p-6" data-testid="panel-item-wise">
          <h3 className="text-xl font-semibold tracking-tight">Top items by quantity</h3>
          {s.item_wise.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-4">No items yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {s.item_wise.map((i) => (
                <li key={i.item} className="flex justify-between text-sm border-b border-border pb-2">
                  <span>{i.item}</span>
                  <span className="mono font-medium">{i.qty}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="grid-panel p-4 sm:p-6" data-testid="panel-party-table">
          <h3 className="text-xl font-semibold tracking-tight">Party position</h3>
          {s.party_wise.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-4">No parties yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {s.party_wise.map((p) => (
                <li key={p.party} className="flex justify-between text-sm border-b border-border pb-2">
                  <span className="truncate pr-3">{p.party}</span>
                  <span className="mono text-xs whitespace-nowrap">
                    {p.rows} rows · ready {p.ready} · pending {p.pending}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
