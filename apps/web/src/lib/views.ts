import type { Decision, Flag, IsoDate, Period, RelyingParty, SalaryRecord } from "@payslip/core";
import type { Hex } from "viem";

/** Shapes the API returns to the employer and worker screens. Types only, shared by server and client. */

export type MonthState = "due" | "missing" | "awaiting_worker" | "acknowledged" | "disputed";

export interface MonthView {
  period: Period;
  deadline: IsoDate;
  state: MonthState;
  record: SalaryRecord | null;
  recordHash: Hex | null;
  decision: Decision | null;
  /** Anchor transaction hashes. "recovered" means the anchor is on-chain but its tx hash was not stored. */
  proposalTx: string | null;
  decisionTx: string | null;
  anchorError: string | null;
  flags: Flag[];
}

export interface EmploymentSummary {
  id: Hex;
  status: "awaiting_worker" | "open";
  employerName: string;
  workerName: string;
  declaredSalaryCents: number;
  restDayWeekday: number;
  startPeriod: Period;
  rp: RelyingParty;
  employerCredentialId: string;
  workerCredentialId: string | null;
  demoKeys: boolean;
  openTx: string | null;
  anchorError: string | null;
}

export interface PartyView {
  role: "employer" | "worker";
  employment: EmploymentSummary;
  /** Only for the employer, and only until the worker joins. */
  inviteUrl: string | null;
  months: MonthView[];
  today: IsoDate;
  anchoringEnabled: boolean;
}

export interface CreatedEmployment {
  employerUrl: string;
  inviteUrl: string;
}
