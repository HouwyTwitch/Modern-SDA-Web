import { create } from "zustand";
import { api, getToken, setToken } from "../lib/api";
import type { AuthUser } from "../types";

type AuthStatus = "loading" | "authed" | "guest";

interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  status: "loading",

  init: async () => {
    if (!getToken()) {
      set({ status: "guest" });
      return;
    }
    try {
      const me = await api.me();
      set({ user: { email: me.email, user_id: me.user_id }, status: "authed" });
    } catch {
      setToken(null);
      set({ status: "guest", user: null });
    }
  },

  login: async (email, password) => {
    const res = await api.login(email, password);
    setToken(res.token);
    set({ user: { email: res.email, user_id: res.user_id }, status: "authed" });
  },

  register: async (email, password) => {
    const res = await api.register(email, password);
    setToken(res.token);
    set({ user: { email: res.email, user_id: res.user_id }, status: "authed" });
  },

  logout: async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    setToken(null);
    set({ user: null, status: "guest" });
  },
}));
