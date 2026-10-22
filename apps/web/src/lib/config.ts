import { parseChainConfig, type ChainConfig } from "@payslip/chain";
import type { RelyingParty } from "@payslip/core";

/**
 * Public configuration, readable in the browser. Next.js inlines NEXT_PUBLIC_* at build time, so each
 * variable must be referenced by its full literal name.
 */
export function publicChainConfig(): ChainConfig {
  return parseChainConfig({
    chainId: process.env.NEXT_PUBLIC_CHAIN_ID,
    name: process.env.NEXT_PUBLIC_CHAIN_NAME,
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL,
    registry: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS,
    explorerUrl: process.env.NEXT_PUBLIC_EXPLORER_URL,
  });
}

export function relyingParty(): RelyingParty {
  const id = process.env.NEXT_PUBLIC_RP_ID;
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN;
  if (!id || !origin) throw new Error("NEXT_PUBLIC_RP_ID and NEXT_PUBLIC_APP_ORIGIN must be set (see .env.example)");
  return { id, origin };
}
