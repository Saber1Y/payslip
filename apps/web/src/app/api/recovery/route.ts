import { errorResponse, handleError, json, readJson } from "@/server/http";
import { ConflictError, finishRecovery, NotFoundError } from "@/server/payslip";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    return json(await finishRecovery(await readJson(request)));
  } catch (error) {
    if (error instanceof NotFoundError) return errorResponse("NOT_FOUND", error.message, 404);
    if (error instanceof ConflictError) return errorResponse("CONFLICT", error.message, 409);
    return handleError(error);
  }
}
