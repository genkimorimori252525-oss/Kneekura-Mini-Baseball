# Recovered activation readiness candidate

This Draft preserves the reviewed repair that hands an already authenticated historical readiness result from prior-closure validation into the same native activation read. Every prior scope still finishes, raw owner rows are checked again, final application identity and bytes remain checked, and independent operations authenticate freshly. Legacy autocommit and prepare-only behavior stays explicit.

The candidate is based on PR352 head `ae366870d28fab9061f0c5b673dc39cbc8ed7a21`. Its source tree is `a84ccc9ac2c45e66d0a6f07afc67af0bf3db6c75`. The recovered two-file production patch matches its original SHA-256 `406abae4b59c0f17b0cd7df078f90d84f4f4195d3a126de23b7125e9ec646a69`; all four recovered test/support files also match retained original file hashes. The focused compiler configuration was recovered from text, with its original byte identity unverified.

Workspace replacement on 2026-10-07 destroyed the previous raw test receipts and private artifacts. They are not inherited by this checkpoint. A fresh focused compiler passed on test-only baseline `5f4a0cc1a7f9d60517ddd2b3e8240a7c17d0a7fb`, before the production patch. The earlier full-project compiler attempt failed at its 1024 MiB V8 old-space limit. A subsequent bounded compiler launcher stopped in its preload because it incorrectly expected total V8 heap to be at most 1088 MiB; the exact Node 26.10 binary reports 1120 MiB for the 1024 MiB old-space setting. That launcher failure was reaped and produced no test credit.

At the initial recovery publication, the production candidate had not passed a fresh compiler or runtime gate. The timestamped results below supersede that status for the 31 new cases, 105 adjacent cases, 110 boundary cases and fresh continuation from a published closed input through official application, the ten-player role/workload stage and next-actor/physical-TAKE continuation. The genuine two-completed-prior fixture, newly constructed batted flight and whole-project acceptance remain pending. No performance improvement is claimed.

This is a code and concise status checkpoint. It contains no database, domain-row export, raw execution log or test-receipt bundle.

## Fresh compiler and 31 cases — 2026-10-07 18:58 UTC

The candidate at local `ff33cbc915bb8938df5010fd40d65f9260d0fde0`, source tree `a84ccc9ac2c45e66d0a6f07afc67af0bf3db6c75`, passed a fresh focused compiler and all 31 new cases. These are the exact source/test bytes preserved by PR354 head `7ca9a855173aef0f80aace72279bdcf1aea9dbf5`. The changed commit metadata and this later result note are not additional production changes.

The test-only baseline `5f4a0cc1a7f9d60517ddd2b3e8240a7c17d0a7fb` first established the intended existing-API RED: exactly two completed historical reads and closure authentications, ten role effects, unchanged result/archive/input bytes, and the sole expected two-to-one assertion. Its qualified terminal is `32fe34c523ef1cb6ad7cdca57987b3f15cb6b809e203984b00b85b2b155e406e` (outer exit 0, test child exit 1). Earlier reporting attempts remain failed: JSON-only reporting omitted the witness, and the first default-reporter attempt added ANSI prefixes that the strict parser rejected. The standard NO_COLOR setting corrected output format without changing the predicate or source.

Fresh candidate terminals:

- Focused compiler: `a812b2b9251f3a4e625c9ff3dee4259dde37cfc87dca76d5433fe85ae61f984f`
- First GREEN, 1 case: `ba5f9cbf6188a2dbf364a74b5815cd5fe69adda4cd0469d826ffeb64192bfd94`
- Contract file, 18 cases: `adddc14c7cdaf70e1f73ab444ff91997dbdf21081a0b09410fd3aa86bb73fce6`
- Guard file, 12 cases: `298d86684a638d52df29cefffc61f4ee303e872b2dfb9eaf71abbdbb623e7732`

All four candidate stages have actual outer/child exit 0, complete reaping and unchanged source, dependencies, controls and runtime. The three complete test files report 31 passes, zero failures and zero skips. The first GREEN witnesses exactly one completed readiness/closure authentication with the same ten effects and byte parity. The guard cases include real write-and-restore detection, fresh independent calls, WAL and cleanup boundaries.

