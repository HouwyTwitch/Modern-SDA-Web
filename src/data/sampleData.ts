// Demo data shown on first run so the app feels alive. The shared secrets below
// are valid base64 and produce real (but meaningless) Steam Guard codes that
// rotate every 30s — handy for demonstrating the UI. Replace by importing your
// own .maFile. Cleared automatically once you add a real account.
import type { Account, Confirmation } from "../types";
import { pickAvatarColor } from "../lib/mafile";

const now = Date.now();

function demoSecret(seed: string): string {
  // Deterministic 20-byte base64 string from a seed — valid for HMAC-SHA1.
  const bytes = new Uint8Array(20);
  let h = 2166136261;
  for (let i = 0; i < 20; i++) {
    h ^= seed.charCodeAt(i % seed.length);
    h = Math.imul(h, 16777619);
    bytes[i] = h & 0xff;
  }
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export const SAMPLE_ACCOUNTS: Account[] = [
  {
    id: "demo-1",
    name: "JohnTrader",
    steamId: "76561198012345678",
    sharedSecret: demoSecret("johntrader"),
    identitySecret: demoSecret("johntrader-id"),
    avatarColor: pickAvatarColor("JohnTrader"),
    proxy: "Germany Proxy",
    status: "online",
    favorite: true,
    lastConfirmation: now - 2 * 60 * 1000,
    lastLogin: now - 60 * 60 * 1000,
    createdAt: now - 30 * 24 * 60 * 60 * 1000,
  },
  {
    id: "demo-2",
    name: "MarketBot01",
    steamId: "76561198087654321",
    sharedSecret: demoSecret("marketbot"),
    identitySecret: demoSecret("marketbot-id"),
    avatarColor: pickAvatarColor("MarketBot01x"),
    proxy: "Netherlands Proxy",
    status: "online",
    lastConfirmation: now - 8 * 60 * 1000,
    createdAt: now - 20 * 24 * 60 * 60 * 1000,
  },
  {
    id: "demo-3",
    name: "InventoryMax",
    steamId: "76561198011223344",
    sharedSecret: demoSecret("inventorymax"),
    avatarColor: pickAvatarColor("InventoryMaxz"),
    proxy: "US East Proxy",
    status: "expiring",
    createdAt: now - 12 * 24 * 60 * 60 * 1000,
  },
  {
    id: "demo-4",
    name: "OldAccount",
    steamId: "76561198055667788",
    sharedSecret: demoSecret("oldaccount"),
    avatarColor: pickAvatarColor("OldAccountq"),
    status: "needs_login",
    createdAt: now - 200 * 24 * 60 * 60 * 1000,
  },
  {
    id: "demo-5",
    name: "SteamBackup",
    steamId: "76561198099887766",
    sharedSecret: demoSecret("steambackup"),
    identitySecret: demoSecret("steambackup-id"),
    avatarColor: pickAvatarColor("SteamBackupp"),
    proxy: "France Proxy",
    status: "online",
    createdAt: now - 5 * 24 * 60 * 60 * 1000,
  },
];

export const SAMPLE_CONFIRMATIONS: Confirmation[] = [
  {
    id: "c1",
    accountId: "demo-1",
    type: "trade",
    title: "Trade Offer",
    subtitle: "Trader123",
    amount: "$1,245.50",
    createdAt: now - 2 * 60 * 1000,
  },
  {
    id: "c2",
    accountId: "demo-1",
    type: "market",
    title: "Market Listing",
    subtitle: "AK-47 | Redline (FT)",
    amount: "$15.22",
    createdAt: now - 5 * 60 * 1000,
  },
  {
    id: "c3",
    accountId: "demo-1",
    type: "trade",
    title: "Trade Offer",
    subtitle: "SkinKing",
    amount: "$89.00",
    createdAt: now - 14 * 60 * 1000,
  },
  {
    id: "c4",
    accountId: "demo-2",
    type: "trade",
    title: "Trade Offer",
    subtitle: "CS.Dealer",
    amount: "$320.00",
    createdAt: now - 8 * 60 * 1000,
  },
  {
    id: "c5",
    accountId: "demo-2",
    type: "market",
    title: "Market Listing",
    subtitle: "AWP | Asiimov (BS)",
    amount: "$42.18",
    createdAt: now - 12 * 60 * 1000,
  },
];
