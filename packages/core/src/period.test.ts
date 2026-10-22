import { describe, expect, it } from "vitest";
import { addDays, isIsoDate, nextPeriod, paymentDeadline, periodEnd, periodToNumber, periodsBetween, todayInSingapore, weekdaysInPeriod } from "./period";

describe("periods", () => {
  it("gives the MOM deadline, 7 days after the last day of the month", () => {
    expect(paymentDeadline("2026-04")).toBe("2026-05-07");
    expect(paymentDeadline("2026-12")).toBe("2027-01-07");
    expect(periodEnd("2028-02")).toBe("2028-02-29");
    expect(periodEnd("2026-02")).toBe("2026-02-28");
  });

  it("walks periods across a year boundary", () => {
    expect(nextPeriod("2026-12")).toBe("2027-01");
    expect(periodsBetween("2026-11", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(periodsBetween("2026-05", "2026-04")).toEqual([]);
    expect(periodToNumber("2026-04")).toBe(202604);
  });

  it("validates calendar dates strictly", () => {
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2026-4-01")).toBe(false);
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("uses the Singapore calendar day", () => {
    expect(todayInSingapore(new Date("2026-05-07T15:59:59Z"))).toBe("2026-05-07");
    expect(todayInSingapore(new Date("2026-05-07T16:00:00Z"))).toBe("2026-05-08");
  });

  it("counts weekly rest days in a month", () => {
    // April 2026 starts on a Wednesday: four Sundays, five Thursdays.
    expect(weekdaysInPeriod("2026-04", 0)).toBe(4);
    expect(weekdaysInPeriod("2026-04", 4)).toBe(5);
  });
});
