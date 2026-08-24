import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Table2, Boxes, Scale, ListTree, Factory, PackageCheck, ClipboardList, Users, Sun, Moon, Menu, X } from "lucide-react";
import { useState } from "react";
import { useRole } from "../context/RoleContext";
import { useTheme } from "../context/ThemeContext";

export const SECTIONS = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    tabs: [
      { to: "/", label: "Dashboard", id: "dashboard" },
      { to: "/parties", label: "Parties", id: "parties" },
    ],
  },
  {
    id: "conference",
    label: "Conference",
    icon: Table2,
    tabs: [
      { to: "/orders", label: "Conference Order", id: "orders" },
      { to: "/summary", label: "Conference Order Summary", id: "summary" },
      { to: "/company-order", label: "Company Order", id: "company-order" },
    ],
  },
  {
    id: "stock",
    label: "Stock",
    icon: Boxes,
    tabs: [
      { to: "/stock", label: "In House Stock", id: "stock" },
      { to: "/company-balance", label: "Company Balance Order", id: "company-balance" },
      { to: "/stock-arrived", label: "Stock Arrived", id: "stock-arrived" },
      { to: "/balance", label: "Balance Stock", id: "balance" },
    ],
  },
];

const TAB_ICON = {
  dashboard: LayoutDashboard, orders: Table2, stock: Boxes, summary: ListTree, balance: Scale,
  "company-order": Factory, "company-balance": ClipboardList, "stock-arrived": PackageCheck, parties: Users,
};

export const Shell = () => {
  const { role, setRole } = useRole();
  const { theme, toggle } = useTheme();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);

  const active = SECTIONS.find((s) => s.tabs.some((t) => t.to === pathname)) || SECTIONS[0];

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[hsl(var(--shell-bg))] text-[hsl(var(--shell-text))]">
      {/* top bar: brand + section tabs + controls, everything one click away */}
      <header className="shrink-0 h-12 flex items-center gap-3 px-2 sm:px-3 border-b border-[hsl(var(--shell-line))] bg-[hsl(var(--shell-panel))]">
        <button
          data-testid="menu-toggle"
          onClick={() => setDrawer((d) => !d)}
          className="lg:hidden p-1.5 text-[hsl(var(--shell-dim))] hover:text-[hsl(var(--shell-text))] transition-colors duration-200"
        >
          {drawer ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <div className="flex items-center gap-2 pr-2 shrink-0">
          <span className="h-5 w-5 bg-[hsl(var(--shell-active))]" />
          <span className="font-display font-black tracking-tight text-[13px] hidden sm:inline">CONFERENCE OPS</span>
        </div>

        <nav className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto thin-scroll" data-testid="top-tabs">
          {active.tabs.map((t) => {
            const Icon = TAB_ICON[t.id];
            return (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.to === "/"}
                data-testid={`tab-${t.id}`}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 whitespace-nowrap px-3 h-8 text-[11px] uppercase tracking-[0.1em] border transition-colors duration-200 ${
                    isActive
                      ? "border-[hsl(var(--shell-active))] bg-[color:var(--shell-soft)] text-[hsl(var(--shell-text))]"
                      : "border-transparent text-[hsl(var(--shell-dim))] hover:text-[hsl(var(--shell-text))] hover:border-[hsl(var(--shell-line))]"
                  }`
                }
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            data-testid="theme-toggle"
            onClick={toggle}
            title={theme === "dark" ? "Switch to light sheets" : "Switch to dark sheets"}
            className="flex items-center gap-1.5 border border-[hsl(var(--shell-line))] px-2 h-8 text-[10px] uppercase tracking-wide text-[hsl(var(--shell-dim))] hover:text-[hsl(var(--shell-text))] hover:border-[hsl(var(--shell-active))] transition-colors duration-200"
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <div className="flex border border-[hsl(var(--shell-line))]">
            {["staff", "admin"].map((r) => (
              <button
                key={r}
                data-testid={`role-${r}`}
                onClick={() => setRole(r)}
                className={`px-2.5 h-8 text-[10px] uppercase tracking-wide transition-colors duration-200 ${
                  role === r ? "bg-[hsl(var(--shell-active))] text-white font-bold" : "text-[hsl(var(--shell-dim))] hover:text-[hsl(var(--shell-text))]"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex">
        {/* compact icon rail: one click per section */}
        <aside className="hidden lg:flex w-14 shrink-0 flex-col items-center gap-1 py-2 bg-[hsl(var(--shell-panel))] shell-shadow" data-testid="icon-rail">
          {SECTIONS.map((s) => {
            const on = s.id === active.id;
            return (
              <button
                key={s.id}
                data-testid={`rail-${s.id}`}
                title={s.label}
                onClick={() => navigate(s.tabs[0].to)}
                className={`group relative w-11 h-11 flex flex-col items-center justify-center gap-0.5 border transition-colors duration-200 ${
                  on
                    ? "border-[hsl(var(--shell-active))] bg-[color:var(--shell-soft)] text-[hsl(var(--shell-text))]"
                    : "border-transparent text-[hsl(var(--shell-dim))] hover:text-[hsl(var(--shell-text))] hover:bg-[color:var(--shell-soft)]"
                }`}
              >
                <s.icon className="h-4 w-4" />
                <span className="text-[8px] uppercase tracking-wide">{s.label}</span>
              </button>
            );
          })}
        </aside>

        {drawer && (
          <div className="lg:hidden absolute inset-x-0 top-12 z-40 bg-[hsl(var(--shell-panel))] border-b border-[hsl(var(--shell-line))] p-3" data-testid="mobile-nav">
            {SECTIONS.map((s) => (
              <div key={s.id} className="mb-2">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--shell-dim))] mb-1">{s.label}</div>
                <div className="flex flex-wrap gap-1.5">
                  {s.tabs.map((t) => (
                    <NavLink
                      key={t.to}
                      to={t.to}
                      end={t.to === "/"}
                      data-testid={`m-tab-${t.id}`}
                      onClick={() => setDrawer(false)}
                      className={({ isActive }) =>
                        `px-2.5 py-1.5 text-[11px] uppercase border transition-colors duration-200 ${
                          isActive ? "border-[hsl(var(--shell-active))] text-[hsl(var(--shell-text))]" : "border-[hsl(var(--shell-line))] text-[hsl(var(--shell-dim))]"
                        }`
                      }
                    >
                      {t.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <main className="flex-1 min-w-0 min-h-0 overflow-hidden bg-[hsl(var(--shell-bg))] p-2">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
