import { bytesToHex, hexToBytes, keccak256, type Hex } from "viem";
import { z } from "zod";

/**
 * Passkey signatures without a WebAuthn library. A WebAuthn assertion is an ECDSA P-256 signature over
 * `authenticatorData || SHA-256(clientDataJSON)`, and clientDataJSON carries the challenge we chose.
 * Payslip always uses a record or decision hash as the challenge, so a valid assertion proves the key
 * holder approved exactly that hash. Everything here runs on WebCrypto, in browsers and in Node.
 */

/** COSE algorithm -7: ECDSA with SHA-256 on P-256. The only algorithm Payslip registers. */
export const ES256 = -7;

const b64url = z.string().regex(/^[A-Za-z0-9_-]+$/, "base64url");

export const publicKeyRefSchema = z.object({
  credentialId: b64url,
  /** SubjectPublicKeyInfo DER, base64url. Browsers expose it as `AuthenticatorAttestationResponse.getPublicKey()`. */
  publicKey: b64url,
  algorithm: z.literal(ES256),
  /** "software-demo" keys are generated in code for seeded data. They are labelled everywhere they appear. */
  authenticator: z.enum(["passkey", "software-demo"]),
});
export type PublicKeyRef = z.infer<typeof publicKeyRefSchema>;

export const assertionSchema = z.object({
  credentialId: b64url,
  authenticatorData: b64url,
  clientDataJSON: b64url,
  /** DER-encoded ECDSA signature, as WebAuthn returns it. */
  signature: b64url,
});
export type Assertion = z.infer<typeof assertionSchema>;

export const relyingPartySchema = z.object({
  id: z.string().min(1),
  origin: z.string().url(),
});
export type RelyingParty = z.infer<typeof relyingPartySchema>;

export type SignatureCheck = { ok: true } | { ok: false; reason: string };

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** The WebAuthn challenge for a 32-byte hash: the raw bytes, base64url-encoded by the browser. */
export function challengeFor(hash: Hex): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(hexToBytes(hash));
}

/** keccak256 of the SPKI bytes. This is what the registry stores to bind a key to an employment. */
export function keyHash(key: Pick<PublicKeyRef, "publicKey">): Hex {
  return keccak256(base64UrlDecode(key.publicKey));
}

