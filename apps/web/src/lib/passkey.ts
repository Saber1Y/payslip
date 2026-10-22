import { base64UrlDecode, base64UrlEncode, challengeFor, ES256, type Assertion, type PublicKeyRef } from "@payslip/core";
import type { Hex } from "viem";

/**
 * Browser passkeys. Registration keeps only the public key (attestation "none": we do not need to know
 * the device maker). Signing uses a record or decision hash as the WebAuthn challenge, so the signature
 * covers exactly the content the person reviewed on screen.
 */

export class PasskeyError extends Error {}

export function passkeysSupported(): boolean {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential === "function" && typeof navigator.credentials?.create === "function";
}

function explain(error: unknown): PasskeyError {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") return new PasskeyError("The passkey request was cancelled or timed out. Try again.");
    if (error.name === "InvalidStateError") return new PasskeyError("This device already has a passkey for this record.");
    if (error.name === "SecurityError") return new PasskeyError("Passkeys are blocked on this address. Open Payslip from its normal web address.");
  }
  return new PasskeyError(error instanceof Error ? error.message : "The passkey request failed.");
}

export async function createPasskey(rpId: string, userLabel: string): Promise<PublicKeyRef> {
  if (!passkeysSupported()) throw new PasskeyError("This browser does not support passkeys.");
  let credential: Credential | null;
  try {
    credential = await navigator.credentials.create({
      publicKey: {
        rp: { id: rpId, name: "Payslip" },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: userLabel, displayName: userLabel },
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        pubKeyCredParams: [{ type: "public-key", alg: ES256 }],
        authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
        attestation: "none",
        timeout: 120_000,
      },
    });
  } catch (error) {
    throw explain(error);
  }
  if (!(credential instanceof PublicKeyCredential)) throw new PasskeyError("No passkey was created.");
  const response = credential.response as AuthenticatorAttestationResponse;
  if (response.getPublicKeyAlgorithm() !== ES256) throw new PasskeyError("This device created an unsupported key type.");
  const spki = response.getPublicKey();
  if (!spki) throw new PasskeyError("This browser did not return the passkey's public key.");
  return { credentialId: base64UrlEncode(new Uint8Array(credential.rawId)), publicKey: base64UrlEncode(new Uint8Array(spki)), algorithm: ES256, authenticator: "passkey" };
}

export async function signWithPasskey(rpId: string, credentialId: string, hash: Hex): Promise<Assertion> {
  if (!passkeysSupported()) throw new PasskeyError("This browser does not support passkeys.");
  let credential: Credential | null;
  try {
    credential = await navigator.credentials.get({
      publicKey: {
        rpId,
        challenge: challengeFor(hash),
        allowCredentials: [{ type: "public-key", id: base64UrlDecode(credentialId) }],
        userVerification: "required",
        timeout: 120_000,
      },
    });
  } catch (error) {
    throw explain(error);
  }
  if (!(credential instanceof PublicKeyCredential)) throw new PasskeyError("Nothing was signed.");
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    credentialId: base64UrlEncode(new Uint8Array(credential.rawId)),
    authenticatorData: base64UrlEncode(new Uint8Array(response.authenticatorData)),
    clientDataJSON: base64UrlEncode(new Uint8Array(response.clientDataJSON)),
    signature: base64UrlEncode(new Uint8Array(response.signature)),
  };
}
