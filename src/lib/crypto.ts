// Local-at-rest encryption for account secrets, using a master password.
// PBKDF2 (SHA-256, 250k iterations) -> AES-GCM. All in-browser; the password
// and derived key never leave the device.

const PBKDF2_ITERATIONS = 250_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password) as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export interface EncryptedBlob {
  v: 1;
  salt: string;
  iv: string;
  data: string;
}

export async function encryptJSON(value: unknown, password: string): Promise<EncryptedBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const plaintext = enc.encode(JSON.stringify(value));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    plaintext as BufferSource,
  );
  return {
    v: 1,
    salt: toB64(salt),
    iv: toB64(iv),
    data: toB64(new Uint8Array(cipher)),
  };
}

export async function decryptJSON<T>(blob: EncryptedBlob, password: string): Promise<T> {
  const key = await deriveKey(password, fromB64(blob.salt));
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(blob.iv) as BufferSource },
    key,
    fromB64(blob.data) as BufferSource,
  );
  return JSON.parse(dec.decode(plain)) as T;
}

export function isEncryptedBlob(value: unknown): value is EncryptedBlob {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as EncryptedBlob).v === 1 &&
    typeof (value as EncryptedBlob).data === "string"
  );
}
