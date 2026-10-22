import { json, readJson } from "@/server/http";
import { partyView, registerWorker } from "@/server/payslip";
import { withToken } from "@/server/route-helpers";

export const runtime = "nodejs";

export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  return withToken(ctx.params, async (token) => {
    await registerWorker(token, await readJson(request));
    return json(await partyView("worker", token), { status: 201 });
  });
}
