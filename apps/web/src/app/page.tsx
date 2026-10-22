import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Stamp } from "@/components/ui";

const DEMO_PATH = process.env.NEXT_PUBLIC_DEMO_PATH || null;

const STEPS = [
  { who: "Employer", what: "Records the month", detail: "Salary, rest days taken or worked, deductions, date paid. Signs it with a passkey." },
  { who: "Worker", what: "Signs or disputes", detail: "Checks it on their own phone, in plain words. Signs, signs under protest, or says what is wrong." },
  { who: "Chain", what: "Keeps the fingerprint", detail: "Only a hash goes on-chain, so nothing private is public, and nobody can quietly rewrite the month." },
  { who: "Anyone", what: "Verifies the packet", detail: "MOM, an NGO or a lawyer re-hashes the records in their browser and compares them with the chain." },
];

const PROVES = ["Who signed each month, and when", "That nobody changed a record after signing", "Disputes, raised before any claim was filed", "Months with no record after MOM's 7-day deadline"];
const DOES_NOT = ["That a signed record was true: pressure is possible, so workers can sign under protest", "That money moved: Payslip records payment, it does not send it", "Anything to MOM by itself: it is evidence for a claim, not a replacement for one"];

export default function Home() {
  return (
    <div className="mx-auto grid max-w-[1080px] gap-20 px-4 pt-12 pb-10 sm:px-8 sm:pt-20">
      <section className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-6">
          <p className="figures text-[12px] tracking-[0.12em] text-muted uppercase">For migrant domestic workers in Singapore</p>
          <h1 className="font-serif text-[44px] leading-[1.02] font-semibold tracking-[-0.03em] sm:text-[64px]">
            The salary notebook,
            <br />
            made <span className="whitespace-nowrap">tamper-proof.</span>
          </h1>
          <p className="max-w-[34rem] text-[17px] leading-relaxed text-muted">
            MOM already requires both employer and worker to sign each cash salary record. Today that lives in a notebook the employer keeps. Payslip puts it on
            both phones, gives the worker their own copy, and anchors a fingerprint on-chain so it can&apos;t be rewritten later.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/start" className="press inline-flex min-h-12 items-center gap-2 rounded-full bg-accent px-6 text-[15px] font-medium text-accent-ink hover:bg-accent-hover">
              Start as an employer
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href="/verify" className="press inline-flex min-h-12 items-center rounded-full border border-rule-strong bg-sheet px-6 text-[15px] font-medium hover:border-ink/40">
              Verify a packet
            </Link>
            {DEMO_PATH && (
              <Link href={DEMO_PATH} className="press inline-flex min-h-12 items-center rounded-full px-1 text-[15px] font-medium text-accent underline-offset-4 hover:underline sm:px-3">
                See a worker&apos;s demo records
              </Link>
            )}
          </div>
        </div>

        <figure className="relative mx-auto w-full max-w-[380px]" aria-label="An example monthly record">
          <div className="slip absolute inset-x-6 -top-3 h-full rotate-[3deg] opacity-60" aria-hidden />
          <div className="slip relative grid gap-0 overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
              <div>
                <p className="font-serif text-[21px] font-semibold">May 2026</p>
                <p className="text-[13px] text-muted">Tan household · Maria Santos</p>
              </div>
              <Stamp tone="waiting">Disputed</Stamp>
            </div>
            <div className="perforation mx-5" />
            <dl className="figures grid gap-0 px-5 py-3 text-[14px]">
              {[
                ["Monthly salary", "S$650.00"],
                ["Rest days taken", "2 of 4"],
                ["Pay for 2 rest days worked", "+ S$0.00"],
                ["Paid on", "4 Jun 2026"],
              ].map(([k, val]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-rule/70 py-2 last:border-0">
                  <dt className="font-sans text-muted">{k}</dt>
                  <dd>{val}</dd>
                </div>
              ))}
            </dl>
            <div className="grid gap-1.5 px-5 pb-5">
              <p className="w-fit rounded-full bg-breach-soft px-2.5 py-0.5 text-[12.5px] font-medium text-breach">2 rest days worked: at least S$50.00 owed</p>
              <p className="figures text-[11.5px] text-muted">fingerprint 0x9f3a2c…41c21e · anchored</p>
            </div>
          </div>
        </figure>
      </section>

      <section className="grid gap-6" aria-labelledby="how">
        <h2 id="how" className="font-serif text-[30px] font-semibold tracking-[-0.02em]">
          One month, four steps
        </h2>
        <ol className="slip divide-y divide-rule/70">
          {STEPS.map((s, i) => (
            <li key={s.what} className="grid gap-1 px-5 py-4 sm:grid-cols-[3rem_9rem_1fr] sm:items-baseline sm:gap-4">
              <span className="figures text-[13px] text-muted">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-[13px] font-medium tracking-wide text-accent uppercase">{s.who}</span>
              <span>
                <span className="text-[16px] font-medium">{s.what}. </span>
                <span className="text-[15px] text-muted">{s.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-6 md:grid-cols-2" aria-labelledby="honest">
        <div className="grid content-start gap-3">
          <h2 id="honest" className="font-serif text-[30px] font-semibold tracking-[-0.02em]">
            What the record proves
          </h2>
          <ul className="grid gap-2 text-[15px]">
            {PROVES.map((p) => (
              <li key={p} className="flex gap-2.5">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-signed" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="grid content-start gap-3">
          <h2 className="font-serif text-[30px] font-semibold tracking-[-0.02em]">And what it doesn&apos;t</h2>
          <ul className="grid gap-2 text-[15px] text-muted">
            {DOES_NOT.map((p) => (
              <li key={p} className="flex gap-2.5">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-rule-strong" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
