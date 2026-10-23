import type { Metadata } from "next";
import { PrintablePacket } from "@/components/printable-packet";

export const metadata: Metadata = { title: "Printable claim packet · Payslip", robots: { index: false } };

export default async function PrintPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="mx-auto max-w-[900px] px-4 pt-8 pb-6 sm:px-8 print:max-w-none print:p-0">
      <PrintablePacket token={token} />
    </div>
  );
}
