"use client";

import { expectedPayment, type Period } from "@payslip/core";
import { Printer } from "@phosphor-icons/react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { dateLabel, METHOD_LABEL, periodLabel, REASON_SUMMARY, sgd, WEEKDAYS } from "@/lib/format";
import type { SharedPacket } from "@/lib/views";
import { Button, Notice, Spinner } from "./ui";
import { usePacketVerification, type VerificationResult } from "./verifier";

/**
 * A one-page-per-few-months paper version of a shared packet, for officers who work on paper. It is
 * verified in the browser before printing, states when and against which chain, and carries a QR code to
 * the live shared link so anyone holding the paper can check it again themselves.
 */
export function PrintablePacket({ token }: { token: string }) {
  const { config, result, error, busy, verify } = usePacketVerification();
  const [share, setShare] = useState<SharedPacket | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [verifyUrl, setVerifyUrl] = useState("");

  useEffect(() => {
    const url = `${window.location.origin}/s/${token}`;
    setVerifyUrl(url);
    QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#1b1914", light: "#00000000" } })
      .then(setQr)
      .catch(() => setQr(null));
    const controller = new AbortController();
    api<SharedPacket>(`/api/s/${token}`, { signal: controller.signal })
      .then((s) => {
        setShare(s);
        void verify(s.packet);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoadError(err instanceof ApiError && err.status === 404 ? "This shared packet isn't available. It may have been revoked." : "Couldn't load this packet.");
      });
    return () => controller.abort();
  }, [token, verify]);

  if (loadError) return <Notice tone="breach" title="Nothing to print">{loadError}</Notice>;
  if (error) return <Notice tone="breach" title="Couldn't check this packet">{error}</Notice>;
  if (!share || busy || !result) return <Spinner label="Checking the records against the chain before printing" />;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-[14px] text-muted">Check the preview, then print it or save it as a PDF.</p>
        <Button icon={<Printer className="size-4" aria-hidden />} onClick={() => window.print()}>
          Print or save as PDF
        </Button>
      </div>
      <Sheet result={result} share={share} qr={qr} verifyUrl={verifyUrl} chainName={config.name} registry={config.registry} />
    </div>
  );
}

