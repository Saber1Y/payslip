import Link from "next/link";
import { Notice } from "./ui";

export function LinkProblem({ status, message }: { status: number; message: string }) {
  return (
    <div className="grid max-w-lg gap-4">
      <Notice tone="breach" title={status === 404 ? "This link doesn't work" : "Couldn't load this page"}>
        {status === 404 ? "Check you copied the whole link. If you lost it, or it was replaced by a new one, your passkey can find your records." : message}
      </Notice>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-[14px]">
        <Link href="/recover" className="font-medium text-accent underline underline-offset-2">
          Find my records with my passkey
        </Link>
        <Link href="/" className="text-muted underline underline-offset-2 hover:text-ink">
          Go to the Payslip home page
        </Link>
      </div>
    </div>
  );
}
