// Client side of the RSA-wrapped encrypted channel (see server/server_crypto.py).
// For each request we generate a fresh AES-256-GCM session key, RSA-OAEP-wrap it
// under the server's public key, encrypt the request body, and decrypt the
// response — all with the Web Crypto API.

let publicKeyPromise: Promise<CryptoKey> | null = null;

function b64encode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64decode(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function pemToDer(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, "")
    .replace(/-----END PUBLIC KEY-----/, "")
    .replace(/\s+/g, "");
  return b64decode(body);
}

async function getPublicKey(): Promise<CryptoKey> {
  if (!publicKeyPromise) {
    publicKeyPromise = (async () => {
      const res = await fetch("/api/crypto/pubkey");
      if (!res.ok) throw new Error("Could not establish secure channel");
      const { pubkey } = await res.json();
      return crypto.subtle.importKey(
        "spki",
        pemToDer(pubkey) as BufferSource,
        { name: "RSA-OAEP", hash: "SHA-256" },
        false,
        ["encrypt"],
      );
    })().catch((e) => {
      publicKeyPromise = null; // allow retry
      throw e;
    });
  }
  return publicKeyPromise;
}

export interface SealedRequest {
  sessionKeyHeader: string;
  body?: string;
  encrypted: boolean;
  aesKey: CryptoKey;
}

/** Create a per-request session, wrapping its key for the server. */
export async function sealRequest(plaintextBody?: string): Promise<SealedRequest> {
  const pub = await getPublicKey();
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const aesKey = await crypto.subtle.importKey("raw", rawKey as BufferSource, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
  const wrapped = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pub, rawKey as BufferSource);
  const sealed: SealedRequest = {
    sessionKeyHeader: b64encode(wrapped),
    encrypted: false,
    aesKey,
  };
  if (plaintextBody !== undefined) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      aesKey,
      new TextEncoder().encode(plaintextBody) as BufferSource,
    );
    sealed.body = JSON.stringify({ iv: b64encode(iv), ct: b64encode(ct) });
    sealed.encrypted = true;
  }
  return sealed;
}

/** Decrypt a `{iv,ct}` response payload with the request's session key. */
export async function openResponse(aesKey: CryptoKey, payload: { iv: string; ct: string }): Promise<string> {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64decode(payload.iv) as BufferSource },
    aesKey,
    b64decode(payload.ct) as BufferSource,
  );
  return new TextDecoder().decode(plain);
}
