import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { LineSheet } from "../components/LineSheet";

const extraColumns = [
  { key: "arrived_qty", label: "Arrived", width: 110 },
  { key: "balance_qty", label: "Balance", width: 110 },
];

export default function CompanyBalanceOrder() {
  const [balance, setBalance] = useState({ rows: [], total_sent: 0, total_arrived: 0, total_balance: 0, pending_lines: 0 });

  const loadBalance = useCallback(() => api.companyBalance().then(setBalance).catch(() => {}), []);
  useEffect(() => { loadBalance(); }, [loadBalance]);

  const keyOf = (r) =>
    `${String(r.group || "").trim().toUpperCase()}|${String(r.item || "").trim().toUpperCase()}|${String(r.shade ?? "").trim()}`;

  const map = Object.fromEntries(balance.rows.map((r) => [keyOf(r), r]));

  const extraValue = (row, key) => {
    if (!String(row.item || "").trim()) return "";
    const hit = map[keyOf(row)];
    if (!hit) return key === "arrived_qty" ? 0 : Number(row.quantity) || 0;
    return hit[key];
  };

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
        {[
          ["Lines pending", balance.pending_lines, "cb-stat-pending"],
          ["Total sent to company", balance.total_sent, "cb-stat-sent"],
          ["Total arrived", balance.total_arrived, "cb-stat-arrived"],
          ["Balance with company", balance.total_balance, "cb-stat-balance"],
        ].map(([label, value, tid]) => (
          <div key={tid} className="grid-panel stat-panel p-4" data-testid={tid}>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="mt-2 text-2xl font-black mono">{value}</div>
          </div>
        ))}
      </div>

      <LineSheet
        sheetKey="company-sent-rows"
        prefix="cb-"
        title="Company Balance Order"
        subtitle="Add every order you send to the company. It stays in balance until the same item + shade is entered in Stock Arrived From Company."
        headerColor="#0A2540"
        extraColumns={extraColumns}
        extraValue={extraValue}
        onSaved={loadBalance}
      />
    </div>
  );
}
