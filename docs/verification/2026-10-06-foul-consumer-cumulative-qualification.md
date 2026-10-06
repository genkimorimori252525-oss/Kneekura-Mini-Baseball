# Original foul count consumer: cumulative author qualification

The new Native owner consumes the accepted original untouched-foul stop under an explicitly registered foul-count runtime. It derives the count from the existing original batting intent and count owners, then uses Core `recordFoulBattedBall`. Ordinary fouls preserve a two-strike count, a declared two-strike bunt produces a composed strikeout, and missing original intent remains unresolved. The physical pitch archive and Match remain unchanged.

The immutable receipt and its runtime admission are written together. Original ownership is discovered through SQL and duplicate-aware raw Source/history/reference metadata, including embedded original-count pitch identity and field-prefix identities behind duplicate, escaped or array-shaped containers. Reads authenticate the original field references while preserving future-payload opacity. First acceptance requires the current physical cut; historical reads and identical retry authenticate the archived cut without adding admission. Trigger and concurrent-writer failures roll back receipt and admission.

## Observed author evidence

The selected 166-case contract has an observed pass for every case across two precisely attributed cuts with identical production bytes. This is cumulative selected-case confirmation, not a fresh single-source 166-case run or whole-project qualification.

| Source | Actual result | Receipt SHA-256 |
| --- | --- | --- |
| `2d22dd5f83f1108c8196e701667f27834638111b` | Compiler/catalog passed; seven metadata cases passed; the 38 consumer cases had 37 passes and one test-expectation failure. The remaining 121 cases were not started | `ab6055d2f52251b690cc157c8c760cc6712fa912eba8072250aea022e5fe93ff` |
| `6bb37ce233dc9567f3ebf8ee0318d5dbecb52431` | Compiler/catalog passed; the corrected consumer case plus the previously unstarted 121 passed; 37 unchanged consumer cases explicitly excluded | `6e710cee91f16fc13bd52172902cf12e986623368bf0cd653e1c850900c676ab` |

Both terminals report no setup, unhandled, resource, source/dependency/control drift or survivor failure. Every launched phase reports reaped children. The coordinator separately confirmed that follow-up supervisor session `75834` returned exit 0 and matched the terminal hash above.

The earlier failing test expected a later terminal-status guard. The actual existing non-live closure first rejects an incomplete canonical physical workload. The test-only correction checks that exact existing rejection and its real call sites, verifies that the original pitch remains pending, and preserves the complete logical database state for both ordinary-two-strike and bunt-two-strike cases. No production guard order changed.

The reconciliation rechecks all 813 production blob identities, 1,853 other source files, shared setup and all 37 prior consumer case bodies. The two pass multisets cover the intended 166 cases exactly, with no duplicate credit. The original failed attempt is retained verbatim in `foul-consumer-partial-green-2026-10-06/terminal.json`; the complete follow-up terminal, production manifest and case-by-case source attribution are in `foul-consumer-cumulative-2026-10-06/`.

The new follow-up measured compiler 38.76s, corrected consumer 209.06s, physical prerequisites (5) 173.09s, count runtime (6) 54.14s, legacy runtime (57) 74.34s, producer (28) 186.20s and compatibility (25) 11.33s. The finite controller completed without extending any budget.

Earlier recovery and repair documents are historical snapshots at their named cuts. Their then-pending checks are superseded only by the specifically attributed observations above; lost pre-recovery receipts remain historical provenance and are not reconstructed as current proof.

## Current integration boundary

This source transports the qualified author files onto local model publication `d2ca94ec24c228d14711b631d689fcf974d244cc`. The author and publication source deltas from PR333 have no changed-file overlap. All transported foul files retain their exact author bytes, and all other current publication source files are preserved.

The combined source subsequently passed its own compiler/catalog and 16 selected integration cases at commit `e06e59fcb38614357a19a698ca606457f0d1fbd9`, src `1c6e92b817ea8b3e29416f3786a9706fbb4062f6`, full tree `5ad10d49e8def118ba2a6a80fb9633555a1a28b7`. The complete actual terminal is preserved in [foul-consumer-current-integration-2026-10-06/terminal.json](foul-consumer-current-integration-2026-10-06/terminal.json), SHA-256 `785f77a5051c837fd6001289dbe61bbdd922f0e3c16b548921cc30459ab25858`. It ended at 2026-10-06 09:54:56 UTC; coordinator session `62550` returned exit 0.

The fixed selection was six consumer cases (four actual count branches, producer-only admission rejection and raw closure/next-pitch rejection), six runtime membership/admission cases, and four Native legacy pitch compatibility cases. All 16 passed, with 32 explicitly excluded consumer cases: 48 collected, 16 passed, zero failed, 32 pending/excluded and zero todo. Compiler/catalog and every selected phase verified; source/dependencies/controls stayed unchanged, no setup/unhandled/resource failure occurred, and all owned processes were reaped with no survivors. Consumer six took 313.39s within its fixed 600s cap.

Reviewed controller/configuration hashes were `b6ae59a970d85a738c36710f536603f06533c4631f69eab34bbb128d3b7ad811` and `d370fe29ff4674d8ebd844c63355193e009252946e304e1c18cc4f7bb6cb2552`. The terminal contains code/control/resource/process metadata and test names/status only; it contains no database archive, row payload, credentials or private domain data. This publication descendant changes documentation only and preserves the tested src tree.

This current 16-case result is separate from the author 44+122 confirmation and the predecessor model/Core 162-case result. It is not a fresh 166-case run or whole-project qualification. Broader regression on the eventual frozen cumulative source remains required.

The scope ends at owned count consumption and its pending disposition successor. It does not certify physical generation closure, PlayEnd, official application, workload settlement, field reset, same-PA resume or next-pitch admission. Legacy 70-member membership and producer-only 71-member membership remain unchanged.
