import { json } from "@/server/http";
import { partyView } from "@/server/payslip";
import { withToken } from "@/server/route-helpers";

export const runtime = "nodejs";

export async function GET(_request: Request, ctx: { params: Promise<{ token: string }> }) {
  return withToken(ctx.params, async (token) => json(await partyView("employer", token)));
}
