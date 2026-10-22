import { describe, expect, it } from "vitest";
import { RP } from "./test-fixtures";
import { hexToBytes } from "viem";
import {
  base64UrlDecode,
  base64UrlEncode,
  createSoftwareAuthenticator,
  derToRawSignature,
  rawToDerSignature,
  verifyAssertion,
  type Assertion,
} from "./webauthn";

const HASH = `0x${"ab".repeat(32)}` as const;
const OTHER = `0x${"cd".repeat(32)}` as const;

function editClientData(assertion: Assertion, edit: (data: Record<string, unknown>) => void): Assertion {
  const data = JSON.parse(new TextDecoder().decode(base64UrlDecode(assertion.clientDataJSON))) as Record<string, unknown>;
  edit(data);
  return { ...assertion, clientDataJSON: base64UrlEncode(new TextEncoder().encode(JSON.stringify(data))) };
}

describe("passkey assertions", () => {
  it("accepts a signature over the expected hash", async () => {
    const auth = await createSoftwareAuthenticator();
    const assertion = await auth.sign(HASH, RP);
    expect(await verifyAssertion(assertion, HASH, auth.key, RP)).toEqual({ ok: true });
  });

  it("rejects a signature over a different hash", async () => {
    const auth = await createSoftwareAuthenticator();
    const assertion = await auth.sign(OTHER, RP);
    expect(await verifyAssertion(assertion, HASH, auth.key, RP)).toEqual({ ok: false, reason: "Signature is for a different record" });
  });

  it("rejects another key's signature even with the right credential id", async () => {
    const auth = await createSoftwareAuthenticator();
    const impostor = await createSoftwareAuthenticator();
    const assertion = { ...(await impostor.sign(HASH, RP)), credentialId: auth.key.credentialId };
    expect(await verifyAssertion(assertion, HASH, auth.key, RP)).toEqual({ ok: false, reason: "Signature does not match" });
  });

  it("rejects a swapped challenge, because the signature covers clientDataJSON", async () => {
    const auth = await createSoftwareAuthenticator();
    const forged = editClientData(await auth.sign(OTHER, RP), (d) => {
      d.challenge = base64UrlEncode(hexToBytes(HASH));
    });
    expect(await verifyAssertion(forged, HASH, auth.key, RP)).toEqual({ ok: false, reason: "Signature does not match" });
  });

  it("rejects signatures made on another origin or for another site", async () => {
    const auth = await createSoftwareAuthenticator();
    const elsewhere = await auth.sign(HASH, { id: "evil.example", origin: "https://evil.example" });
    expect((await verifyAssertion(elsewhere, HASH, auth.key, RP)).ok).toBe(false);
    const wrongRp = await auth.sign(HASH, { id: "evil.example", origin: RP.origin });
    expect(await verifyAssertion(wrongRp, HASH, auth.key, RP)).toEqual({ ok: false, reason: "Signed for a different site" });
  });

  it("rejects registration ceremonies and malformed client data", async () => {
    const auth = await createSoftwareAuthenticator();
    const created = editClientData(await auth.sign(HASH, RP), (d) => {
      d.type = "webauthn.create";
    });
    expect(await verifyAssertion(created, HASH, auth.key, RP)).toEqual({ ok: false, reason: "Not a WebAuthn signing ceremony" });
    const garbage = { ...(await auth.sign(HASH, RP)), clientDataJSON: base64UrlEncode(new TextEncoder().encode("{")) };
    expect((await verifyAssertion(garbage, HASH, auth.key, RP)).ok).toBe(false);
  });

  it("requires the user-presence flag", async () => {
    const auth = await createSoftwareAuthenticator();
    const assertion = await auth.sign(HASH, RP);
    const authData = base64UrlDecode(assertion.authenticatorData);
    authData[32] = 0;
    const noPresence = { ...assertion, authenticatorData: base64UrlEncode(authData) };
    expect(await verifyAssertion(noPresence, HASH, auth.key, RP)).toEqual({ ok: false, reason: "User presence was not confirmed" });
  });

  it("round-trips DER signatures, including high-bit and leading-zero integers", () => {
    const raw = new Uint8Array(64);
    raw.fill(0x80, 0, 32);
    raw[32] = 0;
    raw[33] = 0x01;
    const der = rawToDerSignature(raw);
    expect(derToRawSignature(der)).toEqual(raw);
    expect(derToRawSignature(der.subarray(0, der.length - 1))).toBeNull();
    expect(derToRawSignature(Uint8Array.from([0x31, 0]))).toBeNull();
  });
});
