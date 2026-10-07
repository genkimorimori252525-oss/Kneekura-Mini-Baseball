# Terminal bunt: read-only projection WIP

This Draft checkpoint now records **20 unique selected passes: 8 retained plus 12 fresh**, with 69 further selections pending. The complete source tree is `1476336a13c8248c6e3a39cafb38cac1bb3a20cc`, identical to reviewed local candidate `f57e59be1c3de0d53445dfc01c74316e2a5d0e70`. Results are fixed at the recovery closure, 2026-10-07 09:50:24 UTC. This two-path update changes only the contract test and this note from PR #351 head `9590ed28df3e61bfd20c6857907af61d6ddfa700`; all other parent paths are preserved. Packaging did not rerun the compiler or tests.

The projection authenticates the original physical pitch, count, physical end and selected official journal. It retains the assigned canonical call ID and the original P/C/E authority. A separate application ledger starts with `playEnd: null`; the original physical pitch remains `batted_ball_pending`. It returns prepared data with `officialApplied: false`. No durable Match application, queue, acknowledgement, workload settlement, reset or actual same-PA resume is implemented. Tasks 2–4 remain held.

## Retained original checkpoint

The initial PR #351 checkpoint added five Task 1 source/test paths on PR #346 head `39422ec6213d1a3c435f1c57f76c12a4b0587130`. Its source was local commit `12dedaba9de6620c1a392eb7c01e1306b190cbc1`, tree `1752aeba4e4fbc198f56e34ca61c47d4b735d245`. Independent review found no blocking issue in its two production files; the three contract/preflight/support files were then unchanged from the review baseline. Review SHA-256: `82f6d56cd89149c6a6565ba610da60ba803b4e6b5a3f0c82aeefaa61eecc0e08`.

That original source had separately closed compiler/catalog checks, seven compatibility/preflight passes and one genuine assigned terminal-bunt projection pass. The genuine stage took 687.602 seconds, with 19.545 seconds reported for the selected case. Its 16 excluded appearances receive zero credit. These closed stages recorded unchanged source/dependencies/controls, observed reaping and no remaining owned processes. The eight test results below were separately reauthenticated for retention; they were not rerun or counted as fresh, and the original compiler/catalog checks are historical only.

| Closed stage | Credit | Terminal SHA-256 |
| --- | --- | --- |
| Compiler | Check passed | `b67787bfe403068056bf8d9ced9724f64f9897b475fd88b4855ca3aca13d82c5` |
| Catalog | Check passed | `a0fae75b7ee8842fb9127ff2544f8060cdcaeb2edc790626aad82619692af825` |
| Preflight | 7 compatibility cases | `5ea6031536a698ee8fe8f6b5f3ae74ea4c21c1477a2463aee2d41385415f57ad` |
| First genuine projection | 1 case | `8e523626caf4bda4b55c221969f126083d1ad69179256c5d3273d929db4581ff` |

The earlier missing-entry RED on `c497f41` is retained as prerequisite evidence (`990305f9d2f59288c62f30627b65a508f330ed574eb338e3bb1db7186cfcc938`). The original `0079069` compiler failure is also preserved and receives no passing credit.

## Original failed stage: zero credit

The original remaining-12 stage failed after 1102.369 seconds with four Vitest `onTaskUpdate` RPC timeouts: native exit 1, controller exit 2. Its assertion inventory reports four passes, eight pending cases and five explicit exclusions; the JSON aggregate is internally inconsistent. That entire failed stage still receives **zero credit**; none of its reported passes is inherited. No domain assertion failure has been classified. Terminal SHA-256: `3724fe52c5aecdcc78f7a2d1cef5948e4e9a7238ac7b719237a2d03321aec2e9`. Final closure records unchanged inputs, observed reaping and no surviving owned processes; cleanup does not make that stage pass.

## Test-only recovery and current result

The corrected contract test uses public `node:timers/promises` `setImmediate` yields between complete operations. Its corruption helper awaits its callback and preserves rollback and primary-error reporting. The synchronous `unchanged()` oracle, original first positive case, other fixture branches and every production file remain byte-identical. Assertions, case names and timeouts are preserved. This is bounded scheduling repair, with no claim of a universal RPC cure or performance improvement.

Fresh compiler and catalog checks passed on `f57e59b`. The complete 12-case recovery then passed in 1136.574 seconds, with 12 selected passes, five explicit exclusions and no unhandled errors. Native and controller exits were zero; closure records unchanged source/dependencies/controls, observed reaping and no remaining owned processes.

| Fresh stage | Credit | Terminal SHA-256 |
| --- | --- | --- |
| Compiler | Check passed | `c5245b8efcb768846c01fde6c84110a6a1539939357528319a4be85d4b3ed599` |
| Catalog | Check passed | `4e500b6f85eb573a2d476a4b7671f551d79bbce38b88e2516808da232817a46a` |
| Complete remaining-12 recovery | 12 cases | `32922175dda14e1fa33701d3ad8e576ffc1b052de45dc6b04c6b494d15eafd64` |

The cumulative 20-case result combines eight source-attributed retained cases with 12 disjoint fresh passes, not a fresh uninterrupted run of all 20. Seven further stages remain pending: four original fixture branches (FAIR, unowned windows, ordinary foul and absent intent; one case each), 47 adjacent Core cases, 12 metadata cases and six Native cases, totaling 69 unique selections. Full Task 1, combined 89-case and whole-project qualification remain pending. Keep this checkpoint Draft; durable application and Tasks 2–4 remain held. Raw logs, receipts, manifests, controllers and database/domain payloads remain outside this change.
