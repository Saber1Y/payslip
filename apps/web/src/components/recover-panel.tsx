"use client";

import { ArrowRight, Fingerprint } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Hex } from "viem";
import { api, ApiError } from "@/lib/api";
import { PasskeyError, signInWithPasskey } from "@/lib/passkey";
import { rememberRecordsLink } from "@/lib/remembered-link";
import { Button, CopyButton, Notice } from "./ui";

interface Recovered {
  path: string;
  role: "worker" | "employer";
  name: string;
}

/** Finds a party's records with the passkey they already have, and hands them a fresh link. */
export function RecoverPanel() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recovered, setRecovered] = useState<Recovered | null>(null);

  async function recover() {
    setBusy(true);
    setError(null);
    try {
      const { challengeId, challenge, rpId } = await api<{ challengeId: string; challenge: Hex; rpId: string }>("/api/recovery/challenge", { method: "POST" });
      const assertion = await signInWithPasskey(rpId, challenge);
      const result = await api<Recovered>("/api/recovery", { method: "POST", body: { challengeId, assertion } });
      rememberRecordsLink(result);
      setRecovered(result);
    } catch (err) {
      setError(err instanceof PasskeyError || err instanceof ApiError ? err.message : "Couldn't find your records. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (recovered) {
    const url = `${window.location.origin}${recovered.path}`;
    return (
      <div className="enter grid gap-4">
        <Notice tone="signed" title={`Found ${recovered.role === "worker" ? "your records" : "your household's records"}, ${recovered.name}`}>
          Here is your new link. Your old link no longer works, so anyone who had it can&apos;t open your records any more.
        </Notice>
        <p className="figures rounded-lg bg-sheet-2 px-3 py-2 text-[12.5px] break-all">{url}</p>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={url} label="Copy new link" />
          <Button icon={<ArrowRight className="size-4" aria-hidden />} onClick={() => router.push(recovered.path)}>
            Open my records
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="slip grid gap-4 p-5 sm:p-6">
      <ol className="grid list-decimal gap-1.5 pl-5 text-[15px] text-muted">
        <li>Use the phone or computer where you made your Payslip passkey.</li>
        <li>Press the button and choose your Payslip passkey.</li>
        <li>You get a new link to your records. Save it this time.</li>
      </ol>
      {error && <Notice tone="breach" title="Couldn't find your records">{error}</Notice>}
      <Button onClick={recover} busy={busy} icon={<Fingerprint className="size-4" aria-hidden />} className="w-full sm:w-fit">
        Find my records with my passkey
      </Button>
      <p className="text-[13px] text-muted">Your passkey proves it is you. Payslip never sees your fingerprint or face, only a signature.</p>
    </div>
  );
}
