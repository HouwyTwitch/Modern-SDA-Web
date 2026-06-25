import { MoreHorizontal, Copy, Check, Star } from "lucide-react";
import { useState } from "react";
import type { Account } from "../../types";
import { Avatar } from "../common/Avatar";
import { StatusBadge } from "../common/StatusBadge";
import { CountdownRing } from "../common/CountdownRing";
import { CodeDisplay } from "../common/CodeDisplay";

interface Props {
  account: Account;
  remaining: number;
  onOpen: () => void;
}

export function AccountRow({ account, remaining, onOpen }: Props) {
  const [copied, setCopied] = useState(false);
  const code = account.code ?? "•••••";

  async function copyCode(e: React.MouseEvent) {
    e.stopPropagation();
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <button
      onClick={onOpen}
      className="card hover-lift group flex w-full items-center gap-3 p-3 text-left hover:border-accent/50 sm:gap-4 sm:p-4"
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

      <div className="flex items-center gap-3 sm:gap-4">
        <div onClick={copyCode} className="hidden sm:block" role="button" tabIndex={-1}>
          <CodeDisplay code={code} size="md" />
        </div>
        <span className="font-mono text-xl font-bold tracking-wider text-accent sm:hidden">{code}</span>
        <CountdownRing remaining={remaining} />
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
