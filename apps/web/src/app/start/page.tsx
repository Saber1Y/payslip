import type { Metadata } from "next";
import { StartForm } from "@/components/start-form";

export const metadata: Metadata = { title: "Set up Payslip · Payslip" };

export default function StartPage() {
  return (
    <div className="mx-auto grid max-w-[760px] gap-6 px-4 pt-10 pb-6 sm:px-8 sm:pt-14">
      <div className="grid gap-2">
        <p className="figures text-[12px] tracking-[0.12em] text-muted uppercase">For employers</p>
        <h1 className="font-serif text-[34px] leading-[1.1] font-semibold tracking-[-0.02em] sm:text-[42px]">Replace the salary notebook</h1>
        <p className="max-w-xl text-[16px] text-muted">
          MOM requires both of you to sign each cash salary record. Payslip does that on your phones and keeps a fingerprint of every record that neither side
          can change later. Honest records protect you too.
        </p>
      </div>
      <StartForm />
    </div>
  );
}
