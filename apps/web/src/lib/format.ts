import type { DisputeReason, FlagSeverity, PaymentMethod, Period } from "@payslip/core";
import type { MonthState } from "./views";

export function sgd(cents: number): string {
  return `S$${(cents / 100).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Parses "650" or "650.50" into cents. Returns null for anything that is not a plain amount. */
export function parseSgd(input: string): number | null {
  const trimmed = input.trim().replace(/,/g, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, frac = ""] = trimmed.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function centsToInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function periodLabel(period: Period, style: "long" | "short" = "long"): string {
  const [y, m] = period.split("-").map(Number) as [number, number];
  const name = MONTHS[m - 1] ?? "";
  return style === "long" ? `${name} ${y}` : `${name.slice(0, 3)} ${y}`;
}

export function dateLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return `${d} ${(MONTHS[m - 1] ?? "").slice(0, 3)} ${y}`;
}

export const METHOD_LABEL: Record<PaymentMethod, string> = { cash: "Cash", bank_transfer: "Bank transfer", paynow: "PayNow" };
/** For sentences: "paid 4 Jul 2026 in cash". */
export const METHOD_PHRASE: Record<PaymentMethod, string> = { cash: "in cash", bank_transfer: "by bank transfer", paynow: "by PayNow" };

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const REASON_LABELS: Record<DisputeReason, string> = {
  amount_wrong: "The amount is wrong",
  not_paid: "I was not paid",
  paid_late: "I was paid late",
  rest_day_not_given: "I did not get my rest days",
  rest_day_pay_missing: "Rest days I worked were not paid",
  deduction_wrong: "A deduction is wrong",
  other: "Something else",
};

/** The same reasons, neutral, for the employer and for officers reading a packet. */
export const REASON_SUMMARY: Record<DisputeReason, string> = {
  amount_wrong: "Amount is wrong",
  not_paid: "Not paid",
  paid_late: "Paid late",
  rest_day_not_given: "Rest days not given",
  rest_day_pay_missing: "Rest days worked were not paid",
  deduction_wrong: "A deduction is wrong",
  other: "Something else",
};

export type Tone = "signed" | "waiting" | "breach" | "neutral";

export const STATE_STAMP: Record<MonthState, { label: string; tone: Tone }> = {
  acknowledged: { label: "Signed by both", tone: "signed" },
  disputed: { label: "Disputed", tone: "waiting" },
  awaiting_worker: { label: "Awaiting worker", tone: "waiting" },
  missing: { label: "Missing", tone: "breach" },
  due: { label: "Not recorded yet", tone: "neutral" },
};

export const SEVERITY_TONE: Record<FlagSeverity, Tone> = { breach: "breach", warning: "waiting", info: "neutral" };

export function shortHash(hash: string): string {
  return hash.length > 14 ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : hash;
}
