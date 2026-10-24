"use client";

import { PencilSimpleLine, WhatsappLogo } from "@phosphor-icons/react";
import { useState } from "react";
import { MonthSlip } from "./month-slip";
import { PartyHeader } from "./party-header";
import { RecordForm } from "./record-form";
import { Button, CopyButton, Notice, Spinner } from "./ui";
import { usePartyView } from "./use-party-view";
import { LinkProblem } from "./link-problem";

export function EmployerWorkspace({ token }: { token: string }) {
  const { view, error, setView } = usePartyView("e", token);
  const [editing, setEditing] = useState<string | null>(null);

  if (error) return <LinkProblem status={error.status} message={error.message} />;
  if (!view) return <Spinner label="Loading your records" />;
  const { employment } = view;
  const firstName = employment.workerName.split(" ")[0] ?? employment.workerName;

  return (
    <div className="grid gap-6">
      <PartyHeader view={view} token={token} onView={setView} title={`Salary records for ${employment.workerName}`} />

      {employment.status === "awaiting_worker" && view.inviteUrl && (
        <section className="slip grid gap-3 p-5">
          <h2 className="font-serif text-lg font-semibold">Waiting for {firstName} to join</h2>
          <p className="text-[14px] text-muted">Send this link to {firstName}. They create their own passkey on their own phone, then you can record months.</p>
          <p className="figures rounded-lg bg-sheet-2 px-3 py-2 text-[12.5px] break-all">{view.inviteUrl}</p>
          <div className="flex flex-wrap gap-2">
            <CopyButton value={view.inviteUrl} label="Copy invite" />
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Hi ${firstName}, open this link on your phone to set up Payslip for your salary records: ${view.inviteUrl}`)}`}
              target="_blank"
              rel="noreferrer"
              className="press inline-flex min-h-9 items-center gap-1.5 rounded-full border border-rule-strong bg-sheet px-3 text-[13px] font-medium hover:border-ink/40"
            >
              <WhatsappLogo className="size-3.5" aria-hidden />
              Send on WhatsApp
            </a>
          </div>
        </section>
      )}

      {employment.status === "open" && (
        <div className="grid gap-4">
          <h2 className="sr-only">Months</h2>
          {view.months.map((month, i) =>
            month.record ? (
              <MonthSlip key={month.period} month={month} index={i} />
            ) : editing === month.period ? (
              <MonthSlip key={month.period} month={month} index={0}>
                <RecordForm
                  token={token}
                  employment={employment}
                  month={month}
                  onCancel={() => setEditing(null)}
                  onSaved={(next) => {
                    setView(next);
                    setEditing(null);
                  }}
                />
              </MonthSlip>
            ) : (
              <MonthSlip
                key={month.period}
                month={month}
                index={i}
                actions={
                  <Button variant={month.state === "missing" ? "primary" : "secondary"} icon={<PencilSimpleLine className="size-4" aria-hidden />} onClick={() => setEditing(month.period)} disabled={editing !== null}>
                    Record this month
                  </Button>
                }
              />
            ),
          )}
          {view.months.length === 0 && <Notice title="No months yet">Your first month appears here once it starts.</Notice>}
        </div>
      )}
    </div>
  );
}
