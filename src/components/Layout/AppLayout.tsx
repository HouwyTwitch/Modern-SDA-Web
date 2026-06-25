import { useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  ShieldCheck,
  Users,
  CheckCircle2,
  Settings as SettingsIcon,
  Moon,
  Sun,
  LogOut,
} from "lucide-react";
import { useStore } from "../../store/useStore";
import { useAuth } from "../../store/useAuth";
import { useSettings } from "../../store/useSettings";

const NAV = [
  { to: "/accounts", label: "Accounts", icon: Users },
  { to: "/confirmations", label: "Confirmations", icon: CheckCircle2 },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const accounts = useStore((s) => s.accounts);
  const confirmations = useStore((s) => s.confirmations);
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const reset = useStore((s) => s.reset);
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const counts: Record<string, number> = {
    "/accounts": accounts.length,
    "/confirmations": confirmations.length,
  };
  const isDark = theme !== "light";

  async function doLogout() {
    await logout();
    reset();
  }

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface-raised/30 p-4 backdrop-blur-sm md:flex">
        <div className="flex items-center gap-2.5 px-2 py-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-white shadow-lg shadow-accent/30">
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className="text-sm font-bold leading-tight">Modern SDA</div>
            <div className="text-xs text-ink-faint">Steam Authenticator</div>
          </div>
        </div>

        <nav className="mt-4 flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-accent-soft text-accent"
                    : "text-ink-muted hover:bg-surface-sunken hover:text-ink"
                }`
              }
            >
              <span className="flex items-center gap-3">
                <Icon size={18} />
                {label}
              </span>
              {counts[to] !== undefined && (
                <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-semibold text-ink-muted">
                  {counts[to]}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User card */}
        <div className="relative mt-auto">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex w-full items-center gap-3 rounded-xl border border-line p-2.5 text-left transition hover:bg-surface-sunken"
          >
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/15 text-sm font-bold text-accent">
              {user?.email?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{user?.email}</div>
              <div className="text-xs text-ink-faint">Signed in</div>
            </div>
          </button>
          {menuOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-full animate-scale-in rounded-xl border border-line bg-surface-raised p-1 shadow-xl">
              <button
                onClick={() => setTheme(isDark ? "light" : "dark")}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-muted hover:bg-surface-sunken hover:text-ink"
              >
                {isDark ? <Sun size={16} /> : <Moon size={16} />} {isDark ? "Light mode" : "Dark mode"}
              </button>
              <button
                onClick={doLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
              >
                <LogOut size={16} /> Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="relative flex-1 overflow-y-auto pb-24 md:pb-0">
        <div key={location.pathname} className="animate-fade-in">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-line bg-surface-raised/85 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur-xl md:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-xs font-medium transition ${
                isActive ? "text-accent" : "text-ink-faint"
              }`
            }
          >
            <span className="relative">
              <Icon size={22} />
              {counts[to] ? (
                <span className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
                  {counts[to]}
                </span>
              ) : null}
            </span>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
