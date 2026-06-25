import { useState } from "react";
import { LogIn, Loader2, Check } from "lucide-react";
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
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit() {
    setError(undefined);
    setBusy(true);
    try {
      await steamLogin(account.id, password || undefined, remember);
      setPassword("");
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Sign in to Steam · ${account.name}`}>
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

      <button
        type="button"
        onClick={() => setRemember((v) => !v)}
        className="mt-3 flex items-center gap-2.5 text-sm text-ink-muted"
      >
        <span
          className={`grid h-5 w-5 place-items-center rounded-md border transition ${
            remember ? "border-accent bg-accent text-white" : "border-line"
          }`}
        >
          {remember && <Check size={13} />}
        </span>
        Remember password (auto re-login when the session expires)
      </button>

      {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

      <button onClick={() => void submit()} disabled={busy || !password} className="btn-accent mt-4 w-full">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
        {busy ? "Signing in…" : "Sign in & link"}
      </button>
    </Modal>
  );
}
