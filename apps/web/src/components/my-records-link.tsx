"use client";

import { Notebook } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { onRecordsLinkChange, readRecordsLink, type RememberedLink } from "@/lib/remembered-link";

/** Header shortcut back to the records page last opened in this browser. Hidden while on that page. */
export function MyRecordsLink() {
  const pathname = usePathname();
  const [link, setLink] = useState<RememberedLink | null>(null);

  useEffect(() => {
    setLink(readRecordsLink());
    return onRecordsLinkChange(() => setLink(readRecordsLink()));
  }, []);

  if (!link || pathname === link.path) return null;
  return (
    <Link href={link.path} className="press inline-flex items-center gap-1.5 rounded-full whitespace-nowrap bg-accent-soft px-3 py-1.5 font-medium text-accent hover:bg-sheet">
      <Notebook className="size-4" aria-hidden />
      My records
    </Link>
  );
}
