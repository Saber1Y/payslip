import { describe, expect, it } from "vitest";
import { monthFlags, worstSeverity } from "./flags";
import { decisionSchema, expectedPayment, hashRecord, restDayPayDue, salaryRecordSchema } from "./record";
import { makeRecord } from "./test-fixtures";

const employment = { declaredMonthlySalaryCents: 65_000 };
const ack = { version: 1 as const, recordHash: `0x${"aa".repeat(32)}` as const, decision: "acknowledge" as const, reasons: [], underProtest: false };
const codes = (flags: { code: string }[]) => flags.map((f) => f.code);

describe("MOM rules", () => {
  it("matches MOM's worked example: $650 salary, 2 rest days worked, $50 owed", () => {
    expect(restDayPayDue(65_000, 2)).toBe(5_000);
    expect(restDayPayDue(65_000, 4)).toBe(10_000);
    expect(expectedPayment(makeRecord("2026-04", { restDaysTaken: 2, restDaysWorked: 2, restDayPayCents: 5_000 }))).toBe(70_000);
  });

  it("raises nothing for a clean, acknowledged month", () => {
    expect(monthFlags(employment, { period: "2026-04", record: makeRecord("2026-04"), decision: ack }, "2026-06-01")).toEqual([]);
  });

  it("flags a missing record only after the deadline", () => {
    expect(monthFlags(employment, { period: "2026-04", record: null, decision: null }, "2026-05-07")).toEqual([]);
    expect(codes(monthFlags(employment, { period: "2026-04", record: null, decision: null }, "2026-05-08"))).toEqual(["MISSING"]);
  });

  it("flags late payment, a month with no rest day, and short rest-day pay", () => {
    const record = makeRecord("2026-04", { paidOn: "2026-05-08", restDaysTaken: 0, restDaysWorked: 4, restDayPayCents: 0, amountPaidCents: 65_000 });
    expect(codes(monthFlags(employment, { period: "2026-04", record, decision: ack }, "2026-06-01"))).toEqual([
      "PAID_LATE",
      "NO_REST_DAY",
      "REST_DAY_PAY_SHORT",
    ]);
  });

  it("flags underpayment against the record's own arithmetic and the declared salary", () => {
    const record = makeRecord("2026-04", { monthlySalaryCents: 60_000, amountPaidCents: 55_000, deductions: [{ label: "Broken vase", cents: 1_000 }] });
    const flags = monthFlags(employment, { period: "2026-04", record, decision: null }, "2026-06-01");
    expect(codes(flags)).toEqual(["AWAITING_WORKER", "UNDERPAID", "BELOW_DECLARED_SALARY", "DEDUCTIONS"]);
    expect(worstSeverity(flags)).toBe("breach");
  });

  it("surfaces disputes and acknowledgements made under protest", () => {
    const record = makeRecord("2026-04");
    const dispute = { ...ack, decision: "dispute" as const, reasons: ["rest_day_not_given" as const] };
    expect(codes(monthFlags(employment, { period: "2026-04", record, decision: dispute }, "2026-06-01"))).toEqual(["DISPUTED"]);
    expect(codes(monthFlags(employment, { period: "2026-04", record, decision: { ...ack, underProtest: true } }, "2026-06-01"))).toEqual(["UNDER_PROTEST"]);
  });
});

describe("record validation", () => {
  it("requires rest days to add up and payment not to predate the period", () => {
    expect(salaryRecordSchema.safeParse(makeRecord("2026-04", { restDaysTaken: 3 })).success).toBe(false);
    expect(salaryRecordSchema.safeParse(makeRecord("2026-04", { paidOn: "2026-03-31" })).success).toBe(false);
    expect(salaryRecordSchema.safeParse(makeRecord("2026-04", { monthlySalaryCents: 650.5 })).success).toBe(false);
  });

  it("keeps decisions internally consistent", () => {
    expect(decisionSchema.safeParse({ ...ack, decision: "dispute" }).success).toBe(false);
    expect(decisionSchema.safeParse({ ...ack, reasons: ["other"] }).success).toBe(false);
    expect(decisionSchema.safeParse({ ...ack, decision: "dispute", reasons: ["other"], underProtest: true }).success).toBe(false);
  });

  it("changes the fingerprint when any field changes", () => {
    const base = makeRecord("2026-04");
    expect(hashRecord(base)).toBe(hashRecord({ ...base }));
    expect(hashRecord({ ...base, amountPaidCents: 65_001 })).not.toBe(hashRecord(base));
    expect(hashRecord({ ...base, salt: `0x${"44".repeat(32)}` })).not.toBe(hashRecord(base));
  });
});
