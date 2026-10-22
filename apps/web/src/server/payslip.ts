import "server-only";
import {
  assertionSchema,
  buildPacket,
  decisionSchema,
  hashDecision,
  hashEmployment,
  hashRecord,
  keyHash,
  monthFlags,
  PayslipError,
  paymentDeadline,
  periodOf,
  periodToNumber,
  periodsBetween,
  publicKeyRefSchema,
  randomSalt,
  salaryRecordSchema,
  todayInSingapore,
  verifyAssertion,
  type Employment,
  type IsoDate,
  type Packet,
  type Period,
} from "@payslip/core";
import type { EmploymentRow, RecordRow } from "@payslip/db";
import { bytesToHex, type Hex } from "viem";
import { z } from "zod";
import { publicChainConfig, relyingParty } from "@/lib/config";
import type { CreatedEmployment, EmploymentSummary, MonthView, PartyView } from "@/lib/views";
import { anchorErrorMessage } from "./http";
import { getReader, getStore, getWriter } from "./services";
import { hashToken, newToken } from "./tokens";

/** How far back an employer may start recording. Older months belong in a paper claim, not here. */
const MAX_BACKFILL_MONTHS = 24;

export class NotFoundError extends Error {}
export class ConflictError extends Error {}

export const createEmploymentSchema = z.object({
  employerName: z.string().trim().min(1).max(60),
  workerName: z.string().trim().min(1).max(60),
  declaredSalaryCents: z.number().int().min(100).max(10_000_000),
  restDayWeekday: z.number().int().min(0).max(6),
  startPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  employerKey: publicKeyRefSchema,
});

function today(): IsoDate {
  return todayInSingapore(new Date());
}

