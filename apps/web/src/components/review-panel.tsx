"use client";

import { DISPUTE_REASONS, hashDecision, type Decision, type DisputeReason } from "@payslip/core";
import { Check, Fingerprint, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { REASON_LABELS } from "@/lib/format";
import { PasskeyError, signWithPasskey } from "@/lib/passkey";
import type { EmploymentSummary, MonthView, PartyView } from "@/lib/views";
import { Button, Notice } from "./ui";

/** The worker's answer. Two big choices, then one passkey signature over exactly that answer. */
export function ReviewPanel({ token, employment, month, onSaved }: { token: string; employment: EmploymentSummary; month: MonthView; onSaved: (view: PartyView) => void }) {
  const [choice, setChoice] = useState<"acknowledge" | "dispute" | null>(null);
  const [reasons, setReasons] = useState<DisputeReason[]>([]);
  const [underProtest, setUnderProtest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sign() {
    if (!month.recordHash || !employment.workerCredentialId || !choice) return;
    if (choice === "dispute" && reasons.length === 0) return setError("Pick at least one reason");
    setError(null);
    const decision: Decision = {
      version: 1,
      recordHash: month.recordHash,
      decision: choice,
      reasons: choice === "dispute" ? DISPUTE_REASONS.filter((r) => reasons.includes(r)) : [],
      underProtest: choice === "acknowledge" && underProtest,
    };
    setBusy(true);
    try {
      const workerSignature = await signWithPasskey(employment.rp.id, employment.workerCredentialId, hashDecision(decision));
      onSaved(await api<PartyView>(`/api/w/${token}/decisions`, { method: "POST", body: { period: month.period, decision, workerSignature } }));
    } catch (err) {
      setError(err instanceof PasskeyError || err instanceof ApiError ? err.message : "Couldn't save your answer. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-[15px] font-medium">Is this record correct?</p>
      <div className="grid grid-cols-2 gap-2">
        <ChoiceButton active={choice === "acknowledge"} tone="signed" onClick={() => setChoice("acknowledge")} icon={<Check className="size-5" weight="bold" aria-hidden />}>
          Yes, it&apos;s correct
        </ChoiceButton>
        <ChoiceButton active={choice === "dispute"} tone="waiting" onClick={() => setChoice("dispute")} icon={<WarningCircle className="size-5" weight="bold" aria-hidden />}>
          Something is wrong
        </ChoiceButton>
      </div>

      {choice === "acknowledge" && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-rule bg-sheet-2 px-4 py-3 text-[14px]">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--waiting)]" checked={underProtest} onChange={(e) => setUnderProtest(e.target.checked)} />
          <span>
            <span className="font-medium">I&apos;m signing because I was told to</span>
            <span className="block text-muted">This is recorded with your signature. You can still raise it with MOM or an NGO later.</span>
          </span>
        </label>
      )}

      {choice === "dispute" && (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-[14px] text-muted">What is wrong? Pick all that apply.</legend>
          {DISPUTE_REASONS.map((r) => (
            <label key={r} className={`press flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-4 text-[14.5px] ${reasons.includes(r) ? "border-waiting bg-waiting-soft text-waiting" : "border-rule-strong bg-sheet"}`}>
              <input type="checkbox" className="size-4 accent-[var(--waiting)]" checked={reasons.includes(r)} onChange={(e) => setReasons((all) => (e.target.checked ? [...all, r] : all.filter((x) => x !== r)))} />
              {REASON_LABELS[r]}
            </label>
          ))}
        </fieldset>
      )}

      {error && <Notice tone="breach" title="Not saved">{error}</Notice>}
      {choice && (
        <div className="grid gap-2">
          <Button busy={busy} onClick={sign} icon={<Fingerprint className="size-4" aria-hidden />} className="w-full">
            {choice === "acknowledge" ? "Sign with my passkey" : "Sign my dispute"}
          </Button>
          <p className="text-center text-[12.5px] text-muted">Uses your fingerprint, face or screen lock. Your answer can&apos;t be changed by anyone afterwards.</p>
        </div>
      )}
    </div>
  );
}

function ChoiceButton({ active, tone, onClick, icon, children }: { active: boolean; tone: "signed" | "waiting"; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  const activeClass = tone === "signed" ? "border-signed bg-signed-soft text-signed" : "border-waiting bg-waiting-soft text-waiting";
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`press flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-3 text-[14.5px] font-medium ${active ? activeClass : "border-rule-strong bg-sheet text-ink hover:border-ink/40"}`}>
      {icon}
      {children}
    </button>
  );
}
