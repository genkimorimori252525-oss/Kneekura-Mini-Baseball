# Returned-owner evidence for ordinary closure completion

The test harness now records each real ordinary-completion owner return synchronously: official application, scoring, actual pitch effort, pitcher workload, and the final closure resume. Exact completion retry adds its own returned result. Each actual value is copied only for evidence, written to an exclusive private file and fsynced before a small fsynced journal event identifies it. Existing progress callbacks also go directly to that journal. A separate final observation receipt binds the trace to the actual closed stage receipt.

Production and existing continuation code under `src` are byte-identical to the qualified Q1 source tree `7e54641d26f28813ea1a8c3c84e5e0b3ee3ef1ff`. New files live under `tools/verification/terminal-completion`; their complete checkpoint and frozen-source group pin the additional harness. Thus the existing v2 predecessor source lineage stays exact. No physical or queue gate is repeated.

Official class methods retain their real receiver. The frozen factory stores receive separate frozen forwarding facades that call every method against the original owner. Returned values and owner exceptions pass through unchanged. Hooks install after module initialization, before owners open, with immediate reverse-order restoration registration. There are no module resets, importOriginal cycles, global SQL hooks, alternate owner receipts or reconstructed successful readers. The fixture calls public resume, whose completion transaction has committed before return; the facade does not claim to intercept lexical calls made inside submit.

The postflight requires six independently observed actual returns in order: one official dispatch, scoring, effort, workload, completion and completion retry. It compares the earlier real returns with the final result and rejects missing, duplicate or mismatched observations. Workload apply's actual after-state remains distinct from the final closure's composite workload receipt. A recording/fsync failure after a returned owner fails the fixture; it neither retries the owner nor claims rollback or compensating repair.

Ten structural contracts passed after observed missing-API RED cuts. They cover original receiver/argument/result identity, unchanged reader/close binding, owner exceptions, post-return recording failure, real fsynced observation files, separate effort/workload values and final retry, prototype binding, partial-install cleanup, exact return inventory, and installation/restoration against every real exported owner surface without opening an owner. Fake owners in these tests are explicitly structural and do not substitute for original physical proofs.

Exact supervised terminal SHA-256 values:

- Six initial RED: `428dfdcaeedbca27da74815dd5e808bab7c90a631dfed4fd60c5da3b196aa4b3`
- Three binding/cleanup/inventory RED with six passes: `2799de83ba2657a0d44bc53811e757794a4d88df4cf2eb67148ee6b88d35321b`
- Real module-wiring RED with nine passes: `afee834cdf9a9c1e01342c2159affb30e9cbe5ef77507ea91ab959fe0ca8b5a8`
- Final ten GREEN: `6053d0b65dfd1664dbcb319ad480bd0567b5e1eb8c2952b61fa92bbe102a8154`
- Final compiler PASS: `45ac977a5c0e8affdec866a3be437870f8791f43e79dd9c4ca37e22e835f0797`

The full compiler includes all `src` and the new harness, using the reviewed 1664/1760/2304 MiB old/measured/RSS profile and 180-second cap. It passed with no diagnostics; the final harness bytes match the ten-case GREEN snapshot. The first compiler found an incorrect scoring-module import path and remains a failed compiler receipt (`d7921dfc71de6025b6beb98c77bdcb42af138a76fb77e56f5f0e02688adac0de`); the corrected real-module wiring and final compiler qualify the final cut. Earlier snapshot/path admission failures launched no test and earn no RED credit.

The separate genuine completion packet was reviewed and launched on 2026-10-08. Its result remains pending; source qualification is not an ordinary-completion pass. Its only input is the already qualified closed Q1 descendant; ordinary official/scoring/workload owners and their existing retry/reopen proofs remain responsible for progression. Private values, databases, controls and traces stay outside source publication.
