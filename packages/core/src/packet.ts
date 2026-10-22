import { zeroHash, type Address, type Hex } from "viem";
import { z } from "zod";
import { PayslipError } from "./errors";
import { monthFlags, type Flag } from "./flags";
import { paymentDeadline, periodOf, periodToNumber, periodsBetween, type IsoDate, type Period } from "./period";
import {
  decisionSchema,
  employmentSchema,
  hashDecision,
  hashEmployment,
  hashRecord,
  salaryRecordSchema,
  type Decision,
  type Employment,
  type SalaryRecord,
} from "./record";
import { assertionSchema, keyHash, verifyAssertion, type Assertion, type SignatureCheck } from "./webauthn";

/**
 * A claim packet is everything a worker hands to MOM, an NGO or a lawyer: the employment, every signed
 * month, and where the anchors live. `verifyPacket` checks it against the chain with no trust in Payslip.
 */
export const PACKET_FORMAT = "payslip.packet.v1";

/** Entry kinds as stored by RecordRegistry. Keep in sync with contracts/src/RecordRegistry.sol. */
export const ENTRY_KIND = { proposed: 1, acknowledged: 2, disputed: 3 } as const;
export type EntryKind = keyof typeof ENTRY_KIND;
/** The decision hash stored with a proposal, before the worker has answered. */
export const NO_DECISION_HASH: Hex = zeroHash;

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/) as unknown as z.ZodType<Address>;

export const packetMonthSchema = z.object({
  record: salaryRecordSchema,
  employerSignature: assertionSchema,
  decision: decisionSchema.nullable(),
  workerSignature: assertionSchema.nullable(),
});
export type PacketMonth = z.infer<typeof packetMonthSchema>;

export const packetSchema = z.object({
  format: z.literal(PACKET_FORMAT),
  generatedAt: z.string().datetime(),
  chain: z.object({ chainId: z.number().int().positive(), name: z.string().min(1), registry: address, explorerUrl: z.string().url().nullable() }),
  employment: employmentSchema,
  months: z.array(packetMonthSchema).max(240),
});
export type Packet = z.infer<typeof packetSchema>;

export interface ChainEmployment {
  employmentHash: Hex;
  workerKeyHash: Hex;
  employerKeyHash: Hex;
  openedAt: number;
}

export interface ChainEntry {
  kind: EntryKind;
  recordHash: Hex;
  decisionHash: Hex;
  recordedAt: number;
  txHash: Hex | null;
}

/** Read access to RecordRegistry. The web app implements it with viem; tests use an in-memory fake. */
export interface RegistryReader {
  getEmployment(employmentId: Hex): Promise<ChainEmployment | null>;
  getEntries(employmentId: Hex, period: number): Promise<ChainEntry[]>;
}

export type MonthVerdict = "verified" | "tampered" | "not_anchored";

export interface MonthVerification {
  period: Period;
  verdict: MonthVerdict;
  recordHash: Hex;
  decisionHash: Hex | null;
  employerSignature: SignatureCheck;
  workerSignature: SignatureCheck | null;
  proposalEntry: ChainEntry | null;
  decisionEntry: ChainEntry | null;
  problems: string[];
  flags: Flag[];
}

export interface PacketVerification {
  employment: {
    hash: Hex;
    anchored: ChainEmployment | null;
    problems: string[];
  };
  months: MonthVerification[];
  /** Deadline passed with nothing on-chain and nothing in the packet. */
  missing: { period: Period; flags: Flag[] }[];
  /** On-chain entries exist for these periods but the packet left them out. */
  omitted: Period[];
  ok: boolean;
}

function decisionKind(decision: Decision): EntryKind {
  return decision.decision === "acknowledge" ? "acknowledged" : "disputed";
}

