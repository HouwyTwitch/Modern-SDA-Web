import { MoreHorizontal, Copy, Check, Star } from "lucide-react";
import { useState } from "react";
import type { Account } from "../../types";
import { Avatar } from "../common/Avatar";
import { StatusBadge } from "../common/StatusBadge";
import { CountdownRing } from "../common/CountdownRing";
import { useStore } from "../../store/useStore";

interface Props {
  account: Account;
  remaining: number;
  onOpen: () => void;
}

export function AccountRow({ account, remaining, onOpen }: Props) {
  const pushToast = useStore((s) => s.pushToast);
  const [copied, setCopied] = useState(false);
  const code = account.code ?? "•••••";

  async function copyCode(e: React.MouseEvent) {
    e.stopPropagation(); // copy the code instead of opening the account
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* clipboard may be unavailable */
    }
    setCopied(true);
    pushToast("Code copied", "success");
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
      className="card hover-lift group flex w-full cursor-pointer items-center gap-3 p-3 text-left hover:border-accent/50 sm:gap-4 sm:p-4"
    >
      <Avatar name={account.name} color={account.avatarColor} url={account.avatarUrl} size={48} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-semibold">{account.name}</span>
          {account.favorite && <Star size={13} className="shrink-0 fill-amber-400 text-amber-400" />}
        </div>
        <div className="truncate font-mono text-xs text-ink-faint">{account.steamId || "—"}</div>
        <div className="mt-1.5 flex items-center gap-3">
          <StatusBadge status={account.status} />
          {account.proxy && <span className="hidden text-xs text-ink-faint sm:inline">· {account.proxy}</span>}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Tap the code itself to copy (works on mobile too). */}
        <button
          onClick={copyCode}
          title="Copy code"
          className="font-mono text-xl font-bold tracking-wider text-accent active:scale-95 sm:text-2xl"
        >
          {code}
        </button>
        <CountdownRing remaining={remaining} />
        {/* Single copy button, just left of the actions menu. */}
        <button
          onClick={copyCode}
          aria-label="Copy code"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-faint transition hover:bg-surface-sunken hover:text-ink"
        >
          {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
        </button>
        <MoreHorizontal size={18} className="shrink-0 text-ink-faint" />
      </div>
    </div>
  );
}
