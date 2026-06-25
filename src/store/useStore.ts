import { create } from "zustand";
import { api } from "../lib/api";
import type { Account, Confirmation, ParsedMaFile } from "../types";

interface Toast {
  id: string;
  message: string;
  kind: "success" | "error" | "info";
}

interface StoreState {
  accounts: Account[];
  confirmations: Confirmation[];
  loadingAccounts: boolean;
  loadingConfirmations: boolean;
  confirmationErrors: { accountId: string; error: string }[];
  /** epoch ms when codes were last fetched (codes share one 30s window). */
  codesFetchedAt: number;
  toasts: Toast[];

  loadAccounts: () => Promise<void>;
  refreshCodes: () => Promise<void>;
  addAccount: (parsed: ParsedMaFile, extra?: { password?: string; refresh_token?: string; proxy?: string }) => Promise<Account>;
  updateAccount: (id: string, patch: Record<string, unknown>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  steamLogin: (id: string, password?: string) => Promise<void>;
  qrApprove: (id: string, url: string, confirm: boolean) => Promise<void>;
  reveal: (id: string, password: string) => Promise<Record<string, string>>;

  loadConfirmations: () => Promise<void>;
  actConfirmation: (accountId: string, id: string, action: "allow" | "cancel") => Promise<void>;
  acceptAll: (accountId: string, type?: string) => Promise<void>;

  pushToast: (message: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: string) => void;
  reset: () => void;
}

export const useStore = create<StoreState>((set, get) => ({
  accounts: [],
  confirmations: [],
  loadingAccounts: false,
  loadingConfirmations: false,
  confirmationErrors: [],
  codesFetchedAt: Date.now(),
  toasts: [],

  loadAccounts: async () => {
    set({ loadingAccounts: true });
    try {
      const accounts = await api.listAccounts();
      set({ accounts, codesFetchedAt: Date.now() });
    } catch (e) {
      get().pushToast((e as Error).message, "error");
    } finally {
      set({ loadingAccounts: false });
    }
  },

  refreshCodes: async () => {
    try {
      const codes = await api.listCodes();
      const map = new Map(codes.map((c) => [c.id, c]));
      set((s) => ({
        accounts: s.accounts.map((a) =>
          map.has(a.id)
            ? { ...a, code: map.get(a.id)!.code, codeExpiresIn: map.get(a.id)!.codeExpiresIn }
            : a,
        ),
        codesFetchedAt: Date.now(),
      }));
    } catch {
      /* silent — countdown keeps running */
    }
  },

  addAccount: async (parsed, extra) => {
    const account = await api.addAccount({
      name: parsed.name,
      steamId: parsed.steamId,
      shared_secret: parsed.shared_secret,
      identity_secret: parsed.identity_secret,
      account_name: parsed.account_name,
      ...extra,
    });
    await get().loadAccounts();
    get().pushToast(`Added ${account.name}`, "success");
    return account;
  },

  updateAccount: async (id, patch) => {
    const updated = await api.updateAccount(id, patch);
    set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...updated } : a)) }));
  },

  deleteAccount: async (id) => {
    await api.deleteAccount(id);
    set((s) => ({
      accounts: s.accounts.filter((a) => a.id !== id),
      confirmations: s.confirmations.filter((c) => c.accountId !== id),
    }));
    get().pushToast("Account removed", "info");
  },

  toggleFavorite: async (id) => {
    const acc = get().accounts.find((a) => a.id === id);
    if (!acc) return;
    await get().updateAccount(id, { favorite: !acc.favorite });
  },

  steamLogin: async (id, password) => {
    const updated = await api.steamLogin(id, password);
    set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...updated } : a)) }));
    get().pushToast("Signed in to Steam", "success");
  },

  qrApprove: async (id, url, confirm) => {
    const res = await api.qrApprove(id, url, confirm);
    get().pushToast(res.confirmed ? "QR login approved" : "QR login denied", res.confirmed ? "success" : "info");
  },

  reveal: async (id, password) => {
    const res = await api.reveal(id, password);
    return res.secrets;
  },

  loadConfirmations: async () => {
    set({ loadingConfirmations: true });
    try {
      const res = await api.allConfirmations();
      set({ confirmations: res.confirmations, confirmationErrors: res.errors });
    } catch (e) {
      get().pushToast((e as Error).message, "error");
    } finally {
      set({ loadingConfirmations: false });
    }
  },

  actConfirmation: async (accountId, id, action) => {
    // Optimistic removal.
    const prev = get().confirmations;
    set({ confirmations: prev.filter((c) => c.id !== id) });
    try {
      await api.actConfirmation(accountId, id, action);
      get().pushToast(action === "allow" ? "Approved" : "Declined", action === "allow" ? "success" : "info");
    } catch (e) {
      set({ confirmations: prev });
      get().pushToast((e as Error).message, "error");
    }
  },

  acceptAll: async (accountId, type) => {
    const prev = get().confirmations;
    set({
      confirmations: prev.filter(
        (c) => c.accountId !== accountId || (type && c.type !== type),
      ),
    });
    try {
      const res = await api.acceptAll(accountId, type);
      get().pushToast(`Approved ${res.accepted} confirmation${res.accepted !== 1 ? "s" : ""}`, "success");
    } catch (e) {
      set({ confirmations: prev });
      get().pushToast((e as Error).message, "error");
    }
  },

  pushToast: (message, kind = "info") => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
    setTimeout(() => get().dismissToast(id), 3400);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  reset: () => set({ accounts: [], confirmations: [], confirmationErrors: [], toasts: [] }),
}));
