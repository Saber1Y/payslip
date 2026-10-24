"use client";

import { DownloadSimple, Fingerprint, LockKey, Printer, SealCheck, ShieldCheck } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { PACKET_HANDOFF_KEY } from "@/lib/handoff";
import { createPasskey, PasskeyError } from "@/lib/passkey";
import type { CreatedShare, PartyView } from "@/lib/views";
import { KeepLinkPanel } from "./keep-link-panel";
import { LinkProblem } from "./link-problem";
import { MonthSlip } from "./month-slip";
import { PartyHeader } from "./party-header";
import { ReviewPanel } from "./review-panel";
import { SharePanel } from "./share-panel";
import { Button, Notice, Spinner } from "./ui";
import { usePartyView } from "./use-party-view";

export function WorkerWorkspace({ token }: { token: string }) {
  const { view, error, setView } = usePartyView("w", token);
  if (error) return <LinkProblem status={error.status} message={error.message} />;
  if (!view) return <Spinner label="Loading your records" />;
  if (view.employment.status === "awaiting_worker") return <Join token={token} view={view} onJoined={setView} />;
  return <Records token={token} view={view} onView={setView} />;
}

function Join({ token, view, onJoined }: { token: string; view: PartyView; onJoined: (v: PartyView) => void }) {
  const { employment } = view;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstName = employment.workerName.split(" ")[0] ?? employment.workerName;

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const workerKey = await createPasskey(employment.rp.id, `${employment.workerName} (Payslip)`);
      onJoined(await api<PartyView>(`/api/w/${token}/register`, { method: "POST", body: { workerKey } }));
    } catch (err) {
      setError(err instanceof PasskeyError || err instanceof ApiError ? err.message : "Couldn't finish. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const points = [
    { icon: <SealCheck className="size-5" aria-hidden />, title: "Every month, you check and sign", body: `${employment.employerName} records your salary and rest days. You say yes, or say what is wrong.` },
    { icon: <LockKey className="size-5" aria-hidden />, title: "Nobody can change it later", body: "Once you both sign, a fingerprint of the record goes on a public blockchain. Not your name or salary, only the fingerprint." },
    { icon: <ShieldCheck className="size-5" aria-hidden />, title: "The records are yours", body: "Download them any time, even if you change employer, and show them to MOM, an NGO or a lawyer." },
  ];

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <p className="figures text-[12px] tracking-[0.12em] text-muted uppercase">Invitation</p>
        <h1 className="font-serif text-[30px] leading-[1.1] font-semibold tracking-[-0.02em] sm:text-[38px]">Hi {firstName}, keep your own salary records</h1>
        <p className="text-[16px] text-muted">{employment.employerName} invited you to Payslip.</p>
      </div>
      <ul className="slip grid gap-0 divide-y divide-rule/70">
        {points.map((p) => (
          <li key={p.title} className="flex gap-3.5 px-5 py-4">
            <span className="mt-0.5 text-accent">{p.icon}</span>
            <span className="grid gap-0.5">
              <span className="text-[15px] font-medium">{p.title}</span>
              <span className="text-[14px] text-muted">{p.body}</span>
            </span>
          </li>
        ))}
      </ul>
      {error && <Notice tone="breach" title="Not finished">{error}</Notice>}
      <div className="grid gap-2">
        <Button onClick={join} busy={busy} icon={<Fingerprint className="size-4" aria-hidden />} className="w-full sm:w-fit">
          Create my passkey
        </Button>
        <p className="text-[13px] text-muted">Your phone asks for your fingerprint, face or screen lock. Use your own phone, not your employer&apos;s.</p>
      </div>
    </div>
  );
}

function Records({ token, view, onView }: { token: string; view: PartyView; onView: (v: PartyView) => void }) {
  const router = useRouter();
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [packetBusy, setPacketBusy] = useState(false);
  const [packetError, setPacketError] = useState<string | null>(null);
  const { employment } = view;
  const waiting = view.months.filter((m) => m.state === "awaiting_worker");

  async function fetchPacket(): Promise<unknown> {
    return api<unknown>(`/api/w/${token}/packet`);
  }

  async function download() {
    setPacketBusy(true);
    setPacketError(null);
    try {
      const packet = await fetchPacket();
      const blob = new Blob([JSON.stringify(packet, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payslip-records-${view.today}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setPacketError(err instanceof ApiError ? err.message : "Couldn't build your packet.");
    } finally {
      setPacketBusy(false);
    }
  }

  async function check() {
    setPacketBusy(true);
    setPacketError(null);
    try {
      sessionStorage.setItem(PACKET_HANDOFF_KEY, JSON.stringify(await fetchPacket()));
      router.push("/verify?from=records");
    } catch (err) {
      setPacketError(err instanceof ApiError ? err.message : "Couldn't build your packet.");
      setPacketBusy(false);
    }
  }

  /** A printed copy gets its own share link, so its QR code keeps working until the worker stops it. */
  async function print() {
    setPacketBusy(true);
    setPacketError(null);
    try {
      const share = await api<CreatedShare>(`/api/w/${token}/shares`, { method: "POST", body: { label: "Printed copy" } });
      router.push(`${new URL(share.url).pathname}/print`);
    } catch (err) {
      setPacketError(err instanceof ApiError ? err.message : "Couldn't prepare the printable copy.");
      setPacketBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <PartyHeader view={view} token={token} onView={onView} title={waiting.length === 0 ? "Your salary records" : waiting.length === 1 ? "1 month needs your answer" : `${waiting.length} months need your answer`} />

      {waiting.length === 0 && (
        <Notice title="Nothing needs your answer right now">
          {employment.employerName} records each month first, usually after paying you. When they do, the month appears below with a <strong className="font-medium">Review and answer</strong> button.
        </Notice>
      )}

      <KeepLinkPanel token={token} />

      <section className="slip flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="grid gap-0.5">
          <h2 className="font-serif text-lg font-semibold">Your claim packet</h2>
          <p className="max-w-md text-[14px] text-muted">Every signed month in one file. Anyone can check it against the blockchain, without trusting Payslip.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" busy={packetBusy} onClick={check} icon={<ShieldCheck className="size-4" aria-hidden />}>
            Check it now
          </Button>
          <Button variant="secondary" disabled={packetBusy} onClick={download} icon={<DownloadSimple className="size-4" aria-hidden />}>
            Download
          </Button>
          <Button variant="secondary" disabled={packetBusy} onClick={print} icon={<Printer className="size-4" aria-hidden />}>
            Print
          </Button>
        </div>
        {packetError && <div className="w-full"><Notice tone="breach">{packetError}</Notice></div>}
      </section>

      <SharePanel token={token} />

      <div className="grid gap-4">
        <h2 className="sr-only">Months</h2>
        {view.months.map((month, i) => (
          <MonthSlip
            key={month.period}
            month={month}
            index={i}
            stampLabel={month.state === "awaiting_worker" ? "Needs your answer" : undefined}
            actions={
              month.state === "awaiting_worker" && reviewing !== month.period ? (
                <Button onClick={() => setReviewing(month.period)}>Review and answer</Button>
              ) : undefined
            }
          >
            {reviewing === month.period && month.state === "awaiting_worker" ? (
              <ReviewPanel
                token={token}
                employment={employment}
                month={month}
                onSaved={(next) => {
                  onView(next);
                  setReviewing(null);
                }}
              />
            ) : month.state === "due" ? (
              <p className="text-[14px] text-muted">
                {employment.employerName} records this month, usually after paying you. When they do, it appears here for you to check and sign.
              </p>
            ) : undefined}
          </MonthSlip>
        ))}
      </div>
    </div>
  );
}