async function sha256(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** DER `SEQUENCE { INTEGER r, INTEGER s }` to the 64-byte `r || s` form WebCrypto verifies. */
export function derToRawSignature(der: Uint8Array): Uint8Array<ArrayBuffer> | null {
  // P-256 signatures are at most 72 bytes, so the sequence length is always the short form.
  if (der[0] !== 0x30 || der[1] !== der.length - 2) return null;
  let offset = 2;
  const out = new Uint8Array(64);
  for (const slot of [0, 32]) {
    if (der[offset] !== 0x02) return null;
    const length = der[offset + 1];
    if (length === undefined || length === 0 || length > 33) return null;
    let int = der.subarray(offset + 2, offset + 2 + length);
    if (int.length !== length) return null;
    while (int.length > 32 && int[0] === 0) int = int.subarray(1);
    if (int.length > 32) return null;
    out.set(int, slot + 32 - int.length);
    offset += 2 + length;
  }
  return offset === der.length ? out : null;
}

/** The inverse of `derToRawSignature`, used by the software authenticator to match browser output. */
export function rawToDerSignature(raw: Uint8Array): Uint8Array<ArrayBuffer> {
  const encodeInt = (bytes: Uint8Array) => {
    let i = 0;
    while (i < bytes.length - 1 && bytes[i] === 0) i++;
    const trimmed = bytes.subarray(i);
    const needsPad = (trimmed[0] ?? 0) & 0x80;
    return Uint8Array.from([0x02, trimmed.length + (needsPad ? 1 : 0), ...(needsPad ? [0] : []), ...trimmed]);
  };
  const r = encodeInt(raw.subarray(0, 32));
  const s = encodeInt(raw.subarray(32, 64));
  return Uint8Array.from([0x30, r.length + s.length, ...r, ...s]);
}

/**
 * Verifies that `assertion` is `key`'s signature over `challenge` for relying party `rp`. Checks, in order:
 * credential id, clientData type, challenge, origin, rpId hash, user-presence flag, then the signature.
 */
export async function verifyAssertion(assertion: Assertion, challenge: Hex, key: PublicKeyRef, rp: RelyingParty): Promise<SignatureCheck> {
  if (assertion.credentialId !== key.credentialId) return { ok: false, reason: "Signed with a different key than the one registered" };

  let clientData: { type?: unknown; challenge?: unknown; origin?: unknown };
  const clientDataBytes = base64UrlDecode(assertion.clientDataJSON);
  try {
    clientData = JSON.parse(new TextDecoder().decode(clientDataBytes)) as typeof clientData;
  } catch {
    return { ok: false, reason: "clientDataJSON is not valid JSON" };
  }
  if (clientData.type !== "webauthn.get") return { ok: false, reason: "Not a WebAuthn signing ceremony" };
  if (clientData.challenge !== base64UrlEncode(challengeFor(challenge))) return { ok: false, reason: "Signature is for a different record" };
  if (clientData.origin !== rp.origin) return { ok: false, reason: `Signed on ${String(clientData.origin)}, expected ${rp.origin}` };

  const authData = base64UrlDecode(assertion.authenticatorData);
  if (authData.length < 37) return { ok: false, reason: "authenticatorData is too short" };
  const rpIdHash = await sha256(new TextEncoder().encode(rp.id));
  if (!equalBytes(authData.subarray(0, 32), rpIdHash)) return { ok: false, reason: "Signed for a different site" };
  if (((authData[32] ?? 0) & 0x01) === 0) return { ok: false, reason: "User presence was not confirmed" };

  const raw = derToRawSignature(base64UrlDecode(assertion.signature));
  if (!raw) return { ok: false, reason: "Signature is not valid DER" };

  let cryptoKey: CryptoKey;
  try {
    cryptoKey = await crypto.subtle.importKey("spki", base64UrlDecode(key.publicKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  } catch {
    return { ok: false, reason: "Registered public key is not a P-256 key" };
  }
  const signed = concat(authData, await sha256(clientDataBytes));
  const valid = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, cryptoKey, raw, signed);
  return valid ? { ok: true } : { ok: false, reason: "Signature does not match" };
}

/**
 * A P-256 key held in memory that produces assertions in exactly the browser's format. Used for seeded
 * demo data and tests; keys it creates are marked `authenticator: "software-demo"`.
 */
export interface SoftwareAuthenticator {
  key: PublicKeyRef;
  sign(challenge: Hex, rp: RelyingParty): Promise<Assertion>;
}

export async function createSoftwareAuthenticator(): Promise<SoftwareAuthenticator> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey));
  const credentialId = base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));
  const key: PublicKeyRef = { credentialId, publicKey: base64UrlEncode(spki), algorithm: ES256, authenticator: "software-demo" };

  return {
    key,
    async sign(challenge, rp) {
      const clientDataJSON = new TextEncoder().encode(
        JSON.stringify({ type: "webauthn.get", challenge: base64UrlEncode(challengeFor(challenge)), origin: rp.origin, crossOrigin: false }),
      );
      // rpIdHash, flags (user present + user verified), signature counter 0.
      const authData = concat(await sha256(new TextEncoder().encode(rp.id)), Uint8Array.from([0x05, 0, 0, 0, 0]));
      const raw = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, concat(authData, await sha256(clientDataJSON))));
      return {
        credentialId,
        authenticatorData: base64UrlEncode(authData),
        clientDataJSON: base64UrlEncode(clientDataJSON),
        signature: base64UrlEncode(rawToDerSignature(raw)),
      };
    },
  };
}

export function randomSalt(): Hex {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}
