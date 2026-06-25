import { useState } from "react";
import { ShieldCheck, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "../store/useAuth";

export function LoginPage() {
  const login = useAuth((s) => s.login);
  const register = useAuth((s) => s.register);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(40rem 30rem at 20% 10%, rgb(var(--accent)/0.25), transparent 60%), radial-gradient(40rem 30rem at 90% 90%, rgb(var(--accent)/0.18), transparent 55%)",
          }}
        />
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/30">
            <ShieldCheck size={24} />
          </div>
          <div className="text-lg font-bold">Modern SDA</div>
        </div>

        <div>
          <h1 className="max-w-md text-4xl font-extrabold leading-tight">
            Your Steam authenticator, <span className="text-accent">everywhere.</span>
          </h1>
          <p className="mt-4 max-w-md text-ink-muted">
            Manage every account, generate Steam Guard codes, and approve trades & QR logins from
            any device — with your secrets sealed by end-to-end encryption.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-ink-muted">
            {["Live confirmations & QR login approval", "Per-user encrypted vaults", "Multi-account, fast & smooth"].map(
              (f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-accent-soft text-accent">
                    ✓
                  </span>
                  {f}
                </li>
              ),
            )}
          </ul>
        </div>
        <div className="text-xs text-ink-faint">v2.0.0 · Secrets decryptable only by you or the server</div>
      </div>

      {/* Form panel */}
      <div className="grid place-items-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-white">
              <ShieldCheck size={22} />
            </div>
            <div className="font-bold">Modern SDA</div>
          </div>

          <h2 className="text-2xl font-bold">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {mode === "login" ? "Sign in to access your accounts." : "Start managing your Steam accounts securely."}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-3">
            <div className="relative">
              <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input
                type="email"
                required
                autoFocus
                className="input pl-11"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="relative">
              <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input
                type="password"
                required
                minLength={6}
                className="input pl-11"
                placeholder="Password (6+ characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
            <button type="submit" disabled={busy} className="btn-accent w-full">
              {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              {mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-ink-muted">
            {mode === "login" ? "No account yet?" : "Already have an account?"}{" "}
            <button
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError(undefined);
              }}
              className="font-semibold text-accent hover:underline"
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>

          <p className="mt-8 rounded-xl bg-surface-sunken px-4 py-3 text-xs text-ink-faint">
            🔒 Your account secrets are encrypted at rest. They can be decrypted only by you (with
            your password) or the server — never exposed to anyone else.
          </p>
        </div>
      </div>
    </div>
  );
}
