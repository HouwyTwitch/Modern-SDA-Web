// Authenticated client for the Modern SDA Web backend.
// All requests go through an RSA-wrapped AES-GCM encrypted channel (secureChannel).
import type { Account, AuthUser, Confirmation } from "../types";
import { openResponse, sealRequest } from "./secureChannel";

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

  const sealed = await sealRequest(body !== undefined ? JSON.stringify(body) : undefined);
  headers["X-Session-Key"] = sealed.sessionKeyHeader;
  if (sealed.encrypted) {
    headers["X-Enc"] = "1";
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`/api${path}`, { method, headers, body: sealed.body });

  if (res.status === 204) return undefined as T;

  let data: { detail?: string; message?: string } & Record<string, unknown> = {};
  const text = await res.text();
  if (text) {
    const parsed = JSON.parse(text);
    if (res.headers.get("x-enc") === "1") {
      data = JSON.parse(await openResponse(sealed.aesKey, parsed as { iv: string; ct: string }));
    } else {
      data = parsed;
    }
  }

  if (!res.ok) {
    throw new ApiError((data.detail || data.message) || `Request failed (${res.status})`, res.status);
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
  refreshProfiles: () => request<Account[]>("POST", "/accounts/refresh-profiles"),
  addAccount: (payload: Record<string, unknown>) => request<Account>("POST", "/accounts", payload),
  updateAccount: (id: string, patch: Record<string, unknown>) =>
    request<Account>("PATCH", `/accounts/${id}`, patch),
  deleteAccount: (id: string) => request<{ ok: boolean }>("DELETE", `/accounts/${id}`),
  reveal: (id: string, password: string) =>
    request<{ secrets: Record<string, string> }>("POST", `/accounts/${id}/reveal`, { password }),

  // ---- steam session ----
  steamLogin: (id: string, password?: string, remember = false) =>
    request<Account>("POST", `/accounts/${id}/steam-login`, { password, remember }),

  // ---- confirmations ----
  accountConfirmations: (id: string) =>
    request<{ confirmations: Confirmation[] }>("GET", `/accounts/${id}/confirmations`),
  allConfirmations: () =>
    request<{ confirmations: Confirmation[]; errors: { accountId: string; error: string }[] }>(
      "GET",
      "/confirmations",
    ),
  actConfirmation: (
    accountId: string,
    confirmationId: string,
    action: "allow" | "cancel",
    nonce?: string,
  ) =>
    request<{ success: boolean }>(
      "POST",
      `/accounts/${accountId}/confirmations/${confirmationId}`,
      { action, nonce },
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

  // ---- enrollment (create a new authenticator) ----
  enrollLogin: (username: string, password: string) =>
    request<{ enrollId: string; step: "email_code" | "ready" }>("POST", "/enroll/login", {
      username,
      password,
    }),
  enrollConfirm: (enrollId: string, emailCode?: string) =>
    request<{ step: "sms"; accountName: string; revocationCode: string }>("POST", "/enroll/confirm", {
      enrollId,
      emailCode,
    }),
  enrollFinalize: (enrollId: string, smsCode: string) =>
    request<{ maFile: Record<string, unknown>; account: Account }>("POST", "/enroll/finalize", {
      enrollId,
      smsCode,
    }),
  enrollCancel: (enrollId: string) => request<{ ok: boolean }>("POST", "/enroll/cancel", { enrollId }),
};
