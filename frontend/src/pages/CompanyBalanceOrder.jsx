import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { LineSheet } from "../components/LineSheet";
import { StatStrip } from "../components/SheetFrame";
import { Button } from "../components/ui/button";

const extraColumns = [
  { key: "arrived_qty", label: "Arrived", width: 110 },
  { key: "balance_qty", label: "Balance", width: 110 },
];

export default function CompanyBalanceOrder() {
  const [balance, setBalance] = useState({ rows: [], total_sent: 0, total_arrived: 0, total_balance: 0, pending_lines: 0 });
  const [showAll, setShowAll] = useState(false);

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

  // only lines still awaited from the company (blank rows stay so new orders can be typed)
  const visibleFilter = useMemo(() => (row) => {
    if (showAll) return true;
    if (!String(row.item || "").trim()) return true;
    return Number(extraValue(row, "balance_qty")) > 0;
  }, [showAll, map]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <LineSheet
      sheetKey="company-sent-rows"
      prefix="cb-"
      title="Company Balance Order"
      subtitle={showAll ? "Every order sent to the company" : "Only orders still pending to arrive from the company"}
      headerColor="#0A2540"
      extraColumns={extraColumns}
      extraValue={extraValue}
      visibleFilter={visibleFilter}
      onSaved={loadBalance}
      toolbarExtras={
        <Button variant={showAll ? "default" : "outline"} size="sm" className="h-8 text-[10px]"
          data-testid="cb-show-all-btn" onClick={() => setShowAll((s) => !s)}>
          {showAll ? "SHOWING ALL" : "PENDING ONLY"}
        </Button>
      }
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
