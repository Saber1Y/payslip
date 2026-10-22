import { paymentDeadline, type IsoDate, type Period } from "./period";
import { expectedPayment, restDayPayDue, totalDeductions, type Decision, type Employment, type SalaryRecord } from "./record";

/**
 * Checks a month against the MOM rules Payslip can see from the record itself. A flag is a prompt to
 * look closer, not a legal finding: for example the mandatory rest day may legitimately be deferred.
 */
export type FlagCode =
  | "MISSING"
  | "AWAITING_WORKER"
  | "DISPUTED"
  | "UNDER_PROTEST"
  | "PAID_LATE"
  | "NO_REST_DAY"
  | "REST_DAY_PAY_SHORT"
  | "UNDERPAID"
  | "BELOW_DECLARED_SALARY"
  | "DEDUCTIONS";

/** breach: the record shows a likely rule breach. warning: the parties disagree. info: worth noting. */
export type FlagSeverity = "breach" | "warning" | "info";

export interface Flag {
  code: FlagCode;
  severity: FlagSeverity;
  message: string;
}

export interface MonthState {
  period: Period;
  record: SalaryRecord | null;
  decision: Decision | null;
}

const sgd = (c: number) => `$${(c / 100).toFixed(2)}`;

export function monthFlags(employment: Pick<Employment, "declaredMonthlySalaryCents">, month: MonthState, today: IsoDate): Flag[] {
  const deadline = paymentDeadline(month.period);
  const { record, decision } = month;
  if (!record) {
    return today > deadline ? [{ code: "MISSING", severity: "breach", message: `No salary record by the ${deadline} deadline` }] : [];
  }

  const flags: Flag[] = [];
  if (!decision) flags.push({ code: "AWAITING_WORKER", severity: "info", message: "The worker has not signed or disputed this record yet" });
  if (decision?.decision === "dispute") flags.push({ code: "DISPUTED", severity: "warning", message: "The worker disputed this record" });
  if (decision?.underProtest) flags.push({ code: "UNDER_PROTEST", severity: "warning", message: "The worker signed under protest" });

  if (record.paidOn > deadline) flags.push({ code: "PAID_LATE", severity: "breach", message: `Paid ${record.paidOn}, after the ${deadline} deadline` });
  if (record.restDaysInMonth > 0 && record.restDaysTaken === 0) {
    flags.push({ code: "NO_REST_DAY", severity: "breach", message: "No rest day this month. At least one cannot be compensated away, unless it was deferred" });
  }
  const due = restDayPayDue(record.monthlySalaryCents, record.restDaysWorked);
  if (record.restDayPayCents < due) {
    flags.push({
      code: "REST_DAY_PAY_SHORT",
      severity: "breach",
      message: `${record.restDaysWorked} rest day(s) worked: at least ${sgd(due)} owed, ${sgd(record.restDayPayCents)} recorded`,
    });
  }
  const expected = expectedPayment(record);
  if (record.amountPaidCents < expected) {
    flags.push({ code: "UNDERPAID", severity: "breach", message: `Paid ${sgd(record.amountPaidCents)}, but the record adds up to ${sgd(expected)}` });
  }
  if (record.monthlySalaryCents < employment.declaredMonthlySalaryCents) {
    flags.push({
      code: "BELOW_DECLARED_SALARY",
      severity: "breach",
      message: `Salary ${sgd(record.monthlySalaryCents)} is below the ${sgd(employment.declaredMonthlySalaryCents)} declared to MOM`,
    });
  }
  const deducted = totalDeductions(record);
  if (deducted > 0) flags.push({ code: "DEDUCTIONS", severity: "info", message: `${sgd(deducted)} deducted: ${record.deductions.map((d) => d.label).join(", ")}` });
  return flags;
}

const SEVERITY_RANK: Record<FlagSeverity, number> = { breach: 2, warning: 1, info: 0 };

export function worstSeverity(flags: readonly Flag[]): FlagSeverity | null {
  let worst: FlagSeverity | null = null;
  for (const f of flags) if (worst === null || SEVERITY_RANK[f.severity] > SEVERITY_RANK[worst]) worst = f.severity;
  return worst;
}
