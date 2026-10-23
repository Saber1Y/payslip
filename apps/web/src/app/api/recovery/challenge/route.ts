import { handleError, json } from "@/server/http";
import { startRecovery } from "@/server/payslip";

export const runtime = "nodejs";

export async function POST() {
  try {
    return json(await startRecovery(), { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
