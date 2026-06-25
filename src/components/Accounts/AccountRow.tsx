import { MoreHorizontal, Copy, Check, Star } from "lucide-react";
import { useState } from "react";
import type { Account } from "../../types";
import { Avatar } from "../common/Avatar";
import { StatusBadge } from "../common/StatusBadge";
import { CountdownRing } from "../common/CountdownRing";
import { CodeDisplay } from "../common/CodeDisplay";
import type { CodeState } from "../../hooks/useSteamCodes";

interface Props {
  account: Account;
  code?: CodeState;
  onOpen: () => void;
}

export function AccountRow({ account, code, onOpen }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyCode(e: React.MouseEvent) {
    e.stopPropagation();
    if (!code) return;
    await navigator.clipboard.writeText(code.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <button
      onClick={onOpen}
      className="card group flex w-full items-center gap-3 p-3 text-left transition hover:border-accent/50 hover:bg-surface-sunken/50 sm:gap-4 sm:p-4"
    >
      <Avatar name={account.name} color={account.avatarColor} size={48} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-semibold">{account.name}</span>
          {account.favorite && <Star size={13} className="shrink-0 fill-amber-400 text-amber-400" />}
        </div>
        <div className="truncate font-mono text-xs text-ink-faint">{account.steamId || "—"}</div>
        <div className="mt-1.5 flex items-center gap-3">
          <StatusBadge status={account.status} />
          {account.proxy && (
            <span className="hidden text-xs text-ink-faint sm:inline">· {account.proxy}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <div onClick={copyCode} className="hidden sm:block" role="button" tabIndex={-1}>
          <CodeDisplay code={code?.code ?? "•••••"} size="md" />
        </div>
        <span className="font-mono text-xl font-bold tracking-wider text-accent sm:hidden">
          {code?.code ?? "•••••"}
        </span>
        <CountdownRing remaining={code?.remaining ?? 30} />
        <span
          onClick={copyCode}
          className="hidden text-ink-faint opacity-0 transition hover:text-ink group-hover:opacity-100 sm:inline"
          role="button"
          tabIndex={-1}
        >
          {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
        </span>
        <MoreHorizontal size={18} className="text-ink-faint" />
      </div>
    </button>
  );
}
