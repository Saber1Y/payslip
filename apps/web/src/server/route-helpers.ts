import "server-only";
import type { NextResponse } from "next/server";
import { ConflictError, NotFoundError } from "./payslip";
import { errorResponse, handleError } from "./http";
import { TOKEN_RE } from "./tokens";

/** Validates the link token, runs the handler, and maps lookup and conflict errors to 404 and 409. */
export async function withToken(params: Promise<{ token: string }>, handler: (token: string) => Promise<NextResponse>): Promise<NextResponse> {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) return errorResponse("NOT_FOUND", "This link is not valid", 404);
  try {
    return await handler(token);
  } catch (error) {
    if (error instanceof NotFoundError) return errorResponse("NOT_FOUND", error.message, 404);
    if (error instanceof ConflictError) return errorResponse("CONFLICT", error.message, 409);
    return handleError(error);
  }
}
