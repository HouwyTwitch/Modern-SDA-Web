import { useState } from "react";
import { Eye, Copy, Check, Loader2, Lock } from "lucide-react";
import { Modal } from "../common/Modal";
import { useStore } from "../../store/useStore";
import type { Account } from "../../types";

interface Props {
  account: Account;
  open: boolean;
  onClose: () => void;
}

const LABELS: Record<string, string> = {
  shared_secret: "Shared secret",
  identity_secret: "Identity secret",
  account_name: "Account name",
  refresh_token: "Refresh token",
};

/** Decrypt secrets with the user's own password (proves owner-side decryption). */
export function RevealModal({ account, open, onClose }: Props) {
  const reveal = useStore((s) => s.reveal);
  const [password, setPassword] = useState("");
  const [secrets, setSecrets] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState<string>();

  function close() {
    setPassword("");
    setSecrets(null);
    setError(undefined);
    onClose();
  }

  async function submit() {
    setError(undefined);
    setBusy(true);
    try {
      const s = await reveal(account.id, password);
      setSecrets(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copy(key: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(undefined), 1200);
  }

  return (
    <Modal open={open} onClose={close} title="Reveal secrets">
      {!secrets ? (
        <>
          <p className="mb-4 flex items-start gap-2 text-sm text-ink-muted">
            <Lock size={16} className="mt-0.5 shrink-0 text-accent" />
            Enter your account password to decrypt these secrets with <b>your</b> key. This proves the
            data is recoverable by you, not just the server.
          </p>
          <input
            type="password"
            autoFocus
            className="input"
            placeholder="Your Modern SDA password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
          />
          {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
          <button onClick={() => void submit()} disabled={busy || !password} className="btn-accent mt-4 w-full">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />} Decrypt
          </button>
        </>
      ) : (
        <div className="space-y-3">
          {Object.entries(secrets).map(([key, value]) => (
            <div key={key}>
              <label className="mb-1 block text-xs font-medium text-ink-muted">{LABELS[key] ?? key}</label>
              <div className="flex items-center gap-2">
                <input readOnly value={value} className="input font-mono text-xs" />
                <button onClick={() => copy(key, value)} className="btn-ghost border border-line !p-2.5">
                  {copied === key ? <Check size={15} className="text-green-400" /> : <Copy size={15} />}
                </button>
              </div>
            </div>
          ))}
          <button onClick={close} className="btn-ghost w-full border border-line">
            Done
          </button>
        </div>
      )}
    </Modal>
  );
}
