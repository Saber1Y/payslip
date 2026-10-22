import type { Hex } from "viem";
import { hashDecision, hashEmployment, hashRecord, type Decision, type Employment, type SalaryRecord } from "./record";
import { NO_DECISION_HASH, type ChainEmployment, type ChainEntry, type EntryKind, type PacketMonth, type RegistryReader } from "./packet";
import { periodToNumber, type Period } from "./period";
import { createSoftwareAuthenticator, keyHash, type RelyingParty, type SoftwareAuthenticator } from "./webauthn";

export const RP: RelyingParty = { id: "localhost", origin: "http://localhost:3020" };
export const EMPLOYMENT_ID = `0x${"11".repeat(32)}` as Hex;

export interface Parties {
  worker: SoftwareAuthenticator;
  employer: SoftwareAuthenticator;
  employment: Employment;
}

export async function makeParties(overrides: Partial<Employment> = {}): Promise<Parties> {
  const worker = await createSoftwareAuthenticator();
  const employer = await createSoftwareAuthenticator();
  const employment: Employment = {
    version: 1,
    employmentId: EMPLOYMENT_ID,
    rp: RP,
    currency: "SGD",
    declaredMonthlySalaryCents: 65_000,
    restDayWeekday: 0,
    startPeriod: "2026-01",
    worker: { displayName: "Maria", key: worker.key },
    employer: { displayName: "Tan household", key: employer.key },
    salt: `0x${"22".repeat(32)}`,
    ...overrides,
  };
  return { worker, employer, employment };
}

export function makeRecord(period: Period, overrides: Partial<SalaryRecord> = {}): SalaryRecord {
  return {
    version: 1,
    employmentId: EMPLOYMENT_ID,
    period,
    monthlySalaryCents: 65_000,
    restDaysInMonth: 4,
    restDaysTaken: 4,
    restDaysWorked: 0,
    restDayPayCents: 0,
    deductions: [],
    amountPaidCents: 65_000,
    paidOn: `${period}-28` as SalaryRecord["paidOn"],
    method: "cash",
    salt: `0x${"33".repeat(32)}`,
    ...overrides,
  };
}

export async function signMonth(parties: Parties, record: SalaryRecord, decision: Omit<Decision, "recordHash" | "version"> | null): Promise<PacketMonth> {
  const recordHash = hashRecord(record);
  const employerSignature = await parties.employer.sign(recordHash, RP);
  if (!decision) return { record, employerSignature, decision: null, workerSignature: null };
  const full: Decision = { version: 1, recordHash, ...decision };
  return { record, employerSignature, decision: full, workerSignature: await parties.worker.sign(hashDecision(full), RP) };
}

/** An in-memory registry with the same append-only semantics as the contract. */
export class FakeRegistry implements RegistryReader {
  employments = new Map<Hex, ChainEmployment>();
  entries = new Map<string, ChainEntry[]>();

  open(employment: Employment) {
    this.employments.set(employment.employmentId, {
      employmentHash: hashEmployment(employment),
      workerKeyHash: keyHash(employment.worker.key),
      employerKeyHash: keyHash(employment.employer.key),
      openedAt: 1,
    });
  }

  anchor(employmentId: Hex, period: Period, kind: EntryKind, recordHash: Hex, decisionHash: Hex = NO_DECISION_HASH) {
    const key = `${employmentId}:${periodToNumber(period)}`;
    const list = this.entries.get(key) ?? [];
    list.push({ kind, recordHash, decisionHash, recordedAt: list.length + 1, txHash: null });
    this.entries.set(key, list);
  }

  /** Anchors a signed month the way the app does: the proposal, then the worker's decision if any. */
  anchorMonth(month: PacketMonth) {
    const recordHash = hashRecord(month.record);
    this.anchor(month.record.employmentId, month.record.period, "proposed", recordHash);
    if (month.decision) {
      const kind = month.decision.decision === "acknowledge" ? "acknowledged" : "disputed";
      this.anchor(month.record.employmentId, month.record.period, kind, recordHash, hashDecision(month.decision));
    }
  }

  async getEmployment(employmentId: Hex) {
    return this.employments.get(employmentId) ?? null;
  }

  async getEntries(employmentId: Hex, period: number) {
    return this.entries.get(`${employmentId}:${period}`) ?? [];
  }
}
