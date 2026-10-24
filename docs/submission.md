# DoraHacks submission: Payslip

Copy for the Web3 for Social Good Hackathon 2026 BUIDL form, Tech Track.
Submissions close 25 October 2026, 00:00 UTC (08:00 in Singapore).

## Before you paste

- If you have tested on a real phone or laptop passkey, add one line to *What is live right now* saying so; it is not claimed below.
- Add the demo video link once it is uploaded.

## Form fields

**BUIDL name:** Payslip

**Vision (one line):**
Salary records that migrant domestic workers own: employer and worker both sign each month with a passkey, and a fingerprint goes on Base so nobody can rewrite it.

**Track:** Tech Track

**Tags:** Social Impact, Decentralized Identity, Public Goods, Base, Ethereum, Passkeys

**GitHub:** https://github.com/Saber1Y/payslip

**Website:** https://payslip-sand.vercel.app

**Demo worker (put in the description if there is no separate field):** https://payslip-sand.vercel.app/w/beS_ioXSFuP-RACnEjMW80wZKYCw7nsdQLRXJPkyKZg

**Contract:** https://sepolia.basescan.org/address/0x2efdab0a0a7fe2bffd8750d51c53613704e45b93

**Demo video:** add the link once recorded (script below).

## Description (paste as the BUIDL details)

### Payslip: the salary notebook, made tamper-proof

Every month the employer records the salary, the rest days and the payment, and signs it with a passkey.
The migrant domestic worker checks it on their own phone and signs it, signs it under protest, or disputes it with reasons.
Only a fingerprint of each signed record is anchored on Base, so nobody can quietly rewrite a month afterwards, and anyone can verify the records in their browser without trusting Payslip.

### The problem

Singapore has 323,800 migrant domestic workers (MOM Work Permit figures, June 2026).
MOM already requires the employer and the worker to sign each cash salary record.
In practice that record is a notebook the employer keeps, so when there is a dispute about unpaid salary, missed rest days or deductions, it is the employer's notebook against the worker's word.
The worker usually has no copy, and loses access entirely when they change employer or are sent home.

### How it works

