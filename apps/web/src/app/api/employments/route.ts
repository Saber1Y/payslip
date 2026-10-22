import { createEmployment } from "@/server/payslip";
import { handleError, json, readJson } from "@/server/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    return json(await createEmployment(await readJson(request)), { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
