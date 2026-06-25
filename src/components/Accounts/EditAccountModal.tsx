import { useState } from "react";
import { Save, Loader2 } from "lucide-react";
import { Modal } from "../common/Modal";
import { useStore } from "../../store/useStore";
import type { Account } from "../../types";

interface Props {
  account: Account;
  open: boolean;
  onClose: () => void;
}

export function EditAccountModal({ account, open, onClose }: Props) {
  const updateAccount = useStore((s) => s.updateAccount);
  const [name, setName] = useState(account.name);
  const [proxy, setProxy] = useState(account.proxy ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit() {
    setError(undefined);
    setBusy(true);
    try {
      await updateAccount(account.id, { name: name.trim() || account.name, proxy: proxy.trim() });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit account">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">Account name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">Proxy</label>
          <input
            className="input font-mono text-xs"
            value={proxy}
            onChange={(e) => setProxy(e.target.value)}
            placeholder="http://user:pass@host:port (leave blank for none)"
          />
        </div>
        {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
        <button onClick={() => void submit()} disabled={busy} className="btn-accent w-full">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save changes
        </button>
      </div>
    </Modal>
  );
}
