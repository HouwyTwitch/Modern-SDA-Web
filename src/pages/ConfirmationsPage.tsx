import { useEffect, useMemo, useState } from "react";
import { Check, X, CheckCheck, Inbox, ArrowLeftRight, Store, RefreshCw, AlertTriangle } from "lucide-react";
import { useStore } from "../store/useStore";
import type { Confirmation, ConfirmationType } from "../types";
import { Avatar } from "../components/common/Avatar";
import { timeAgo } from "../lib/format";

type Tab = "all" | "trade" | "market";

const TYPE_ICON: Record<ConfirmationType, typeof ArrowLeftRight> = {
  trade: ArrowLeftRight,
  market: Store,
  other: Inbox,
};

export function ConfirmationsPage() {
  const accounts = useStore((s) => s.accounts);
  const confirmations = useStore((s) => s.confirmations);
  const errors = useStore((s) => s.confirmationErrors);
  const loading = useStore((s) => s.loadingConfirmations);
  const loadConfirmations = useStore((s) => s.loadConfirmations);
  const act = useStore((s) => s.actConfirmation);
  const acceptAll = useStore((s) => s.acceptAll);
  const [tab, setTab] = useState<Tab>("all");

  useEffect(() => {
    void loadConfirmations();
  }, [loadConfirmations]);

  const counts = useMemo(
    () => ({
      all: confirmations.length,
      trade: confirmations.filter((c) => c.type === "trade").length,
      market: confirmations.filter((c) => c.type === "market").length,
    }),
    [confirmations],
  );

  const grouped = useMemo(() => {
    const visible = confirmations.filter((c) => tab === "all" || c.type === tab);
    const map = new Map<string, Confirmation[]>();
    for (const c of visible) {
      if (!map.has(c.accountId)) map.set(c.accountId, []);
      map.get(c.accountId)!.push(c);
    }
    return map;
  }, [confirmations, tab]);

  const sessionCount = accounts.filter((a) => a.hasSession).length;
  const TABS: { id: Tab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "trade", label: "Trades" },
    { id: "market", label: "Market" },
  ];

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold sm:text-3xl">Confirmations</h1>
        <button onClick={() => void loadConfirmations()} className="btn-ghost border border-line !p-2.5" title="Refresh">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="mt-5 flex gap-1 rounded-xl bg-surface-sunken p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition ${
              tab === t.id ? "bg-surface-raised text-ink shadow" : "text-ink-muted"
            }`}
          >
            {t.label}
            <span className="rounded-full bg-surface-sunken px-1.5 text-xs text-ink-faint">{counts[t.id]}</span>
          </button>
        ))}
      </div>

      {errors.length > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-400">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{errors.length} account(s) couldn't sync — they may need re-linking to Steam.</span>
        </div>
      )}

      {grouped.size === 0 ? (
        <EmptyState loading={loading} sessionCount={sessionCount} />
      ) : (
        <div className="mt-5 space-y-6">
          {[...grouped.entries()].map(([accountId, items]) => {
            const account = accounts.find((a) => a.id === accountId);
            if (!account) return null;
            return (
              <section key={accountId}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar name={account.name} color={account.avatarColor} url={account.avatarUrl} size={26} />
                    <span className="font-semibold">{account.name}</span>
                    <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-semibold text-ink-muted">
                      {items.length}
                    </span>
                  </div>
                  <button
                    onClick={() => acceptAll(accountId, tab === "all" ? undefined : tab)}
                    className="chip bg-green-500/10 text-green-400 hover:bg-green-500/20"
                  >
                    <CheckCheck size={14} /> Accept all
                  </button>
                </div>
                <div className="space-y-2.5">
                  {items.map((c) => (
                    <ConfirmationCard key={c.id} conf={c} onResolve={act} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState({ loading, sessionCount }: { loading: boolean; sessionCount: number }) {
  return (
    <div className="card mt-6 flex flex-col items-center gap-3 p-12 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-green-500/10 text-green-400">
        <CheckCheck size={28} />
      </div>
      <div>
        <p className="font-semibold">{loading ? "Syncing…" : "All caught up"}</p>
        <p className="text-sm text-ink-faint">
          {sessionCount === 0
            ? "Sign in to Steam on an account to receive live confirmations."
            : "No pending confirmations right now."}
        </p>
      </div>
    </div>
  );
}

function ConfirmationCard({
  conf,
  onResolve,
}: {
  conf: Confirmation;
  onResolve: (accountId: string, id: string, action: "allow" | "cancel") => void;
}) {
  const Icon = TYPE_ICON[conf.type];
  return (
    <div className="card hover-lift flex items-center gap-3 p-3 sm:p-4">
      <div
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
          conf.type === "trade" ? "bg-accent-soft text-accent" : "bg-purple-500/10 text-purple-400"
        }`}
      >
        <Icon size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-semibold">{conf.title}</span>
          {conf.amount && <span className="shrink-0 font-bold text-green-400">{conf.amount}</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-faint">
          {conf.subtitle && <span className="truncate">{conf.subtitle}</span>}
          {conf.subtitle && <span>·</span>}
          <span className="shrink-0">{timeAgo(conf.createdAt)}</span>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          onClick={() => onResolve(conf.accountId, conf.id, "allow")}
          className="grid h-9 w-9 place-items-center rounded-xl bg-green-500/10 text-green-400 transition hover:bg-green-500 hover:text-white active:scale-90"
          aria-label="Approve"
        >
          <Check size={18} />
        </button>
        <button
          onClick={() => onResolve(conf.accountId, conf.id, "cancel")}
          className="grid h-9 w-9 place-items-center rounded-xl bg-red-500/10 text-red-400 transition hover:bg-red-500 hover:text-white active:scale-90"
          aria-label="Decline"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
