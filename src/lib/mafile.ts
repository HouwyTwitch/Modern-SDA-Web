// Parse Steam `.maFile` (JSON) locally into the fields the backend needs.
import type { ParsedMaFile } from "../types";

interface RawMaFile {
  shared_secret?: string;
  identity_secret?: string;
  account_name?: string;
  Session?: { SteamID?: number | string; SteamId?: number | string; steamid?: number | string };
  steamid?: number | string;
  steamId?: number | string;
}

const AVATAR_COLORS = ["#1a9fff", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#ec4899", "#14b8a6", "#6366f1"];

export function pickAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function isValidSecret(secret?: string): boolean {
  if (!secret) return false;
  try {
    return atob(secret.trim()).length >= 16;
  } catch {
    return false;
  }
}

function extractSteamId(ma: RawMaFile): string {
  const candidates = [
    ma.Session?.SteamID,
    ma.Session?.SteamId,
    ma.Session?.steamid,
    ma.steamid,
    ma.steamId,
  ];
  for (const c of candidates) if (c !== undefined && c !== null && `${c}` !== "0") return `${c}`;
  return "";
}

export interface ParseResult {
  parsed?: ParsedMaFile;
  error?: string;
}

export function parseMaFile(text: string, fallbackName?: string): ParseResult {
  let ma: RawMaFile;
  try {
    ma = JSON.parse(text);
  } catch {
    return { error: "File is not valid JSON." };
  }
  if (!isValidSecret(ma.shared_secret)) return { error: "Missing or invalid shared_secret." };

  const steamId = extractSteamId(ma);
  const name = ma.account_name || fallbackName || (steamId ? `Account ${steamId.slice(-4)}` : "New Account");

  return {
    parsed: {
      name,
      steamId,
      shared_secret: ma.shared_secret!.trim(),
      identity_secret: ma.identity_secret?.trim(),
      account_name: ma.account_name,
    },
  };
}

export { isValidSecret };
