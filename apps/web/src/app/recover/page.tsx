import type { Metadata } from "next";
import { RecoverPanel } from "@/components/recover-panel";

export const metadata: Metadata = { title: "Lost your link · Payslip" };

export default function RecoverPage() {
  return (
    <div className="mx-auto grid max-w-[640px] gap-6 px-4 pt-10 pb-6 sm:px-8 sm:pt-14">
      <div className="grid gap-2">
        <p className="figures text-[12px] tracking-[0.12em] text-muted uppercase">Lost your link</p>
        <h1 className="font-serif text-[34px] leading-[1.1] font-semibold tracking-[-0.02em] sm:text-[42px]">Get back to your records</h1>
        <p className="text-[16px] text-muted">If you lost your Payslip link, your passkey can find your records again. This works for workers and employers.</p>
      </div>
      <RecoverPanel />
    </div>
  );
}
