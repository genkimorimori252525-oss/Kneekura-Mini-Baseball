# Actual first-fielder-touch interpretation

Authority: frozen Foundation `44b9f5de7b9d87e649f12f1af78c202f2b5ab44d` and Realism `4f0a60a3818926327b6bf5877ab3dec456a76530` contracts 05/06/07. Continuation of batted World plan task 3 and the user's approved nonvisual implementation goal. Base PR #244, SHA `944dc57926d4a18a1e7ab0efacae360e9f3a19a3`. No UI/Presentation connection, merge, production numeric defaults or outcome-driven physics.

## Tasks

1. Core adapter: derive first-fielder-touch evidence from the actual first World contact and original defensive identities. Support every physical role without fabricating a glove/catch-retention event. Only a sole actual defender contact proves this route; preserve airborne, ground, surface, offensive and simultaneous boundaries. Record the physical event, then invoke the existing fair/foul rule. Foul stays pending catch; fair becomes live. No catch, out, score or end is implied.
2. Native owner: reference the original accepted World contact Source, rederive it through a shared own-connection reader, and archive Source/proof/derived timeline. No caller position, actor, timeline, desired territory or absence flag. Validate original Source, SQL mirrors/hash, model/Player/Person/flight/prefix and fresh current Match/workload before/after write and identical retry callbacks. Historical originals survive legitimate later workload activity. No peer callback inside the writer transaction.
3. Tests: actual physical role contacts, fair/foul and explicit unresolved boundaries; real Native contact/reopen and invalid Source; disk WAL late mutation/stale getter/retry/history. Watch RED then GREEN. One fresh readonly branch review, fix Important findings with reproductions, final related and whole gates; normal stacked commit/push/PR and exact-SHA P0.

## Interfaces and decisions

- Input proof is the complete original `BattedWorldContactInput`, with original Native defender bindings and accepted flight field. The adapter binds `flight.contact` to the latest canonical `BatBallContact`, rederives the World contact internally and obtains radius from its actual parameters. A caller result or first/no-prior flag cannot replace the proof. Existing `CatchRetentionContact` adapter remains unchanged.
- Extract the existing SQLite contact reader rather than introducing a second reader that trusts snapshots. Store lifecycle checks remain in its public wrapper.
- A physical contact must be the current owned World head for fresh interpretation. Historical reads use the frozen original Source prefix and do not require that original to remain current after legitimate later activity.
- A sole ground contact already has canonical ground evidence and remains unresolved in this fielder-specific adapter. Ground/base/catch response integration is subsequent work; the overall approved plan remains incomplete.

## Verification record

- Core and Native owner implemented with own-source rederivation and explicit unresolved boundaries. Independent review found one Important cross-origin proof issue; a tracked reproduction failed before the binding fix and passed afterward with the scratch reproduction (2 files / 14 tests).
- Fresh acceptance requires current actual World head, and validates the complete current flight prefix. A later free-flight forecast does not imply that an earlier World horizon has already physically advanced.
- Final related gate after the review fix: 6 files / 72 tests GREEN (one unpublished scratch regression); final typecheck GREEN. Final whole `npm run verify -- -- --maxWorkers=2 --minWorkers=1`: exit 0, 567 files / 3,414 tests in 3,263.01 seconds. Published Source:559 files /3,391 tests; eight unpublished scratch review files:23 tests. Source remained frozen; process-local K: TMP/TEMP only, no persistent configuration change. The overall nonvisual goal remains incomplete.
- Base PR244 P0 run36911934869 failed on C: SQLite full/I/O errors (552 files passed,4 failed). The concrete CI-only RUNNER_TEMP/two-worker/90-minute proposal passes apply/syntax checks but remains unapplied pending user approval under AGENTS.md.
