import { useRef, useState, type ReactNode } from "react";
import {
  Palette,
  Globe,
  Sun,
  Lock,
  KeyRound,
  Clock,
  Fingerprint,
  Download,
  Upload,
  Zap,
  ChevronRight,
  Check,
} from "lucide-react";
import { useStore } from "../store/useStore";
import { ACCENTS } from "../data/accents";
import { Modal } from "../components/common/Modal";
import type { ThemeMode } from "../types";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-ink-faint">{title}</h2>
      <div className="card divide-y divide-line overflow-hidden">{children}</div>
    </section>
  );
}

function Row({
  icon,
  label,
  children,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  children?: ReactNode;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${
        onClick ? "transition hover:bg-surface-sunken/60" : ""
      }`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-sunken text-ink-muted">
        {icon}
      </span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <span className="flex items-center gap-2 text-sm text-ink-muted">{children}</span>
    </Comp>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChange(!on);
      }}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-accent" : "bg-surface-sunken"}`}
      role="switch"
      aria-checked={on}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          on ? "left-[1.375rem]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const enableEncryption = useStore((s) => s.enableEncryption);
  const disableEncryption = useStore((s) => s.disableEncryption);
  const exportVault = useStore((s) => s.exportVault);
  const addAccount = useStore((s) => s.addAccount);
  const pushToast = useStore((s) => s.pushToast);
  const lock = useStore((s) => s.lock);

  const [pwModal, setPwModal] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const themes: { id: ThemeMode; label: string }[] = [
    { id: "system", label: "System" },
    { id: "dark", label: "Dark" },
    { id: "light", label: "Light" },
    { id: "contrast", label: "Contrast" },
  ];

  function handleExport() {
    const blob = new Blob([exportVault()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `modern-sda-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast("Backup exported", "success");
  }

  async function handleImport(file?: File) {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const accounts = Array.isArray(data) ? data : data.accounts;
      if (!Array.isArray(accounts)) throw new Error();
      let n = 0;
      for (const a of accounts) {
        if (a.sharedSecret) {
          addAccount({ ...a, id: crypto.randomUUID() });
          n++;
        }
      }
      pushToast(`Imported ${n} account${n !== 1 ? "s" : ""}`, "success");
    } catch {
      pushToast("Invalid backup file", "error");
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Settings</h1>

      <Section title="General">
        <div className="px-4 py-3.5">
          <div className="mb-3 flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-sunken text-ink-muted">
              <Sun size={18} />
            </span>
            <span className="text-sm font-medium">Theme</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => setSettings({ theme: t.id })}
                className={`rounded-xl border py-2 text-xs font-semibold transition ${
                  settings.theme === t.id
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line text-ink-muted hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 py-3.5">
          <div className="mb-3 flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-sunken text-ink-muted">
              <Palette size={18} />
            </span>
            <span className="text-sm font-medium">Accent Color</span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                onClick={() => setSettings({ accent: a.id })}
                className={`grid h-9 w-9 place-items-center rounded-full transition ${
                  settings.accent === a.id ? "ring-2 ring-offset-2 ring-offset-surface-raised" : ""
                }`}
                style={{ backgroundColor: `rgb(${a.rgb})`, ...(settings.accent === a.id ? { ["--tw-ring-color" as string]: `rgb(${a.rgb})` } : {}) }}
                aria-label={a.label}
              >
                {settings.accent === a.id && <Check size={16} className="text-white" />}
              </button>
            ))}
          </div>
        </div>

        <Row icon={<Globe size={18} />} label="Language">
          {settings.language} <ChevronRight size={16} className="text-ink-faint" />
        </Row>
      </Section>

      <Section title="Security">
        <Row icon={<Lock size={18} />} label="Local Encryption">
          <Toggle
            on={settings.encryptionEnabled}
            onChange={(v) => {
              if (v) setPwModal(true);
              else if (confirm("Disable encryption? Secrets will be stored unencrypted.")) disableEncryption();
            }}
          />
        </Row>
        <Row icon={<KeyRound size={18} />} label="Master Password" onClick={() => setPwModal(true)}>
          {settings.encryptionEnabled ? "Set" : "Not set"} <ChevronRight size={16} className="text-ink-faint" />
        </Row>
        <Row icon={<Clock size={18} />} label="Auto Lock">
          <select
            value={settings.autoLockMinutes}
            onChange={(e) => setSettings({ autoLockMinutes: Number(e.target.value) })}
            className="bg-transparent text-right text-sm font-medium outline-none"
          >
            <option value={0}>Never</option>
            <option value={1}>1 minute</option>
            <option value={5}>5 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={60}>1 hour</option>
          </select>
        </Row>
        <Row icon={<Fingerprint size={18} />} label="Lock now" onClick={lock}>
          <ChevronRight size={16} className="text-ink-faint" />
        </Row>
      </Section>

      <Section title="Auto-Confirm">
        <Row icon={<Zap size={18} />} label="Auto-confirm trades">
          <Toggle on={settings.autoConfirmTrades} onChange={(v) => setSettings({ autoConfirmTrades: v })} />
        </Row>
        <Row icon={<Zap size={18} />} label="Auto-confirm market">
          <Toggle on={settings.autoConfirmMarket} onChange={(v) => setSettings({ autoConfirmMarket: v })} />
        </Row>
      </Section>

      <Section title="Storage">
        <Row icon={<Download size={18} />} label="Export Backup" onClick={handleExport}>
          JSON <ChevronRight size={16} className="text-ink-faint" />
        </Row>
        <Row icon={<Upload size={18} />} label="Import Backup" onClick={() => importRef.current?.click()}>
          From file <ChevronRight size={16} className="text-ink-faint" />
        </Row>
      </Section>

      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => void handleImport(e.target.files?.[0])}
      />

      <p className="mt-6 text-center text-xs text-ink-faint">
        Modern SDA Web v1.0.0 · Codes generated locally with Web Crypto
      </p>

      <MasterPasswordModal open={pwModal} onClose={() => setPwModal(false)} onSet={enableEncryption} />
    </div>
  );
}

function MasterPasswordModal({
  open,
  onClose,
  onSet,
}: {
  open: boolean;
  onClose: () => void;
  onSet: (pw: string) => Promise<void>;
}) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();

  async function submit() {
    if (pw.length < 6) return setError("Use at least 6 characters.");
    if (pw !== confirm) return setError("Passwords don't match.");
    await onSet(pw);
    setPw("");
    setConfirm("");
    setError(undefined);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Set Master Password">
      <p className="mb-4 text-sm text-ink-muted">
        Your vault is encrypted with AES-GCM. The password is never stored — if you lose it, your
        secrets can't be recovered.
      </p>
      <div className="space-y-3">
        <input
          type="password"
          className="input"
          placeholder="Master password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoFocus
        />
        <input
          type="password"
          className="input"
          placeholder="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button onClick={() => void submit()} className="btn-accent w-full">
          <Lock size={16} /> Encrypt vault
        </button>
      </div>
    </Modal>
  );
}
