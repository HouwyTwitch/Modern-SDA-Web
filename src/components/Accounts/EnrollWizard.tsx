import { useEffect, useRef, useState } from "react";
import { Loader2, ShieldPlus, KeyRound, Mail, Smartphone, Download, Check, AlertTriangle, ArrowLeftRight } from "lucide-react";
import { api } from "../../lib/api";
import { useStore } from "../../store/useStore";

type Step = "creds" | "email" | "confirm" | "sms" | "move" | "done";

const STEP_POSITION: Record<Step, number> = { creds: 0, email: 1, confirm: 1, sms: 2, move: 2, done: 3 };

interface Props {
  onClose: () => void;
}

/**
 * Wizard to enroll a brand-new Steam Mobile Authenticator and produce a .maFile.
 * Steps: Steam credentials -> email guard code -> SMS activation code -> done.
 * The account must already have a phone number on Steam.
 */
export function EnrollWizard({ onClose }: Props) {
  const loadAccounts = useStore((s) => s.loadAccounts);
  const pushToast = useStore((s) => s.pushToast);

  const [step, setStep] = useState<Step>("creds");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [moveSms, setMoveSms] = useState("");

  const [enrollId, setEnrollId] = useState("");
  const [accountName, setAccountName] = useState("");
  const [revocationCode, setRevocationCode] = useState("");
  const [maFile, setMaFile] = useState<Record<string, unknown> | null>(null);
  const [saved, setSaved] = useState(true);
  const [doneTitle, setDoneTitle] = useState("Authenticator created");

  // Cancel an in-progress enrollment server-side if the user navigates away.
  const cleanup = useRef({ enrollId: "", done: false });
  useEffect(() => {
    cleanup.current = { enrollId, done: step === "done" };
  }, [enrollId, step]);
  useEffect(() => {
    return () => {
      const { enrollId: id, done } = cleanup.current;
      if (id && !done) api.enrollCancel(id).catch(() => {});
    };
  }, []);

  async function run(fn: () => Promise<void>) {
    setError(undefined);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function proceed(id: string, code?: string) {
    const info = await api.enrollConfirm(id, code);
    if (info.step === "move") {
      await api.enrollMoveStart(id); // ask the existing authenticator to confirm
      setStep("move");
      return;
    }
    setAccountName(info.accountName ?? "");
    setRevocationCode(info.revocationCode ?? "");
    setStep("sms");
  }

  const login = () =>
    run(async () => {
      const res = await api.enrollLogin(username.trim(), password);
      setEnrollId(res.enrollId);
      if (res.step === "ready") await proceed(res.enrollId);
      else if (res.step === "confirm") setStep("confirm");
      else setStep("email");
    });

  const confirmEmail = () => run(() => proceed(enrollId, emailCode.trim()));
  const confirmApproved = () => run(() => proceed(enrollId));

  const completeFinalize = async (res: { maFile: Record<string, unknown>; saved: boolean }, title: string) => {
    setMaFile(res.maFile);
    setSaved(res.saved);
    setDoneTitle(title);
    setRevocationCode((prev) => (res.maFile.revocation_code as string) || prev);
    setAccountName((prev) => (res.maFile.account_name as string) || prev);
    setStep("done");
    if (res.saved) await loadAccounts();
    pushToast(title, "success");
  };

  const moveFinish = () =>
    run(async () => {
      const res = await api.enrollMoveContinue(enrollId, moveSms.trim() || undefined);
      await completeFinalize(res, "Authenticator moved");
    });

  const finalize = () =>
    run(async () => {
      const res = await api.enrollFinalize(enrollId, smsCode.trim());
      await completeFinalize(res, "Authenticator created");
    });

  function downloadMaFile() {
    if (!maFile) return;
    const raw = (maFile.account_name as string) || (maFile.Session as { SteamID?: number })?.SteamID || "account";
    const name = String(raw).replace(/[^a-zA-Z0-9._-]/g, "_") || "account";
    const blob = new Blob([JSON.stringify(maFile, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.maFile`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const steps: { id: Step; icon: typeof KeyRound; label: string }[] = [
    { id: "creds", icon: KeyRound, label: "Sign in" },
    { id: "email", icon: Mail, label: "Email" },
    { id: "sms", icon: Smartphone, label: "SMS" },
    { id: "done", icon: Check, label: "Done" },
  ];
  const activeIdx = STEP_POSITION[step];

  return (
    <div>
      {/* Stepper */}
      <div className="mb-4 flex items-center justify-between">
        {steps.map((s, i) => (
          <div key={s.id} className="flex flex-1 items-center">
            <div
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs ${
                i < activeIdx
                  ? "bg-accent text-white"
                  : i === activeIdx
                    ? "bg-accent-soft text-accent ring-2 ring-accent"
                    : "bg-surface-sunken text-ink-faint"
              }`}
            >
              {i < activeIdx ? <Check size={14} /> : <s.icon size={14} />}
            </div>
            {i < steps.length - 1 && (
              <div className={`mx-1 h-0.5 flex-1 rounded ${i < activeIdx ? "bg-accent" : "bg-line"}`} />
            )}
          </div>
        ))}
      </div>

      {step === "creds" && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-xl bg-accent-soft p-3 text-sm text-ink-muted">
            <ShieldPlus size={18} className="mt-0.5 shrink-0 text-accent" />
            Create a new Steam Guard authenticator for an account. The account must already have a
            phone number attached on Steam.
          </div>
          <Field label="Steam username" value={username} onChange={setUsername} placeholder="login" autoFocus />
          <Field label="Steam password" value={password} onChange={setPassword} placeholder="••••••••" type="password" onEnter={() => username && password && login()} />
          <Action onClick={login} busy={busy} disabled={!username || !password} icon={<KeyRound size={16} />}>
            Continue
          </Action>
        </div>
      )}

      {step === "email" && (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">
            Steam emailed a confirmation code to the account's email. Enter it below.
          </p>
          <Field label="Email code" value={emailCode} onChange={setEmailCode} placeholder="ABCDE" autoFocus mono onEnter={() => emailCode && confirmEmail()} />
          <Action onClick={confirmEmail} busy={busy} disabled={!emailCode} icon={<Mail size={16} />}>
            Verify & request SMS
          </Action>
        </div>
      )}

      {step === "confirm" && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-xl bg-accent-soft p-3 text-sm text-ink-muted">
            <Mail size={18} className="mt-0.5 shrink-0 text-accent" />
            Steam sent a confirmation to this account. Approve it by clicking the link in the email
            (or approving in your Steam mobile app), then continue.
          </div>
          <Action onClick={confirmApproved} busy={busy} icon={<Check size={16} />}>
            I approved it — continue
          </Action>
        </div>
      )}

      {step === "sms" && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-300">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-ink">Save your revocation code</div>
              You'll need it to remove the authenticator. It is shown only now:
              <div className="mt-1 font-mono text-base font-bold text-amber-300">{revocationCode || "—"}</div>
            </div>
          </div>
          <p className="text-sm text-ink-muted">
            Steam sent an SMS code to the phone on <span className="font-medium">{accountName}</span>. Enter it
            to activate.
          </p>
          <Field label="SMS code" value={smsCode} onChange={setSmsCode} placeholder="12345" autoFocus mono onEnter={() => smsCode && finalize()} />
          <Action onClick={finalize} busy={busy} disabled={!smsCode} icon={<Smartphone size={16} />}>
            Activate authenticator
          </Action>
        </div>
      )}

      {step === "move" && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-xl bg-accent-soft p-3 text-sm text-ink-muted">
            <ArrowLeftRight size={18} className="mt-0.5 shrink-0 text-accent" />
            This account already has an authenticator. To move it here, open your existing Steam Guard
            and approve the request (tap the confirm button). If Steam texted you a code instead, enter
            it below — then continue.
          </div>
          <Field
            label="SMS code (only if Steam texted you)"
            value={moveSms}
            onChange={setMoveSms}
            placeholder="optional"
            mono
            onEnter={moveFinish}
          />
          <Action onClick={moveFinish} busy={busy} icon={<Check size={16} />}>
            I approved it — move authenticator here
          </Action>
        </div>
      )}

      {step === "done" && (
        <div className="space-y-4 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-green-500/10 text-green-400">
            <Check size={28} />
          </div>
          <div>
            <p className="text-lg font-bold">{doneTitle} 🎉</p>
            <p className="mt-1 text-sm text-ink-muted">
              {saved
                ? `${accountName || "The account"} is ready. Download and back up the .maFile — it's the only copy.`
                : "Download and back up the .maFile now — it's the only copy."}
            </p>
          </div>
          {!saved && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-left text-sm text-amber-300">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              Your session had locked, so the account wasn't added automatically. Download the
              .maFile, sign in again, and add it via <span className="font-medium">Import .maFile</span>.
            </div>
          )}
          <div className="rounded-xl bg-surface-sunken p-3 text-left text-sm">
            <div className="text-ink-muted">Revocation code</div>
            <div className="font-mono text-base font-bold text-accent">{revocationCode}</div>
          </div>
          <button onClick={downloadMaFile} className="btn-accent w-full">
            <Download size={16} /> Download .maFile
          </button>
          <button onClick={onClose} className="btn-ghost w-full border border-line">
            Done
          </button>
        </div>
      )}

      {error && step !== "done" && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}

function Action({
  onClick,
  busy,
  disabled,
  icon,
  children,
}: {
  onClick: () => void;
  busy: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={busy || disabled} className="btn-accent w-full">
      {busy ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  onEnter,
  placeholder,
  type = "text",
  mono,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-muted">{label}</label>
      <input
        type={type}
        autoFocus={autoFocus}
        className={`input ${mono ? "font-mono tracking-wider" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        placeholder={placeholder}
      />
    </div>
  );
}
