import type { Metadata } from "next";
import { Suspense } from "react";
import { Verifier } from "@/components/verifier";

export const metadata: Metadata = { title: "Verify a claim packet · Payslip" };

export default function VerifyPage() {
  return (
    <div className="mx-auto grid max-w-[760px] gap-6 px-4 pt-10 pb-6 sm:px-8 sm:pt-14">
      <div className="grid gap-2">
        <p className="figures text-[12px] tracking-[0.12em] text-muted uppercase">For MOM officers, NGOs and lawyers</p>
        <h1 className="font-serif text-[34px] leading-[1.1] font-semibold tracking-[-0.02em] sm:text-[42px]">Check a worker&apos;s salary records</h1>
        <p className="max-w-xl text-[16px] text-muted">See whether each month is exactly what both people signed, and what MOM rules it raises. You don&apos;t need an account.</p>
      </div>
      <Suspense>
        <Verifier />
      </Suspense>
    </div>
  );
}