These tests use the declared synthetic lower physical inputs while retaining real closure/readiness and guard operations. They do not authenticate a genuine flight artifact or prove a general second completed prior play. The compact aggregate SHA-256 is `2fa780e9bd514a772624c537196e6c673b6005577d6b500091585c13895c9d9e`; raw receipts remain local and are not part of this note.

## Adjacent regressions — 2026-10-07 19:13 UTC

The same candidate passed 105 additional cases across 12 complete, distinct adjacent test files, with zero failures or skips. Together with the three files above, this is 136 distinct case passes across 15 complete files. Every adjacent stage has actual outer/child exit 0, no remaining owned processes, and unchanged source, dependency, control and runtime hashes. The adjacent aggregate SHA-256 is `482a9d0441bbfd8e68819e6050ca9eca35898af8e254d6b7b32f337a48f434ac`.

The existing PR354 publication is head `1a25a0e4ce575b7be49ce50e285f3cf98dca0709`, full tree `1ebac9c027408e399f2f3b0861d03d89d7a24452`, with the same source tree recorded above. This update changes only this note; it adds no production, test or control files.

## Closed-input official continuation — 2026-10-07 20:37 UTC

Fresh source `e58db66ff423fd58b90dfc183f4bc66021e9c2c8` retains source tree `a84ccc9ac2c45e66d0a6f07afc67af0bf3db6c75` and adds exactly six control/configuration files whose bytes match PR339 donor `36ebcf434581174d4a5c25a30cc8fd574e9fa757`. Separate, predecessor-pinned invocations passed the focused compiler, raw input preflight, current Native reauthentication and official application. Their checkpoint SHA-256 chain is:

- Compiler: `35dcb7f1cb44de365b829c536c33a7081848458d84eed72ee897da77ec2c3693`
- Raw preflight: `19f5768bccd992684a5ed6e66cc82b8cdacafc7a8b17b94715e9b915b353f463`
- Current Native reauthentication: `d861595c63d23cc7cd51a318c6f9e65e9671f6bca6d10ae8d9d54ec1dc9ea4b6`
- Official application: `618195ca8e674d47304d1b35d3ddfddd9357666958180cb185585dbde27b1c93`

All four have actual outer/child exit 0, verified phases, complete reaping, no remaining owned processes and unchanged source/dependency/control/input pins. The successful official stage finished at 20:31 UTC in 1,218.164 seconds with peak aggregate RSS 489,572 KiB. Its proof SHA-256 is `2a361e32f3f9728291db949b98e7d8f6276f9157ba484bcfe3a007800a9e1c46`; its invocation terminal is `bf8140ca74fcc742a3d1758d47a4a842c84eeec7455bb470963e658f666937e5`.

The proof records exactly-once official application, both after-insert fault checks, closed/reopened connections and conservation of the original physical tables. Original input SHA-256 `585ab7862ab93991e97cd5032ba8d520e113635559aa0019b5dd9bd43257a04a` remained unchanged. The closed output SHA-256 is `7d23d7006075f57685bbd3998ca8f92b5a01e3802d0f2c911a3e882b0032a953`; a separate coordinator filesystem observation at 20:37 UTC confirmed that hash, 3,579,904 bytes and absent WAL/SHM sidecars. This documentation review reads text evidence only and does not reopen either database.

The first official attempt was interrupted without an official checkpoint or known final reap; it earns no successful credit. Its controls and database/sidecars were preserved separately before the successful invocation. The three preceding fresh checkpoints were retained; no historical receipts were inherited.

This is continuation from a published closed input under the explicit fixture policy. It does not prove new physical construction, the original seal/rollback, elapsed-world recovery, historical raw-producer admission or a geometry RED. Actual role/workload and next-play stages were not run. `freshContinuationVerified`, `wholePipelinePassed` and whole-project acceptance remain false/unproven. Private databases, domain rows and raw receipts remain excluded from publication.

