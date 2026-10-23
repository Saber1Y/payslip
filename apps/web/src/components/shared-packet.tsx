"use client";

import { Printer, ShareNetwork } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { dateLabel } from "@/lib/format";
import type { SharedPacket } from "@/lib/views";
import { LinkProblem } from "./link-problem";
import { Notice, Spinner } from "./ui";
import { Report, usePacketVerification, VerificationNotes } from "./verifier";

/**
 * What a recipient (an NGO, a lawyer, a MOM officer) sees when a worker shares their packet. The packet
 * comes from Payslip's server, but the verification runs here, against the chain, exactly as on /verify.
 */
export function SharedPacketView({ token }: { token: string }) {
  const { result, error, busy, verify } = usePacketVerification();
  const [share, setShare] = useState<SharedPacket | null>(null);
  const [loadError, setLoadError] = useState<{ status: number; message: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api<SharedPacket>(`/api/s/${token}`, { signal: controller.signal })
      .then((s) => {
        setShare(s);
        void verify(s.packet);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoadError(err instanceof ApiError ? { status: err.status, message: err.message } : { status: 0, message: "Couldn't load this packet." });
      });
    return () => controller.abort();
  }, [token, verify]);

  if (loadError) {
    return loadError.status === 404 ? (
      <Notice tone="breach" title="This shared packet isn't available">
        The worker may have revoked it. Ask them to share a new link.
      </Notice>
    ) : (
      <LinkProblem status={loadError.status} message={loadError.message} />
    );
  }
  if (!share) return <Spinner label="Loading the shared packet" />;

  const worker = result?.packet.employment.worker.displayName;
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent-soft px-4 py-3 text-[14px] text-accent">
        <p className="flex items-center gap-2">
          <ShareNetwork className="size-4 shrink-0" aria-hidden />
          Shared {worker ? `by ${worker} ` : ""}for {share.label} on {dateLabel(share.sharedAt.slice(0, 10))}. It was checked in your browser just now.
        </p>
        {result && (
          <Link
            href={`/s/${token}/print`}
            className="press inline-flex min-h-9 items-center gap-1.5 rounded-full border border-rule-strong bg-sheet px-3 text-[13px] font-medium text-ink hover:border-ink/40"
          >
            <Printer className="size-3.5" aria-hidden />
            Printable version
          </Link>
        )}
      </div>
      {busy && <Spinner label="Recomputing fingerprints and reading the chain" />}
      {error && <Notice tone="breach" title="Couldn't check this packet">{error}</Notice>}
      {result && <Report result={result} scrollIntoView={false} />}
      <VerificationNotes />
    </div>
  );
}