function monthsBack(period: Period, months: number): Period {
  let [y, m] = period.split("-").map(Number) as [number, number];
  m -= months;
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, "0")}` as Period;
}

export async function createEmployment(input: unknown): Promise<CreatedEmployment> {
  const data = createEmploymentSchema.parse(input);
  const current = periodOf(today());
  const startPeriod = data.startPeriod as Period;
  if (startPeriod > current) throw new PayslipError("INVALID_PERIOD", "The start month cannot be in the future", "startPeriod");
  if (startPeriod < monthsBack(current, MAX_BACKFILL_MONTHS)) throw new PayslipError("INVALID_PERIOD", `Start within the last ${MAX_BACKFILL_MONTHS} months`, "startPeriod");
  if (data.employerKey.authenticator !== "passkey") throw new PayslipError("INVALID_SIGNATURE", "Employers must register a passkey", "employerKey");

  const employerToken = newToken();
  const workerToken = newToken();
  const rp = relyingParty();
  await getStore().createEmployment({
    id: bytesToHex(crypto.getRandomValues(new Uint8Array(32))),
    employerName: data.employerName,
    workerName: data.workerName,
    declaredSalaryCents: data.declaredSalaryCents,
    restDayWeekday: data.restDayWeekday,
    startPeriod,
    rp,
    employerKey: data.employerKey,
    salt: randomSalt(),
    employerTokenHash: hashToken(employerToken),
    workerTokenHash: hashToken(workerToken),
    workerInviteToken: workerToken,
  });
  return { employerUrl: `${rp.origin}/e/${employerToken}`, inviteUrl: `${rp.origin}/w/${workerToken}` };
}

export async function findEmployment(role: "employer" | "worker", token: string): Promise<EmploymentRow> {
  const store = getStore();
  const row = role === "employer" ? await store.findByEmployerToken(hashToken(token)) : await store.findByWorkerToken(hashToken(token));
  if (!row) throw new NotFoundError("This link is not valid");
  return row;
}

function requireOpen(row: EmploymentRow): Employment {
  if (row.status !== "open" || !row.employment) throw new ConflictError(`${row.workerName} has not joined yet`);
  return row.employment;
}

/** Anchors the employment if it is not on-chain yet. Safe to call repeatedly. */
async function ensureEmploymentAnchored(row: EmploymentRow): Promise<boolean> {
  if (row.openTx) return true;
  const employment = requireOpen(row);
  const writer = getWriter();
  if (!writer) return false;
  const store = getStore();
  try {
    if (await getReader().getEmployment(employment.employmentId)) {
      await store.setEmploymentAnchor(row.id, { tx: "recovered" });
    } else {
      const receipt = await writer.openEmployment(employment.employmentId, hashEmployment(employment), keyHash(employment.worker.key), keyHash(employment.employer.key));
      await store.setEmploymentAnchor(row.id, { tx: receipt.txHash });
    }
    return true;
  } catch (error) {
    await store.setEmploymentAnchor(row.id, { error: anchorErrorMessage(error) });
    return false;
  }
}

/** Anchors the proposal and, if present, the decision for one record. Reads the chain first so retries never duplicate. */
async function ensureRecordAnchored(row: EmploymentRow, record: RecordRow): Promise<void> {
  const writer = getWriter();
  if (!writer || !(await ensureEmploymentAnchored(row))) return;
  const store = getStore();
  const employmentId = row.id as Hex;
  const period = periodToNumber(record.period as Period);
  try {
    const entries = await getReader().getEntries(employmentId, period);
    if (!record.proposalTx) {
      const onChain = entries.some((e) => e.kind === "proposed" && e.recordHash === record.recordHash);
      const tx = onChain ? "recovered" : (await writer.propose(employmentId, period, record.recordHash as Hex)).txHash;
      await store.setRecordAnchor(record.id, { proposalTx: tx });
    }
    if (record.decision && record.decisionHash && !record.decisionTx) {
      const disputed = record.decision.decision === "dispute";
      const onChain = entries.some((e) => e.kind === (disputed ? "disputed" : "acknowledged") && e.decisionHash === record.decisionHash);
      const tx = onChain ? "recovered" : (await writer.decide(employmentId, period, record.recordHash as Hex, record.decisionHash as Hex, disputed)).txHash;
      await store.setRecordAnchor(record.id, { decisionTx: tx });
    }
  } catch (error) {
    await store.setRecordAnchor(record.id, { error: anchorErrorMessage(error) });
  }
}

export async function registerWorker(token: string, input: unknown): Promise<void> {
  const workerKey = publicKeyRefSchema.parse((input as { workerKey?: unknown } | undefined)?.workerKey);
  if (workerKey.authenticator !== "passkey") throw new PayslipError("INVALID_SIGNATURE", "Workers must register a passkey", "workerKey");
  const row = await findEmployment("worker", token);
  if (row.workerKey) throw new ConflictError("This invite was already used");
  if (workerKey.publicKey === row.employerKey.publicKey) throw new ConflictError("The worker and employer must use different passkeys");

  const employment: Employment = {
    version: 1,
    employmentId: row.id as Hex,
    rp: row.rp,
    currency: "SGD",
    declaredMonthlySalaryCents: row.declaredSalaryCents,
    restDayWeekday: row.restDayWeekday,
    startPeriod: row.startPeriod as Period,
    worker: { displayName: row.workerName, key: workerKey },
    employer: { displayName: row.employerName, key: row.employerKey },
    salt: row.salt as Hex,
  };
  const updated = await getStore().attachWorker(row.id, workerKey, employment, hashEmployment(employment));
  if (!updated) throw new ConflictError("This invite was already used");
  await ensureEmploymentAnchored(updated);
}

const proposeSchema = z.object({ record: salaryRecordSchema, employerSignature: assertionSchema });

export async function proposeRecord(token: string, input: unknown): Promise<void> {
  const { record, employerSignature } = proposeSchema.parse(input);
  const row = await findEmployment("employer", token);
  const employment = requireOpen(row);
  const now = today();
  if (record.employmentId !== employment.employmentId) throw new PayslipError("INVALID_RECORD", "Record is for a different employment", "employmentId");
  if (record.period < employment.startPeriod || record.period > periodOf(now)) throw new PayslipError("INVALID_PERIOD", "That month is outside this employment", "period");
  if (record.paidOn > now) throw new PayslipError("INVALID_DATE", "The payment date cannot be in the future", "paidOn");

  const recordHash = hashRecord(record);
  const check = await verifyAssertion(employerSignature, recordHash, employment.employer.key, employment.rp);
  if (!check.ok) throw new PayslipError("INVALID_SIGNATURE", check.reason, "employerSignature");

  const inserted = await getStore().insertRecord({ employmentId: row.id, record, recordHash, employerSignature });
  if (!inserted) throw new ConflictError(`${record.period} already has a record`);
  await ensureRecordAnchored(row, inserted);
}

const decideSchema = z.object({ period: z.string(), decision: decisionSchema, workerSignature: assertionSchema });

export async function decideRecord(token: string, input: unknown): Promise<void> {
  const { period, decision, workerSignature } = decideSchema.parse(input);
  const row = await findEmployment("worker", token);
  const employment = requireOpen(row);
  const store = getStore();
  const record = await store.getRecord(row.id, period);
  if (!record) throw new NotFoundError(`No record for ${period}`);
  if (record.decision) throw new ConflictError(`${period} was already answered`);
  if (decision.recordHash !== record.recordHash) throw new PayslipError("INVALID_RECORD", "The decision is about a different version of this record", "decision");

  const decisionHash = hashDecision(decision);
  const check = await verifyAssertion(workerSignature, decisionHash, employment.worker.key, employment.rp);
  if (!check.ok) throw new PayslipError("INVALID_SIGNATURE", check.reason, "workerSignature");

  const saved = await store.saveDecision(record.id, decision, decisionHash, workerSignature);
  if (!saved) throw new ConflictError(`${period} was already answered`);
  await ensureRecordAnchored(row, saved);
}

export async function retryAnchors(role: "employer" | "worker", token: string): Promise<void> {
  const row = await findEmployment(role, token);
  if (row.status !== "open") return;
  if (!(await ensureEmploymentAnchored(row))) return;
  const fresh = (await getStore().getEmployment(row.id)) ?? row;
  for (const record of await getStore().listRecords(row.id)) {
    if (!record.proposalTx || (record.decision && !record.decisionTx)) await ensureRecordAnchored(fresh, record);
  }
}

function monthView(row: EmploymentRow, period: Period, record: RecordRow | undefined, now: IsoDate): MonthView {
  const deadline = paymentDeadline(period);
  const flags = monthFlags({ declaredMonthlySalaryCents: row.declaredSalaryCents }, { period, record: record?.record ?? null, decision: record?.decision ?? null }, now);
  let state: MonthView["state"];
  if (!record) state = now > deadline ? "missing" : "due";
  else if (!record.decision) state = "awaiting_worker";
  else state = record.decision.decision === "acknowledge" ? "acknowledged" : "disputed";
  return {
    period,
    deadline,
    state,
    record: record?.record ?? null,
    recordHash: (record?.recordHash as Hex | undefined) ?? null,
    decision: record?.decision ?? null,
    proposalTx: record?.proposalTx ?? null,
    decisionTx: record?.decisionTx ?? null,
    anchorError: record?.anchorError ?? null,
    flags,
  };
}

function summary(row: EmploymentRow): EmploymentSummary {
  return {
    id: row.id as Hex,
    status: row.status,
    employerName: row.employerName,
    workerName: row.workerName,
    declaredSalaryCents: row.declaredSalaryCents,
    restDayWeekday: row.restDayWeekday,
    startPeriod: row.startPeriod as Period,
    rp: row.rp,
    employerCredentialId: row.employerKey.credentialId,
    workerCredentialId: row.workerKey?.credentialId ?? null,
    demoKeys: row.employerKey.authenticator === "software-demo",
    openTx: row.openTx,
    anchorError: row.anchorError,
  };
}

export async function partyView(role: "employer" | "worker", token: string): Promise<PartyView> {
  const row = await findEmployment(role, token);
  const now = today();
  const byPeriod = new Map((await getStore().listRecords(row.id)).map((r) => [r.period, r]));
  // Newest first: the month that needs attention is at the top.
  const months = periodsBetween(row.startPeriod as Period, periodOf(now))
    .reverse()
    .map((p) => monthView(row, p, byPeriod.get(p), now));
  return {
    role,
    employment: summary(row),
    inviteUrl: role === "employer" && row.workerInviteToken ? `${row.rp.origin}/w/${row.workerInviteToken}` : null,
    months,
    today: now,
    anchoringEnabled: getWriter() !== null,
  };
}

export async function workerPacket(token: string): Promise<Packet> {
  const row = await findEmployment("worker", token);
  const employment = requireOpen(row);
  const config = publicChainConfig();
  const months = (await getStore().listRecords(row.id)).map((r) => ({
    record: r.record,
    employerSignature: r.employerSignature,
    decision: r.decision,
    workerSignature: r.workerSignature,
  }));
  return buildPacket({
    chain: { chainId: config.chainId, name: config.name, registry: config.registry, explorerUrl: config.explorerUrl },
    employment,
    months,
    generatedAt: new Date(),
  });
}
