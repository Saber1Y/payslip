import { json, readJson } from "@/server/http";
import { createShare, listShares } from "@/server/payslip";
import { withToken } from "@/server/route-helpers";

export const runtime = "nodejs";

export async function GET(_request: Request, ctx: { params: Promise<{ token: string }> }) {
  return withToken(ctx.params, async (token) => json(await listShares(token)));
}

export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  return withToken(ctx.params, async (token) => json(await createShare(token, await readJson(request)), { status: 201 }));
}
