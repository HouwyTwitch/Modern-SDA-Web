// Typed client for the optional Python backend (see /server). Used for live
// Steam confirmation syncing, which the browser can't do directly due to CORS.
// Code generation does not need this — it runs client-side via steamGuard.ts.
import type { Confirmation } from "../types";

/** Steam session credentials, obtained from a completed Steam login. */
export interface SteamSession {
  steamid: string;
  identity_secret: string;
  /** Value of the `steamLoginSecure` cookie. */
  steam_login_secure: string;
  session_id?: string;
  device_id?: string;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/** Returns true if the backend is reachable. */
export async function backendAvailable(): Promise<boolean> {
  try {
    const res = await fetch("/api/health");
    return res.ok;
  } catch {
    return false;
  }
}

/** Fetch live pending confirmations for an account. */
export async function fetchConfirmations(
  session: SteamSession,
  accountId: string,
): Promise<Confirmation[]> {
  const data = await post<{ confirmations: Omit<Confirmation, "accountId">[] }>(
    "/confirmations/list",
    session,
  );
  return data.confirmations.map((c) => ({ ...c, accountId }));
}

/** Approve or decline a single confirmation. */
export async function actOnConfirmation(
  session: SteamSession,
  confirmationId: string,
  nonce: string,
  action: "allow" | "cancel",
): Promise<boolean> {
  const data = await post<{ success: boolean }>("/confirmations/act", {
    session,
    confirmation_id: confirmationId,
    nonce,
    action,
  });
  return data.success;
}
