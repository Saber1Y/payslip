import type { Assertion, Decision, Employment, Packet, PublicKeyRef, RelyingParty, SalaryRecord } from "@payslip/core";
import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Payslip's server copy. It is a convenience, not the source of truth: everything that matters is signed
 * by the parties and fingerprinted on-chain, and the claim packet verifies without this database.
 * Access links are bearer secrets; only their SHA-256 hashes are stored.
 */
export const employments = pgTable("employments", {
  id: text("id").primaryKey(),
  status: text("status", { enum: ["awaiting_worker", "open"] }).notNull(),
  employerName: text("employer_name").notNull(),
  workerName: text("worker_name").notNull(),
  declaredSalaryCents: integer("declared_salary_cents").notNull(),
  restDayWeekday: integer("rest_day_weekday").notNull(),
  startPeriod: text("start_period").notNull(),
  rp: jsonb("rp").$type<RelyingParty>().notNull(),
  employerKey: jsonb("employer_key").$type<PublicKeyRef>().notNull(),
  workerKey: jsonb("worker_key").$type<PublicKeyRef>(),
  salt: text("salt").notNull(),
  employment: jsonb("employment").$type<Employment>(),
  employmentHash: text("employment_hash"),
  employerTokenHash: text("employer_token_hash").notNull().unique(),
  workerTokenHash: text("worker_token_hash").notNull().unique(),
  /** The worker's invite link, kept only until they register so the employer can resend it. */
  workerInviteToken: text("worker_invite_token"),
  openTx: text("open_tx"),
  anchorError: text("anchor_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  openedAt: timestamp("opened_at", { withTimezone: true }),
}, (t) => [
  // Passkey recovery looks an employment up by the credential that signed in.
  index("employments_worker_credential").on(sql`(${t.workerKey}->>'credentialId')`),
  index("employments_employer_credential").on(sql`(${t.employerKey}->>'credentialId')`),
]);

export const records = pgTable(
  "records",
  {
    id: serial("id").primaryKey(),
    employmentId: text("employment_id")
      .notNull()
      .references(() => employments.id),
    period: text("period").notNull(),
    record: jsonb("record").$type<SalaryRecord>().notNull(),
    recordHash: text("record_hash").notNull(),
    employerSignature: jsonb("employer_signature").$type<Assertion>().notNull(),
    proposalTx: text("proposal_tx"),
    decision: jsonb("decision").$type<Decision>(),
    decisionHash: text("decision_hash"),
    workerSignature: jsonb("worker_signature").$type<Assertion>(),
    decisionTx: text("decision_tx"),
    anchorError: text("anchor_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("records_employment_period").on(t.employmentId, t.period)],
);

export type EmploymentRow = typeof employments.$inferSelect;
export type RecordRow = typeof records.$inferSelect;

/**
 * Single-use challenges for passkey recovery. A challenge is consumed on first use and expires quickly,
 * so a recorded sign-in can never be replayed to mint another link.
 */
export const recoveryChallenges = pgTable("recovery_challenges", {
  id: text("id").primaryKey(),
  challenge: text("challenge").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

/**
 * Claim packets a worker chose to share, for example with an NGO. Each share is a frozen snapshot behind
 * its own link (stored only as a hash), so the worker can revoke one recipient without affecting others.
 * Whoever opens it still verifies the packet in their own browser against the chain.
 */
export const shares = pgTable(
  "shares",
  {
    id: serial("id").primaryKey(),
    employmentId: text("employment_id")
      .notNull()
      .references(() => employments.id),
    tokenHash: text("token_hash").notNull().unique(),
    label: text("label").notNull(),
    packet: jsonb("packet").$type<Packet>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("shares_employment").on(t.employmentId)],
);

export type ShareRow = typeof shares.$inferSelect;
