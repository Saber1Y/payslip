// Seeds one demo employment with six months of history and anchors it on the configured chain.
// The two parties sign with software P-256 keys ("software-demo"), because real passkeys need a person at a
// device. Every screen and the verify page label these keys as demo keys. The anchors are real transactions.
import { createRegistryWriter, parseChainConfig, toViemChain } from "@payslip/chain";
import {
  createSoftwareAuthenticator,
  hashDecision,
  hashEmployment,
  hashRecord,
  keyHash,
  periodToNumber,
  randomSalt,
  restDayPayDue,
  type Decision,
  type Employment,
  type Period,
  type SalaryRecord,
} from "@payslip/core";
import { connectDb, createStore } from "@payslip/db";
import { createHash, randomBytes } from "node:crypto";
import { bytesToHex, createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const env = (name: string) => {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is not set (see .env.example)`);
    process.exit(1);
  }
  return value;
};

const config = parseChainConfig({
  chainId: process.env.NEXT_PUBLIC_CHAIN_ID,
  name: process.env.NEXT_PUBLIC_CHAIN_NAME,
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL,
  registry: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS,
  explorerUrl: process.env.NEXT_PUBLIC_EXPLORER_URL,
});
const rp = { id: env("NEXT_PUBLIC_RP_ID"), origin: env("NEXT_PUBLIC_APP_ORIGIN") };
const chain = toViemChain(config);
const client = createPublicClient({ chain, transport: http(config.rpcUrl) });
const wallet = createWalletClient({ account: privateKeyToAccount(env("RELAYER_PRIVATE_KEY") as Hex), chain, transport: http(config.rpcUrl) });
const writer = createRegistryWriter(wallet, client, config.registry);
const { db, close } = connectDb(env("DATABASE_URL"), { max: 1 });
const store = createStore(db);

const token = () => randomBytes(32).toString("base64url");
const sha = (t: string) => createHash("sha256").update(t).digest("hex");

const worker = await createSoftwareAuthenticator();
const employer = await createSoftwareAuthenticator();
const employmentId = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
const salary = 65_000;
const employment: Employment = {
  version: 1,
  employmentId,
  rp,
  currency: "SGD",
  declaredMonthlySalaryCents: salary,
  restDayWeekday: 0,
  startPeriod: "2026-04",
  worker: { displayName: "Maria Santos", key: worker.key },
  employer: { displayName: "Tan household", key: employer.key },
  salt: randomSalt(),
};

const employerToken = token();
const workerToken = token();
await store.createEmployment({
  id: employmentId,
  employerName: employment.employer.displayName,
  workerName: employment.worker.displayName,
  declaredSalaryCents: salary,
  restDayWeekday: 0,
  startPeriod: employment.startPeriod,
  rp,
  employerKey: employer.key,
  salt: employment.salt,
  employerTokenHash: sha(employerToken),
  workerTokenHash: sha(workerToken),
  workerInviteToken: workerToken,
});
const opened = await store.attachWorker(employmentId, worker.key, employment, hashEmployment(employment));
if (!opened) throw new Error("Could not attach the demo worker");
const openReceipt = await writer.openEmployment(employmentId, hashEmployment(employment), keyHash(worker.key), keyHash(employer.key));
await store.setEmploymentAnchor(employmentId, { tx: openReceipt.txHash });
console.log(`Opened employment ${employmentId} in tx ${openReceipt.txHash}`);

const base = (period: Period, overrides: Partial<SalaryRecord>): SalaryRecord => ({
  version: 1,
  employmentId,
  period,
  monthlySalaryCents: salary,
  restDaysInMonth: 4,
  restDaysTaken: 4,
  restDaysWorked: 0,
  restDayPayCents: 0,
  deductions: [],
  amountPaidCents: salary,
  paidOn: `${period}-30` as SalaryRecord["paidOn"],
  method: "cash",
  salt: randomSalt(),
  ...overrides,
});

const months: { record: SalaryRecord; answer: Omit<Decision, "version" | "recordHash"> | null }[] = [
  { record: base("2026-04", {}), answer: { decision: "acknowledge", reasons: [], underProtest: false } },
  { record: base("2026-05", { restDaysInMonth: 5, restDaysTaken: 4, restDaysWorked: 1, restDayPayCents: restDayPayDue(salary, 1), amountPaidCents: salary + restDayPayDue(salary, 1), paidOn: "2026-05-31" }), answer: { decision: "acknowledge", reasons: [], underProtest: false } },
  { record: base("2026-06", { restDaysTaken: 2, restDaysWorked: 2, paidOn: "2026-07-04" }), answer: { decision: "dispute", reasons: ["rest_day_pay_missing"], underProtest: false } },
  { record: base("2026-07", { deductions: [{ label: "Broken vase", cents: 5_000 }], amountPaidCents: 60_000, paidOn: "2026-07-31" }), answer: { decision: "acknowledge", reasons: [], underProtest: true } },
  { record: base("2026-08", { restDaysInMonth: 5, restDaysTaken: 5, paidOn: "2026-09-12", method: "paynow", paymentReference: "PAYNOW-20260912-4471" }), answer: { decision: "acknowledge", reasons: [], underProtest: false } },
  // September has no record at all: its deadline (7 October) has passed, so it shows as missing.
];

for (const { record, answer } of months) {
  const recordHash = hashRecord(record);
  const row = await store.insertRecord({ employmentId, record, recordHash, employerSignature: await employer.sign(recordHash, rp) });
  if (!row) throw new Error(`Duplicate ${record.period}`);
  const period = periodToNumber(record.period);
  await store.setRecordAnchor(row.id, { proposalTx: (await writer.propose(employmentId, period, recordHash)).txHash });
  if (answer) {
    const decision: Decision = { version: 1, recordHash, ...answer };
    const decisionHash = hashDecision(decision);
    await store.saveDecision(row.id, decision, decisionHash, await worker.sign(decisionHash, rp));
    await store.setRecordAnchor(row.id, { decisionTx: (await writer.decide(employmentId, period, recordHash, decisionHash, answer.decision === "dispute")).txHash });
  }
  console.log(`Anchored ${record.period}`);
}

await close();
console.log(`\nDemo worker:   ${rp.origin}/w/${workerToken}`);
console.log(`Demo employer: ${rp.origin}/e/${employerToken}`);
console.log(`Set NEXT_PUBLIC_DEMO_PATH=/w/${workerToken} to link the demo from the home page.`);
