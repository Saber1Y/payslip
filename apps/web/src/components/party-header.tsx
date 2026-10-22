"use client";

import { ArrowClockwise } from "@phosphor-icons/react";
import { useState } from "react";
import { api } from "@/lib/api";
import { periodLabel, sgd, WEEKDAYS } from "@/lib/format";
import type { PartyView } from "@/lib/views";
import { AnchorLine } from "./month-slip";
import { Button, Notice } from "./ui";

/** Shared top of the employer and worker pages: who, the agreement, and chain status. */
export function PartyHeader({ view, token, title, eyebrow, onView }: { view: PartyView; token: string; title: string; eyebrow: string; onView: (v: PartyView) => void }) {
  const { employment } = view;
  const [retrying, setRetrying] = useState(false);
  const unanchored = employment.status === "open" && (!employment.openTx || view.months.some((m) => m.record && (!m.proposalTx || (m.decision && !m.decisionTx))));

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <p className="figures text-[12px] tracking-[0.12em] text-muted uppercase">{eyebrow}</p>
        <h1 className="font-serif text-[30px] leading-[1.1] font-semibold tracking-[-0.02em] sm:text-[38px]">{title}</h1>
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-muted">
          <div className="flex gap-1.5">
            <dt>Declared salary</dt>
            <dd className="figures text-ink">{sgd(employment.declaredSalaryCents)}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Rest day</dt>
            <dd className="text-ink">{WEEKDAYS[employment.restDayWeekday]}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Since</dt>
            <dd className="text-ink">{periodLabel(employment.startPeriod)}</dd>
          </div>
        </dl>
        <AnchorLine label="Agreement and both passkeys anchored" tx={employment.openTx} />
      </div>
      {employment.demoKeys && (
        <Notice tone="waiting" title="Demo data">
          These records were signed by keys generated in code for the demo, not by real passkeys. Everything else, including the on-chain anchors, is real.
        </Notice>
      )}
      {!view.anchoringEnabled && employment.status === "open" && (
        <Notice tone="waiting" title="Anchoring is switched off">
          This server has no relayer key, so records are saved and signed but not yet fingerprinted on-chain.
        </Notice>
      )}
      {view.anchoringEnabled && unanchored && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-waiting-soft px-4 py-3 text-[14px] text-waiting">
          <p>{employment.anchorError ?? "Some records are not anchored on-chain yet."}</p>
          <Button
            variant="secondary"
            busy={retrying}
            icon={<ArrowClockwise className="size-4" aria-hidden />}
            onClick={async () => {
              setRetrying(true);
              try {
                onView(await api<PartyView>(`/api/${view.role === "employer" ? "e" : "w"}/${token}/anchors`, { method: "POST" }));
              } finally {
                setRetrying(false);
              }
            }}
          >
            Retry anchoring
          </Button>
        </div>
      )}
    </div>
  );
}
