import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { LineSheet } from "../components/LineSheet";

export default function StockArrived() {
  const [balance, setBalance] = useState({ total_arrived: 0, total_balance: 0, pending_lines: 0 });
  const loadBalance = useCallback(() => api.companyBalance().then(setBalance).catch(() => {}), []);
  useEffect(() => { loadBalance(); }, [loadBalance]);

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        {[
          ["Total arrived", balance.total_arrived, "sa-stat-arrived"],
          ["Still with company", balance.total_balance, "sa-stat-balance"],
          ["Lines pending", balance.pending_lines, "sa-stat-pending"],
        ].map(([label, value, tid]) => (
          <div key={tid} className="grid-panel stat-panel p-4" data-testid={tid}>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="mt-2 text-2xl font-black mono">{value}</div>
          </div>
        ))}
      </div>

      <LineSheet
        sheetKey="company-arrived-rows"
        prefix="sa-"
        title="Stock Arrived From Company"
        subtitle="Enter every lot received from the company. Each entry is subtracted from the Company Balance Order for that Group + Item + Shade."
        headerColor="#3F6F52"
        onSaved={loadBalance}
      />
    </div>
  );
}
