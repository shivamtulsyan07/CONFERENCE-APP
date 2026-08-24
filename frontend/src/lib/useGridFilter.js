import { useMemo, useState } from "react";
import { matchRow, sortRows, activeCount, emptyFilter } from "./filters";

// Filtering / sorting / search for read-only grids.
export function useGridFilter(rows, columns) {
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState(
    () => new URLSearchParams(window.location.search).get("q") || ""
  );
  const [sort, setSort] = useState(null);

  const colsByKey = useMemo(
    () => Object.fromEntries(columns.map((c) => [c.key, c])),
    [columns]
  );

  const visible = useMemo(() => {
    const filtered = (rows || []).filter((r) => matchRow(r, filters, colsByKey, search));
    return sortRows(filtered, sort, colsByKey);
  }, [rows, filters, colsByKey, search, sort]);

  const setFilter = (key, f) => setFilters((prev) => ({ ...prev, [key]: f }));
  const clearAll = () => { setFilters({}); setSearch(""); setSort(null); };
  const toggleSort = (next) =>
    setSort((prev) =>
      prev && prev.key === next.key && prev.dir === next.dir ? null : next
    );

  return {
    filters, setFilter, emptyFilter, search, setSearch, sort,
    setSort: toggleSort, visible, clearAll, activeCount: activeCount(filters) + (search ? 1 : 0),
  };
}
