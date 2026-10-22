// Deploys RecordRegistry to NEXT_PUBLIC_RPC_URL and checks the deployed code against the build.
// Requires DEPLOYER_PRIVATE_KEY funded on that chain. Run `pnpm contracts:build` first.
import { parseChainConfig, recordRegistryAbi, recordRegistryBytecode, toViemChain } from "@payslip/chain";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, createWalletClient, formatEther, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const key = process.env.DEPLOYER_PRIVATE_KEY;
if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
  console.error("Set DEPLOYER_PRIVATE_KEY to a 0x-prefixed 32-byte hex key (see .env.example).");
  process.exit(1);
}

// The registry address is what we are about to create, so a placeholder satisfies the config schema.
const config = parseChainConfig({
  chainId: process.env.NEXT_PUBLIC_CHAIN_ID,
  name: process.env.NEXT_PUBLIC_CHAIN_NAME,
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL,
  registry: "0x0000000000000000000000000000000000000000",
  explorerUrl: process.env.NEXT_PUBLIC_EXPLORER_URL,
});
const chain = toViemChain(config);
const client = createPublicClient({ chain, transport: http(config.rpcUrl) });
const actualChainId = await client.getChainId();
if (actualChainId !== config.chainId) {
  console.error(`RPC reports chain ${actualChainId}, but NEXT_PUBLIC_CHAIN_ID is ${config.chainId}.`);
  process.exit(1);
}

const account = privateKeyToAccount(key as Hex);
const wallet = createWalletClient({ account, chain, transport: http(config.rpcUrl) });
const balance = await client.getBalance({ address: account.address });
const gas = await client.estimateGas({ account, data: recordRegistryBytecode });
const gasPrice = await client.getGasPrice();
console.log(`Deployer ${account.address} on ${config.name}: balance ${formatEther(balance)}, estimated cost ${formatEther(gas * gasPrice)}`);
if (balance < gas * gasPrice) {
  console.error("Insufficient balance for the deployment estimate.");
  process.exit(1);
}

const txHash = await wallet.deployContract({ abi: recordRegistryAbi, bytecode: recordRegistryBytecode });
console.log(`Submitted ${txHash}`);
const receipt = await client.waitForTransactionReceipt({ hash: txHash, timeout: 180_000 });
if (receipt.status !== "success" || !receipt.contractAddress) {
  console.error(`Deployment failed: status ${receipt.status}`);
  process.exit(1);
}

const artifact = JSON.parse(readFileSync(join(import.meta.dirname, "../contracts/out/RecordRegistry.sol/RecordRegistry.json"), "utf8")) as {
  deployedBytecode: { object: Hex };
};
const code = await client.getCode({ address: receipt.contractAddress });
if (code !== artifact.deployedBytecode.object) {
  console.error("Deployed code does not match the compiled artifact.");
  process.exit(1);
}
console.log(JSON.stringify({ contract: "RecordRegistry", address: receipt.contractAddress, txHash, blockNumber: receipt.blockNumber.toString(), chainId: config.chainId }, null, 2));
console.log(`Set NEXT_PUBLIC_REGISTRY_ADDRESS=${receipt.contractAddress} in .env`);
