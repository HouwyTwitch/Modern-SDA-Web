import { Check, X, ArrowLeftRight, Store, Inbox, Loader2 } from "lucide-react";
import { useState } from "react";
import { Modal } from "../common/Modal";
import { Avatar } from "../common/Avatar";
import { timeAgo } from "../../lib/format";
import type { Account, Confirmation, ConfirmationType } from "../../types";

const TYPE_ICON: Record<ConfirmationType, typeof ArrowLeftRight> = {
  trade: ArrowLeftRight,
  market: Store,
  other: Inbox,
};
const TYPE_LABEL: Record<ConfirmationType, string> = {
  trade: "Trade offer",
  market: "Market listing",
  other: "Confirmation",
};

interface Props {
  conf: Confirmation | null;
  account?: Account;
  open: boolean;
  onClose: () => void;
  onResolve: (accountId: string, id: string, action: "allow" | "cancel", nonce?: string) => Promise<void> | void;
}

export function ConfirmationDetailModal({ conf, account, open, onClose, onResolve }: Props) {
  const [busy, setBusy] = useState<"allow" | "cancel" | null>(null);
  if (!conf) return null;
  const Icon = TYPE_ICON[conf.type];

  async function act(action: "allow" | "cancel") {
    if (!conf) return;
    setBusy(action);
    try {
      await onResolve(conf.accountId, conf.id, action, conf.nonce);
      onClose();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Confirmation details">
      <div className="flex items-center gap-3">
        <div
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
            conf.type === "trade" ? "bg-accent-soft text-accent" : "bg-purple-500/10 text-purple-400"
          }`}
        >
          <Icon size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold">{conf.title}</div>
          <div className="text-xs text-ink-faint">{TYPE_LABEL[conf.type]} · {timeAgo(conf.createdAt)}</div>
        </div>
        {conf.amount && <span className="font-bold text-green-400">{conf.amount}</span>}
      </div>

      {conf.iconUrls && conf.iconUrls.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {conf.iconUrls.map((u, i) => (
            <img key={i} src={u} alt="" className="h-14 w-14 rounded-lg border border-line bg-surface-sunken object-contain p-1" />
          ))}
        </div>
      )}

      {conf.subtitle && (
        <div className="mt-4 rounded-xl bg-surface-sunken p-3 text-sm leading-relaxed">{conf.subtitle}</div>
      )}

      {conf.warn && (
        <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-400">
          {conf.warn}
        </div>
      )}

      <div className="mt-4 space-y-2 text-sm">
        {account && (
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">Account</span>
            <span className="flex items-center gap-2">
              <Avatar name={account.name} color={account.avatarColor} url={account.avatarUrl} size={20} />
              {account.name}
            </span>
          </div>
        )}
        {conf.creatorId && (
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">Reference</span>
            <span className="font-mono text-xs">{conf.creatorId}</span>
          </div>
        )}
      </div>

      <div className="mt-5 flex gap-2">
        <button onClick={() => void act("cancel")} disabled={!!busy} className="btn-danger flex-1">
          {busy === "cancel" ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />} Decline
        </button>
        <button onClick={() => void act("allow")} disabled={!!busy} className="btn-accent flex-1">
          {busy === "allow" ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Approve
        </button>
      </div>
    </Modal>
  );
}
