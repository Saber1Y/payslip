"use client";

import { expectedPayment, hashRecord, monthFlags, randomSalt, restDayPayDue, salaryRecordSchema, todayInSingapore, weekdaysInPeriod, type IsoDate, type SalaryRecord } from "@payslip/core";
import { Fingerprint, Plus, Trash } from "@phosphor-icons/react";
import { useMemo, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { centsToInput, dateLabel, parseSgd, periodLabel, SEVERITY_TONE, sgd, WEEKDAYS } from "@/lib/format";
import { PasskeyError, signWithPasskey } from "@/lib/passkey";
import type { EmploymentSummary, MonthView, PartyView } from "@/lib/views";
import { Button, Field, inputClass, Notice, Pill, SlipRow } from "./ui";

interface Deduction {
  label: string;
  amount: string;
}

/** The employer's monthly record. Totals follow the inputs until the employer overrides them. */
export function RecordForm({ token, employment, month, onSaved, onCancel }: { token: string; employment: EmploymentSummary; month: MonthView; onSaved: (view: PartyView) => void; onCancel: () => void }) {
  const today = todayInSingapore(new Date());
  const defaultRestDays = weekdaysInPeriod(month.period, employment.restDayWeekday);
  const [salary, setSalary] = useState(centsToInput(employment.declaredSalaryCents));
  const [restDaysInMonth, setRestDaysInMonth] = useState(defaultRestDays);
  const [restDaysWorked, setRestDaysWorked] = useState(0);
  const [restDayPay, setRestDayPay] = useState<string | null>(null);
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [amountPaid, setAmountPaid] = useState<string | null>(null);
  const [paidOn, setPaidOn] = useState<string>(today < month.deadline ? today : month.deadline);
  const [method, setMethod] = useState<SalaryRecord["method"]>("cash");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const salaryCents = parseSgd(salary);
  const dueRestDayPay = salaryCents === null ? 0 : restDayPayDue(salaryCents, restDaysWorked);
  const restDayPayCents = restDayPay === null ? dueRestDayPay : parseSgd(restDayPay);
  const deductionCents = deductions.map((d) => parseSgd(d.amount));
  const expected = salaryCents === null || restDayPayCents === null ? null : expectedPayment({ monthlySalaryCents: salaryCents, restDayPayCents, deductions: deductions.map((d, i) => ({ label: d.label, cents: deductionCents[i] ?? 0 })) });
  const amountPaidCents = amountPaid === null ? expected : parseSgd(amountPaid);

  const draft = useMemo((): SalaryRecord | null => {
    if (salaryCents === null || restDayPayCents === null || amountPaidCents === null || deductionCents.some((c) => c === null)) return null;
    const parsed = salaryRecordSchema.safeParse({
      version: 1,
      employmentId: employment.id,
      period: month.period,
      monthlySalaryCents: salaryCents,
      restDaysInMonth,
      restDaysTaken: restDaysInMonth - restDaysWorked,
      restDaysWorked,
      restDayPayCents,
      deductions: deductions.map((d, i) => ({ label: d.label.trim(), cents: deductionCents[i] ?? 0 })),
      amountPaidCents,
      paidOn,
      method,
      salt: `0x${"00".repeat(32)}`,
    });
    return parsed.success ? parsed.data : null;
  }, [salaryCents, restDayPayCents, amountPaidCents, deductionCents, employment.id, month.period, restDaysInMonth, restDaysWorked, deductions, paidOn, method]);

  const flags = draft ? monthFlags({ declaredMonthlySalaryCents: employment.declaredSalaryCents }, { period: month.period, record: draft, decision: null }, today).filter((f) => f.code !== "AWAITING_WORKER") : [];
  const breaches = flags.filter((f) => f.severity === "breach");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (salaryCents === null) return setError("Enter the monthly salary, for example 650");
    if (deductions.some((d, i) => !d.label.trim() || !deductionCents[i])) return setError("Each deduction needs a reason and an amount");
    if (paidOn > today) return setError("The payment date can't be in the future");
    if (!draft) return setError("Check the amounts: they must be plain numbers like 650 or 650.50");

    const record: SalaryRecord = { ...draft, salt: randomSalt() };
    setBusy(true);
    try {
      const employerSignature = await signWithPasskey(employment.rp.id, employment.employerCredentialId, hashRecord(record));
      onSaved(await api<PartyView>(`/api/e/${token}/records`, { method: "POST", body: { record, employerSignature } }));
    } catch (err) {
      setError(err instanceof PasskeyError || err instanceof ApiError ? err.message : "Couldn't save the record. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const id = (name: string) => `${month.period}-${name}`;
  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Monthly salary" htmlFor={id("salary")}>
          <MoneyInput id={id("salary")} value={salary} onChange={setSalary} />
        </Field>
        <Field label="Paid on" htmlFor={id("paidOn")} hint={`Due by ${dateLabel(month.deadline)}`}>
          <input id={id("paidOn")} type="date" className={`${inputClass} figures`} value={paidOn} max={today} onChange={(e) => setPaidOn(e.target.value as IsoDate)} />
        </Field>
        <Field label={`${WEEKDAYS[employment.restDayWeekday]}s in ${periodLabel(month.period, "short")}`} htmlFor={id("restDays")} hint="Weekly rest days this month">
          <select id={id("restDays")} className={inputClass} value={restDaysInMonth} onChange={(e) => {
            const n = Number(e.target.value);
            setRestDaysInMonth(n);
            setRestDaysWorked((w) => Math.min(w, n));
          }}>
            {[0, 1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Rest days worked instead" htmlFor={id("worked")} hint="Only if the worker agreed. At least one rest day a month cannot be worked.">
          <select id={id("worked")} className={inputClass} value={restDaysWorked} onChange={(e) => setRestDaysWorked(Number(e.target.value))}>
            {Array.from({ length: restDaysInMonth + 1 }, (_, n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        {restDaysWorked > 0 && (
          <Field label="Pay for rest days worked" htmlFor={id("restPay")} hint={`MOM minimum: ${sgd(dueRestDayPay)} (salary ÷ 26 per day)`}>
            <MoneyInput id={id("restPay")} value={restDayPay ?? centsToInput(dueRestDayPay)} onChange={setRestDayPay} />
          </Field>
        )}
        <fieldset className="grid content-start gap-1.5">
          <legend className="mb-1.5 text-[14px] font-medium">Payment method</legend>
          <div className="flex gap-2">
            {(["cash", "bank_transfer"] as const).map((m) => (
              <label key={m} className={`press flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-[10px] border text-[14.5px] ${method === m ? "border-accent bg-accent-soft text-accent" : "border-rule-strong bg-sheet"}`}>
                <input type="radio" name={id("method")} value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only" />
                {m === "cash" ? "Cash" : "Bank transfer"}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="grid gap-2">
        <p className="text-[14px] font-medium">Deductions</p>
        {deductions.map((d, i) => (
          <div key={i} className="flex gap-2">
            <input aria-label="Reason for deduction" className={inputClass} value={d.label} maxLength={60} placeholder="Reason" onChange={(e) => setDeductions((all) => all.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <div className="w-36 shrink-0">
              <MoneyInput id={id(`ded-${i}`)} label="Deduction amount" value={d.amount} onChange={(v) => setDeductions((all) => all.map((x, j) => (j === i ? { ...x, amount: v } : x)))} />
            </div>
            <Button type="button" variant="ghost" className="px-3" aria-label="Remove deduction" onClick={() => setDeductions((all) => all.filter((_, j) => j !== i))}>
              <Trash className="size-4" aria-hidden />
            </Button>
          </div>
        ))}
        <Button type="button" variant="ghost" className="w-fit px-3" icon={<Plus className="size-4" aria-hidden />} disabled={deductions.length >= 10} onClick={() => setDeductions((all) => [...all, { label: "", amount: "" }])}>
          Add a deduction
        </Button>
      </div>

      <div className="rounded-xl border border-rule bg-sheet-2 px-4 py-2">
        <SlipRow label="The record adds up to" value={expected === null ? "-" : sgd(expected)} />
        <div className="flex items-center justify-between gap-4 py-2">
          <label htmlFor={id("paid")} className="text-[16px] font-semibold">
            Amount actually paid
          </label>
          <div className="w-40">
            <MoneyInput id={id("paid")} value={amountPaid ?? (expected === null ? "" : centsToInput(expected))} onChange={setAmountPaid} />
          </div>
        </div>
      </div>

      {flags.length > 0 && (
        <div className="grid gap-2">
          {breaches.length > 0 && <p className="text-[14px] text-breach">These look like MOM rule problems. You can still record what really happened. The worker will see the same checks.</p>}
          <ul className="grid gap-1.5">
            {flags.map((f) => (
              <li key={f.code}>
                <Pill tone={SEVERITY_TONE[f.severity]}>{f.message}</Pill>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <Notice tone="breach" title="Not saved">{error}</Notice>}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" busy={busy} icon={<Fingerprint className="size-4" aria-hidden />}>
          Sign and send to {employment.workerName.split(" ")[0]}
        </Button>
      </div>
    </form>
  );
}

function MoneyInput({ id, value, onChange, label }: { id: string; value: string; onChange: (v: string) => void; label?: string }) {
  const invalid = value.trim() !== "" && parseSgd(value) === null;
  return (
    <div className="relative">
      <span className="figures pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[14px] text-muted">S$</span>
      <input id={id} aria-label={label} inputMode="decimal" className={`${inputClass} figures pl-9`} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid} />
    </div>
  );
}
