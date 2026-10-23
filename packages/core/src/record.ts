import type { Hex } from "viem";
import { z } from "zod";
import { hashCanonical } from "./canonical";
import { isIsoDate, isPeriod, periodStart, type IsoDate, type Period } from "./period";
import { publicKeyRefSchema, relyingPartySchema } from "./webauthn";

export const EMPLOYMENT_HASH_DOMAIN = "payslip.employment.v1";
export const RECORD_HASH_DOMAIN = "payslip.record.v1";
export const DECISION_HASH_DOMAIN = "payslip.decision.v1";

/** MOM: one day's salary, for pay in lieu of a rest day, is the monthly salary divided by 26. */
export const WORKING_DAYS_PER_MONTH = 26;

const hex32 = z.string().regex(/^0x[0-9a-f]{64}$/, "32-byte lowercase hex") as unknown as z.ZodType<Hex>;
const period = z.string().refine(isPeriod, "YYYY-MM") as unknown as z.ZodType<Period>;
const isoDate = z.string().refine(isIsoDate, "YYYY-MM-DD") as unknown as z.ZodType<IsoDate>;
/** Money is integer cents. Floats never appear in anything that gets hashed. */
const cents = z.number().int().nonnegative().max(100_000_000);
const shortText = z.string().min(1).max(60).refine((v) => v === v.trim(), "Remove spaces at the start or end");

const partySchema = z.object({ displayName: shortText, key: publicKeyRefSchema });

/**
 * The agreement both parties register once. Its hash and both key hashes are anchored when it opens,
 * which is what lets anyone later check that a signature came from this worker or this employer.
 */
export const employmentSchema = z.object({
  version: z.literal(1),
  employmentId: hex32,
  rp: relyingPartySchema,
  currency: z.literal("SGD"),
  /** The monthly salary declared to MOM. Paying less is a breach of the Work Permit conditions. */
  declaredMonthlySalaryCents: cents.min(1),
  /** The agreed weekly rest day, 0 = Sunday. */
  restDayWeekday: z.number().int().min(0).max(6),
  startPeriod: period,
  worker: partySchema,
  employer: partySchema,
  salt: hex32,
});
export type Employment = z.infer<typeof employmentSchema>;

export const PAYMENT_METHODS = ["cash", "bank_transfer", "paynow"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
/** Methods that leave a trail at the bank, which a transfer reference points to. */
export const TRACEABLE_METHODS: readonly PaymentMethod[] = ["bank_transfer", "paynow"];

/**
 * The bank's or PayNow's own reference for the transfer, as shown in the banking app. Hashing it into the
 * record ties the signed month to the bank's trail without Payslip ever touching the money. Optional, and
 * absent from older records, so their fingerprints are unchanged.
 */
export const paymentReferenceSchema = z
  .string()
  // Never transform a hashed field: what the browser signed must be exactly what is stored and re-hashed.
  .refine((v) => v === v.trim(), "Remove spaces at the start or end")
  .min(4, "A transfer reference has at least 4 characters")
  .max(64)
  .regex(/^[A-Za-z0-9 ._/:#-]+$/, "Use the reference exactly as your bank shows it: letters, numbers and - . / : #");

/** One month's salary record, proposed and signed by the employer. */
export const salaryRecordSchema = z
  .object({
    version: z.literal(1),
    employmentId: hex32,
    period,
    monthlySalaryCents: cents.min(1),
    /** Weekly rest days that fell in this month (4 or 5). */
    restDaysInMonth: z.number().int().min(0).max(6),
    restDaysTaken: z.number().int().min(0).max(6),
    /** Rest days the worker agreed to work instead, each owed one day's salary on top. */
    restDaysWorked: z.number().int().min(0).max(6),
    restDayPayCents: cents,
    deductions: z.array(z.object({ label: shortText, cents: cents.min(1) })).max(10),
    amountPaidCents: cents,
    paidOn: isoDate,
    method: z.enum(PAYMENT_METHODS),
    paymentReference: paymentReferenceSchema.optional(),
    salt: hex32,
  })
  .superRefine((record, ctx) => {
    if (record.restDaysTaken + record.restDaysWorked !== record.restDaysInMonth) {
      ctx.addIssue({ code: "custom", path: ["restDaysTaken"], message: "Rest days taken and worked must add up to the rest days in the month" });
    }
    if (record.paymentReference !== undefined && !TRACEABLE_METHODS.includes(record.method)) {
      ctx.addIssue({ code: "custom", path: ["paymentReference"], message: "Only bank transfers and PayNow have a transfer reference" });
    }
    if (record.paidOn < periodStart(record.period)) {
      ctx.addIssue({ code: "custom", path: ["paidOn"], message: "Payment date is before the salary period starts" });
    }
  });
export type SalaryRecord = z.infer<typeof salaryRecordSchema>;

export const DISPUTE_REASONS = [
  "amount_wrong",
  "not_paid",
  "paid_late",
  "rest_day_not_given",
  "rest_day_pay_missing",
  "deduction_wrong",
  "other",
] as const;
export type DisputeReason = (typeof DISPUTE_REASONS)[number];

/** The worker's answer to a record. Signed by the worker's own key, over its own hash. */
export const decisionSchema = z
  .object({
    version: z.literal(1),
    recordHash: hex32,
    decision: z.enum(["acknowledge", "dispute"]),
    reasons: z.array(z.enum(DISPUTE_REASONS)).max(DISPUTE_REASONS.length),
    /** Acknowledged, but the worker records that they did so under pressure. */
    underProtest: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if (d.decision === "dispute" && d.reasons.length === 0) ctx.addIssue({ code: "custom", path: ["reasons"], message: "A dispute needs at least one reason" });
    if (d.decision === "acknowledge" && d.reasons.length > 0) ctx.addIssue({ code: "custom", path: ["reasons"], message: "Reasons only apply to disputes" });
    if (d.decision === "dispute" && d.underProtest) ctx.addIssue({ code: "custom", path: ["underProtest"], message: "Under protest only applies to acknowledgements" });
    if (new Set(d.reasons).size !== d.reasons.length) ctx.addIssue({ code: "custom", path: ["reasons"], message: "Duplicate reason" });
  });
export type Decision = z.infer<typeof decisionSchema>;

export function hashEmployment(employment: Employment): Hex {
  return hashCanonical(EMPLOYMENT_HASH_DOMAIN, employment);
}

export function hashRecord(record: SalaryRecord): Hex {
  return hashCanonical(RECORD_HASH_DOMAIN, record);
}

export function hashDecision(decision: Decision): Hex {
  return hashCanonical(DECISION_HASH_DOMAIN, decision);
}

export function restDayPayDue(monthlySalaryCents: number, restDaysWorked: number): number {
  return Math.round((monthlySalaryCents * restDaysWorked) / WORKING_DAYS_PER_MONTH);
}

export function totalDeductions(record: Pick<SalaryRecord, "deductions">): number {
  return record.deductions.reduce((sum, d) => sum + d.cents, 0);
}

/** What the record itself says should have been paid: salary plus rest-day pay, minus deductions. */
export function expectedPayment(record: Pick<SalaryRecord, "monthlySalaryCents" | "restDayPayCents" | "deductions">): number {
  return record.monthlySalaryCents + record.restDayPayCents - totalDeductions(record);
}
