import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { LineSheet } from "../components/LineSheet";
import { StatStrip } from "../components/SheetFrame";

export default function StockArrived() {
  const [balance, setBalance] = useState({ total_arrived: 0, total_balance: 0, pending_lines: 0 });
  const loadBalance = useCallback(() => api.companyBalance().then(setBalance).catch(() => {}), []);
  useEffect(() => { loadBalance(); }, [loadBalance]);

  return (
    <LineSheet
      sheetKey="company-arrived-rows"
      prefix="sa-"
      title="Stock Arrived From Company"
      subtitle="Every lot received is subtracted from the Company Balance Order for that Group + Item + Shade"
      headerColor="#3F6F52"
      onSaved={loadBalance}
      stats={
        <StatStrip
          items={[
            ["Total arrived", balance.total_arrived, "sa-stat-arrived"],
            ["Still with company", balance.total_balance, "sa-stat-balance"],
            ["Lines pending", balance.pending_lines, "sa-stat-pending"],
          ]}
        />
      }
    />
  );
}
