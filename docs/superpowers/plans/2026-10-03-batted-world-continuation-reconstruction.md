# Actual batted World continuation — reconstruction brief

Authority: the already confirmed nonvisual World-first continuation after PR #246. Base is exact PR #246 head `e2cbf66b985f8b011d0a388e495c658ef1943718`. The previous local branch with this work was never published and is unavailable, so this branch reconstructs only the scope preserved in the durable execution record. It does not add or revise game design.

## 1. Post-response ball flight

- The accepted actual contact response remains the only start state. No caller ball, catch flag, possession, fair/foul result, OUT/SAFE, PlayEnd or scoring label may replace it.
- A proven `ground` or `rebound` response may project later BallFlight physics with the original frozen physical parameters. The projection can include later ground bounce/roll.
- The projection is not proof that the interval was free of another actor or venue contact. The next World-geometry owner must clip or confirm it before possession, pickup, fair/foul finality, rules or official state consume it.
- A `capture_candidate` remains `requires_acquisition`; retention does not become uninterrupted possession. An airborne no-contact horizon remains `requires_world_extension`. Simultaneous or degenerate contact remains unresolved.

## 2. Native ownership

- Persist the projection from the original SQLite response archive re-derived on the writer connection. A peer getter is comparison-only.
- Preserve an ordered, revisioned continuation prefix. Only a prior `flight_projection` may be extended. Pending acquisition, unresolved contact and an exhausted airborne World horizon cannot be bypassed by increasing a caller duration.
- Fresh writes revalidate the current original response/World/flight/workload before and during the transaction. Historical reads remain recoverable after legitimate later workload recovery.
- Store Source, mirrors, hashes and complete snapshots; reject late original/own-row mutation and stale peer/retry evidence.

## 3. Numeric collision regression

The preserved readonly review found a numeric-limit false-contact risk in accelerated sphere collision error bounds. Scale each finite squared term by `8 * Number.EPSILON` before summing the floating error bound. Do not first sum near-`Number.MAX_VALUE` squared terms into Infinity, and do not let a coarse scale tolerance turn positive separation into a contact.

## 4. Continuation after this slice

The next dependency remains actual uninterrupted acquisition plus shared constant-acceleration World geometry, then actual venue/base/foul whole-play replay and official/scoring/actual-role workload closure. UI/Presentation, merge, production calibration defaults and the separately prepared CI YAML patch are outside this scope.
