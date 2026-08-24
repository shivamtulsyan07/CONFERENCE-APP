import { useEffect, useState } from "react";
import { api, money, errMsg } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { IndianRupee, PackageCheck, Truck, Boxes, AlertTriangle } from "lucide-react";

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
    toast[r.seeded ? "success" : "info"](r.seeded ? "Sample data added" : r.message);
    load();
  };

  if (!s) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div>
      <PageHeader
        testId="dashboard-page"
        title="Operations Dashboard"
        subtitle="Sales, company procurement and party-wise dispatch at a glance"
        action={
          <Button variant="outline" data-testid="seed-btn" onClick={seed}>
            Load sample data
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total sales" value={money(s.total_sales)} icon={IndianRupee} testId="stat-sales" />
        <Stat label="Orders" value={s.total_orders} icon={PackageCheck} testId="stat-orders" />
        <Stat label="Pending dispatch" value={s.pending_dispatch} icon={Truck} testId="stat-pending" />
        <Stat label="Shop stock units" value={s.stock_units} icon={Boxes} testId="stat-stock" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="grid-panel p-4 sm:p-6 lg:col-span-2" data-testid="chart-party-wise">
          <h3 className="text-xl font-semibold tracking-tight">Party-wise dispatch quantity</h3>
          {s.party_wise.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-4">No dispatches yet.</p>
          ) : (
            <div className="h-64 mt-4">
              <ResponsiveContainer>
                <BarChart data={s.party_wise}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="party" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="qty" fill="#0066FF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="grid-panel p-4 sm:p-6" data-testid="panel-low-stock">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <h3 className="text-xl font-semibold tracking-tight">Low stock</h3>
          </div>
          {s.low_stock.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-4">All items healthy.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {s.low_stock.map((p) => (
                <li key={p.name} className="flex justify-between text-sm border-b border-border pb-2">
                  <span>{p.name}</span>
                  <span className="mono font-medium">{p.shop_stock}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="grid-panel p-4 sm:p-6 lg:col-span-2" data-testid="chart-daily">
          <h3 className="text-xl font-semibold tracking-tight">Order value trend</h3>
          {s.daily.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-4">No orders yet.</p>
          ) : (
            <div className="h-56 mt-4">
              <ResponsiveContainer>
                <LineChart data={s.daily}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#0A2540" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="grid-panel p-4 sm:p-6" data-testid="panel-recent-dispatch">
          <h3 className="text-xl font-semibold tracking-tight">Recent dispatches</h3>
          {s.recent_dispatches.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-4">Nothing dispatched yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {s.recent_dispatches.map((d) => (
                <li key={d.dispatch_no} className="text-sm border-b border-border pb-2">
                  <div className="flex justify-between">
                    <span className="mono text-xs text-muted-foreground">{d.dispatch_no}</span>
                    <span className="mono font-medium">{d.qty} qty</span>
                  </div>
                  <div>{d.party_name}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
