// Authenticated client for the Modern SDA Web backend.
import type { Account, AuthUser, Confirmation } from "../types";

const TOKEN_KEY = "msda.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      (data && (data.detail || data.message)) || `Request failed (${res.status})`,
      res.status,
    );
  }
  return data as T;
}

// ---- auth ----
interface AuthResponse {
  token: string;
  email: string;
  user_id: string;
}

export const api = {
  health: () => request<{ status: string }>("GET", "/health"),

  register: (email: string, password: string) =>
    request<AuthResponse>("POST", "/auth/register", { email, password }),
  login: (email: string, password: string) =>
    request<AuthResponse>("POST", "/auth/login", { email, password }),
  me: () => request<AuthUser & { unlocked: boolean }>("GET", "/auth/me"),
  logout: () => request<{ ok: boolean }>("POST", "/auth/logout"),

  // ---- accounts ----
  listAccounts: () => request<Account[]>("GET", "/accounts"),
  listCodes: () => request<{ id: string; code: string; codeExpiresIn: number }[]>("GET", "/accounts/codes"),
  addAccount: (payload: Record<string, unknown>) => request<Account>("POST", "/accounts", payload),
  updateAccount: (id: string, patch: Record<string, unknown>) =>
    request<Account>("PATCH", `/accounts/${id}`, patch),
  deleteAccount: (id: string) => request<{ ok: boolean }>("DELETE", `/accounts/${id}`),
  reveal: (id: string, password: string) =>
    request<{ secrets: Record<string, string> }>("POST", `/accounts/${id}/reveal`, { password }),

  // ---- steam session ----
  steamLogin: (id: string, password?: string) =>
    request<Account>("POST", `/accounts/${id}/steam-login`, { password }),

  // ---- confirmations ----
  accountConfirmations: (id: string) =>
    request<{ confirmations: Confirmation[] }>("GET", `/accounts/${id}/confirmations`),
  allConfirmations: () =>
    request<{ confirmations: Confirmation[]; errors: { accountId: string; error: string }[] }>(
      "GET",
      "/confirmations",
    ),
  actConfirmation: (accountId: string, confirmationId: string, action: "allow" | "cancel") =>
    request<{ success: boolean }>(
      "POST",
      `/accounts/${accountId}/confirmations/${confirmationId}`,
      { action },
    ),
  acceptAll: (accountId: string, type?: string) =>
    request<{ accepted: number }>(
      "POST",
      `/accounts/${accountId}/confirmations-accept-all${type ? `?type_filter=${type}` : ""}`,
    ),

  // ---- qr ----
  qrApprove: (accountId: string, challengeUrl: string, confirm: boolean) =>
    request<{ success: boolean; confirmed: boolean }>(
      "POST",
      `/accounts/${accountId}/qr-approve`,
      { challenge_url: challengeUrl, confirm },
    ),
};
