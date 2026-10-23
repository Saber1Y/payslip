"use client";

import { createRegistryReader, explorerAddressUrl, toViemChain } from "@payslip/chain";
import { packetSchema, todayInSingapore, verifyPacket, type Packet, type PacketVerification } from "@payslip/core";
import { CheckCircle, FileArrowUp, ShieldCheck, WarningOctagon } from "@phosphor-icons/react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { createPublicClient, http } from "viem";
import { publicChainConfig } from "@/lib/config";
import { PACKET_HANDOFF_KEY } from "@/lib/handoff";
import { dateLabel, periodLabel, REASON_SUMMARY, SEVERITY_TONE, sgd, shortHash } from "@/lib/format";
import { Button, Notice, Pill, Spinner, Stamp, stagger } from "./ui";

export type VerificationResult = { packet: Packet; verification: PacketVerification; checkedAt: Date };
type Result = VerificationResult;

/**
 * Verifies a claim packet entirely in this browser: hashes are recomputed here, passkey signatures are
 * checked with WebCrypto, and anchors are read straight from the chain RPC. Payslip's server is not asked.
 * The registry is always this site's configured one, never the address the packet claims.
 */
export function usePacketVerification() {
  const config = useMemo(() => publicChainConfig(), []);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const verify = useCallback(
    async (raw: unknown) => {
      setBusy(true);
      setError(null);
      setResult(null);
      try {
        const parsed = packetSchema.safeParse(raw);
        if (!parsed.success) throw new Error("This file is not a Payslip claim packet, or it is damaged.");
        const client = createPublicClient({ chain: toViemChain(config), transport: http(config.rpcUrl) });
        const reader = createRegistryReader(client, config.registry);
        const verification = await verifyPacket(parsed.data, reader, todayInSingapore(new Date()));
        setResult({ packet: parsed.data, verification, checkedAt: new Date() });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(/fetch|HTTP request failed|network/i.test(message) ? `Couldn't reach the ${config.name} network to read the anchors. Try again.` : message);
      } finally {
        setBusy(false);
      }
    },
    [config],
  );

  return { config, result, error, setError, busy, verify };
}

/** The upload-a-file verifier on /verify. */
export function Verifier() {
  const params = useSearchParams();
  const { config, result, error, setError, busy, verify } = usePacketVerification();
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (params.get("from") !== "records") return;
    const stored = sessionStorage.getItem(PACKET_HANDOFF_KEY);
    if (!stored) return;
    sessionStorage.removeItem(PACKET_HANDOFF_KEY);
    try {
      void verify(JSON.parse(stored));
    } catch {
      setError("The packet could not be read.");
    }
  }, [params, verify]);

  async function readFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 2_000_000) return setError("That file is too large to be a claim packet.");
    try {
      await verify(JSON.parse(await file.text()));
    } catch {
      setError("That file is not valid JSON. Pick the file you downloaded from Payslip.");
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void readFile(event.dataTransfer.files[0]);
  }

  return (
    <div className="grid gap-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`slip grid place-items-center gap-3 border-dashed px-5 py-8 text-center transition-colors ${dragging ? "border-accent bg-accent-soft" : ""}`}
      >
        <FileArrowUp className="size-7 text-accent" aria-hidden />
        <div className="grid gap-1">
          <p className="text-[15px] font-medium">Drop a claim packet here</p>
          <p className="text-[13.5px] text-muted">The file a worker downloaded from Payslip. It stays in this browser.</p>
        </div>
        <input ref={input} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => void readFile(e.target.files?.[0])} aria-label="Choose a claim packet file" />
        <Button variant="secondary" onClick={() => input.current?.click()} busy={busy}>
          Choose file
        </Button>
      </div>

      {busy && <Spinner label={`Recomputing fingerprints and reading ${config.name}`} />}
      {error && <Notice tone="breach" title="Couldn't check this packet">{error}</Notice>}
      {result && <Report result={result} />}

      <VerificationNotes />
    </div>
  );
}

