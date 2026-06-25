// Shared domain types for Modern SDA Web (multi-user, backend-driven).

export type AccountStatus = "online" | "expiring" | "needs_login" | "offline";

export interface Account {
  id: string;
  name: string;
  steamId: string;
  avatarColor: string;
  proxy: string | null;
  status: AccountStatus;
  favorite: boolean;
  hasIdentity: boolean;
  hasSession: boolean;
  lastConfirmation: number | null;
  lastLogin: number | null;
  createdAt: number;
  // present on /api/accounts (server-generated)
  code?: string;
  codeExpiresIn?: number;
}

export type ConfirmationType = "trade" | "market" | "other";

export interface Confirmation {
  id: string;
  accountId: string;
  type: ConfirmationType;
  title: string;
  subtitle: string;
  amount?: string | null;
  createdAt: number;
  nonce?: string;
  iconUrls?: string[];
}

export interface AuthUser {
  email: string;
  user_id: string;
}

export type ThemeMode = "dark" | "light" | "contrast" | "system";

export interface AccentColor {
  id: string;
  label: string;
  rgb: string;
}

export interface Settings {
  theme: ThemeMode;
  accent: string;
  density: "comfortable" | "compact";
}

/** Parsed locally from a .maFile before being sent to the backend. */
export interface ParsedMaFile {
  name?: string;
  steamId: string;
  shared_secret: string;
  identity_secret?: string;
  account_name?: string;
}
