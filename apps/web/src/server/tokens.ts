import "server-only";
import { createHash, randomBytes } from "node:crypto";

/**
 * Access links are 256-bit random bearer secrets. They gate viewing only: every action that changes a
 * record also needs the party's passkey signature, so a leaked link cannot sign anything.
 */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
