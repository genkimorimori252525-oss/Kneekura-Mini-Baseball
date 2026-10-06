# Original foul physical end — same-source 159 confirmation

Reviewed and tested source: `a7086cdb0e3e563a8aafd688da2d569e3afa428d`, src `a7e3c58da3bfd3d9bf217c0dbaa544c6d66cd6d4`.

**159 cases are confirmed on this exact source as 19 retained + 140 fresh.** This is not a fresh run of all 159 cases. Compiler and catalog passed in the original attempt. Its three genuine physical prerequisites and sixteen initial end contracts have complete qualified stage receipts, each with observed cleanup and unchanged input/control checks.

The original session 97985 was interrupted during the 16 guard cases when the executor became unavailable (`pong_timeout` / unknown session). It has no guard or final terminal. Those partial guard results receive zero credit, and final reaping of the original attempt remains **unobserved**. The original admission and four closed receipts remain unchanged here.

The independently reviewed continuation session 88111 started at 2026-10-06 20:28:50 UTC and finished at 21:16:13.918506 UTC, exit 0. All 140 cases passed with 0 failures or skips: 16 guard cases, 72 runtime cases, 28 producer cases, 7 count metadata cases, and 17 shared fence/first-base transaction cases. All seven stages passed; source/dependencies/controls stayed unchanged; the new continuation reaped every owned process, with no survivors or cancellation. Complete terminal SHA256: `11a2523e117b050bac060e5caba400c6ffc55a91b67a40330785f52b05cf3861`.

## Exact attribution

| Retained original stage | Result | Receipt SHA256 |
| --- | --- | --- |
| compiler | PASS | `bd033c2de64038a3a174d71c40c1496f49b4451b9182be2d2bdc30b527ff5841` |
| catalog | PASS | `e59fb8dcd4e6ae3ddeec4dbda734532e0caacc89fca2bda3f7f7183366981dee` |
| physical prerequisites | 3 PASS | `22e92b79d91321290855e8070aa927971d0c1fdaaf1e6436b2513033f76d5bcc` |
| initial end contracts | 16 PASS | `c4f23a60678df81338093dcb8be895c906c9c79c422e4aa5ecffaa3cb63cdd99` |

Original admission: `c1f9aa1f4438fd3a4bf0e18d2f7c5108727a99a092570437449cf0013130bfa0`. Both attempts use source manifest `64686718e47f265b44e5f4e1bcaf932a238b1bfed4b7a9fb8a29c26b49d38b43` and dependency manifest `e9624551894fd127f81b5e475c928741bce41fac2012d369b6cd62b9b08fc542`.

The continuation authenticates the original admission, controls and four closed receipts before launching its seven remaining stages. Its controller is `310d3a43b8b91d10b63e687a6301bfacf7887479c82a44813aec83e84ebdb460`, config `91c0cb41b3b2a0743a8c6b7b94badaaa032dead1e7975f7bc17b171c6987ab16`. No result is attributed to another source, and the new cleanup does not certify the old interrupted attempt's final reaping.

## Qualified bounded scope

All 35 physical cases are now confirmed: the initial 19, the original 10 guards, five raw-ownership regressions and the historical topology regression. They cover the original 71-domain dead-ball proof, immutable mixed count successor with only its physical child acknowledged before Core resolution, atomic receipt/seal, exact closed reads/retries, specified raw claims, rollback and the two concrete late-ingress routes.

The canonical census retains every declared owner/head and all fresh original-scope references/rows. Noncausal global installation booleans were removed from this unpublished candidate's serialization and independent oracle; no archived terminal bits are fed into the causal proof. The complete empty-owner/foreign-control/target-rejection/recovery path passed. Old-source RED evidence and the earlier unqualified truncated-stack attempt retain their original attribution.

The 124 compatibility cases retain the runtime/registration/fence boundary, original producer ownership, count metadata and real SQLite first-base transactional-owner behavior. The latter explicitly substitutes stable physical evidence; it is not a genuine fair-end chain qualification.

## Parallel publication and remaining work

This remains the exact a708 foul source checkpoint on PR 337’s line. It does not integrate the later stance/runner union src `f02849963df3fca3c32b9c411b9d53c590d59575`; those slices and their qualification remain separate. This result-only descendant preserves every PR 337/publication baseline source, document and prior receipt.

No foul official consumer, workload settlement, controller retirement, reset or same-PA resume is implemented or certified by this receipt. The full 38-case count contract, the genuine fair-end chain and all-route coverage remain separate cumulative requirements. The reviewed two-case ordinary/bunt prerequisite launched separately at 2026-10-06 21:27 UTC in session 63016. It has no terminal result or qualification credit at this checkpoint.

Included artifacts contain only complete code/result/control metadata and concise attribution. No database, WAL/SHM file, raw guard log, telemetry or temporary fixture payload is included. Earlier candidate/WIP documents retain their historical pre-run or interrupted status; this record gives the completed same-source confirmation.