## Activation and next-play boundaries — 2026-10-07 20:38 UTC

The same candidate `ff33cbc915bb8938df5010fd40d65f9260d0fde0`, source tree `a84ccc9ac2c45e66d0a6f07afc67af0bf3db6c75`, passed five more complete test files:

- `ActualLivePhysicalActivation.test.ts`: 3 cases
- `ActualLiveNextPlayGuard.test.ts`: 13 cases
- `ActualLiveInningHandoff.test.ts`: 51 cases
- `ActualReadinessClosurePair.test.ts`: 19 cases
- `ActualFirstBasePhysicalReadTraversal.test.ts`: 24 cases

These 110 fresh case passes bring the verified total to 246 across 20 complete files (31 + 105 + 110). File/name pairs are disjoint across the three groups. All five stages have actual outer/child exit 0, zero failures or skips, no remaining owned processes and unchanged source, dependency, control and runtime hashes. Aggregate SHA-256: `458956e8ece2f68e1711fb006030e5501584575786edb53b4b2a35006469c46f`. No historical receipts or earlier partial-suite credit are inherited. These complete-file results do not complete the pending genuine two-completed-prior fixture, actual-flight construction, role/next artifact continuation or whole-project acceptance.

## Fresh ten-player workload continuation — 2026-10-07 23:54 UTC

The existing role phase completed on local continuation commit `e58db66ff423fd58b90dfc183f4bc66021e9c2c8`, src tree `a84ccc9ac2c45e66d0a6f07afc67af0bf3db6c75`. This is the exact readiness continuation cut described above and the production/test source preserved by PR354 at `5494e35125007383b60d8d31707481665c634021`. It is not a qualification of the separately developed participation or shared-writer/terminal-pending cuts, nor an integrated whole-project result.

Starting from the already-qualified official checkpoint, the phase authenticated the original closure, accepted the ten participant assessments, froze the exact settlement-time BEFORE states and applied the accepted total-play effort exactly once through the existing workload owner. It then verified same-connection retry, disk close/reopen, reopened read and exact retry. Day-level recovery history was tested only on an isolated backup; the playable artifact contains zero recovery activities and preserves all frozen AFTER heads.

All five prescribed fault obligations passed: assessment INSERT, freeze INSERT, workload INSERT, stale-current-head rejection and interruption after the first committed MATCH activity. The original official input stayed unchanged. The fixture provides explicit effort/baseline inputs; this does not establish automatic effort generation or elapsed-World-time recovery.

The actual outer and child exits were 0. The supervisor verified unchanged source/dependency/control/input pins, complete reaping and no remaining owned processes. The stage took 6,810.462 seconds within its unchanged 14,400-second ceiling, with peak aggregate RSS 516,364 KiB. This is an observed qualification run, not a performance-improvement claim.

- Preceding official checkpoint: `618195ca8e674d47304d1b35d3ddfddd9357666958180cb185585dbde27b1c93`
- Role checkpoint: `ca28ec1a1158d5fe060b84a12c44f6d3c9d7aba73967f0c29675fee57078baf2`
- Role proof receipt: `e90fa208c7d2da37a297b566a42e36b801fab18055dc49e3ae5b2e1f7018e690`
- Closed private role output: `cc587072c7f7259b07e4dafb08452861121bbeb3a33f96c5689389b00b859a46`; WAL is zero bytes

At this role checkpoint, five continuation phases were qualified on this exact lineage: compiler, raw admission, Native reauthentication, official application and role/workload. The next-TAKE phase was still pending; its later result is recorded below. The 246 regression-case count is unchanged; this phase is not added as an invented number of test cases. New physical construction, the original seal rollback, genuine two-completed-prior coverage, geometry continuation and whole-project acceptance are still unproved here.

This update publishes only concise source-specific results and digest metadata. The private database, domain rows, input manifest, execution logs and receipt files remain unpublished.


## Recovered next-actor and physical TAKE — 2026-10-08 01:47 UTC

