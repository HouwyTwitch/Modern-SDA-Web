import { useRef, useState } from "react";
import { Upload, FileJson, KeyRound } from "lucide-react";
import { Modal } from "../common/Modal";
import { parseMaFile, pickAvatarColor } from "../../lib/mafile";
import { isValidSharedSecret } from "../../lib/steamGuard";
import { useStore } from "../../store/useStore";
import type { Account } from "../../types";

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
  const fileRef = useRef<HTMLInputElement>(null);

  // manual fields
  const [name, setName] = useState("");
  const [steamId, setSteamId] = useState("");
  const [shared, setShared] = useState("");
  const [identity, setIdentity] = useState("");

  function reset() {
    setError(undefined);
    setName("");
    setSteamId("");
    setShared("");
    setIdentity("");
  }

  function close() {
    reset();
    onClose();
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    let added = 0;
    for (const file of Array.from(files)) {
      const text = await file.text();
      const { account, error: err } = parseMaFile(text, file.name.replace(/\.maFile$|\.json$/i, ""));
      if (account) {
        addAccount(account);
        added++;
      } else if (err) {
        setError(`${file.name}: ${err}`);
      }
    }
    if (added > 0) close();
  }

  function submitManual() {
    setError(undefined);
    if (!isValidSharedSecret(shared)) {
      setError("Shared secret must be valid base64 (16+ bytes).");
      return;
    }
    const finalName = name.trim() || (steamId ? `Account ${steamId.slice(-4)}` : "New Account");
    const account: Account = {
      id: crypto.randomUUID(),
      name: finalName,
      steamId: steamId.trim(),
      sharedSecret: shared.trim(),
      identitySecret: identity.trim() || undefined,
      avatarColor: pickAvatarColor(finalName + steamId),
      status: identity.trim() ? "online" : "needs_login",
      createdAt: Date.now(),
    };
    addAccount(account);
    close();
  }

  return (
    <Modal open={open} onClose={close} title="Add Account">
      <div className="mb-4 flex gap-1 rounded-xl bg-surface-sunken p-1">
        {(["file", "manual"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition ${
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
              {dragging ? <FileJson size={24} /> : <Upload size={24} />}
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
          <p className="mt-3 text-xs text-ink-faint">
            Files are read locally in your browser. Secrets never touch a server unless you enable
            confirmation syncing.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">Account name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="JohnTrader" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">SteamID64</label>
            <input className="input" value={steamId} onChange={(e) => setSteamId(e.target.value)} placeholder="7656119..." />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              Shared secret <span className="text-red-400">*</span>
            </label>
            <input className="input font-mono" value={shared} onChange={(e) => setShared(e.target.value)} placeholder="base64…" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">Identity secret (for confirmations)</label>
            <input className="input font-mono" value={identity} onChange={(e) => setIdentity(e.target.value)} placeholder="base64… (optional)" />
          </div>
          <button onClick={submitManual} className="btn-accent w-full">
            <KeyRound size={16} /> Add account
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}
    </Modal>
  );
}
