import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { LineSheet } from "../components/LineSheet";
import { StatStrip } from "../components/SheetFrame";

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
    <LineSheet
      sheetKey="company-sent-rows"
      prefix="cb-"
      title="Company Balance Order"
      subtitle="Every order sent to the company stays in balance until the same Group + Item + Shade is entered in Stock Arrived"
      headerColor="#0A2540"
      extraColumns={extraColumns}
      extraValue={extraValue}
      onSaved={loadBalance}
      stats={
        <StatStrip
          items={[
            ["Lines pending", balance.pending_lines, "cb-stat-pending"],
            ["Total sent to company", balance.total_sent, "cb-stat-sent"],
            ["Total arrived", balance.total_arrived, "cb-stat-arrived"],
            ["Balance with company", balance.total_balance, "cb-stat-balance"],
          ]}
        />
      }
    />
  );
}
