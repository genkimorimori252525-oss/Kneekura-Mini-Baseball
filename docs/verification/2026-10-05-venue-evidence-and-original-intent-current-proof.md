# Venue evidence and original batting intent: qualified current-source proof

The fixed integration `5d4d13867cac14495ccb16a40e87d9b130e04973`, based on `94534e13f8175944cadb22a832bcc7315aab4070`, passed full TypeScript compilation and all 158 selected cases with zero failures or skips. Its source tree is `2ce5f61321816627815a9f1cdb3b3279ad5f5afb`; the complete source manifest SHA256 is `2f64a084755da1a40cad3d3bac1dbab86b5ea9b68e95d85cbd25e573699dff61`.

| Selected group | Passed |
| --- | ---: |
| Settled-foul Core, existing territory/foul/count rules | 55 |
| Immutable Native venue policy and connection/write boundaries | 44 |
| Read-only Native observer and actual original pitch count | 25 |
| Genuine original Native foul-stop/file-reopen fixture | 1 |
| Original intent plus existing pitch progress, continuous pitch and actor regressions | 33 |
| Total | 158 |

The compiler took 32.19 seconds with peak process-group RSS 1,355,776 KiB. The 158-case test gate took 132.63 seconds with peak RSS 504,224 KiB. Both used the pinned Node 26.10.0 runtime, retained source/control hashes, and finished with all owned processes reaped. The gates stayed within their existing resource limits.

- Compiler terminal SHA256: `745a70c20f9dbb2690f150baf5159aa4dd36172afa26434980fecfbd81f31492`
- Test terminal SHA256: `cc9f97c9213b6e3558ad77629c27e33b7bf6feb00fc0d4270e17a06afce7c3f2`
- Exact path/preimage comparison SHA256: `797346740fcb3e1efb027cd38fd8d0030ca15aa2705ee91d8cb5b72a8560a0f8`

The comparison proves all 14 venue paths equal their reviewed `40e3ad5` author bytes and all six intent paths equal `08f56b9`. Every other integration-base file, including the 17 PR314 paths, is unchanged. Earlier author/scaffold receipts remain distinct; the unrun intermediate gates are not additional successes.

## What the proof establishes

The physical fixture accepts its original synthetic incoming pitch velocity before execution, uses the existing contact/material/geometry owners, and genuinely reaches an untouched foul rolling stop. Its actual exit x velocity is `-0.5200000000000004` m/s. The stop is at `(-0.043206587288437126, 0.0366, 21.536197618653116)` m, elapsed `2.921400026539861` seconds from origin tick `11180360`, recorded tick `14101761`. This is a test input/result, not a new production calibration. The earlier fair candidate remains a preserved failed attempt.

The Native policy is immutable per original pitch/version, authenticates its accepted venue/model/geometry/RuleProfile anchor, rejects TEMP or attached authority replacement and rolls back unrelated trigger writes. Observation reconstructs its explicit original prefix, preserves every physical contact and exact raw origin, and changes no canonical physical/official state. Proper file close/reopen checks occur after all original handles close.

Original count comes from actual accepted pitch timelines and contact events. The genuine three-pitch case proves that an original Match frame can retain zero strikes while the third pitch's before/contact/result count is two.

The new optional batting intent is an explicitly accepted actor declaration (`ordinary_swing` or `bunt`) frozen with the original action before execution. It preserves the physical result, binds the original actor/pitch/contact, rejects later attachment or mutation, and leaves absent legacy intent unresolved. It proves neither an umpire decision nor an autonomous batting choice.

## Boundaries that remain

The settled-foul consumer still publishes the shared dead-ball evidence with bunt/count consequences pending. Connecting an authenticated declaration to a versioned legal count consequence is the next separate contract; these checks do not apply foul count or close/resume a plate appearance.

Same-PA episode ownership, causal dead-ball registration, official consequence/reset readiness, workload reservation and single-path settlement equivalence remain unimplemented. Repeated batted pitches also require a reviewed versioned geometry/flight binding; current per-game uniqueness is preserved. No first-base PlayEnd/adjudication guard is weakened, and no generalized out-of-play, interference or runner-owned prefix support is claimed.

Publication is stacked on the documentation-only `108f9c62af99cfaf821cc4400ca3bfb3ad329d3f`. The publication candidate's entire `src` tree and build/catalog inputs match the tested integration exactly. Documentation additions do not represent another runtime gate. This record supersedes older pending-status wording for the specific code slices proved here; their historical source cuts and receipts remain unchanged.
