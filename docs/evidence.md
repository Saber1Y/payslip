# Base Sepolia evidence

This log records the exact commands run on 22 October 2026 to deploy Payslip to Base Sepolia and test it end to end, with the transactions they produced.
Every transaction below can be opened on Basescan.

## Setup

| Item | Value |
| --- | --- |
| Network | Base Sepolia, chain id 84532 |
| RPC | `https://sepolia.base.org` (public) |
| Deployer and relayer | [`0x04b6Dd4d9D510f503C6C0573C0967f27bD9d30B8`](https://sepolia.basescan.org/address/0x04b6Dd4d9D510f503C6C0573C0967f27bD9d30B8), a testnet-only key |
| Funding | 0.02 ETH from the Alchemy Base Sepolia faucet |
| `RecordRegistry` | [`0x2efdab0a0a7fe2bffd8750d51c53613704e45b93`](https://sepolia.basescan.org/address/0x2efdab0a0a7fe2bffd8750d51c53613704e45b93) |

The Base Sepolia settings live in `.env.base-sepolia`, which git ignores.
`scripts/with-env.mjs` loads it ahead of `.env`, so the local Anvil setup keeps working unchanged.
Base Sepolia records go into a separate database, `payslip_base_sepolia`, so they never mix with local Anvil records.

## 1. Deploy

```bash
cd Payslip
pnpm contracts:build
pnpm deploy:base-sepolia
```

```text
Deployer 0x04b6Dd4d9D510f503C6C0573C0967f27bD9d30B8 on Base Sepolia: balance 0.02, estimated cost 0.000003811878
Submitted 0x30b0e8171ee6e0aa214d5f956e14c5ad8a31896096eb2b94f5fb7317ba950e51
{
  "contract": "RecordRegistry",
  "address": "0x2efdab0a0a7fe2bffd8750d51c53613704e45b93",
  "txHash": "0x30b0e8171ee6e0aa214d5f956e14c5ad8a31896096eb2b94f5fb7317ba950e51",
  "blockNumber": "48913883",
  "chainId": 84532
}
```

The script checks that the RPC reports chain 84532 and that the deployed runtime bytecode equals the Foundry build before printing the address.
A read call returned `MAX_ENTRIES_PER_PERIOD() = 32` and an empty employment for an unknown id.

## 2. Database and demo history

```bash
cd Payslip
docker exec payslip-postgres-1 createdb -U payslip payslip_base_sepolia
pnpm db:migrate:base-sepolia
pnpm seed:base-sepolia
```

The seed opens one demo employment (Tan household and Maria Santos, from April 2026) and anchors five months.
Its records are signed with software P-256 keys, labelled as demo keys everywhere they appear.

| Anchor | Transaction |
| --- | --- |
| Employment opened | [`0xa0c49594…`](https://sepolia.basescan.org/tx/0xa0c495949bd04b90c8af52c8230ea23697c31b35ccb3ed0d38ec37342ce680f2) |
| April proposed / acknowledged | [`0xf518bd96…`](https://sepolia.basescan.org/tx/0xf518bd96c6e3a13b42ab628a3ae346d7b11eaa065108a1ef6cead9ac0926a63b) / [`0x51935b9a…`](https://sepolia.basescan.org/tx/0x51935b9a1e5110c8461c3e3433dbd55645370aafd98577a3da6d5e42b0ebf81d) |
| May proposed / acknowledged | [`0x14be046b…`](https://sepolia.basescan.org/tx/0x14be046b3505c92dca4621b0525a875cf44faa4ad37e3d4e2cb437752a5696ef) / [`0x44283c39…`](https://sepolia.basescan.org/tx/0x44283c39053e92c29088dbdc84cee6e4906c59a921938e4a9420824f59515fe4) |
| June proposed / disputed | [`0x00e0e9db…`](https://sepolia.basescan.org/tx/0x00e0e9dba89698d6aedc378cfb113c8394f7ccad87e1b3d0918a5f03aa868991) / [`0x00fd2b4a…`](https://sepolia.basescan.org/tx/0x00fd2b4a6619b706e39483b3ba70a4a32dd1d346d4cfa2ab532d7a9f6919401a) |
| July proposed / acknowledged under protest | [`0x031a3683…`](https://sepolia.basescan.org/tx/0x031a368383906c34d9061f1b65b3c3e4ac1dc9a8f252ad11b96979f813b82c7e) / [`0x82d215be…`](https://sepolia.basescan.org/tx/0x82d215bee9231a5ebc00bfee56e3e952682f8a5f5f1252db658f1f1adbfe82ea) |
| August proposed / acknowledged | [`0xe349e1fe…`](https://sepolia.basescan.org/tx/0xe349e1fed400518a145e659b364cf090225b62162ca5f60f166dede9e026f707) / [`0x7c3af599…`](https://sepolia.basescan.org/tx/0x7c3af5991b5eae11a26047077d30b72e23ff70cac942b136044fa77f14b987de) |

September has no record on purpose, so it shows as missing after its 7 October deadline.

## 3. The app against Base Sepolia

```bash
cd Payslip
pnpm dev:base-sepolia  # http://localhost:3020
```

**Demo packet.**
On the demo worker page, *Check it now* verified the packet in the browser.
The browser's resource log shows its reads went to `https://sepolia.base.org` directly.
Result: every record matches what was signed and anchored; 0 altered, 1 disputed (June), 1 missing month (September), 3 rule flags (June rest-day pay, August paid late, September missing).

**Live flow.**
A new employment, Wong household and Ana Reyes (S$680 a month, from September 2026), went through the whole app:

| Step | Result | Transaction |
| --- | --- | --- |
| Employer creates a passkey on `/start` | Employment saved, invite and employer links issued | - |
| Worker opens the invite and creates a passkey | Agreement and both key hashes anchored | [`0x4a663268…`](https://sepolia.basescan.org/tx/0x4a663268d4736a7e2cbf31a720aae74a668433da52810ee9d0fac8f6f20fec2b) (block 48915865) |
| Employer records September: 1 rest day worked, paid 5 Oct, S$706.15 | Server verified the signature; proposal anchored | [`0xa1342928…`](https://sepolia.basescan.org/tx/0xa1342928969552f25422648faed690d6014a2c377fd72b26ab25f2db159c3871) (block 48915975) |
| Worker answers *Yes, it's correct* and signs | Server verified the signature; acknowledgement anchored | [`0xc5a308bb…`](https://sepolia.basescan.org/tx/0xc5a308bb7e2f0bf5b4e70007dd5bf4eb63cff48c5264009ffafd242d1ee5ff92) (block 48916063) |
| Worker presses *Check it now* | Every record matches what was signed and anchored | - |
| A copy with the amount changed to S$750 is dropped on `/verify` | Reported as altered: the employer's signature is for a different record; rule checks skipped | - |

The S$706.15 is S$680 plus one day's pay for the rest day worked (S$680 / 26 = S$26.15).

## 4. Independent check with cast

Read directly from the contract, without the app:

```bash
cast call 0x2efdab0a0a7fe2bffd8750d51c53613704e45b93 "getEntries(bytes32,uint32)((uint8,bytes32,bytes32,uint64)[])" 0xffc04838fa63b72a3d70f425d0076c508b8290e08a4b13be452b63049254d0b7 202609 --rpc-url https://sepolia.base.org
```

```text
[(1, 0x9ae78116acf585b2137f5cc597bb33e5c26fd541aa6bb140dd87ef2e4ade672e, 0x0000000000000000000000000000000000000000000000000000000000000000, 1792705063),
 (2, 0x9ae78116acf585b2137f5cc597bb33e5c26fd541aa6bb140dd87ef2e4ade672e, 0xc193aca039e04b79c193611bd12efeb11f1142a362f0ad98cdbdebd4d43d8002, 1792705081)]
```

Kind 1 is the employer's proposal and kind 2 the worker's acknowledgement.
Both hashes equal the record hash and decision hash the app stored, and all three transaction receipts report status 1 (success).
After everything above, the relayer still held 0.019986 ETH.

## What was simulated

The in-app browser could not complete a real passkey prompt without a person, so the live flow used an in-page authenticator that produces the same WebAuthn assertion format (ES256 over `authenticatorData || SHA-256(clientDataJSON)`).
The server and the verifier checked those signatures with the same code they use for real passkeys.
A real Touch ID or phone passkey has not been tested yet.
