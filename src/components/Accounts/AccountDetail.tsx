import { useState } from "react";
import { X, Copy, Eye, EyeOff, Star, Trash2, Check } from "lucide-react";
import type { Account } from "../../types";
import { Avatar } from "../common/Avatar";
import { StatusBadge } from "../common/StatusBadge";
import { CountdownRing } from "../common/CountdownRing";
import { CodeDisplay } from "../common/CodeDisplay";
import { useStore } from "../../store/useStore";
import { maskSecret, timeAgo } from "../../lib/format";
import type { CodeState } from "../../hooks/useSteamCodes";

interface Props {
  account: Account;
  code?: CodeState;
  onClose: () => void;
}

function SecretRow({ label, value }: { label: string; value?: string }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <span className="text-sm text-ink-muted">{label}</span>
      <div className="flex items-center gap-2">
        <span className="max-w-[140px] truncate font-mono text-sm">
          {shown ? value || "—" : maskSecret(value)}
        </span>
        {value && (
          <>
            <button onClick={() => setShown((v) => !v)} className="text-ink-faint hover:text-ink">
              {shown ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(value);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
              className="text-ink-faint hover:text-ink"
            >
              {copied ? <Check size={15} className="text-green-400" /> : <Copy size={15} />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function AccountDetail({ account, code, onClose }: Props) {
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const removeAccount = useStore((s) => s.removeAccount);
  const pushToast = useStore((s) => s.pushToast);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 animate-fade-in lg:hidden" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md animate-fade-in flex-col border-l border-line bg-surface-raised shadow-2xl lg:relative lg:z-0 lg:shadow-none">
        <div className="flex items-center justify-between border-b border-line p-4">
          <div className="flex items-center gap-3">
            <Avatar name={account.name} color={account.avatarColor} size={40} />
            <div>
              <div className="flex items-center gap-1.5 font-bold">
                {account.name}
                {account.favorite && <Star size={14} className="fill-amber-400 text-amber-400" />}
              </div>
              <StatusBadge status={account.status} />
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost !p-2">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="card bg-surface-sunken p-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Current Code
            </div>
            <div className="flex items-center justify-between">
              <CodeDisplay
                code={code?.code ?? "•••••"}
                size="xl"
                onCopy={() => pushToast("Code copied", "success")}
              />
              <CountdownRing remaining={code?.remaining ?? 30} size={56} />
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Account Details
            </div>
            <div className="divide-y divide-line">
              <SecretRow label="SteamID" value={account.steamId || "—"} />
              <SecretRow label="Shared Secret" value={account.sharedSecret} />
              <SecretRow label="Identity Secret" value={account.identitySecret} />
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-ink-muted">Proxy</span>
                <span className="text-sm">{account.proxy ?? "No proxy"}</span>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Activity
            </div>
            <div className="divide-y divide-line">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-ink-muted">Last confirmation</span>
                <span className="text-sm">{timeAgo(account.lastConfirmation)}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-ink-muted">Last login</span>
                <span className="text-sm">{timeAgo(account.lastLogin)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-t border-line p-4">
          <button onClick={() => toggleFavorite(account.id)} className="btn-ghost flex-1 border border-line">
            <Star size={16} className={account.favorite ? "fill-amber-400 text-amber-400" : ""} />
            {account.favorite ? "Unfavorite" : "Favorite"}
          </button>
          <button
            onClick={() => {
              if (confirm(`Remove ${account.name}? This cannot be undone.`)) {
                removeAccount(account.id);
                onClose();
              }
            }}
            className="btn-danger flex-1"
          >
            <Trash2 size={16} /> Remove
          </button>
        </div>
      </div>
    </>
  );
}
