import { useState } from "react";
import { ShieldCheck, Lock } from "lucide-react";
import { useStore } from "../store/useStore";

export function LockScreen() {
  const unlock = useStore((s) => s.unlock);
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!pw) return;
    setBusy(true);
    const ok = await unlock(pw);
    setBusy(false);
    if (!ok) {
      setError(true);
      setPw("");
    }
  }

  return (
    <div className="grid h-full place-items-center p-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/30">
          <ShieldCheck size={32} />
        </div>
        <h1 className="mt-5 text-xl font-bold">Vault locked</h1>
        <p className="mt-1 text-sm text-ink-muted">Enter your master password to continue.</p>

        <div className="mt-6 space-y-3">
          <input
            type="password"
            autoFocus
            className={`input text-center ${error ? "border-red-500 ring-red-500/30" : ""}`}
            placeholder="Master password"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              setError(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
          />
          {error && <p className="text-sm text-red-400">Incorrect password. Try again.</p>}
          <button onClick={() => void submit()} disabled={busy} className="btn-accent w-full">
            <Lock size={16} /> {busy ? "Unlocking…" : "Unlock"}
          </button>
        </div>
      </div>
    </div>
  );
}
