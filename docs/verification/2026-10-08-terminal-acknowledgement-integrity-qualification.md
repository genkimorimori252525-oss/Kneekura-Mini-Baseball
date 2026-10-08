# Terminal acknowledgement retained-integrity qualification

## Bounded result and source attribution

The finite retained-artifact inventory passed **61 of 61 unique Native controls**, with no missing or duplicated selected case: 13 rollback/transaction controls, 24 strict-wire controls, 14 sibling-integrity controls, and 10 schema/cutover controls.

The first 45 cases ran at `cf5f83fb2c454cba431dbbffb22e44a238ef6001`, source tree `78ebf25d97a53aa85c990e6268871bb96e14c34a`. The final 16 ran after the test-only foreign-key fault-injector repair at `e91018e3796502cc3297df43baa1169a77a71f21`, source tree `8842f7add55d2609c43dc8f61ff6d4eb1c9058a2`. Production in both cohorts was byte-identical to `2a0b33242d8a094f595e516f4ce83d23d4c06bd0`. Every case authenticated a fresh exclusive copy through the current real owner before applying its fault. The original physical prerequisites were never regenerated. A01's separate one-write/retry/reopen success is recorded in the existing success checkpoint.

A transaction-boundary defect was subsequently reproduced and repaired at `2cecbce67b381f23e51e571e51cdffa5961aa15a`, source tree `37e82fbb5f42934d68d454142bb480135b21e84c`. That repaired source independently passed 80 LIGHT controls, its full focused compiler, genuine A01, and genuine A18–A20. Independent review found no blocking issue. **The 61-case stream below keeps its original-source attribution; it is not claimed as a 61-case rerun on the repair.** See [the transaction-boundary verification record](2026-10-08-terminal-transaction-boundary.md). Its later combined production/test candidate at `394ea995f58a689557f2c86d8c1436d1849945a8` independently passed 82 LIGHT controls and the full focused compiler; no Native source attribution is transferred by that combination.

## What the inventory proves

- Real acknowledgement UPDATE triggers affecting E, pitch, selected journal, application, Match, an acknowledgement-only competing claim, or an unrelated write roll back atomically. Main/temp/user schema side effects, peer freshness, transaction replacement, and failed rollback cleanup are covered.
- All acknowledgement stage/null mismatches, missing/extra/wrong fields, duplicate escaped keys, and noncanonical equal-value JSON reject through read/apply/acknowledge/enqueue without owner writes. Exact restoration authenticates again.
- Missing or damaged E, C, selected journal, application, Match, and physical pitch; a replaced pending marker; and a stale Match revision reject through all four routes without writes.
- Missing and genuine QUEUED Sources cannot acknowledge. Legacy CHECK still supports applied-null retries and refuses acknowledgement; impossible acknowledged/legacy rows, unapproved CHECK variants, extra cutover trigger/index objects, frozen legacy openers, user_version mismatch, and quoted-literal corruption fail closed.

## Exact stage evidence

