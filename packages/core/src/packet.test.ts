import { describe, expect, it } from "vitest";
import { buildPacket, verifyPacket, type Packet } from "./packet";
import { hashRecord } from "./record";
import { FakeRegistry, makeParties, makeRecord, signMonth, type Parties } from "./test-fixtures";
import { createSoftwareAuthenticator } from "./webauthn";

const CHAIN = { chainId: 31337, name: "Anvil", registry: "0x5FbDB2315678afecb367f032d93F642f64180aa3" as const, explorerUrl: null };
const ACK = { decision: "acknowledge" as const, reasons: [], underProtest: false };

async function scenario(): Promise<{ parties: Parties; registry: FakeRegistry; packet: Packet }> {
  const parties = await makeParties();
  const registry = new FakeRegistry();
  registry.open(parties.employment);
  const months = [
    await signMonth(parties, makeRecord("2026-01"), ACK),
    await signMonth(parties, makeRecord("2026-02"), ACK),
    await signMonth(parties, makeRecord("2026-03", { restDaysTaken: 2, restDaysWorked: 2 }), { decision: "dispute", reasons: ["rest_day_pay_missing"], underProtest: false }),
    await signMonth(parties, makeRecord("2026-04"), null),
  ];
  months.forEach((m) => registry.anchorMonth(m));
  return { parties, registry, packet: buildPacket({ chain: CHAIN, employment: parties.employment, months, generatedAt: new Date("2026-06-10T00:00:00Z") }) };
}

describe("claim packet verification", () => {
  it("verifies an honest packet and reports the months that never got a record", async () => {
    const { registry, packet } = await scenario();
    const result = await verifyPacket(JSON.parse(JSON.stringify(packet)), registry, "2026-06-10");
    expect(result.ok).toBe(true);
    expect(result.employment.problems).toEqual([]);
    expect(result.months.map((m) => m.verdict)).toEqual(["verified", "verified", "verified", "verified"]);
    expect(result.months[2]?.flags.map((f) => f.code)).toEqual(["DISPUTED", "REST_DAY_PAY_SHORT"]);
    expect(result.months[3]?.flags.map((f) => f.code)).toEqual(["AWAITING_WORKER"]);
    // May's deadline (7 June) has passed; June's has not.
    expect(result.missing.map((m) => m.period)).toEqual(["2026-05"]);
    expect(result.omitted).toEqual([]);
  });

  it("catches a record edited after it was signed and anchored", async () => {
    const { registry, packet } = await scenario();
    const edited = structuredClone(packet);
    const march = edited.months[2];
    if (!march) throw new Error("fixture has no March");
    march.record.amountPaidCents = 75_000;
    const result = await verifyPacket(edited, registry, "2026-06-10");
    expect(result.ok).toBe(false);
    expect(result.months[2]?.verdict).toBe("tampered");
    expect(result.months[2]?.problems).toContain("Employer signature: Signature is for a different record");
  });

  it("catches a record re-signed by the employer that differs from what was anchored", async () => {
    const { parties, registry, packet } = await scenario();
    const resigned = await signMonth(parties, makeRecord("2026-02", { amountPaidCents: 70_000 }), ACK);
    const result = await verifyPacket({ ...packet, months: packet.months.map((m) => (m.record.period === "2026-02" ? resigned : m)) }, registry, "2026-06-10");
    expect(result.months[1]?.verdict).toBe("tampered");
    expect(result.months[1]?.problems).toEqual(["This record does not match what was anchored on-chain for this month"]);
  });

  it("rejects a packet whose keys were swapped for someone else's", async () => {
    const { registry, packet } = await scenario();
    const stranger = await createSoftwareAuthenticator();
    const swapped = structuredClone(packet);
    swapped.employment.worker.key = stranger.key;
    const result = await verifyPacket(swapped, registry, "2026-06-10");
    expect(result.ok).toBe(false);
    expect(result.employment.problems).toEqual(["Employment details differ from what was anchored", "Worker key differs from the one anchored"]);
  });

  it("notices months left out of the packet and records never anchored", async () => {
    const { parties, registry, packet } = await scenario();
    const unanchored = await signMonth(parties, makeRecord("2026-05"), ACK);
    const result = await verifyPacket({ ...packet, months: [...packet.months.filter((m) => m.record.period !== "2026-01"), unanchored] }, registry, "2026-06-10");
    expect(result.omitted).toEqual(["2026-01"]);
    expect(result.months.find((m) => m.period === "2026-05")?.verdict).toBe("not_anchored");
    expect(hashRecord(unanchored.record)).toBe(result.months.find((m) => m.period === "2026-05")?.recordHash);
  });

  it("rejects malformed packets and duplicate months", async () => {
    const { registry, packet } = await scenario();
    await expect(verifyPacket({ ...packet, format: "other" }, registry, "2026-06-10")).rejects.toThrow();
    await expect(verifyPacket({ ...packet, months: [packet.months[0], packet.months[0]] }, registry, "2026-06-10")).rejects.toThrow("Duplicate period 2026-01");
  });
});
