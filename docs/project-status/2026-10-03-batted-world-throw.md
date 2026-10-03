# Actual World transfer/release/throw — implementation status

Authority: current approved Foundation44b9f5de7b9d87e649f12f1af78c202f2b5ab44d and Realism4f0a60a3818926327b6bf5877ab3dec456a76530. Existing rated transfer/throw adapters and architecture05 section10 ready-tick approximation remain unchanged. Base is own execution37d6d62 and independently reviewed Player model82ca71d.

## Source implementation

- Share validated actor rebasing with existing motion; new acceleration starts at the true preceding continuous state, without changing old motion outputs.
- Carry the actual secured ball through rated transfer, preserving its actual contact offset and spin. Query all bodies/feet/gloves/panels/ground before release. Any carried collision has no fabricated launch/free cursor.
- Release at the existing approximated ready tick from the actual ball position, aim at the active receiver's physical glove at release, and apply the existing arm/accuracy launch adapter. Free motion again queries the entire World; third-party contact, miss or pending acquisition never becomes an OUT/SAFE oracle.
- Add a throw action to the directed own execution prefix: only Source IDs, active receiver intent and accepted future motion/coverage. Own fielding model, original actual defender/Player/Person/day and original physical matchSeed/playId determine provenance and randomness. Capture the immutable model in the result, rederive historical/current prefixes before/after writes and roll back late mutations.
- No production defaults, caller releaseTick/result/ball, circular future readers, old forecast pickup substitution, official/scoring/workload charge or Presentation connection.

## Verification

- Core missing-module RED, then3files30tests GREEN. Additional tests cover actual transfer acceleration, fractional secure/release clocks and receiver candidate followed by actual acquisition.
- Native unsupported-action regression:1failed/6skipped RED. Initial Native7tests GREEN/64.25seconds.
- Initial typecheck exposed lost discriminant narrowing inside a callback; a local narrowed action fixes it. Final typecheck GREEN.
- Final related gate:7files76tests GREEN/483.06seconds, terminal exit0. Includes Core11throw/17motion/5actual acquisition, Native8throw/12existing execution and WAL8throw/15existing execution. Verifies actual late model/Person/workload corruption rollback, cached-peer and identical-retry mutation, genuine foreign active model rejection and deterministic reopen.
- One fresh readonly review of the complete pending physical slice found no P1/P2 finding. No Source edits or gate reruns by the reviewer.
- The combined frozen whole gate is still required before publication; no whole-suite completion claim is made here. Parent motion/execution whole gates remain independently frozen.

## Remaining full objective

Actual receiver acquisition/base/running and rules, foul/next-pitch/between-pitch replay, official/scoring/actual-role workload and capability generation/development plus other latest approved connections remain required. This slice does not complete the overall goal. No GitHub PR merge.