/** How the check works, and which registry it trusts. Shown wherever a packet is verified. */
export function VerificationNotes() {
  const config = publicChainConfig();
  return (
    <section className="grid gap-2 text-[14px] text-muted">
      <h2 className="font-serif text-lg font-semibold text-ink">How the check works</h2>
      <ol className="grid list-decimal gap-1.5 pl-5">
        <li>Each record is fingerprinted again here, in your browser.</li>
        <li>The employer&apos;s and worker&apos;s passkey signatures are checked against those fingerprints.</li>
        <li>The fingerprints and both public keys are compared with what was anchored on {config.name}, read directly from the chain.</li>
        <li>Months with no record after MOM&apos;s 7-day deadline, and anchored months left out of the file, are listed.</li>
      </ol>
      <p>
        Registry contract{" "}
        {explorerAddressUrl(config, config.registry) ? (
          <a className="figures text-accent underline underline-offset-2" href={explorerAddressUrl(config, config.registry) ?? undefined} target="_blank" rel="noreferrer">
            {shortHash(config.registry)}
          </a>
        ) : (
          <span className="figures text-ink">{config.registry}</span>
        )}{" "}
        on {config.name}.
      </p>
    </section>
  );
}

const VERDICT = {
  verified: { label: "Matches chain", tone: "signed" as const },
  tampered: { label: "Altered", tone: "breach" as const },
  not_anchored: { label: "Not anchored", tone: "waiting" as const },
};

