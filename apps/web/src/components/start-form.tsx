"use client";

import { ArrowRight, Fingerprint, WhatsappLogo } from "@phosphor-icons/react";
import { periodOf, todayInSingapore } from "@payslip/core";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { parseSgd, WEEKDAYS } from "@/lib/format";
import { createPasskey, PasskeyError } from "@/lib/passkey";
import type { CreatedEmployment } from "@/lib/views";
import { Button, CopyButton, Field, inputClass, Notice } from "./ui";

const RP_ID = process.env.NEXT_PUBLIC_RP_ID ?? "localhost";

export function StartForm() {
  const thisMonth = periodOf(todayInSingapore(new Date()));
  const [employerName, setEmployerName] = useState("");
  const [workerName, setWorkerName] = useState("");
  const [salary, setSalary] = useState("");
  const [restDay, setRestDay] = useState(0);
  const [startPeriod, setStartPeriod] = useState<string>(thisMonth);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CreatedEmployment | null>(null);
  function edit(field: string, set: (v: string) => void, value: string) {
    set(value);
    setErrors((all) => (all[field] ? { ...all, [field]: "" } : all));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    const next: Record<string, string> = {};
    if (!employerName.trim()) next.employerName = "Enter your name or household name";
    if (!workerName.trim()) next.workerName = "Enter the worker's name";
    const cents = parseSgd(salary);
    if (cents === null || cents < 100) next.salary = "Enter the monthly salary, for example 650";
    if (!/^\d{4}-\d{2}$/.test(startPeriod) || startPeriod > thisMonth) next.startPeriod = "Pick this month or an earlier one";
    setErrors(next);
    if (Object.keys(next).length > 0 || cents === null) return;

    setBusy(true);
    try {
      const employerKey = await createPasskey(RP_ID, `${employerName.trim()} (employer)`);
      const result = await api<CreatedEmployment>("/api/employments", {
          method: "POST",
          body: { employerName, workerName, declaredSalaryCents: cents, restDayWeekday: restDay, startPeriod, employerKey },
        });
      setCreated(result);
      window.scrollTo({ top: 0 });
    } catch (error) {
      setFailure(error instanceof PasskeyError || error instanceof ApiError ? error.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    const message = `Hi ${workerName.trim()}, I've set up Payslip for your salary records. Open this link on your phone and create your passkey: ${created.inviteUrl}`;
    return (
      <div className="enter grid gap-5">
        <Notice tone="signed" title="Your passkey is set up">
          Two links were created. Keep yours private, and send the other one to {workerName.trim()}.
        </Notice>
        <section className="slip grid gap-3 p-5">
          <h2 className="font-serif text-lg font-semibold">1. Send this invite to {workerName.trim()}</h2>
          <p className="text-[14px] text-muted">They open it on their own phone and create their own passkey. Records start once they join.</p>
          <p className="figures rounded-lg bg-sheet-2 px-3 py-2 text-[12.5px] break-all">{created.inviteUrl}</p>
          <div className="flex flex-wrap gap-2">
            <CopyButton value={created.inviteUrl} label="Copy invite" />
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noreferrer"
              className="press inline-flex min-h-9 items-center gap-1.5 rounded-full border border-rule-strong bg-sheet px-3 text-[13px] font-medium hover:border-ink/40"
            >
              <WhatsappLogo className="size-3.5" aria-hidden />
              Send on WhatsApp
            </a>
          </div>
        </section>
        <section className="slip grid gap-3 p-5">
          <h2 className="font-serif text-lg font-semibold">2. Save your own link</h2>
          <p className="text-[14px] text-muted">This is how you get back to your records. Bookmark it. Anyone with it can view, but only your passkey can sign.</p>
          <p className="figures rounded-lg bg-sheet-2 px-3 py-2 text-[12.5px] break-all">{created.employerUrl}</p>
          <div className="flex flex-wrap gap-2">
            <CopyButton value={created.employerUrl} label="Copy my link" />
          </div>
        </section>
        <Link
          href={new URL(created.employerUrl).pathname}
          className="press inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-accent px-5 text-[15px] font-medium text-accent-ink hover:bg-accent-hover"
        >
          Go to my records
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="slip grid gap-5 p-5 sm:p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name or household" htmlFor="employerName" error={errors.employerName}>
          <input id="employerName" className={inputClass} value={employerName} onChange={(e) => edit("employerName", setEmployerName, e.target.value)} placeholder="Tan household" maxLength={60} aria-invalid={!!errors.employerName} />
        </Field>
        <Field label="Worker's name" htmlFor="workerName" error={errors.workerName}>
          <input id="workerName" className={inputClass} value={workerName} onChange={(e) => edit("workerName", setWorkerName, e.target.value)} placeholder="Maria Santos" maxLength={60} aria-invalid={!!errors.workerName} />
        </Field>
        <Field label="Monthly salary declared to MOM" htmlFor="salary" error={errors.salary} hint="In Singapore dollars, before rest-day pay">
          <div className="relative">
            <span className="figures pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">S$</span>
            <input id="salary" inputMode="decimal" className={`${inputClass} figures pl-10`} value={salary} onChange={(e) => edit("salary", setSalary, e.target.value)} placeholder="650" aria-invalid={!!errors.salary} />
          </div>
        </Field>
        <Field label="Weekly rest day" htmlFor="restDay" hint="The day you both agreed on">
          <select id="restDay" className={inputClass} value={restDay} onChange={(e) => setRestDay(Number(e.target.value))}>
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </Field>
        <Field label="First month to record" htmlFor="startPeriod" error={errors.startPeriod} hint="You can start from a past month">
          <input id="startPeriod" type="month" className={`${inputClass} figures`} value={startPeriod} max={thisMonth} onChange={(e) => edit("startPeriod", setStartPeriod, e.target.value)} aria-invalid={!!errors.startPeriod} />
        </Field>
      </div>
      <div className="perforation" />
      {failure && <Notice tone="breach" title="Couldn't finish setup">{failure}</Notice>}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-md text-[13.5px] text-muted">
          Next, your phone or computer asks you to create a passkey with your fingerprint, face or screen lock. It signs every record you make. There is no
          password and no crypto wallet.
        </p>
        <Button type="submit" busy={busy} icon={<Fingerprint className="size-4" aria-hidden />}>
          Create passkey and continue
        </Button>
      </div>
    </form>
  );
}
