import { errorResponse, json } from "@/server/http";
import { listShares, revokeShare } from "@/server/payslip";
import { withToken } from "@/server/route-helpers";

export const runtime = "nodejs";

export async function POST(_request: Request, ctx: { params: Promise<{ token: string; id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d{1,9}$/.test(id)) return errorResponse("NOT_FOUND", "Unknown share", 404);
  return withToken(
    ctx.params.then((p) => ({ token: p.token })),
    async (token) => {
      await revokeShare(token, Number(id));
      return json(await listShares(token));
    },
  );
}