function Sheet({ result, share, qr, verifyUrl, chainName, registry }: { result: VerificationResult; share: SharedPacket; qr: string | null; verifyUrl: string; chainName: string; registry: string }) {
  const { packet, verification: v, checkedAt } = result;
  const { employment } = packet;
  const byPeriod = new Map(packet.months.map((m) => [m.record.period, m]));
  const rows: { period: Period; kind: "month" | "missing" }[] = [
    ...v.months.map((m) => ({ period: m.period, kind: "month" as const })),
    ...v.missing.map((m) => ({ period: m.period, kind: "missing" as const })),
  ].sort((a, b) => (a.period < b.period ? -1 : 1));
  const demo = employment.worker.key.authenticator === "software-demo";

  return (
    <article className="slip mx-auto grid w-full max-w-[820px] gap-6 p-6 text-[13px] sm:p-8 print:max-w-none print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="grid gap-1">
          <p className="figures text-[11px] tracking-[0.12em] text-muted uppercase">Payslip claim packet</p>
          <h1 className="font-serif text-[26px] leading-tight font-semibold">Salary records of {employment.worker.displayName}</h1>
          <p className="text-muted">
            Employer: {employment.employer.displayName}. Shared for {share.label} on {dateLabel(share.sharedAt.slice(0, 10))}.
          </p>
        </div>
        {qr && (
          <figure className="grid w-[128px] justify-items-center gap-1.5">
            <div className="size-[112px] [&>svg]:size-full" role="img" aria-label="QR code to the live records" dangerouslySetInnerHTML={{ __html: qr }} />
            <figcaption className="text-center text-[10.5px] leading-snug text-muted">Scan to check these records yourself</figcaption>
          </figure>
        )}
      </header>

      <div className={`rounded-lg px-4 py-3 ${v.ok ? "bg-signed-soft text-signed" : "bg-breach-soft text-breach"}`}>
        <p className="font-semibold">
          {v.ok ? "Every record matches what both people signed and what was anchored on-chain." : "Some records do not match the chain. See the table."}
        </p>
        <p className="opacity-90">
          Checked {checkedAt.toLocaleString("en-SG", { dateStyle: "medium", timeStyle: "short" })} against {chainName}, registry {registry}.
        </p>
      </div>
      {demo && <p className="text-waiting">Demo data: signed with keys generated in code, not real passkeys.</p>}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
        {[
          ["Declared salary", sgd(employment.declaredMonthlySalaryCents)],
          ["Weekly rest day", WEEKDAYS[employment.restDayWeekday] ?? ""],
          ["Records since", periodLabel(employment.startPeriod)],
          ["Months in packet", String(packet.months.length)],
        ].map(([k, val]) => (
          <div key={k}>
            <dt className="text-muted">{k}</dt>
            <dd className="figures font-medium">{val}</dd>
          </div>
        ))}
      </dl>

      <table className="w-full border-collapse text-left text-[12px]">
        <thead>
          <tr className="border-b border-rule-strong text-[11.5px] text-muted">
            <th className="py-2 pr-2 font-medium">Month</th>
            <th className="py-2 pr-2 text-right font-medium">Salary</th>
            <th className="py-2 pr-2 text-right font-medium whitespace-nowrap">Rest days</th>
            <th className="py-2 pr-2 text-right font-medium whitespace-nowrap">Should be</th>
            <th className="py-2 pr-2 text-right font-medium">Paid</th>
            <th className="py-2 pr-2 font-medium">Paid on</th>
            <th className="py-2 pr-2 font-medium">Worker</th>
            <th className="py-2 font-medium">Chain</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ period, kind }) => {
            if (kind === "missing") {
              return (
                <tr key={period} className="border-b border-rule align-top text-breach">
                  <td className="py-2 pr-2 font-medium whitespace-nowrap">{periodLabel(period, "short")}</td>
                  <td colSpan={7} className="py-2">
                    No record by the MOM payment deadline, and nothing anchored.
                  </td>
                </tr>
              );
            }
            const m = byPeriod.get(period);
            const check = v.months.find((x) => x.period === period);
            if (!m || !check) return null;
            const r = m.record;
            const breaches = check.verdict === "tampered" ? [] : check.flags.filter((f) => f.severity === "breach");
            return (
              <tr key={period} className="border-b border-rule align-top break-inside-avoid">
                <td className="py-2 pr-2 font-medium whitespace-nowrap">{periodLabel(period, "short")}</td>
                <td className="figures py-2 pr-2 text-right whitespace-nowrap">{sgd(r.monthlySalaryCents)}</td>
                <td className="figures py-2 pr-2 text-right">
                  {r.restDaysTaken}/{r.restDaysInMonth}
                  {r.restDaysWorked > 0 && <span className="block text-[11px] text-muted">{r.restDaysWorked} worked</span>}
                </td>
                <td className="figures py-2 pr-2 text-right whitespace-nowrap">{sgd(expectedPayment(r))}</td>
                <td className="figures py-2 pr-2 text-right whitespace-nowrap font-medium">{sgd(r.amountPaidCents)}</td>
                <td className="py-2 pr-2 whitespace-nowrap">
                  {dateLabel(r.paidOn)}
                  <span className="block text-[11px] text-muted">{METHOD_LABEL[r.method]}</span>
                  {r.paymentReference && <span className="figures block text-[10.5px] break-all whitespace-normal text-muted">Ref {r.paymentReference}</span>}
                </td>
                <td className="py-2 pr-2">
                  {!m.decision ? "Not answered" : m.decision.decision === "dispute" ? "Disputed" : m.decision.underProtest ? "Signed, under protest" : "Signed"}
                  {m.decision?.decision === "dispute" && <span className="block text-[11px] text-waiting">{m.decision.reasons.map((x) => REASON_SUMMARY[x]).join("; ")}</span>}
                </td>
                <td className={`py-2 ${check.verdict === "verified" ? "text-signed" : "text-breach"}`}>
                  {check.verdict === "verified" ? "Matches" : check.verdict === "tampered" ? "Altered" : "Not anchored"}
                  {breaches.map((f) => (
                    <span key={f.code} className="block text-[11px] text-breach">
                      {f.message}
                    </span>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <section className="grid gap-1.5 text-[11.5px] text-muted break-inside-avoid">
        <h2 className="text-[12.5px] font-semibold text-ink">How to check this paper</h2>
        <p>
          Scan the QR code or open {verifyUrl}. Each month is fingerprinted again in your browser, both passkey signatures are checked, and the fingerprints
          are compared with what was recorded on {chainName}. Nobody, including Payslip, can change a month after both people signed it.
        </p>
        <p>
          This paper is evidence of what the employer and worker recorded and signed. It is not legal advice and does not replace MOM&apos;s processes. Rules
          checked: payment within 7 days of the month end, at least one rest day a month, one day&apos;s salary (monthly salary ÷ 26) for each rest day worked.
        </p>
      </section>

      <section className="grid gap-1 text-[10.5px] text-muted break-inside-avoid">
        <h2 className="text-[11.5px] font-semibold text-ink">Fingerprints</h2>
        <p className="figures break-all">Employment {employment.employmentId}</p>
        {v.months.map((m) => (
          <p key={m.period} className="figures break-all">
            {m.period} record {m.recordHash}
            {m.decisionHash ? ` · answer ${m.decisionHash}` : ""}
          </p>
        ))}
      </section>
    </article>
  );
}
