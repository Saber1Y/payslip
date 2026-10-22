import { json } from "@/server/http";
import { workerPacket } from "@/server/payslip";
import { withToken } from "@/server/route-helpers";

export const runtime = "nodejs";

export async function GET(_request: Request, ctx: { params: Promise<{ token: string }> }) {
  return withToken(ctx.params, async (token) => {
    const packet = await workerPacket(token);
    const name = `payslip-claim-packet-${packet.generatedAt.slice(0, 10)}.json`;
    return json(packet, { headers: { "content-disposition": `attachment; filename="${name}"` } });
  });
}
