import { useRef, useState } from "react";
import { Upload, FileJson, KeyRound, Loader2 } from "lucide-react";
import { Modal } from "../common/Modal";
import { parseMaFile, isValidSecret } from "../../lib/mafile";
import { useStore } from "../../store/useStore";
import type { ParsedMaFile } from "../../types";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = "file" | "manual";

export function AddAccountModal({ open, onClose }: Props) {
  const addAccount = useStore((s) => s.addAccount);
  const [tab, setTab] = useState<Tab>("file");
  const [error, setError] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [steamId, setSteamId] = useState("");
  const [shared, setShared] = useState("");
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [proxy, setProxy] = useState("");

  function reset() {
    setError(undefined);
    setName("");
    setSteamId("");
    setShared("");
    setIdentity("");
    setPassword("");
    setProxy("");
  }
  function close() {
    reset();
    onClose();
  }

  async function addParsed(parsed: ParsedMaFile, pw?: string) {
    await addAccount(parsed, {
      ...(pw ? { password: pw } : {}),
      ...(proxy.trim() ? { proxy: proxy.trim() } : {}),
    });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(undefined);
    let added = 0;
    try {
      for (const file of Array.from(files)) {
        const text = await file.text();
        const { parsed, error: err } = parseMaFile(text, file.name.replace(/\.maFile$|\.json$/i, ""));
        if (parsed) {
          await addParsed(parsed);
          added++;
        } else if (err) {
          setError(`${file.name}: ${err}`);
        }
      }
      if (added > 0) close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitManual() {
    setError(undefined);
    if (!isValidSecret(shared)) {
      setError("Shared secret must be valid base64 (16+ bytes).");
      return;
    }
    setBusy(true);
    try {
      const finalName = name.trim() || (steamId ? `Account ${steamId.slice(-4)}` : "New Account");
      await addParsed(
        {
          name: finalName,
          steamId: steamId.trim(),
          shared_secret: shared.trim(),
          identity_secret: identity.trim() || undefined,
          account_name: name.trim() || undefined,
        },
        password.trim() || undefined,
      );
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title="Add Account">
      <div className="mb-4 flex gap-1 rounded-xl bg-surface-sunken p-1">
        {(["file", "manual"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
              tab === t ? "bg-surface-raised text-ink shadow" : "text-ink-muted"
            }`}
          >
            {t === "file" ? "Import .maFile" : "Manual"}
          </button>
        ))}
      </div>

      {tab === "file" ? (
        <div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition ${
              dragging ? "border-accent bg-accent-soft" : "border-line hover:border-accent/60"
            }`}
          >
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-accent-soft text-accent">
              {busy ? <Loader2 size={24} className="animate-spin" /> : dragging ? <FileJson size={24} /> : <Upload size={24} />}
            </div>
            <div>
              <p className="font-semibold">Drop your .maFile here</p>
              <p className="text-sm text-ink-faint">or click to browse — multiple files supported</p>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".maFile,.json,application/json"
            multiple
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <div className="mt-3">
            <Field label="Proxy (optional)" value={proxy} onChange={setProxy} placeholder="http://user:pass@host:port" />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Field label="Account name" value={name} onChange={setName} placeholder="JohnTrader" />
          <Field label="SteamID64" value={steamId} onChange={setSteamId} placeholder="7656119…" />
          <Field label="Shared secret *" value={shared} onChange={setShared} placeholder="base64…" mono />
          <Field label="Identity secret (for confirmations)" value={identity} onChange={setIdentity} placeholder="base64… (optional)" mono />
          <Field label="Steam password (optional — to link now)" value={password} onChange={setPassword} placeholder="••••••••" type="password" />
          <Field label="Proxy (optional)" value={proxy} onChange={setProxy} placeholder="http://user:pass@host:port" />
          <button onClick={() => void submitManual()} disabled={busy} className="btn-accent w-full">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />} Add account
          </button>
        </div>
      )}

      {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  mono,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-muted">{label}</label>
      <input
        type={type}
        className={`input ${mono ? "font-mono" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
