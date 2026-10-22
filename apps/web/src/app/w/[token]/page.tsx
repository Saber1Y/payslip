import type { Metadata } from "next";
import { WorkerWorkspace } from "@/components/worker-workspace";

export const metadata: Metadata = { title: "My salary records · Payslip", robots: { index: false } };

export default async function WorkerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="mx-auto max-w-[640px] px-4 pt-10 pb-6 sm:px-8 sm:pt-14">
      <WorkerWorkspace token={token} />
    </div>
  );
}
