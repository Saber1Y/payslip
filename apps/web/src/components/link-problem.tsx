import Link from "next/link";
import { Notice } from "./ui";

export function LinkProblem({ status, message }: { status: number; message: string }) {
  return (
    <div className="grid max-w-lg gap-4">
      <Notice tone="breach" title={status === 404 ? "This link doesn't work" : "Couldn't load this page"}>
        {status === 404 ? "Check you copied the whole link. If it still fails, ask for a new one." : message}
      </Notice>
      <Link href="/" className="text-[14px] text-accent underline underline-offset-2">
        Go to the Payslip home page
      </Link>
    </div>
  );
}