| Stage | Passed | Supervisor terminal SHA-256 |
| --- | ---: | --- |
| first-pair-stablenames | 2 | `6bd8a981679e14bc3bc4eb9a38881d12f30ee968d30426abbbd259319f3a495a` |
| rollback-pitch-journal-application | 3 | `313fb5889b4dd152137551d22b9e4ca44d4e2c4af436193673465b0837233531` |
| rollback-match-claim-unrelated | 3 | `f056ea91868bffca971294406d7bb9b3d5157aee71be3be7dc56fc37c39051da` |
| rollback-transaction-cleanup | 3 | `8c6e1e575858913753622250013f196a323e3aac76dab47d3837bf12810f96fb` |
| rollback-schema | 3 | `9928ddd357fb8ea1a8ab7e2ccb2fee683434ebb489659fbc21c726f5f2b62e49` |
| wire-02-05 | 4 | `bba819473cb9481ab12d5189c32c337eed16cc441e3869ca1bcc7a412e39a5cd` |
| wire-06-10 | 5 | `67fc14cce08df5344eaae6e43a8555e51e96729edb4500a56a4f454e1ae55d70` |
| wire-11-15 | 5 | `ab34ad180a789350d1e3ddc902c95d50a6cdec230d1917c6ebf83c9d9c2cec64` |
| wire-16-20 | 5 | `f7411cf1893ee6ad9be5a43420a569804f2e2cf4b5de4f01fbce04a9f97c9781` |
| wire-21-24 | 4 | `a9caf9e6405ebf210fc991e7109427e8717ae618686c59687f030b9c975a0d5d` |
| siblings-01-04 | 4 | `f726b131cf55c6fab3d913ddad09514f69ccb860074eecccc61bf0cf3ec9de41` |
| siblings-05-08 | 4 | `2b0b8a5962091af0615db486b979656a96b4714ab864fa2fa169c5562a02bc43` |
| siblings-09-11-fixturefix | 3 | `ee888abc9b33e2bb4c4e2fed8bf51bc081cf82cefe717f25caa4a93440ea2b3b` |
| siblings-12-14-fixturefix | 3 | `a0bca4f392b1cd992079398bf38af864ebc390ddd1f39db767687627ad5f17f9` |
| schema-source-legacy-impossible-fixturefix | 3 | `0d06a2ecb75c25c7f31a093dc3be54a102e5fe1586d8b726a5bc69048fe8723a` |
| schema-layout-cutover-fixturefix | 3 | `4f88b73a26fee279435d9b8ba87954dd4ad49d703f5f832591c7c55b0b38cdfa` |
| schema-openers-version-literal-fixturefix | 3 | `f12804fde0fd1a5d47489da37dfb797f2fa1dad79d0cc7ea1b0c7d65d5e2a2ef` |
| schema-genuine-queued-fixturefix | 1 | `484177442209b6af1f8c7c509b21d909247cb51dd13eef05aabaaadd480efdd5` |

The companion [sanitized JSON inventory](2026-10-08-terminal-acknowledgement-integrity-qualification.json) records exact case names, report hashes, and bounded resource peaks. Each stage independently verified all four unchanged input groups, exact selected/skipped names, expected suite counts, runtime identity, zero unhandled/controller failures, and no remaining owned processes. The siblings-09–11-fixturefix stage additionally recorded six short-lived descendants whose exit codes were not waitable by the supervisor; its main child and esbuild had observed exit 0, and the terminal recorded no remaining owned process. This is preserved as an observation limit, not silently relabeled as six observed successful exits. Skipped cases receive zero credit; only the unique selected cases above count.

All Native stages used one worker, 1024 MiB old space, measured 1120 MiB V8 heap, 2048 MiB aggregate RSS, and a 2520-second external wall cap. Earlier helper-syntax and unstable generated-name failures remain recorded without being promoted to an exact successful stage. The first siblings-09–11 attempt was also uncredited: observer foreign-key enforcement prevented deliberate Match deletion/restoration. The test-only repair scopes FK disablement to the private observer, restores and verifies the original policy before any production route, and preserves rowid/bytes. Its tiny restoration RED, two-case GREEN and focused compiler are recorded in the companion JSON; no production FK policy changed.

## Remaining limits

The second independently genuine terminal origin remains unavailable, so a genuine cross-origin receipt swap stays open. Restoring an entire coherent older status/result checkpoint is not an external monotonic-history guarantee. The lightweight boundary tests directly cover reads and constructors; the equivalent queue writer was independently source-reviewed, not credited with a fabricated genuine write. Existing application, official journal, physical evidence, Match pending state, and post-play/next-pitch fences keep their stated scope.

This is not whole-project GREEN or completion of later scoring/workload/reset/new-pitch work. No UI/design, home-PC CI, merge, deployment, or private database/log publication was performed. Only sanitized source, tests, and evidence records are repository deliverables.
