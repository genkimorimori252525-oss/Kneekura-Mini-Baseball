# Ordinary closure handoff from the qualified split-pitch K

The handoff consumes the actual qualified TAKE-2 result. It calls the existing ordinary closure owner's enqueue/retry/read methods on a fresh private copy, using the existing accepted nine-inning policy, setup and physical-K closure materializer. Rule/closure/next-start ticks remain the actual final physical tick +1/+2/+3. No official, scorer, workload or actor effect is applied by this queue stage.

A distinct `terminal_continuation_stage_v2` receipt records `splitPhysicalOrigin`: the exact qualified single-pitch input, its actual physical receipt and aggregate P1 credit zero. The root queue's predecessor hash must match that physical receipt. It cannot claim an aggregate physical_k stage. Later existing completion/actor stages explicitly accept and carry this origin. The original v1 receipt shape and serialized data remain unchanged; extra v2 fields on v1 reject.

The adapter authenticates current original terminal readiness, the complete actual three-pitch K prefix and its original actor. Existing runtime/closure owners open without initializer authorities, and opening may not change rows/schema. Native enqueue and exact retry receive fsynced closure-return observations before fresh queue readback. Only the scoped closure/policy additions are allowed; all original rows/schema are conserved. Handles close and ordinary Native query-only reopen verifies exact row/schema equality before the durable receipt. No old P1 receipt is manufactured or relabeled.

Six structural missing-API RED cases were observed. A separate root-link RED established that a disconnected physical receipt hash was rejected only after its guard was added. All six handoff cases and the combined 28-case handoff/continuation/recovery/pitch-step inventory pass. These test controls and receipt contracts do not substitute for original Native physical proofs.

The initial 1408 MiB full-root compiler ran out of V8 heap and remains failed. A prepared 1536 MiB intermediate configuration was not launched. The fresh reviewed full-root profile uses 1664 MiB old space, 1760 MiB measured heap, 2304 MiB RSS and 180 seconds, with RSS+4096 MiB admission and continuous 4096 MiB reserve. The genuine queue proposal remains separate and held; its proposed Native envelope is 1024/1120/2048 MiB with an 1800-second wall cap.

The actual K is qualified, but its official/scoring/workload completion and next actor are not yet claimed. Original aggregate P1 remains failed with zero credit. No private database, trace, control or receipt is included in this source change.

## Frozen source checks

All three final snapshots had byte-identical `src` contents. Every finished lane left no owned process. Receipt SHA-256 values:

- Six missing-API RED: `d721010c702cc4ec37b2314d03885a08421d94999c5f29c940d9d6ae4d5f7567` (child 1; six expected failures).
- Disconnected-origin RED: `90d71ef4acb2c96a9655fa196e6ed95ec6e84718a565c3fda8be86ccf609e4f9` (child 1; one expected failure, five passes).
- Six GREEN: `cc859eb5b73c9a2e3e5b7b50e9998c10c81cc38a3b64ddaf6eeebb497599563c` (child 0).
- Combined 28-case GREEN: `163ed2e2e509befaf8c363935565531f90374001bafe8df357a4624d7a5b3007` (child 0).
- Failed 1408 MiB full-root compiler: `4c9a3a7f8ddcfc5ebe17e9918746725885cdaa81f55fe052e0e0933d98892bf8` (child -6; V8 heap exhaustion).
- Reviewed 1664 MiB full-root compiler PASS: `0d70e06fd97816fe8d074836f84fcddea9fcdab541cef455e85dbaa313f8e4c3` (child 0; no diagnostics).
- Focused compiler PASS: `86faf998532b34b72e1a022086973c830b4ce7cba4d93c94155ba2a7b4ee3fcd` (child 0; no diagnostics).

The structural fixture results establish test adapter contracts only. The separately held HC-N01 must still establish the genuine normal-owner queue, exact retry, fresh readback and closed result.
