// Real Steam Guard code + confirmation-key generation, implemented purely in the
// browser with the Web Crypto API (HMAC-SHA1). No secrets ever leave the device
// for code generation.

const STEAM_CODE_ALPHABET = "23456789BCDFGHJKMNPQRTVWXY";
export const CODE_PERIOD = 30; // seconds

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.trim();
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function hmacSha1(keyBytes: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes as BufferSource,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, message as BufferSource);
  return new Uint8Array(sig);
}

/** 8-byte big-endian representation of a number. */
function int64ToBytes(value: number): Uint8Array {
  const buf = new Uint8Array(8);
  let v = Math.floor(value);
  for (let i = 7; i >= 0; i--) {
    buf[i] = v & 0xff;
    v = Math.floor(v / 256);
  }
  return buf;
}

/**
 * Generate a 5-character Steam Guard code for the given shared secret.
 * @param sharedSecret base64-encoded shared secret from the maFile
 * @param epochSeconds unix time in seconds (defaults to local clock)
 */
export async function generateSteamGuardCode(
  sharedSecret: string,
  epochSeconds: number = Date.now() / 1000,
): Promise<string> {
  const key = base64ToBytes(sharedSecret);
  const counter = Math.floor(epochSeconds / CODE_PERIOD);
  const mac = await hmacSha1(key, int64ToBytes(counter));

  const start = mac[19] & 0x0f;
  let codePoint =
    ((mac[start] & 0x7f) << 24) |
    ((mac[start + 1] & 0xff) << 16) |
    ((mac[start + 2] & 0xff) << 8) |
    (mac[start + 3] & 0xff);

  let code = "";
  for (let i = 0; i < 5; i++) {
    code += STEAM_CODE_ALPHABET[codePoint % STEAM_CODE_ALPHABET.length];
    codePoint = Math.floor(codePoint / STEAM_CODE_ALPHABET.length);
  }
  return code;
}

/** Seconds remaining in the current 30s code window. */
export function secondsRemaining(epochSeconds: number = Date.now() / 1000): number {
  return CODE_PERIOD - (Math.floor(epochSeconds) % CODE_PERIOD);
}

/**
 * Generate a confirmation key used to sign Steam mobile confirmation requests.
 * @param identitySecret base64 identity secret from the maFile
 * @param epochSeconds current unix time in seconds
 * @param tag e.g. "conf", "details", "allow", "cancel"
 */
export async function generateConfirmationKey(
  identitySecret: string,
  epochSeconds: number,
  tag: string,
): Promise<string> {
  const tagBytes = new TextEncoder().encode(tag);
  const message = new Uint8Array(8 + tagBytes.length);
  message.set(int64ToBytes(epochSeconds), 0);
  message.set(tagBytes, 8);
  const mac = await hmacSha1(base64ToBytes(identitySecret), message);
  return bytesToBase64(mac);
}

/** Validate that a string is a usable base64 shared secret. */
export function isValidSharedSecret(secret: string): boolean {
  try {
    return base64ToBytes(secret).length >= 16;
  } catch {
    return false;
  }
}