1. **Employer records the month.**
Salary, weekly rest days taken or worked, rest-day pay (MOM's salary ÷ 26 rule is filled in), deductions, the amount paid, the date, and cash, bank transfer or PayNow with the bank's transfer reference.
Live checks show MOM rule problems before signing.
2. **Both sides sign with passkeys.**
The WebAuthn challenge is the record's keccak256 fingerprint, so a signature covers exactly the reviewed numbers.
No wallets, seed phrases or gas for the worker: a relayer pays gas and cannot forge anything, because every hash is backed by a signature anyone can check.
3. **Fingerprints go on-chain.**
`RecordRegistry` on Base Sepolia stores the agreement hash and both passkey key hashes, then each month's proposal and the worker's answer, append-only.
Names and salaries never go on-chain.
A dispute can never be erased, and a month with no record after MOM's 7-day deadline is reported as missing.
4. **The worker owns the evidence.**
The worker downloads a claim packet, shares it with HOME, the Centre for Domestic Employees, MOM or a lawyer through a link they can stop at any time, or prints an A4 copy with a QR code.
The recipient's browser re-hashes every record, checks both passkey signatures with WebCrypto, and reads the anchors straight from Base: altered months, missing months and MOM rule breaches are flagged.
5. **Lost link, not lost records.**
A worker who loses their link signs in with their passkey and gets a new one; the old link stops working.

### What is live right now

- The app: https://payslip-sand.vercel.app (Vercel and Neon Postgres in Singapore).
- `RecordRegistry` on Base Sepolia: https://sepolia.basescan.org/address/0x2efdab0a0a7fe2bffd8750d51c53613704e45b93, with bytecode checked against the build.
- A demo worker with six months of history, including a dispute, a signature under protest, a late payment, a PayNow reference and a missing month: https://payslip-sand.vercel.app/w/beS_ioXSFuP-RACnEjMW80wZKYCw7nsdQLRXJPkyKZg.
Press *Check it now* to verify it against the chain.
- Every command and transaction from deployment and end-to-end testing: https://github.com/Saber1Y/payslip/blob/main/docs/evidence.md.
- 44 automated tests: 32 core tests (MOM rules including MOM's own worked example, passkey signature checks, tamper detection), 3 tests that run the real contract on a local chain, and 9 Foundry contract tests including a fuzz test.

Honest scope: the demo history is signed with software keys, labelled as demo data on every screen; the anchors are real Base Sepolia transactions.
The live flows were tested end to end in a desktop browser with a simulated authenticator that produces the same WebAuthn signatures as a real passkey.
Payslip records payments; it does not move money, give legal advice or replace MOM's processes.

### Why Web3, and why it matters here

- **Nobody can rewrite history**: not the employer, not the worker, not Payslip.
An edited month no longer matches its on-chain fingerprint and is reported as altered.
- **The worker owns the record**: it survives a change of employer, a lost phone or Payslip disappearing, because verification needs only the packet and a public chain.
- **Disputes are timestamped before any claim is filed**, which is exactly what a wage claim lacks today.
- **No crypto UX for the worker**: passkeys use the fingerprint or face they already unlock their phone with.

### Judging criteria

- **Social impact (30%)**: salary paid on time and rest days are the protections MOM sets out for migrant domestic workers, and they are exactly what a worker has to prove in a dispute; Payslip digitises a record MOM already requires and puts a copy in the worker's hands.
- **Solution quality (25%)**: a working product, end to end, on a public testnet, with the evidence log and 44 tests.
- **Meaningful use of Web3 (20%)**: on-chain anchoring is the part that makes the record trustworthy to a third party; signatures are standard passkeys; nothing private is public.
- **Feasibility and sustainability (15%)**: two anchors per worker per month; on Base Sepolia the 28 anchors and the deployment so far cost 0.00003 test ETH in total.
It replaces a legal requirement employers already have, so adoption does not depend on a new obligation, and honest employers get a clean record that protects them too.
- **Presentation (10%)**: see the demo video.

### What's next (roadmap, not in the demo)

- Worker screens in Bahasa Indonesia, Tagalog and Burmese.
- A work-history credential when employment ends ("12 of 12 months paid on time, 0 disputes") the worker can show to a next employer or lender, without revealing the salary.
- Corrected re-proposals after a dispute, keeping the disputed version on record.
- Encrypted backups with recovery through a partner NGO, for a worker who loses their phone and passkey.
- A pilot with HOME or the Centre for Domestic Employees, then Base mainnet.

### Built with

Next.js 16, React 19, TypeScript, Tailwind CSS 4, viem, Zod, Drizzle with Postgres (Neon), Solidity 0.8.28 with Foundry, WebAuthn passkeys and WebCrypto, Base Sepolia.
The receipt and verification pattern is adapted from RelayMesh, an earlier project by the same builder.

## Demo video script (about 3 minutes)

Narration is in quotes, actions are in brackets, and each scene starts with the page you are on.
The employer and the worker each need their own passkey, so use two browsers: **Chrome as the employer** and **Safari (or your phone) as the worker**.
Always use https://payslip-sand.vercel.app exactly; passkeys do not work on any other address.

### Before you record (5 minutes, not filmed)

1. **Chrome, home page** https://payslip-sand.vercel.app → *Start as an employer*.
2. **Chrome, setup page** https://payslip-sand.vercel.app/start → household "Lim family", worker "Siti", salary `700`, rest day Sunday, first month **September 2026** → *Create passkey and continue* → Touch ID.
3. **Chrome, links screen** (still /start) → copy the **invite link** (`/w/…`) and paste it into a note; also save **your employer link** (`/e/…`).
4. **Safari, worker invite page** `https://payslip-sand.vercel.app/w/…` (the invite link) → *Create my passkey* → Touch ID.
The page now says "Worker's page · Siti".
5. Open a third tab on **Basescan** so you can switch to it during the video.
6. Have two tabs ready in Chrome: your **employer page** `/e/…` and the **demo worker** https://payslip-sand.vercel.app/w/beS_ioXSFuP-RACnEjMW80wZKYCw7nsdQLRXJPkyKZg.

September is now past MOM's 7-day deadline with nothing recorded, so it shows as *Missing*, which is a good opening shot for the employer page.

### Scenes

**0:00 to 0:20, the problem**
Page: **home** https://payslip-sand.vercel.app (Chrome).
[Start on the headline.]
"Singapore has over 320,000 migrant domestic workers.
MOM already requires both the employer and the worker to sign each cash salary record.
Today that record is a notebook the employer keeps.
When there's a dispute, it's the employer's notebook against the worker's word."

**0:20 to 0:35, the idea**
Page: **home**, scrolled to "One month, four steps".
"Payslip puts that record on both phones.
Both people sign every month with a passkey, and a fingerprint of the record goes on Base, so nobody can rewrite it later."

**0:35 to 1:20, the employer records a month**
Page: **employer page** `https://payslip-sand.vercel.app/e/…` (Chrome).
The badge reads "Employer's page · Lim family", and September is stamped *Missing*.
[Press *Record this month* on September.]
"The employer records the salary and the rest days."
[Set *Rest days worked instead* to 2.]
"Payslip fills in MOM's minimum rest-day pay: salary divided by 26."
[Set *Paid on* to 12 October.]
"Paying after the 7-day deadline is flagged before anything is signed."
[Choose *PayNow* and type a reference such as `PAYNOW-20261012-4471`.]
"For a bank transfer or PayNow, the bank's own reference goes into the signed record."
[Press *Sign and send to Siti*, approve with Touch ID.]
"The employer signs with a passkey: no wallet, no seed phrase."
[Click the *Employer's record anchored* link.]
Page: **Basescan** transaction page.
"The fingerprint is on Base."

**1:20 to 1:55, the worker answers**
Page: **worker page** `https://payslip-sand.vercel.app/w/…` (Safari or phone).
The badge reads "Worker's page · Siti" and the title says "1 month needs your answer".
[Press *Review and answer* on September.]
"The worker checks it on their own phone."
[Choose *Something is wrong*, tick *I was paid late*, press *Sign my dispute*, approve with Touch ID.]
"They can sign, sign under protest, or dispute with reasons.
The dispute is anchored too, and can never be erased."
[The stamp changes to *Disputed*.]

**1:55 to 2:30, anyone can verify**
Page: **demo worker** https://payslip-sand.vercel.app/w/beS_ioXSFuP-RACnEjMW80wZKYCw7nsdQLRXJPkyKZg (Chrome).
"Here's six months of a worker's history."
[Press *Check it now*.]
Page: **check page** https://payslip-sand.vercel.app/verify (opens on its own).
"The check runs entirely in this browser: every record is fingerprinted again, both signatures are verified, and the anchors are read straight from Base.
Payslip's server isn't trusted."
[Scroll over the stamps.]
"A disputed June, a July signed under protest, a late August, and a September with no record at all, flagged as missing."
[Go back to the demo worker page, press *Download*, change one amount in the file, then open *Check records* (top right) and drop the file in.]
Page: **check page** https://payslip-sand.vercel.app/verify.
"If anyone edits a single number, that month shows as altered."

**2:30 to 2:50, the worker shares**
Page: **worker page** `https://payslip-sand.vercel.app/w/…` (Safari, Siti's page).
[In *Share with an NGO or MOM*, type HOME, press *Create a share link*, then *Print with QR code*.]
Page: **print page** `https://payslip-sand.vercel.app/s/…/print`.
"The worker shares a link with an NGO, which they can stop at any time, or prints a page for an officer.
The QR code opens the same live check."

**2:50 to 3:00, close**
Page: **home** https://payslip-sand.vercel.app.
"Payslip doesn't touch the money.
It makes the record of the money impossible to rewrite, and puts it in the worker's hands."

### Pages at a glance

| Page | Address | Who uses it |
| --- | --- | --- |
| Home | https://payslip-sand.vercel.app | Everyone |
| Employer setup | https://payslip-sand.vercel.app/start | Employer, once |
| Employer page | `https://payslip-sand.vercel.app/e/…` (your employer link) | Employer, every month |
| Worker page | `https://payslip-sand.vercel.app/w/…` (the invite link) | Worker, every month |
| Check records | https://payslip-sand.vercel.app/verify | NGOs, MOM, lawyers |
| Shared packet | `https://payslip-sand.vercel.app/s/…` and `/s/…/print` | Whoever the worker shares with |
| Lost link | https://payslip-sand.vercel.app/recover | Anyone with their passkey |
| Demo worker | https://payslip-sand.vercel.app/w/beS_ioXSFuP-RACnEjMW80wZKYCw7nsdQLRXJPkyKZg | Judges |

## Announcement post (optional)

Payslip: salary records migrant domestic workers own.
Employer and worker both sign each month with a passkey, and a fingerprint goes on Base so nobody can rewrite it.
Live on Base Sepolia for the Web3 for Social Good Hackathon 2026 (SMU, GSR Foundation, UMA).
https://payslip-sand.vercel.app
