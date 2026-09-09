import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { LineSheet } from "../components/LineSheet";
import { StatStrip } from "../components/SheetFrame";

export default function ShopSale() {
  const [parties, setParties] = useState([]);
  const [totals, setTotals] = useState({ bills: 0, qty: 0, lines: 0 });

  useEffect(() => { api.parties().then((p) => setParties(p.map((x) => x.name))); }, []);

  const leadColumns = useMemo(() => ([
    { key: "party_name", label: "Party Name", width: 230, options: parties, upper: true },
    { key: "bill_no", label: "Bill No", width: 120, upper: true },
  ]), [parties]);

  const refreshTotals = useCallback(() => api.lineRows("shop-sale-rows").then((rows) => {
    const live = rows.filter((r) => (r.item || "").trim() || (r.party_name || "").trim() || String(r.bill_no || "").trim());
    setTotals({
      lines: live.length,
      qty: live.reduce((n, r) => n + (Number(r.quantity) || 0), 0),
      bills: new Set(live.map((r) => String(r.bill_no || "").trim()).filter(Boolean)).size,
    });
  }), []);

  useEffect(() => { refreshTotals(); }, [refreshTotals]);

  return (
    <LineSheet
      sheetKey="shop-sale-rows"
      prefix="ss-"
      title="Shop Sale"
      subtitle="Sales made at the shop counter · party, bill, group, item, shade and quantity"
      headerColor="#6B3F8C"
      leadColumns={leadColumns}
      omitColumns={["date", "remark"]}
      onSaved={refreshTotals}
      stats={
        <StatStrip
          items={[
            ["Sale lines", totals.lines, "ss-stat-lines"],
            ["Total quantity sold", totals.qty, "ss-stat-qty"],
            ["Bills", totals.bills, "ss-stat-bills"],
          ]}
        />
      }
    />
  );
}
