import type { Assertion, Decision, Employment, PublicKeyRef, RelyingParty, SalaryRecord } from "@payslip/core";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { Db } from "./client";
import { employments, records, type EmploymentRow, type RecordRow } from "./schema";

export interface NewEmployment {
  id: string;
  employerName: string;
  workerName: string;
  declaredSalaryCents: number;
  restDayWeekday: number;
  startPeriod: string;
  rp: RelyingParty;
  employerKey: PublicKeyRef;
  salt: string;
  employerTokenHash: string;
  workerTokenHash: string;
  workerInviteToken: string;
}

export function createStore(db: Db) {
  return {
    async createEmployment(input: NewEmployment): Promise<EmploymentRow> {
      const [row] = await db
        .insert(employments)
        .values({ ...input, status: "awaiting_worker" })
        .returning();
      if (!row) throw new Error("Employment insert returned nothing");
      return row;
    },

    async getEmployment(id: string): Promise<EmploymentRow | null> {
      return (await db.query.employments.findFirst({ where: eq(employments.id, id) })) ?? null;
    },

    async findByEmployerToken(tokenHash: string): Promise<EmploymentRow | null> {
      return (await db.query.employments.findFirst({ where: eq(employments.employerTokenHash, tokenHash) })) ?? null;
    },

    async findByWorkerToken(tokenHash: string): Promise<EmploymentRow | null> {
      return (await db.query.employments.findFirst({ where: eq(employments.workerTokenHash, tokenHash) })) ?? null;
    },

    /** Binds the worker's key exactly once. Returns null if another request already did. */
    async attachWorker(id: string, workerKey: PublicKeyRef, employment: Employment, employmentHash: string): Promise<EmploymentRow | null> {
      const [row] = await db
        .update(employments)
        .set({ workerKey, employment, employmentHash, status: "open", workerInviteToken: null, openedAt: new Date() })
        .where(and(eq(employments.id, id), isNull(employments.workerKey)))
        .returning();
      return row ?? null;
    },

    async setEmploymentAnchor(id: string, anchor: { tx: string } | { error: string }): Promise<void> {
      await db
        .update(employments)
        .set("tx" in anchor ? { openTx: anchor.tx, anchorError: null } : { anchorError: anchor.error })
        .where(eq(employments.id, id));
    },

    async listRecords(employmentId: string): Promise<RecordRow[]> {
      return db.query.records.findMany({ where: eq(records.employmentId, employmentId), orderBy: [asc(records.period)] });
    },

    async getRecord(employmentId: string, period: string): Promise<RecordRow | null> {
      return (await db.query.records.findFirst({ where: and(eq(records.employmentId, employmentId), eq(records.period, period)) })) ?? null;
    },

    /** One record per month. Returns null when the month already has one. */
    async insertRecord(input: { employmentId: string; record: SalaryRecord; recordHash: string; employerSignature: Assertion }): Promise<RecordRow | null> {
      const [row] = await db
        .insert(records)
        .values({ employmentId: input.employmentId, period: input.record.period, record: input.record, recordHash: input.recordHash, employerSignature: input.employerSignature })
        .onConflictDoNothing()
        .returning();
      return row ?? null;
    },

    /** Stores the worker's decision exactly once. Returns null if the record was already decided. */
    async saveDecision(id: number, decision: Decision, decisionHash: string, workerSignature: Assertion): Promise<RecordRow | null> {
      const [row] = await db
        .update(records)
        .set({ decision, decisionHash, workerSignature, decidedAt: new Date() })
        .where(and(eq(records.id, id), isNull(records.decision)))
        .returning();
      return row ?? null;
    },

    async setRecordAnchor(id: number, anchor: { proposalTx: string } | { decisionTx: string } | { error: string }): Promise<void> {
      const set =
        "proposalTx" in anchor
          ? { proposalTx: anchor.proposalTx, anchorError: null }
          : "decisionTx" in anchor
            ? { decisionTx: anchor.decisionTx, anchorError: null }
            : { anchorError: anchor.error };
      await db.update(records).set(set).where(eq(records.id, id));
    },
  };
}
export type Store = ReturnType<typeof createStore>;
