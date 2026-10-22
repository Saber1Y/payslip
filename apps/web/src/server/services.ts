import "server-only";
import { createRegistryReader, createRegistryWriter, toViemChain, type RegistryWriter } from "@payslip/chain";
import type { RegistryReader } from "@payslip/core";
import { connectDb, createStore, type DbHandle, type Store } from "@payslip/db";
import { createPublicClient, createWalletClient, http, type Hex, type PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { publicChainConfig } from "@/lib/config";

// Long-lived connections are cached on globalThis so Next.js dev reloads do not leak sockets.
const cache = globalThis as typeof globalThis & {
  __payslipDb?: DbHandle;
  __payslipClient?: PublicClient;
  __payslipWriter?: RegistryWriter;
};

export function getStore(): Store {
  if (!cache.__payslipDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
    cache.__payslipDb = connectDb(url);
  }
  return createStore(cache.__payslipDb.db);
}

function getClient(): PublicClient {
  if (!cache.__payslipClient) {
    const config = publicChainConfig();
    cache.__payslipClient = createPublicClient({ chain: toViemChain(config), transport: http(config.rpcUrl) });
  }
  return cache.__payslipClient;
}

export function getReader(): RegistryReader {
  return createRegistryReader(getClient(), publicChainConfig().registry);
}

/** The relayer pays gas for anchors. Without a key, records are stored but reported as not anchored. */
export function getWriter(): RegistryWriter | null {
  if (cache.__payslipWriter) return cache.__payslipWriter;
  const key = process.env.RELAYER_PRIVATE_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) return null;
  const config = publicChainConfig();
  const wallet = createWalletClient({ account: privateKeyToAccount(key as Hex), chain: toViemChain(config), transport: http(config.rpcUrl) });
  cache.__payslipWriter = createRegistryWriter(wallet, getClient(), config.registry);
  return cache.__payslipWriter;
}
