# Actual uninterrupted batted-ball acquisition — implementation brief

Authority: confirmed nonvisual continuation after PR #247, exact base `6f9d893d24697151ddeb7f603002ca52eed6224f`. This slice implements the next recorded dependency only. It does not add UI/Presentation or a new catching probability model.

## 1. Core acquisition proof

- Consume the already-derived actual `capture_candidate` plus the complete original `BattedWorldContactInput`.
- Re-derive the original first World contact/continuous geometry and require it to match the candidate. A caller-provided catch/possession boolean is not evidence.
- The candidate must be the sole actual glove contact, the actor must belong to the original nine defender bindings (never the batter actor), and its retention outcome must be `secured` at the existing physical `secureTick`.
- Locate the same original glove primitive and require one continuous constant-acceleration primitive to cover the interval through `secureTick`.
- If the original World horizon does not reach `secureTick`, return an explicit `requires_world_extension` boundary. Do not extrapolate the accepted command beyond its owned interval.
- Rebound/ground/airborne responses are explicit `not_candidate`; prior simultaneous/degenerate contact remains `unresolved`.
- On success, return immutable acquisition evidence with fielder id, contact tick, secure tick and the actual glove sample at secure tick. This evidence still does not imply OUT, PlayEnd, scoring or workload.

## 2. Native ownership

- Add a Native SQLite acquisition owner referencing the original accepted contact-response Source only.
- Re-derive response, World geometry and acquisition on its own connection. The peer response store is comparison-only.
- Fresh acceptance requires the original response/World/flight/current workload fences to remain intact before and during the transaction.
- Historical acquisition remains readable after legitimate later workload recovery.
- Archive Source, physical-pitch/game mirrors, full snapshot and hashes; late Source/model/World/flight/workload/own-row mutations roll back.
- Do not persist a successful acquisition if the Core returns `requires_world_extension`, `not_candidate` or `unresolved`; expose the reason by rejection and leave the database unchanged.

## 3. Existing event integration boundary

The older generic `adoptSecurePossessionAtTick(... stillRetained: boolean ...)` remains unchanged for compatibility. This new batted-ball path must not feed a caller boolean into it. Later whole-play replay may construct secure-possession canonical evidence from this acquisition record.

## 4. Verification and continuation

Tracked tests cover secure acquisition, exact-contact secure tick, insufficient World interval, forged/mismatched World proof, non-candidate/unresolved boundaries, Native reopen/history and WAL rollback. Run strict typecheck and whole P0 verification, then publish stacked and unmerged.

After this slice: repeated post-response World contacts / rolling pickup, transfer/throw/reception/base/running, foul whole-play replay, and official/scoring/actual-role workload closure remain.
