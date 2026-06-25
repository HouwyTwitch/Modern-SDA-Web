import { useMemo, useState } from "react";
import { Plus, Search, Database, ShieldCheck } from "lucide-react";
import { useStore } from "../store/useStore";
import { useSteamCodes } from "../hooks/useSteamCodes";
import { AccountRow } from "../components/Accounts/AccountRow";
import { AccountDetail } from "../components/Accounts/AccountDetail";
import { AddAccountModal } from "../components/Accounts/AddAccountModal";

type Filter = "all" | "healthy" | "needs_login" | "proxy";

export function AccountsPage() {
  const accounts = useStore((s) => s.accounts);
  const codes = useSteamCodes();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const counts = useMemo(
    () => ({
      all: accounts.length,
      healthy: accounts.filter((a) => a.status === "online").length,
      needs_login: accounts.filter((a) => a.status === "needs_login").length,
      proxy: accounts.filter((a) => a.proxy).length,
    }),
    [accounts],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accounts
      .filter((a) => {
        if (filter === "healthy" && a.status !== "online") return false;
        if (filter === "needs_login" && a.status !== "needs_login") return false;
        if (filter === "proxy" && !a.proxy) return false;
        if (q && !a.name.toLowerCase().includes(q) && !a.steamId.includes(q)) return false;
        return true;
      })
      .sort((a, b) => Number(b.favorite ?? false) - Number(a.favorite ?? false));
  }, [accounts, query, filter]);

  const selected = accounts.find((a) => a.id === selectedId) ?? null;

  const FILTERS: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "healthy", label: "Healthy" },
    { id: "needs_login", label: "Needs Login" },
    { id: "proxy", label: "Proxy" },
  ];

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl p-4 sm:p-6">
          <header className="flex items-center justify-between">
            <h1 className="text-2xl font-bold sm:text-3xl">Accounts</h1>
            <button onClick={() => setAdding(true)} className="btn-accent">
              <Plus size={18} />
              <span className="hidden sm:inline">Add Account</span>
            </button>
          </header>

          <div className="relative mt-5">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              className="input pl-11"
              placeholder="Search accounts…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`chip shrink-0 ${
                  filter === f.id
                    ? "bg-accent text-white"
                    : "bg-surface-sunken text-ink-muted hover:text-ink"
                }`}
              >
                {f.label}
                <span className={filter === f.id ? "text-white/80" : "text-ink-faint"}>
                  {counts[f.id]}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {filtered.length === 0 ? (
              <EmptyState onAdd={() => setAdding(true)} hasAccounts={accounts.length > 0} />
            ) : (
              filtered.map((a) => (
                <AccountRow
                  key={a.id}
                  account={a}
                  code={codes[a.id]}
                  onOpen={() => setSelectedId(a.id)}
                />
              ))
            )}
          </div>

          <StorageUsage count={accounts.length} />
        </div>
      </div>

      {selected && (
        <div className="hidden lg:block lg:w-[26rem] lg:shrink-0">
          <div className="sticky top-0 h-screen overflow-y-auto">
            <AccountDetail account={selected} code={codes[selected.id]} onClose={() => setSelectedId(null)} />
          </div>
        </div>
      )}
      {selected && (
        <div className="lg:hidden">
          <AccountDetail account={selected} code={codes[selected.id]} onClose={() => setSelectedId(null)} />
        </div>
      )}

      <AddAccountModal open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function EmptyState({ onAdd, hasAccounts }: { onAdd: () => void; hasAccounts: boolean }) {
  return (
    <div className="card flex flex-col items-center gap-4 p-10 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent">
        <ShieldCheck size={28} />
      </div>
      <div>
        <p className="font-semibold">{hasAccounts ? "No matching accounts" : "No accounts yet"}</p>
        <p className="text-sm text-ink-faint">
          {hasAccounts ? "Try a different search or filter." : "Import a .maFile to get started."}
        </p>
      </div>
      {!hasAccounts && (
        <button onClick={onAdd} className="btn-accent">
          <Plus size={16} /> Add your first account
        </button>
      )}
    </div>
  );
}

function StorageUsage({ count }: { count: number }) {
  // Rough estimate of localStorage footprint for the friendly meter.
  const usedMb = Math.max(0.05, count * 0.004).toFixed(2);
  const pct = Math.min(100, (count / 50) * 100);
  return (
    <div className="card mt-6 p-4">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-medium">
          <Database size={15} className="text-ink-muted" /> Local Storage
        </span>
        <span className="text-ink-faint">{usedMb} MB · {count} accounts</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
