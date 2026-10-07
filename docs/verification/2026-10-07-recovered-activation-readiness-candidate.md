# Recovered activation readiness candidate

This Draft preserves the reviewed repair that hands an already authenticated historical readiness result from prior-closure validation into the same native activation read. Every prior scope still finishes, raw owner rows are checked again, final application identity and bytes remain checked, and independent operations authenticate freshly. Legacy autocommit and prepare-only behavior stays explicit.

The candidate is based on PR352 head `ae366870d28fab9061f0c5b673dc39cbc8ed7a21`. Its source tree is `a84ccc9ac2c45e66d0a6f07afc67af0bf3db6c75`. The recovered two-file production patch matches its original SHA-256 `406abae4b59c0f17b0cd7df078f90d84f4f4195d3a126de23b7125e9ec646a69`; all four recovered test/support files also match retained original file hashes. The focused compiler configuration was recovered from text, with its original byte identity unverified.

Workspace replacement on 2026-10-07 destroyed the previous raw test receipts and private artifacts. They are not inherited by this checkpoint. A fresh focused compiler passed on test-only baseline `5f4a0cc1a7f9d60517ddd2b3e8240a7c17d0a7fb`, before the production patch. The earlier full-project compiler attempt failed at its 1024 MiB V8 old-space limit. A subsequent bounded compiler launcher stopped in its preload because it incorrectly expected total V8 heap to be at most 1088 MiB; the exact Node 26.10 binary reports 1120 MiB for the 1024 MiB old-space setting. That launcher failure was reaped and produced no test credit.

At the initial recovery publication, the production candidate had not passed a fresh compiler or runtime gate. The subsequent bounded result below supersedes that status for the 31 new cases only. Adjacent regressions, the genuine two-completed-prior fixture, actual flight, root continuation and whole-project acceptance remain pending. No performance improvement is claimed.

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
