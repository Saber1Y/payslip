"use client";

import { explorerTxUrl } from "@payslip/chain";
import { expectedPayment, type SalaryRecord } from "@payslip/core";
import { ArrowSquareOut, LinkSimple } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { dateLabel, METHOD_LABEL, periodLabel, REASON_SUMMARY, SEVERITY_TONE, sgd, shortHash, STATE_STAMP } from "@/lib/format";
import type { MonthView } from "@/lib/views";
import { Pill, SlipRow, Stamp, stagger } from "./ui";

const EXPLORER = process.env.NEXT_PUBLIC_EXPLORER_URL || null;

export function RecordLines({ record }: { record: SalaryRecord }) {
  return (
    <div className="divide-y divide-rule/70">
      <SlipRow label="Monthly salary" value={sgd(record.monthlySalaryCents)} />
      <SlipRow label="Rest days taken" value={`${record.restDaysTaken} of ${record.restDaysInMonth}`} />
      {record.restDaysWorked > 0 && <SlipRow label={`Pay for ${record.restDaysWorked} rest day${record.restDaysWorked > 1 ? "s" : ""} worked`} value={`+ ${sgd(record.restDayPayCents)}`} />}
      {record.deductions.map((d, i) => (
        <SlipRow key={i} label={`Deduction: ${d.label}`} value={`- ${sgd(d.cents)}`} />
      ))}
      {(record.restDaysWorked > 0 || record.deductions.length > 0 || record.amountPaidCents !== expectedPayment(record)) && (
        <SlipRow label="Should add up to" value={sgd(expectedPayment(record))} />
      )}
      <SlipRow emphasis label="Amount paid" value={sgd(record.amountPaidCents)} />
      <SlipRow label="Paid on" value={`${dateLabel(record.paidOn)}, ${METHOD_LABEL[record.method]}`} />
      {record.paymentReference && <SlipRow label="Transfer reference" value={record.paymentReference} />}
    </div>
  );
}

export function AnchorLine({ label, tx }: { label: string; tx: string | null }) {
  if (!tx) return null;
  const url = tx.startsWith("0x") ? explorerTxUrl({ explorerUrl: EXPLORER }, tx) : null;
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
      <LinkSimple className="size-3.5 text-signed" weight="bold" aria-hidden />
      {label}
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="figures inline-flex items-center gap-1 text-accent underline-offset-2 hover:underline">
          {shortHash(tx)}
          <ArrowSquareOut className="size-3" aria-hidden />
        </a>
      ) : (
        <span className="figures">{tx.startsWith("0x") ? shortHash(tx) : "on-chain"}</span>
      )}
    </p>
  );
}

/** One month as a slip: header with the stamp, the record, MOM flags, and where it is anchored. */
export function MonthSlip({ month, index, actions, children, stampLabel }: { month: MonthView; index: number; actions?: ReactNode; children?: ReactNode; stampLabel?: string }) {
  const stamp = STATE_STAMP[month.state];
  // The stamp, the dispute box and the under-protest pill already show these states.
  const SHOWN_ELSEWHERE = new Set(["AWAITING_WORKER", "DISPUTED", "MISSING", "UNDER_PROTEST"]);
  const flags = month.flags.filter((f) => !SHOWN_ELSEWHERE.has(f.code));
  return (
    <article className="slip enter overflow-hidden" style={stagger(index)} aria-labelledby={`m-${month.period}`}>
      <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3.5">
        <div className="grid gap-0.5">
          <h3 id={`m-${month.period}`} className="font-serif text-[19px] leading-tight font-semibold">
            {periodLabel(month.period)}
          </h3>
          <p className="text-[13px] text-muted">
            {month.record ? `Recorded, fingerprint ${shortHash(month.recordHash ?? "")}` : `Pay due by ${dateLabel(month.deadline)}`}
          </p>
        </div>
        <Stamp tone={stamp.tone} animate>
          {stampLabel ?? stamp.label}
        </Stamp>
      </header>
      {(month.record || children) && <div className="perforation mx-5" />}
      {month.record && (
        <div className="grid gap-3 px-5 py-3">
          <RecordLines record={month.record} />
          {month.decision?.decision === "dispute" && (
            <div className="grid gap-1.5 rounded-xl bg-waiting-soft px-3.5 py-3 text-[14px] text-waiting">
              <p className="font-medium">Dispute reasons</p>
              <ul className="list-disc pl-5">
                {month.decision.reasons.map((r) => (
                  <li key={r}>{REASON_SUMMARY[r]}</li>
                ))}
              </ul>
            </div>
          )}
          {month.decision?.underProtest && <Pill tone="waiting">Signed under protest</Pill>}
          {flags.length > 0 && (
            <ul className="grid gap-1.5" aria-label="Rule checks">
              {flags.map((f) => (
                <li key={f.code}>
                  <Pill tone={SEVERITY_TONE[f.severity]}>{f.message}</Pill>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-1">
            <AnchorLine label="Employer's record anchored" tx={month.proposalTx} />
            <AnchorLine label={month.decision?.decision === "dispute" ? "Dispute anchored" : "Worker's signature anchored"} tx={month.decisionTx} />
            {month.anchorError && <p className="text-[12.5px] text-breach">Not anchored yet: {month.anchorError}</p>}
          </div>
        </div>
      )}
      {month.state === "missing" && !children && (
        <p className="px-5 pb-4 text-[14px] text-breach">No record by the {dateLabel(month.deadline)} deadline. This gap is itself evidence.</p>
      )}
      {children && <div className="px-5 py-4">{children}</div>}
      {actions && <div className="flex flex-wrap gap-2 border-t border-rule/70 bg-sheet-2/60 px-5 py-3">{actions}</div>}
    </article>
  );
}
