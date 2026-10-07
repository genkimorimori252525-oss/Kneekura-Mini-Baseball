# Terminal bunt: read-only projection WIP

This Draft checkpoint preserves the five Task 1 source/test additions from local commit `12dedaba9de6620c1a392eb7c01e1306b190cbc1`, source tree `1752aeba4e4fbc198f56e34ca61c47d4b735d245`. Its parent is PR #346 head `39422ec6213d1a3c435f1c57f76c12a4b0587130`; every existing parent path, including earlier result notes, is preserved. The checkpoint has the same complete source tree as the reviewed local candidate with the bounded results below; packaging did not rerun the compiler or tests. Results are fixed at the 2026-10-07 09:05 UTC snapshot.

The projection authenticates the original physical pitch, count, physical end and selected official journal. It retains the assigned canonical call ID and the original P/C/E authority. A separate application ledger starts with `playEnd: null`; the original physical pitch remains `batted_ball_pending`. It returns prepared data with `officialApplied: false`. No durable Match application, queue, acknowledgement, workload settlement, reset or actual same-PA resume is implemented. Tasks 2–4 remain held.

## Bounded evidence at this snapshot

Independent source review found no blocking issue in the two production files; the three contract/preflight/support files stayed byte-identical to its baseline. Review SHA-256: `82f6d56cd89149c6a6565ba610da60ba803b4e6b5a3f0c82aeefaa61eecc0e08`.

The unchanged candidate has separately closed compiler and catalog checks, seven compatibility/preflight passes, and one genuine assigned terminal-bunt projection pass. The genuine stage took 687.602 seconds, with 19.545 seconds reported for the selected case. Its 16 excluded appearances receive zero credit. These closed stages recorded unchanged source/dependencies/controls, observed reaping and no remaining owned processes.

| Closed stage | Credit | Terminal SHA-256 |
| --- | --- | --- |
| Compiler | Check passed | `b67787bfe403068056bf8d9ced9724f64f9897b475fd88b4855ca3aca13d82c5` |
| Catalog | Check passed | `a0fae75b7ee8842fb9127ff2544f8060cdcaeb2edc790626aad82619692af825` |
| Preflight | 7 compatibility cases | `5ea6031536a698ee8fe8f6b5f3ae74ea4c21c1477a2463aee2d41385415f57ad` |
| First genuine projection | 1 case | `8e523626caf4bda4b55c221969f126083d1ad69179256c5d3273d929db4581ff` |

The earlier missing-entry RED on `c497f41` is retained as prerequisite evidence (`990305f9d2f59288c62f30627b65a508f330ed574eb338e3bb1db7186cfcc938`). The original `0079069` compiler failure is also preserved and receives no passing credit.

## Failed stage and remaining work

The remaining-12 stage failed after 1102.369 seconds with four Vitest `onTaskUpdate` RPC timeouts: native exit 1, controller exit 2. Its assertion inventory reports four passes, eight pending cases and five explicit exclusions; the JSON aggregate is internally inconsistent. This stage receives **zero credit**, and all 12 selected cases remain pending qualification. No domain assertion failure has been classified. Terminal SHA-256: `3724fe52c5aecdcc78f7a2d1cef5948e4e9a7238ac7b719237a2d03321aec2e9`. Final closure records unchanged inputs, observed reaping and no surviving owned processes; cleanup does not make the stage pass.

The testing repair is not included in this fixed checkpoint; no corrected runtime result is claimed. Remaining terminal and adjacent stages are unqualified. There is no full Task 1, combined 89-case, whole-project or cumulative qualification. Keep this checkpoint Draft. Raw logs, receipts, manifests, controllers and database/domain payloads remain outside this change.
