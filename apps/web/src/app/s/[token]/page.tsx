import type { Metadata } from "next";
import { SharedPacketView } from "@/components/shared-packet";

export const metadata: Metadata = { title: "Shared salary records · Payslip", robots: { index: false } };

export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="mx-auto grid max-w-[760px] gap-6 px-4 pt-10 pb-6 sm:px-8 sm:pt-14">
      <div className="grid gap-2">
        <p className="figures text-[12px] tracking-[0.12em] text-muted uppercase">Shared claim packet</p>
        <h1 className="font-serif text-[34px] leading-[1.1] font-semibold tracking-[-0.02em] sm:text-[42px]">Salary records, checked against the chain</h1>
      </div>
      <SharedPacketView token={token} />
    </div>
  );
}
