import type { Metadata } from "next";
import { EmployerWorkspace } from "@/components/employer-workspace";

export const metadata: Metadata = { title: "Employer records · Payslip", robots: { index: false } };

export default async function EmployerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="mx-auto max-w-[760px] px-4 pt-10 pb-6 sm:px-8 sm:pt-14">
      <EmployerWorkspace token={token} />
    </div>
  );
}
