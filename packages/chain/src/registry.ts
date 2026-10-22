import { ENTRY_KIND, type ChainEmployment, type ChainEntry, type EntryKind, type RegistryReader } from "@payslip/core";
import { zeroAddress, type Address, type Hex, type PublicClient, type WalletClient } from "viem";
import { recordRegistryAbi } from "./abi";

const KIND_BY_NUMBER = new Map<number, EntryKind>(Object.entries(ENTRY_KIND).map(([k, v]) => [v, k as EntryKind]));

export function createRegistryReader(client: PublicClient, registry: Address): RegistryReader {
  return {
    async getEmployment(employmentId): Promise<ChainEmployment | null> {
      const e = await client.readContract({ address: registry, abi: recordRegistryAbi, functionName: "getEmployment", args: [employmentId] });
      if (e.recorder === zeroAddress) return null;
      return { employmentHash: e.employmentHash, workerKeyHash: e.workerKeyHash, employerKeyHash: e.employerKeyHash, openedAt: Number(e.openedAt) };
    },
    async getEntries(employmentId, period): Promise<ChainEntry[]> {
      const list = await client.readContract({ address: registry, abi: recordRegistryAbi, functionName: "getEntries", args: [employmentId, period] });
      return list.map((e) => {
        const kind = KIND_BY_NUMBER.get(e.kind);
        if (!kind) throw new Error(`Unknown entry kind ${e.kind} from the registry`);
        return { kind, recordHash: e.recordHash, decisionHash: e.decisionHash, recordedAt: Number(e.recordedAt), txHash: null };
      });
    },
  };
}

export interface AnchorReceipt {
  txHash: Hex;
  blockNumber: bigint;
}

/** Each call is simulated first, then sent and awaited. A reverted transaction is an error, never a receipt. */
export function createRegistryWriter(wallet: WalletClient, client: PublicClient, registry: Address) {
  const account = wallet.account;
  if (!account) throw new Error("The relayer wallet has no account");
  const chain = wallet.chain;

  async function confirm(txHash: Hex): Promise<AnchorReceipt> {
    const receipt = await client.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 });
    if (receipt.status !== "success") throw new Error(`Registry transaction ${txHash} reverted`);
    return { txHash, blockNumber: receipt.blockNumber };
  }

  return {
    async openEmployment(employmentId: Hex, employmentHash: Hex, workerKeyHash: Hex, employerKeyHash: Hex) {
      const args = [employmentId, employmentHash, workerKeyHash, employerKeyHash] as const;
      await client.simulateContract({ account, address: registry, abi: recordRegistryAbi, functionName: "openEmployment", args });
      return confirm(await wallet.writeContract({ account, chain, address: registry, abi: recordRegistryAbi, functionName: "openEmployment", args }));
    },
    async propose(employmentId: Hex, period: number, recordHash: Hex) {
      const args = [employmentId, period, recordHash] as const;
      await client.simulateContract({ account, address: registry, abi: recordRegistryAbi, functionName: "propose", args });
      return confirm(await wallet.writeContract({ account, chain, address: registry, abi: recordRegistryAbi, functionName: "propose", args }));
    },
    async decide(employmentId: Hex, period: number, recordHash: Hex, decisionHash: Hex, disputed: boolean) {
      const args = [employmentId, period, recordHash, decisionHash, disputed] as const;
      await client.simulateContract({ account, address: registry, abi: recordRegistryAbi, functionName: "decide", args });
      return confirm(await wallet.writeContract({ account, chain, address: registry, abi: recordRegistryAbi, functionName: "decide", args }));
    },
  };
}
export type RegistryWriter = ReturnType<typeof createRegistryWriter>;
