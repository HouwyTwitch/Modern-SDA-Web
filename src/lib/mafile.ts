// Parse Steam `.maFile` (JSON) into an Account.
import type { Account, MaFile } from "../types";
import { isValidSharedSecret } from "./steamGuard";

const AVATAR_COLORS = [
  "#1a9fff",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#6366f1",
];

export function pickAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function extractSteamId(ma: MaFile): string {
  const candidates = [
    ma.Session?.SteamID,
    ma.Session?.SteamId,
    ma.Session?.steamid,
    ma.steamid,
    ma.steamId,
  ];
  for (const c of candidates) {
    if (c !== undefined && c !== null && `${c}` !== "0") return `${c}`;
  }
  return "";
}

export interface ParseResult {
  account?: Account;
  error?: string;
}

export function parseMaFile(text: string, fallbackName?: string): ParseResult {
  let ma: MaFile;
  try {
    ma = JSON.parse(text) as MaFile;
  } catch {
    return { error: "File is not valid JSON." };
  }

  if (!ma.shared_secret || !isValidSharedSecret(ma.shared_secret)) {
    return { error: "Missing or invalid shared_secret." };
  }

  const steamId = extractSteamId(ma);
  const name = ma.account_name || fallbackName || (steamId ? `Account ${steamId.slice(-4)}` : "New Account");

  const account: Account = {
    id: crypto.randomUUID(),
    name,
    steamId,
    sharedSecret: ma.shared_secret.trim(),
    identitySecret: ma.identity_secret?.trim(),
    deviceId: ma.device_id,
    avatarColor: pickAvatarColor(name + steamId),
    status: ma.identity_secret ? "online" : "needs_login",
    createdAt: Date.now(),
  };

  return { account };
}
