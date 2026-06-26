import { useState } from "react";
import { X, Star, Trash2, LogIn, QrCode, Eye, Pencil, ShieldCheck, ShieldAlert } from "lucide-react";
import type { Account } from "../../types";
import { Avatar } from "../common/Avatar";
import { StatusBadge } from "../common/StatusBadge";
import { CountdownRing } from "../common/CountdownRing";
import { CodeDisplay } from "../common/CodeDisplay";
import { useStore } from "../../store/useStore";
import { timeAgo } from "../../lib/format";
import { SteamLinkModal } from "./SteamLinkModal";
import { QrApproveModal } from "./QrApproveModal";
import { RevealModal } from "./RevealModal";
import { EditAccountModal } from "./EditAccountModal";

interface Props {
  account: Account;
  remaining: number;
  onClose: () => void;
}

export function AccountDetail({ account, remaining, onClose }: Props) {
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const deleteAccount = useStore((s) => s.deleteAccount);
  const pushToast = useStore((s) => s.pushToast);
  const [linkOpen, setLinkOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 animate-fade-in lg:hidden" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex h-full w-full flex-col bg-surface-raised animate-fade-in lg:relative lg:inset-auto lg:z-0 lg:h-full lg:border-l lg:border-line">
        <div className="flex items-center justify-between border-b border-line p-4">
          <div className="flex items-center gap-3">
            <Avatar name={account.name} color={account.avatarColor} url={account.avatarUrl} size={40} />
            <div>
              <div className="flex items-center gap-1.5 font-bold">
                {account.name}
                {account.favorite && <Star size={14} className="fill-amber-400 text-amber-400" />}
              </div>
              <StatusBadge status={account.status} />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setEditOpen(true)} className="btn-ghost !p-2" title="Edit">
              <Pencil size={17} />
            </button>
            <button onClick={onClose} className="btn-ghost !p-2">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="card bg-gradient-to-br from-surface-sunken to-surface-sunken/40 p-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">Current Code</div>
            <div className="flex items-center justify-between">
              <CodeDisplay code={account.code ?? "•••••"} size="xl" onCopy={() => pushToast("Code copied", "success")} />
              <CountdownRing remaining={remaining} size={56} />
            </div>
          </div>

          {/* Session status banner */}
          <div
            className={`mt-4 flex items-center gap-3 rounded-xl border p-3 ${
              account.hasSession
                ? "border-green-500/20 bg-green-500/5 text-green-400"
                : "border-amber-500/20 bg-amber-500/5 text-amber-400"
            }`}
          >
            {account.hasSession ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
            <div className="flex-1 text-sm">
              <div className="font-semibold text-ink">
                {account.hasSession ? "Steam session active" : "Not signed in to Steam"}
              </div>
              <div className="text-xs text-ink-muted">
                {account.hasSession
                  ? "Live confirmations & QR approval are available."
                  : "Sign in to enable confirmations and QR login approval."}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={() => setLinkOpen(true)} className="btn-ghost border border-line">
              <LogIn size={16} /> {account.hasSession ? "Re-link Steam" : "Sign in to Steam"}
            </button>
            <button
              onClick={() => (account.hasSession ? setQrOpen(true) : pushToast("Sign in to Steam first", "info"))}
              className="btn-ghost border border-line"
            >
              <QrCode size={16} /> Approve QR login
            </button>
            <button onClick={() => setRevealOpen(true)} className="btn-ghost border border-line">
              <Eye size={16} /> Reveal secrets
            </button>
            <button onClick={() => toggleFavorite(account.id)} className="btn-ghost border border-line">
              <Star size={16} className={account.favorite ? "fill-amber-400 text-amber-400" : ""} />
              {account.favorite ? "Unfavorite" : "Favorite"}
            </button>
          </div>

          <div className="mt-5">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">Details</div>
            <div className="divide-y divide-line">
              <Row label="SteamID" value={account.steamId || "—"} mono />
              <Row label="Identity secret" value={account.hasIdentity ? "Stored (encrypted)" : "Not provided"} />
              <Row label="Refresh token" value={account.hasSession ? "Stored (encrypted)" : "None"} />
              <Row label="Proxy" value={account.proxy ?? "No proxy"} />
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">Activity</div>
            <div className="divide-y divide-line">
              <Row label="Last confirmation" value={timeAgo(account.lastConfirmation ?? undefined)} />
              <Row label="Last login" value={timeAgo(account.lastLogin ?? undefined)} />
            </div>
          </div>

        </div>

        <div className="border-t border-line p-4">
          <button
            onClick={() => {
              if (confirm(`Remove ${account.name}? This cannot be undone.`)) {
                void deleteAccount(account.id);
                onClose();
              }
            }}
            className="btn-danger w-full"
          >
            <Trash2 size={16} /> Remove account
          </button>
        </div>
      </div>

      <SteamLinkModal account={account} open={linkOpen} onClose={() => setLinkOpen(false)} />
      <QrApproveModal account={account} open={qrOpen} onClose={() => setQrOpen(false)} />
      <RevealModal account={account} open={revealOpen} onClose={() => setRevealOpen(false)} />
      <EditAccountModal account={account} open={editOpen} onClose={() => setEditOpen(false)} />
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-2.5">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className={`max-w-[180px] truncate text-sm ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
