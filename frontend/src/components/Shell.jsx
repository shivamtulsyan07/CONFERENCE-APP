import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Table2, Boxes, Scale, Users, Menu } from "lucide-react";
import { useState } from "react";
import { useRole } from "../context/RoleContext";
import { Button } from "./ui/button";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, id: "dashboard" },
  { to: "/orders", label: "Conference Order", icon: Table2, id: "orders" },
  { to: "/stock", label: "In House Order", icon: Boxes, id: "stock" },
  { to: "/balance", label: "Balance Stock", icon: Scale, id: "balance" },
  { to: "/parties", label: "Parties", icon: Users, id: "parties" },
];

export const Shell = () => {
  const { role, setRole } = useRole();
  const [open, setOpen] = useState(false);

  const links = (
    <nav className="flex flex-col gap-1">
      {nav.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.to === "/"}
          data-testid={`nav-${n.id}`}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-md text-sm uppercase tracking-wide transition-colors duration-200 ${
              isActive
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`
          }
        >
          <n.icon className="h-4 w-4" />
          {n.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-secondary">
      <header className="sticky top-0 z-30 bg-white border-b border-border">
        <div className="flex items-center justify-between px-4 lg:px-8 h-14">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              data-testid="menu-toggle"
              onClick={() => setOpen((o) => !o)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 bg-accent rounded-sm" />
              <span className="font-display font-black tracking-tight text-base">
                CONFERENCE OPS
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">Role</span>
            <div className="flex border border-border rounded-md overflow-hidden">
              {["staff", "admin"].map((r) => (
                <button
                  key={r}
                  data-testid={`role-${r}`}
                  onClick={() => setRole(r)}
                  className={`px-3 py-1.5 text-xs uppercase tracking-wide transition-colors duration-200 ${
                    role === r
                      ? "bg-primary text-primary-foreground"
                      : "bg-white text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden lg:block w-60 shrink-0 border-r border-border bg-white min-h-[calc(100vh-3.5rem)] p-4">
          {links}
        </aside>
        {open && (
          <div className="lg:hidden fixed inset-0 top-14 z-20 bg-white p-4" data-testid="mobile-nav">
            {links}
          </div>
        )}
        <main className="flex-1 min-w-0 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
