import { errorResponse, json } from "@/server/http";
import { partyView, retryAnchors } from "@/server/payslip";
import { withToken } from "@/server/route-helpers";

export const runtime = "nodejs";

const ROLES = { e: "employer", w: "worker" } as const;

/** Retries any anchor that failed, for example while the RPC was down. Idempotent. */
export async function POST(_request: Request, ctx: { params: Promise<{ role: string; token: string }> }) {
  const { role: short } = await ctx.params;
  const role = ROLES[short as keyof typeof ROLES];
  if (!role) return errorResponse("NOT_FOUND", "Unknown route", 404);
  return withToken(
    ctx.params.then((p) => ({ token: p.token })),
    async (token) => {
      await retryAnchors(role, token);
      return json(await partyView(role, token));
    },
  );
}
