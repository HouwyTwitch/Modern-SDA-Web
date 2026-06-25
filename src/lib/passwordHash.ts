// Client-side password hashing: the plaintext password never leaves the browser.
// We derive a stable hash from (password, email) with PBKDF2-SHA256 and send that
// hash to the server, which treats it as the password for auth + key derivation.

const ITERATIONS = 150_000;

export async function hashPassword(email: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = enc.encode("msda$" + email.trim().toLowerCase());
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password) as BufferSource,
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    baseKey,
    256,
  );
  const bytes = new Uint8Array(bits);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}
