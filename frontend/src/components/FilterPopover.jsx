import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { Filter, ArrowUpAZ, ArrowDownAZ, X } from "lucide-react";
import { opsFor, emptyFilter, isActive, distinctValues } from "../lib/filters";

export const FilterPopover = ({
  column,
  filter,
  onChange,
  rows,
  sort,
  onSort,
  prefix = "",
}) => {
  const f = filter || emptyFilter();
  const ops = opsFor(column);
  const opDef = ops.find((o) => o.id === f.op) || ops[0];
  const [search, setSearch] = useState("");
  const values = distinctValues(rows, column.key);
  const shown = values.filter((v) => v.toLowerCase().includes(search.toLowerCase())).slice(0, 300);
  const active = isActive(f);

  const toggle = (v) => {
    const sel = f.selected || [];
    onChange({ ...f, selected: sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v] });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          data-testid={`${prefix}filter-${column.key}`}
          className={`w-full flex items-center justify-between gap-1 h-7 px-2 rounded-sm border text-[11px] transition-colors duration-150 ${
            active
              ? "bg-[#0066FF] text-white border-[#0066FF]"
              : "bg-[color:var(--sheet-bg)] text-muted-foreground border-border hover:border-[#0066FF]"
          }`}
        >
          <span className="truncate uppercase">
            {active ? (f.selected?.length ? `${f.selected.length} picked` : `${opDef.label} ${f.v1}`) : "Filter"}
          </span>
          <Filter className="h-3 w-3 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3" data-testid={`${prefix}filter-panel-${column.key}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wide">{column.label}</span>
          {active && (
            <button
              data-testid={`${prefix}filter-clear-${column.key}`}
              onClick={() => { onChange(emptyFilter()); setSearch(""); }}
              className="text-[11px] text-destructive flex items-center gap-1"
            >
              <X className="h-3 w-3" /> CLEAR
            </button>
          )}
        </div>

        {onSort && (
          <div className="flex gap-1 mb-3">
            <Button
              size="sm"
              variant={sort?.key === column.key && sort?.dir === "asc" ? "default" : "outline"}
              className="flex-1 h-7 text-[11px]"
              data-testid={`${prefix}sort-asc-${column.key}`}
              onClick={() => onSort({ key: column.key, dir: "asc" })}
            >
              <ArrowUpAZ className="h-3 w-3 mr-1" /> ASC
            </Button>
            <Button
              size="sm"
              variant={sort?.key === column.key && sort?.dir === "desc" ? "default" : "outline"}
              className="flex-1 h-7 text-[11px]"
              data-testid={`${prefix}sort-desc-${column.key}`}
              onClick={() => onSort({ key: column.key, dir: "desc" })}
            >
              <ArrowDownAZ className="h-3 w-3 mr-1" /> DESC
            </Button>
          </div>
        )}

        <div className="space-y-2">
          <select
            data-testid={`${prefix}filter-op-${column.key}`}
            value={f.op}
            onChange={(e) => onChange({ ...f, op: e.target.value })}
            className="w-full h-8 px-2 text-xs border border-border rounded-sm bg-[color:var(--sheet-bg)]"
          >
            {ops.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          {!opDef.noValue && (
            <div className="flex gap-2">
              <Input
                data-testid={`${prefix}filter-value-${column.key}`}
                value={f.v1}
                onChange={(e) => onChange({ ...f, v1: e.target.value })}
                placeholder="value"
                className="h-8 text-xs"
              />
              {opDef.two && (
                <Input
                  data-testid={`${prefix}filter-value2-${column.key}`}
                  value={f.v2}
                  onChange={(e) => onChange({ ...f, v2: e.target.value })}
                  placeholder="to"
                  className="h-8 text-xs"
                />
              )}
            </div>
          )}
        </div>

        <div className="mt-3 border-t border-border pt-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search values"
            className="h-8 text-xs mb-2"
            data-testid={`${prefix}filter-search-${column.key}`}
          />
          <div className="flex justify-between text-[11px] mb-1">
            <button
              className="text-[#0066FF] uppercase"
              data-testid={`${prefix}filter-select-all-${column.key}`}
              onClick={() => onChange({ ...f, selected: shown })}
            >
              Select shown
            </button>
            <button
              className="text-muted-foreground uppercase"
              onClick={() => onChange({ ...f, selected: [] })}
            >
              Clear picks
            </button>
          </div>
          <div className="max-h-44 overflow-auto space-y-1">
            {shown.length === 0 && <p className="text-xs text-muted-foreground">No values</p>}
            {shown.map((v) => (
              <label key={v} className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={(f.selected || []).includes(v)}
                  onCheckedChange={() => toggle(v)}
                  data-testid={`${prefix}filter-value-check-${column.key}-${v}`}
                />
                <span className="truncate">{v}</span>
              </label>
            ))}
            {values.length > shown.length && (
              <p className="text-[10px] text-muted-foreground">
                Showing {shown.length} of {values.length} — refine the search
              </p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
