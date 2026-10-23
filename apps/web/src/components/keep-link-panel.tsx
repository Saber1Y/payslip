"use client";

import { BookmarkSimple, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { CopyButton } from "./ui";

/**
 * The records link is the worker's way back in, and only its hash is stored on the server, so nobody can
 * resend it once the invite is used. This asks the worker to keep it, until they dismiss the reminder.
 */
export function KeepLinkPanel({ token }: { token: string }) {
  const key = `payslip:kept-link:${token.slice(0, 12)}`;
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(window.location.href.split("#")[0] ?? window.location.href);
    try {
      setVisible(localStorage.getItem(key) !== "1");
    } catch {
      setVisible(true);
    }
  }, [key]);

  if (!visible) return null;
  return (
    <section className="slip enter grid gap-3 border-accent/40 p-5" aria-labelledby="keep-link">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <BookmarkSimple className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
          <div className="grid gap-1">
            <h2 id="keep-link" className="font-serif text-lg font-semibold">
              Keep this link
            </h2>
            <p className="text-[14px] text-muted">
              This page is how you get back to your records. Bookmark it, or use your browser&apos;s Share button and choose Add to Home Screen. Nobody can send
              it to you again, not even your employer.
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          className="press -mt-1 -mr-1 rounded-full p-2 text-muted hover:bg-sheet-2 hover:text-ink"
          onClick={() => {
            setVisible(false);
            try {
              localStorage.setItem(key, "1");
            } catch {
              // Storage unavailable: the reminder simply comes back next time.
            }
          }}
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <p className="figures rounded-lg bg-sheet-2 px-3 py-2 text-[12.5px] break-all">{url}</p>
      <div>
        <CopyButton value={url} label="Copy my link" />
      </div>
    </section>
  );
}