The final next phase passed on the same continuation commit `e58db66ff423fd58b90dfc183f4bc66021e9c2c8`, src tree `a84ccc9ac2c45e66d0a6f07afc67af0bf3db6c75`. From the qualified closed role artifact, it admitted the explicitly selected next batter, executed one new physical TAKE at play 8, and produced the active count 0 balls / 1 strike under `npb-2026`. Wrong-activation rejection and a real actor INSERT/readiness-corruption rollback both passed. Exact actor/pitch retries and complete connection close/reopen readback passed; the role input remained unchanged.

Actual child and controller exits were 0, with complete reaping, no survivors and unchanged source/dependency/control/input pins. The stage finished at 01:47:12 UTC in 2,014.424 seconds, with peak aggregate RSS 496,652 KiB, within the existing 14,400-second / 1,024 MiB old-space / measured 1,120 MiB heap / 1,536 MiB RSS bounds and 6 GiB stop reserve.

- Preceding role checkpoint: `ca28ec1a1158d5fe060b84a12c44f6d3c9d7aba73967f0c29675fee57078baf2`
- Next checkpoint: `cf869d37f73a833edcc985f95b1c6c88fc183bd3f9dd455f1a0145109289c083`
- Next proof receipt: `41e10a0ffe9fe99f67688e6c9d320f102c67f41e67ae29f4392484a89c3a65f2`
- Final invocation terminal: `d98b5a176d1dfe45bcfab2c7681f01a4f4a0a1739b7958085c5af2f5b133c7b7`
- Closed private next output: `32978dbf7accf15c29f27e8208800eb7638094224ee84dad79eb4770b492e721`; WAL absent or empty

### Recovery boundary

The earlier next attempt lost its execution session during environment restart after its last telemetry at 00:33:45 UTC. It had no terminal or proof and receives zero qualification credit; its final owned exit/reap remains unknown. Original source, completed predecessor checkpoints and all interrupted output bytes survived and were preserved.

The supported recovery kept all predecessor checkpoint/receipt bytes unchanged and used the original shared lock identities. An environment launcher failure occurred before process creation. A first scratch attempt then failed before project execution when Vite attempted a temporary compiled-config write beside a read-only shared config; that failed terminal was fully reaped. A second scratch attempt stalled in the Node backup boundary and was stopped with tool exit 130, without a supervisor terminal or reap claim. A bounded diagnostic reproduced repeated first-batch backup from the shared read-only WAL artifact, while a byte-identical closed private copy completed. These unsuccessful attempts receive no credit.

The successful invocation used independently reviewed scratch controls, a byte-identical writable-location Vite config, and an explicitly pinned private copy of the same closed role database (`cc587072c7f7259b07e4dafb08452861121bbeb3a33f96c5689389b00b859a46`). A next-only entry recorded and verified this input relocation against the original role proof before calling the unchanged project helper. Original project imports, source and assertions remained fixed; the extra control/entry bytes and preserved interrupted files were separately pinned and rechecked. Recovery record SHA-256: `029c1a770f215532808126e83e210eb85109e67bc1bf2042d03e52a9cf246666`; supervisor: `0602059ad79505a299894962942b4ead675f612afa6957fa0eeccb9a7ea7f5ef`; entry: `0e1ff2c91498eb9cbd9433a9ef669a43d22ca5d6db94e6d8747e6121e9c4076c`.

The final chain authenticates all six completed stages and reports `invocationVerified:true` and `freshContinuationVerified:true`. This is a predecessor-pinned continuation across separate invocations, including recovery, not one uninterrupted run. `wholePipelinePassed:false`, `geometryRedObserved:false`, original construction/seal-rollback, elapsed-World recovery and autonomous lineup selection remain unproved. The fixture's scoring remains unsupported. The 246 selected regression count is unchanged and no phase count is added to it. This exact source result does not qualify later participation, terminal pending/acknowledgement or integrated-union sources.

Only this concise result and hash metadata are published; all private databases, raw logs, manifests and receipt bundles remain private.
