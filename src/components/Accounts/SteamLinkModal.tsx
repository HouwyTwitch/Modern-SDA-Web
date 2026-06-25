import { useState } from "react";
import { LogIn, Loader2, ShieldCheck } from "lucide-react";
import { Modal } from "../common/Modal";
import { useStore } from "../../store/useStore";
import type { Account } from "../../types";

interface Props {
  account: Account;
  open: boolean;
  onClose: () => void;
}

/** Sign in to Steam to obtain a refresh token (enables live confirmations). */
export function SteamLinkModal({ account, open, onClose }: Props) {
  const steamLogin = useStore((s) => s.steamLogin);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit() {
    setError(undefined);
    setBusy(true);
    try {
      await steamLogin(account.id, password || undefined);
      setPassword("");
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Sign in to Steam">
      <div className="mb-4 flex items-start gap-3 rounded-xl bg-accent-soft p-3 text-sm text-accent">
        <ShieldCheck size={18} className="mt-0.5 shrink-0" />
        <p className="text-ink-muted">
          Your Steam password is used once to obtain a long-lived <b>refresh token</b>, which is then
          stored encrypted. The Steam Guard code is generated automatically from your shared secret.
        </p>
      </div>

      <label className="mb-1 block text-xs font-medium text-ink-muted">Steam password</label>
      <input
        type="password"
        autoFocus
        className="input"
        placeholder="Steam account password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void submit()}
      />
      <p className="mt-2 text-xs text-ink-faint">
        For <span className="font-medium">{account.name}</span>
        {account.steamId ? ` (${account.steamId})` : ""}.
      </p>

      {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      <button onClick={() => void submit()} disabled={busy || !password} className="btn-accent mt-4 w-full">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
        {busy ? "Signing in…" : "Sign in & link"}
      </button>
    </Modal>
  );
}
