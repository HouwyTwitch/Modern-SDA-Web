import { type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ShieldCheck, Users, CheckCircle2, Settings as SettingsIcon, Moon, Sun } from "lucide-react";
import { useStore } from "../../store/useStore";

const NAV = [
  { to: "/accounts", label: "Accounts", icon: Users },
  { to: "/confirmations", label: "Confirmations", icon: CheckCircle2 },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const accounts = useStore((s) => s.accounts);
  const confirmations = useStore((s) => s.confirmations);
  const theme = useStore((s) => s.settings.theme);
  const setSettings = useStore((s) => s.setSettings);
  const location = useLocation();

  const counts: Record<string, number> = {
    "/accounts": accounts.length,
    "/confirmations": confirmations.length,
  };

  const isDark = theme !== "light";

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface-raised/40 p-4 md:flex">
        <div className="flex items-center gap-2.5 px-2 py-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-white">
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
                `flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition ${
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

        <div className="mt-auto flex items-center justify-between px-2 text-xs text-ink-faint">
          <span>v1.0.0</span>
          <button
            onClick={() => setSettings({ theme: isDark ? "light" : "dark" })}
            className="btn-ghost !p-2"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="relative flex-1 overflow-y-auto pb-24 md:pb-0">
        <div key={location.pathname} className="animate-fade-in">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-line bg-surface-raised/90 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur-lg md:hidden">
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