export function Report({ result, scrollIntoView = true }: { result: Result; scrollIntoView?: boolean }) {
  const top = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!scrollIntoView) return;
    top.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [result, scrollIntoView]);
  const config = publicChainConfig();
  const { packet, verification: v } = result;
  const tampered = v.months.filter((m) => m.verdict === "tampered").length;
  const disputed = v.months.filter((m) => m.flags.some((f) => f.code === "DISPUTED")).length;
  const breaches = v.months.filter((m) => m.verdict !== "tampered").reduce((n, m) => n + m.flags.filter((f) => f.severity === "breach").length, 0) + v.missing.length;
  const otherRegistry = packet.chain.registry.toLowerCase() !== config.registry.toLowerCase() || packet.chain.chainId !== config.chainId;
  const demo = packet.employment.worker.key.authenticator === "software-demo";

  return (
    <section ref={top} className="grid scroll-mt-6 gap-4" aria-live="polite">
      <div className={`enter flex items-start gap-3 rounded-2xl px-5 py-4 ${v.ok ? "bg-signed-soft text-signed" : "bg-breach-soft text-breach"}`}>
        {v.ok ? <CheckCircle className="mt-0.5 size-6 shrink-0" weight="fill" aria-hidden /> : <WarningOctagon className="mt-0.5 size-6 shrink-0" weight="fill" aria-hidden />}
        <div className="grid gap-0.5">
          <p className="text-[17px] font-semibold">{v.ok ? "Every record matches what was signed and anchored" : "This packet does not match the chain"}</p>
          <p className="text-[14px] opacity-90">
            {packet.employment.employer.displayName} and {packet.employment.worker.displayName}, {v.months.length} month{v.months.length === 1 ? "" : "s"}, checked{" "}
            {result.checkedAt.toLocaleString("en-SG", { dateStyle: "medium", timeStyle: "short" })}.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Altered", tampered],
          ["Disputed", disputed],
          ["Missing months", v.missing.length],
          ["Rule flags", breaches],
        ].map(([label, n], i) => (
          <div key={label} className="slip enter px-4 py-3" style={stagger(i)}>
            <p className="text-[12.5px] text-muted">{label}</p>
            <p className="figures text-[24px] font-medium">{n}</p>
          </div>
        ))}
      </div>

      {otherRegistry && (
        <Notice tone="waiting" title="Checked against this site's registry">
          The packet says it was anchored on {packet.chain.name} at {shortHash(packet.chain.registry)}. It was checked against {config.name} at {shortHash(config.registry)}, the registry this site trusts.
        </Notice>
      )}
      {demo && <Notice tone="waiting" title="Demo keys">This packet was signed with keys generated in code for a demo, not with real passkeys.</Notice>}
      {v.employment.problems.length > 0 && (
        <Notice tone="breach" title="The agreement does not match">
          <ul className="list-disc pl-4">
            {v.employment.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Notice>
      )}
      {v.omitted.length > 0 && (
        <Notice tone="waiting" title="Months left out of this file">
          The chain has records for {v.omitted.map((p) => periodLabel(p)).join(", ")}, but this file does not include them.
        </Notice>
      )}

      <ol className="slip divide-y divide-rule/70">
        {[...v.months.map((m) => ({ period: m.period, month: m })), ...v.missing.map((m) => ({ period: m.period, month: null }))]
          .sort((a, b) => (a.period < b.period ? 1 : -1))
          .map(({ period, month }) => {
            const record = packet.months.find((p) => p.record.period === period);
            return (
              <li key={period} className="grid gap-2 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="grid gap-0.5">
                    <p className="font-serif text-[17px] font-semibold">{periodLabel(period)}</p>
                    {record && (
                      <p className="figures text-[13px] text-muted">
                        {sgd(record.record.amountPaidCents)} paid {dateLabel(record.record.paidOn)}
                      </p>
                    )}
                  </div>
                  {month ? <Stamp tone={VERDICT[month.verdict].tone}>{VERDICT[month.verdict].label}</Stamp> : <Stamp tone="breach">Missing</Stamp>}
                </div>
                {month && (
                  <>
                    {month.problems.length > 0 && (
                      <ul className="grid gap-1">
                        {month.problems.map((p) => (
                          <li key={p}>
                            <Pill tone="breach">{p}</Pill>
                          </li>
                        ))}
                      </ul>
                    )}
                    {record?.decision?.decision === "dispute" && <p className="text-[13.5px] text-waiting">Worker disputed: {record.decision.reasons.map((r) => REASON_SUMMARY[r]).join("; ")}</p>}
                    {month.verdict === "tampered" ? (
                      <p className="text-[13.5px] text-muted">Rule checks are skipped: this copy was changed after signing, so its numbers can&apos;t be trusted.</p>
                    ) : (
                    <ul className="flex flex-wrap gap-1.5">
                      {month.flags
                        .filter((f) => f.code !== "DISPUTED")
                        .map((f) => (
                          <li key={f.code}>
                            <Pill tone={SEVERITY_TONE[f.severity]}>{f.message}</Pill>
                          </li>
                        ))}
                    </ul>
                    )}
                    <details className="text-[12.5px] text-muted">
                      <summary className="cursor-pointer select-none hover:text-ink">Technical details</summary>
                      <dl className="figures mt-2 grid gap-1 break-all">
                        <div>record fingerprint {month.recordHash}</div>
                        {month.decisionHash && <div>decision fingerprint {month.decisionHash}</div>}
                        <div>employer signature {month.employerSignature.ok ? "valid" : month.employerSignature.reason}</div>
                        {month.workerSignature && <div>worker signature {month.workerSignature.ok ? "valid" : month.workerSignature.reason}</div>}
                        <div>proposal anchored {month.proposalEntry ? new Date(month.proposalEntry.recordedAt * 1000).toISOString() : "no"}</div>
                        {record?.decision && <div>decision anchored {month.decisionEntry ? new Date(month.decisionEntry.recordedAt * 1000).toISOString() : "no"}</div>}
                      </dl>
                    </details>
                  </>
                )}
                {!month && <p className="text-[13.5px] text-breach">No record and nothing anchored by the MOM deadline.</p>}
              </li>
            );
          })}
      </ol>
      <p className="flex items-center gap-2 text-[13px] text-muted">
        <ShieldCheck className="size-4 text-accent" aria-hidden />
        Checked in this browser. Payslip&apos;s server was not involved.
      </p>
    </section>
  );
}