async function verifyMonth(employment: Employment, month: PacketMonth, entries: ChainEntry[], today: IsoDate): Promise<MonthVerification> {
  const { record, decision } = month;
  const problems: string[] = [];
  const recordHash = hashRecord(record);
  const decisionHash = decision ? hashDecision(decision) : null;

  if (record.employmentId !== employment.employmentId) problems.push("Record belongs to a different employment");
  if (decision && decision.recordHash !== recordHash) problems.push("The worker's decision is about a different version of this record");

  const employerSignature = await verifyAssertion(month.employerSignature, recordHash, employment.employer.key, employment.rp);
  if (!employerSignature.ok) problems.push(`Employer signature: ${employerSignature.reason}`);

  let workerSignature: SignatureCheck | null = null;
  if (decision && decisionHash) {
    if (!month.workerSignature) {
      workerSignature = { ok: false, reason: "Decision has no signature" };
    } else {
      workerSignature = await verifyAssertion(month.workerSignature, decisionHash, employment.worker.key, employment.rp);
    }
    if (!workerSignature.ok) problems.push(`Worker signature: ${workerSignature.reason}`);
  } else if (month.workerSignature) {
    problems.push("Worker signature present without a decision");
  }

  const proposalEntry = entries.find((e) => e.kind === "proposed" && e.recordHash === recordHash) ?? null;
  const decisionEntry = decision ? (entries.find((e) => e.kind === decisionKind(decision) && e.recordHash === recordHash && e.decisionHash === decisionHash) ?? null) : null;
  const anchored = decision ? decisionEntry !== null : proposalEntry !== null;

  let verdict: MonthVerdict = "verified";
  if (problems.length > 0) {
    verdict = "tampered";
  } else if (!anchored) {
    // Nothing on-chain has this exact fingerprint. If the period has other entries, the packet's copy was changed.
    verdict = entries.length > 0 ? "tampered" : "not_anchored";
    problems.push(entries.length > 0 ? "This record does not match what was anchored on-chain for this month" : "No anchor on-chain for this month");
  }

  return {
    period: record.period,
    verdict,
    recordHash,
    decisionHash,
    employerSignature,
    workerSignature,
    proposalEntry,
    decisionEntry,
    problems,
    flags: monthFlags(employment, { period: record.period, record, decision }, today),
  };
}

export async function verifyPacket(input: unknown, reader: RegistryReader, today: IsoDate): Promise<PacketVerification> {
  const packet = packetSchema.parse(input);
  const { employment } = packet;
  const employmentHash = hashEmployment(employment);
  const employmentProblems: string[] = [];

  const anchored = await reader.getEmployment(employment.employmentId);
  if (!anchored) {
    employmentProblems.push("This employment was never opened on-chain");
  } else {
    if (anchored.employmentHash !== employmentHash) employmentProblems.push("Employment details differ from what was anchored");
    if (anchored.workerKeyHash !== keyHash(employment.worker.key)) employmentProblems.push("Worker key differs from the one anchored");
    if (anchored.employerKeyHash !== keyHash(employment.employer.key)) employmentProblems.push("Employer key differs from the one anchored");
  }

  const seen = new Set<Period>();
  for (const m of packet.months) {
    if (seen.has(m.record.period)) throw new PayslipError("INVALID_PACKET", `Duplicate period ${m.record.period}`, "months");
    seen.add(m.record.period);
  }

  const lastPeriod = periodOf(today);
  const periods = periodsBetween(employment.startPeriod, lastPeriod);
  const entriesByPeriod = new Map<Period, ChainEntry[]>();
  await Promise.all(periods.map(async (p) => entriesByPeriod.set(p, await reader.getEntries(employment.employmentId, periodToNumber(p)))));

  const months = await Promise.all(
    [...packet.months]
      .sort((a, b) => (a.record.period < b.record.period ? -1 : 1))
      .map((m) => verifyMonth(employment, m, entriesByPeriod.get(m.record.period) ?? [], today)),
  );

  const missing: PacketVerification["missing"] = [];
  const omitted: Period[] = [];
  for (const p of periods) {
    if (seen.has(p)) continue;
    if ((entriesByPeriod.get(p) ?? []).length > 0) omitted.push(p);
    else if (today > paymentDeadline(p)) missing.push({ period: p, flags: monthFlags(employment, { period: p, record: null, decision: null }, today) });
  }

  return {
    employment: { hash: employmentHash, anchored, problems: employmentProblems },
    months,
    missing,
    omitted,
    ok: employmentProblems.length === 0 && months.every((m) => m.verdict === "verified"),
  };
}

export function buildPacket(input: {
  chain: Packet["chain"];
  employment: Employment;
  months: { record: SalaryRecord; employerSignature: Assertion; decision: Decision | null; workerSignature: Assertion | null }[];
  generatedAt: Date;
}): Packet {
  return packetSchema.parse({
    format: PACKET_FORMAT,
    generatedAt: input.generatedAt.toISOString(),
    chain: input.chain,
    employment: input.employment,
    months: input.months,
  });
}
