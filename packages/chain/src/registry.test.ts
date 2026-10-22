import { spawn, type ChildProcess } from "node:child_process";
import { buildPacket, hashDecision, hashEmployment, hashRecord, keyHash, periodToNumber, verifyPacket } from "@payslip/core";
import { makeParties, makeRecord, signMonth } from "@payslip/core/test-fixtures";
import { createPublicClient, createWalletClient, http, type Address, type PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { recordRegistryAbi, recordRegistryBytecode } from "./abi";
import { createRegistryReader, createRegistryWriter, type RegistryWriter } from "./registry";
import { toViemChain } from "./config";

// Runs the real contract on a throwaway Anvil node. Anvil ships with Foundry, which the contracts need anyway.
const PORT = 8600 + Math.floor(Math.random() * 300);
const RPC = `http://127.0.0.1:${PORT}`;
// Anvil's first well-known development account. Never used outside a local node.
const DEV_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const ACK = { decision: "acknowledge" as const, reasons: [], underProtest: false };

let anvil: ChildProcess;
let client: PublicClient;
let writer: RegistryWriter;
let registry: Address;

beforeAll(async () => {
  anvil = spawn("anvil", ["--port", String(PORT), "--silent"], { stdio: "ignore" });
  const chain = toViemChain({ chainId: 31337, name: "Anvil", rpcUrl: RPC, registry: "0x0000000000000000000000000000000000000000", explorerUrl: null });
  client = createPublicClient({ chain, transport: http(RPC) });
  for (let i = 0; i < 50; i++) {
    try {
      await client.getChainId();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  const wallet = createWalletClient({ account: privateKeyToAccount(DEV_KEY), chain, transport: http(RPC) });
  const hash = await wallet.deployContract({ abi: recordRegistryAbi, bytecode: recordRegistryBytecode });
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error("deployment failed");
  registry = receipt.contractAddress;
  writer = createRegistryWriter(wallet, client, registry);
}, 20_000);

afterAll(() => {
  anvil?.kill();
});

describe("RecordRegistry on a local chain", () => {
  it("anchors a month end to end and verifies the packet from chain state alone", async () => {
    const parties = await makeParties();
    const { employment } = parties;
    await writer.openEmployment(employment.employmentId, hashEmployment(employment), keyHash(employment.worker.key), keyHash(employment.employer.key));

    const april = await signMonth(parties, makeRecord("2026-01"), ACK);
    const recordHash = hashRecord(april.record);
    await writer.propose(employment.employmentId, periodToNumber("2026-01"), recordHash);
    if (!april.decision) throw new Error("fixture has no decision");
    await writer.decide(employment.employmentId, periodToNumber("2026-01"), recordHash, hashDecision(april.decision), false);

    const reader = createRegistryReader(client, registry);
    const entries = await reader.getEntries(employment.employmentId, 202601);
    expect(entries.map((e) => e.kind)).toEqual(["proposed", "acknowledged"]);

    const packet = buildPacket({ chain: { chainId: 31337, name: "Anvil", registry, explorerUrl: null }, employment, months: [april], generatedAt: new Date() });
    const result = await verifyPacket(packet, reader, "2026-02-01");
    expect(result.ok).toBe(true);
    expect(result.months[0]?.verdict).toBe("verified");
  });

  it("refuses a decision for a record that was never proposed", async () => {
    const parties = await makeParties({ employmentId: `0x${"77".repeat(32)}` });
    const { employment } = parties;
    await writer.openEmployment(employment.employmentId, hashEmployment(employment), keyHash(employment.worker.key), keyHash(employment.employer.key));
    await expect(writer.decide(employment.employmentId, 202601, `0x${"99".repeat(32)}`, `0x${"98".repeat(32)}`, true)).rejects.toThrow(/UnknownProposal/);
  });

  it("reports an unopened employment as missing", async () => {
    expect(await createRegistryReader(client, registry).getEmployment(`0x${"55".repeat(32)}`)).toBeNull();
  });
});
