# Correct the raw-pitch closure guard expectation

The attempted166-case gate on `2d22dd5f83f1108c8196e701667f27834638111b` passed compiler/catalog, all seven metadata cases and37 of38 consumer cases. One test expected a `/terminal/` error from the raw pending-pitch official-closure route. That route correctly rejected earlier with `physical pitch workload requires a completed canonical play`. The consumer phase took1069.15s and had no resource stop. The remaining121 cases were not started.

The original actual terminal is preserved byte-for-byte under `foul-consumer-partial-green-2026-10-06/terminal.json`, SHA-256 `ab6055d2f52251b690cc157c8c760cc6712fa912eba8072250aea022e5fe93ff`. It remains44 passes/1 failure on its original source, not a166-case pass.

The root cause is the test's inferred rejection order. The unchanged `derivePhysicalNonLiveClosure` invokes `assessOfficialPhysicalPitchWorkload` before its later terminal-status check. A genuine raw `batted_ball_pending` timeline fails the completed-canonical-play requirement. Both production files and the Native proposal/store path match the published936a070 base; no production repair or guard reordering is needed.

The corrected case requires the exact existing error and the real Core non-live/Native proposal stack frames. For both ordinary-two and declared-bunt-two scenarios it verifies the composed disposition, independently reads the raw still-pending pitch, checks next-pitch rejection with complete logical state unchanged, confirms no closure receipt is queued, and checks unchanged consumer/admission/unrelated tables, accepted-input bytes and Match state after closure rejection. Shared setup and every other case body remain byte-identical.

The next finite follow-up must compile this test-only cut and run the corrected case plus the121 previously unstarted cases. The37 unchanged consumer assertions and seven metadata passes keep their original2d22dd5 attribution. This follow-up is not a fresh whole166 pass; cumulative confirmation remains explicitly pending. Count consumer behavior still grants no physical end, official application, reset or next-pitch admission.
