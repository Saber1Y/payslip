import { defineChain, type Address, type Chain } from "viem";
import { z } from "zod";

/**
 * Where RecordRegistry lives. The same values are needed in the browser (the verify page reads the chain
 * itself, never through Payslip's server), so they come from NEXT_PUBLIC_* variables in the web app.
 */
export const chainConfigSchema = z.object({
  chainId: z.coerce.number().int().positive(),
  name: z.string().min(1),
  rpcUrl: z.string().url(),
  registry: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "registry must be a 20-byte address") as unknown as z.ZodType<Address>,
  explorerUrl: z
    .string()
    .url()
    .nullable()
    .transform((v) => v || null),
});
export type ChainConfig = z.infer<typeof chainConfigSchema>;

export function parseChainConfig(input: {
  chainId: string | undefined;
  name: string | undefined;
  rpcUrl: string | undefined;
  registry: string | undefined;
  explorerUrl: string | undefined;
}): ChainConfig {
  return chainConfigSchema.parse({ ...input, explorerUrl: input.explorerUrl || null });
}

export function toViemChain(config: ChainConfig): Chain {
  return defineChain({
    id: config.chainId,
    name: config.name,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } },
    blockExplorers: config.explorerUrl ? { default: { name: "Explorer", url: config.explorerUrl } } : undefined,
  });
}

export function explorerTxUrl(config: Pick<ChainConfig, "explorerUrl">, txHash: string): string | null {
  return config.explorerUrl ? `${config.explorerUrl.replace(/\/$/, "")}/tx/${txHash}` : null;
}

export function explorerAddressUrl(config: Pick<ChainConfig, "explorerUrl">, address: string): string | null {
  return config.explorerUrl ? `${config.explorerUrl.replace(/\/$/, "")}/address/${address}` : null;
}
