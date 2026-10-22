import { PayslipError } from "./errors";

/** A salary period is one calendar month, written "YYYY-MM". MOM caps a salary period at one month. */
export type Period = `${number}-${number}`;
/** A calendar date, "YYYY-MM-DD". Dates are compared as Singapore calendar days, never as instants. */
export type IsoDate = `${number}-${number}-${number}`;

const PERIOD_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** MOM: salary must be paid no later than 7 days after the last day of the salary period. */
export const PAYMENT_GRACE_DAYS = 7;
/** Singapore has no daylight saving time, so a fixed offset is exact. */
const SINGAPORE_OFFSET_MS = 8 * 60 * 60 * 1000;

export function isPeriod(value: string): value is Period {
  return PERIOD_RE.test(value);
}

export function isIsoDate(value: string): value is IsoDate {
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function parsePeriod(period: string): { year: number; month: number } {
  const match = PERIOD_RE.exec(period);
  if (!match) throw new PayslipError("INVALID_PERIOD", `Invalid period: ${period}`, "period");
  return { year: Number(match[1]), month: Number(match[2]) };
}

function toIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10) as IsoDate;
}

function parseDate(date: string): Date {
  if (!isIsoDate(date)) throw new PayslipError("INVALID_DATE", `Invalid date: ${date}`, "date");
  return new Date(`${date}T00:00:00Z`);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = parseDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toIsoDate(d);
}

export function periodStart(period: Period): IsoDate {
  const { year, month } = parsePeriod(period);
  return toIsoDate(new Date(Date.UTC(year, month - 1, 1)));
}

export function periodEnd(period: Period): IsoDate {
  const { year, month } = parsePeriod(period);
  return toIsoDate(new Date(Date.UTC(year, month, 0)));
}

/** The last day salary for `period` can be paid on time. */
export function paymentDeadline(period: Period): IsoDate {
  return addDays(periodEnd(period), PAYMENT_GRACE_DAYS);
}

export function periodOf(date: IsoDate): Period {
  parseDate(date);
  return date.slice(0, 7) as Period;
}

export function nextPeriod(period: Period): Period {
  const { year, month } = parsePeriod(period);
  return month === 12 ? (`${year + 1}-01` as Period) : (`${year}-${String(month + 1).padStart(2, "0")}` as Period);
}

/** Every period from `first` to `last`, both inclusive; empty when `last` is before `first`. */
export function periodsBetween(first: Period, last: Period): Period[] {
  parsePeriod(first);
  parsePeriod(last);
  const out: Period[] = [];
  for (let p = first; p <= last; p = nextPeriod(p)) out.push(p);
  return out;
}

/** YYYYMM as an integer, the form the registry contract stores. */
export function periodToNumber(period: Period): number {
  const { year, month } = parsePeriod(period);
  return year * 100 + month;
}

export function todayInSingapore(now: Date): IsoDate {
  return toIsoDate(new Date(now.getTime() + SINGAPORE_OFFSET_MS));
}

/** Singapore days in a month that fall on `weekday` (0 = Sunday). Used to count weekly rest days. */
export function weekdaysInPeriod(period: Period, weekday: number): number {
  const { year, month } = parsePeriod(period);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let count = 0;
  for (let d = 1; d <= days; d++) if (new Date(Date.UTC(year, month - 1, d)).getUTCDay() === weekday) count++;
  return count;
}
