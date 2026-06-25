// Shared domain types for Modern SDA Web.

/** The subset of a Steam `.maFile` we care about. */
export interface MaFile {
  shared_secret: string;
  identity_secret?: string;
  account_name?: string;
  Session?: {
    SteamID?: number | string;
    SteamId?: number | string;
    steamid?: number | string;
  };
  device_id?: string;
  // Steam stores the id under a couple of different keys depending on tooling.
  steamid?: number | string;
  steamId?: number | string;
}

export type AccountStatus = "online" | "expiring" | "needs_login" | "offline";

export interface Account {
  id: string;
  name: string;
  steamId: string;
  /** base64 shared secret used to generate Steam Guard codes. */
  sharedSecret: string;
  /** base64 identity secret used to sign confirmations (optional). */
  identitySecret?: string;
  deviceId?: string;
  avatarColor: string;
  proxy?: string;
  status: AccountStatus;
  favorite?: boolean;
  lastConfirmation?: number;
  lastLogin?: number;
  createdAt: number;
}

export type ConfirmationType = "trade" | "market" | "other";

export interface Confirmation {
  id: string;
  accountId: string;
  type: ConfirmationType;
  title: string;
  /** Counterparty / sub-line, e.g. "Trader123" or item name. */
  subtitle: string;
  amount?: string;
  createdAt: number;
  /** Steam confirmation identifiers, present for real (server-fetched) items. */
  nonce?: string;
  key?: string;
  iconUrls?: string[];
}

export type ThemeMode = "dark" | "light" | "contrast" | "system";

export interface AccentColor {
  id: string;
  label: string;
  rgb: string; // "26 159 255"
}

export interface Settings {
  theme: ThemeMode;
  accent: string; // accent id
  language: string;
  autoLockMinutes: number; // 0 = never
  encryptionEnabled: boolean;
  biometrics: boolean;
  autoConfirmTrades: boolean;
  autoConfirmMarket: boolean;
  density: "comfortable" | "compact";
}
