import "server-only";
import { isPayslipError, type PayslipErrorCode } from "@payslip/core";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

const STATUS: Record<PayslipErrorCode, number> = {
  NOT_CANONICAL: 400,
  INVALID_RECORD: 400,
  INVALID_PERIOD: 400,
  INVALID_DATE: 400,
  INVALID_SIGNATURE: 400,
  INVALID_PACKET: 400,
  INTEGRITY_ERROR: 500,
};

export function json(body: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(body, { ...init, headers: { "cache-control": "no-store", ...init?.headers } });
}

export interface ApiErrorBody {
  error: { code: string; message: string; field?: string };
}

export function errorResponse(code: string, message: string, status: number, field?: string): NextResponse {
  return json({ error: { code, message, ...(field && { field }) } } satisfies ApiErrorBody, { status });
}

/** Maps domain and validation errors to HTTP. Unexpected errors are logged and returned without internals. */
export function handleError(error: unknown): NextResponse {
  if (isPayslipError(error)) return errorResponse(error.code, error.message, STATUS[error.code], error.field);
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    return errorResponse("INVALID_INPUT", issue ? `${issue.path.join(".") || "input"}: ${issue.message}` : "Invalid input", 400, issue?.path.join("."));
  }
  console.error("[payslip] unexpected error", error);
  return errorResponse("INTERNAL", "Unexpected server error", 500);
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/** Short, user-facing reason for a failed chain call. Full details go to the server log. */
export function anchorErrorMessage(error: unknown): string {
  console.error("[payslip] anchoring failed", error);
  const message = error instanceof Error ? error.message : String(error);
  if (/ECONNREFUSED|fetch failed|HTTP request failed/i.test(message)) return "The chain RPC is unreachable";
  if (/insufficient funds/i.test(message)) return "The relayer is out of gas funds";
  return "The anchor transaction failed";
}
