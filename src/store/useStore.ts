import { create } from "zustand";
import type { Account, Confirmation, Settings } from "../types";
import { SAMPLE_ACCOUNTS, SAMPLE_CONFIRMATIONS } from "../data/sampleData";
import { encryptJSON, decryptJSON, isEncryptedBlob, type EncryptedBlob } from "../lib/crypto";

const STORAGE_KEY = "msda.vault.v1";
const SETTINGS_KEY = "msda.settings.v1";

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  accent: "blue",
  language: "English",
  autoLockMinutes: 5,
  encryptionEnabled: false,
  biometrics: false,
  autoConfirmTrades: false,
  autoConfirmMarket: false,
  density: "comfortable",
};

interface Toast {
  id: string;
  message: string;
  kind: "success" | "error" | "info";
}

interface VaultData {
  accounts: Account[];
  confirmations: Confirmation[];
}

interface StoreState {
  accounts: Account[];
  confirmations: Confirmation[];
  settings: Settings;
  /** true when an encrypted vault exists and has not been unlocked this session. */
  locked: boolean;
  hasEncryptedVault: boolean;
  masterPassword?: string;
  toasts: Toast[];
  initialized: boolean;

  init: () => void;
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;

  addAccount: (account: Account) => void;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  removeAccount: (id: string) => void;
  toggleFavorite: (id: string) => void;

  resolveConfirmation: (id: string, action: "allow" | "cancel") => void;
  resolveAllForAccount: (accountId: string, action: "allow" | "cancel") => void;

  setSettings: (patch: Partial<Settings>) => void;
  enableEncryption: (password: string) => Promise<void>;
  disableEncryption: () => void;

  pushToast: (message: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: string) => void;

  exportVault: () => string;
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_SETTINGS;
}

function persistSettings(settings: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export const useStore = create<StoreState>((set, get) => {
  async function persistVault() {
    const { accounts, confirmations, settings, masterPassword } = get();
    const data: VaultData = { accounts, confirmations };
    if (settings.encryptionEnabled && masterPassword) {
      const blob = await encryptJSON(data, masterPassword);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }

  return {
    accounts: [],
    confirmations: [],
    settings: DEFAULT_SETTINGS,
    locked: false,
    hasEncryptedVault: false,
    toasts: [],
    initialized: false,

    init: () => {
      if (get().initialized) return;
      const settings = loadSettings();
      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        // First run: seed with demo content.
        set({
          settings,
          accounts: SAMPLE_ACCOUNTS,
          confirmations: SAMPLE_CONFIRMATIONS,
          initialized: true,
          locked: false,
          hasEncryptedVault: false,
        });
        return;
      }

      try {
        const parsed = JSON.parse(raw);
        if (isEncryptedBlob(parsed)) {
          // Locked until the user enters their master password.
          set({
            settings,
            accounts: [],
            confirmations: [],
            initialized: true,
            locked: true,
            hasEncryptedVault: true,
          });
        } else {
          const data = parsed as VaultData;
          set({
            settings,
            accounts: data.accounts ?? [],
            confirmations: data.confirmations ?? [],
            initialized: true,
            locked: false,
            hasEncryptedVault: false,
          });
        }
      } catch {
        set({ settings, initialized: true });
      }
    },

    unlock: async (password) => {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      try {
        const blob = JSON.parse(raw) as EncryptedBlob;
        const data = await decryptJSON<VaultData>(blob, password);
        set({
          accounts: data.accounts ?? [],
          confirmations: data.confirmations ?? [],
          locked: false,
          masterPassword: password,
        });
        return true;
      } catch {
        return false;
      }
    },

    lock: () => {
      if (!get().settings.encryptionEnabled) return;
      set({ locked: true, accounts: [], confirmations: [], masterPassword: undefined });
    },

    addAccount: (account) => {
      set((s) => {
        // Drop demo data the first time a real account is added.
        const isDemo = s.accounts.every((a) => a.id.startsWith("demo-"));
        const base = isDemo ? [] : s.accounts;
        const baseConf = isDemo ? [] : s.confirmations;
        return { accounts: [...base, account], confirmations: baseConf };
      });
      void persistVault();
      get().pushToast(`Added ${account.name}`, "success");
    },

    updateAccount: (id, patch) => {
      set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
      void persistVault();
    },

    removeAccount: (id) => {
      set((s) => ({
        accounts: s.accounts.filter((a) => a.id !== id),
        confirmations: s.confirmations.filter((c) => c.accountId !== id),
      }));
      void persistVault();
      get().pushToast("Account removed", "info");
    },

    toggleFavorite: (id) => {
      set((s) => ({
        accounts: s.accounts.map((a) => (a.id === id ? { ...a, favorite: !a.favorite } : a)),
      }));
      void persistVault();
    },

    resolveConfirmation: (id, action) => {
      const conf = get().confirmations.find((c) => c.id === id);
      set((s) => ({ confirmations: s.confirmations.filter((c) => c.id !== id) }));
      void persistVault();
      get().pushToast(
        `${action === "allow" ? "Approved" : "Declined"}${conf ? ` ${conf.title}` : ""}`,
        action === "allow" ? "success" : "info",
      );
    },

    resolveAllForAccount: (accountId, action) => {
      const count = get().confirmations.filter((c) => c.accountId === accountId).length;
      set((s) => ({ confirmations: s.confirmations.filter((c) => c.accountId !== accountId) }));
      void persistVault();
      get().pushToast(
        `${action === "allow" ? "Approved" : "Declined"} ${count} confirmation${count !== 1 ? "s" : ""}`,
        action === "allow" ? "success" : "info",
      );
    },

    setSettings: (patch) => {
      set((s) => {
        const settings = { ...s.settings, ...patch };
        persistSettings(settings);
        return { settings };
      });
    },

    enableEncryption: async (password) => {
      set((s) => {
        const settings = { ...s.settings, encryptionEnabled: true };
        persistSettings(settings);
        return { settings, masterPassword: password, hasEncryptedVault: true };
      });
      await persistVault();
      get().pushToast("Master password set — vault encrypted", "success");
    },

    disableEncryption: () => {
      set((s) => {
        const settings = { ...s.settings, encryptionEnabled: false };
        persistSettings(settings);
        return { settings, masterPassword: undefined, hasEncryptedVault: false };
      });
      void persistVault();
      get().pushToast("Encryption disabled", "info");
    },

    pushToast: (message, kind = "info") => {
      const id = crypto.randomUUID();
      set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
      setTimeout(() => get().dismissToast(id), 3200);
    },

    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

    exportVault: () => {
      const { accounts, confirmations } = get();
      return JSON.stringify({ accounts, confirmations }, null, 2);
    },
  };
});
