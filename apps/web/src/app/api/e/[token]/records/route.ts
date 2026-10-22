import { json, readJson } from "@/server/http";
import { partyView, proposeRecord } from "@/server/payslip";
import { withToken } from "@/server/route-helpers";

export const runtime = "nodejs";

export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  return withToken(ctx.params, async (token) => {
    await proposeRecord(token, await readJson(request));
    return json(await partyView("employer", token), { status: 201 });
  });
}
