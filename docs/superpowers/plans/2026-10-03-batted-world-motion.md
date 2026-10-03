# Actual batted World motion handoff implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement task by task, with one fresh readonly whole-branch review.

**Goal:** Execute later accepted body/primitive motion from the exact own preceding physical state while preserving all original batted evidence and World causality.

**Architecture:** Add explicit continuous primitive start offsets to the shared World segment engine; existing integer-based primitive inputs retain their behavior. Rebase every active primitive from its actual prior center/velocity, then execute free or securely carried ball motion against all updated primitives, finite panels and ground. A Native Source prefix owns original response/continuation/acquisition, accepted commands, current head and complete immutable replay; it never accepts caller positions, velocities, possession or results.

**Tech Stack:** Existing TypeScript, Vitest and node:sqlite. No new dependencies.

**Spec:** Current approved `docs/game-design/05-world-first-live-ball-architecture.md`, `06-world-first-runtime-contracts.md`, `07-world-first-adjudication-contracts.md` at Realism4f0a60a3818926327b6bf5877ab3dec456a76530. Foundation44b9f5de7b9d87e649f12f1af78c202f2b5ab44d handoff confirms current design statuses. Base b4bd50eb527820b58e98108f50aaba80ebda0401.

## Global constraints

- World-first causality; Presentation remains read-only and disconnected.
- Preserve true continuous moment, shared integer clock, original actor/Player/Person identities, role/radius and accepted original material/retention calibration.
- Motion commands replace future execution only. Derive starts from the prior own physical state; no pocket teleport, old-route snap, retroactive acceleration or forecast treated as completed movement.
- Preserve all contacts at the earliest recorded tick, actual departure/re-entry, body/feet/hand/glove collision coverage and finite-panel/ground geometry.
- Missing acquisition, simultaneous/persistent/unresolved contact or insufficient release calibration remains unresolved. Do not fabricate released-ball motion, official result or PlayEnd.
- No general pre-pitch runner body orchestration, old plan revival, UI/Presentation connection, merge/reset/force, lock/config overwrite or deletion of active/review artifacts.

## Review focus

- Fractional contact/secure moments and very large original ticks: preserve actual geometry when starting a later primitive.
- Commands changing acceleration after a contact: position/velocity stay continuous, prior history stays immutable.
- Missing/duplicate roles, actors or clocks and late command availability: fail closed rather than omit a collider.
- A secured carried ball meeting another primitive/panel/ground: preserve interruption without inventing a free-ball release.
- Original/prefix/head/mirror/hash corruption and callback/late-WAL races: own re-derivation and rollback, including superseded lower World writers.

## Task 1: Continuous motion basis and actual World segment

Files: modify `src/core/sim/ball/BallWorldContinuation.ts` and `BattedWorldContinuation.ts`; create `BattedWorldMotion.ts`, `BattedWorldMotion.test.ts`.

Interfaces: `BallWorldMotionActor` extends a registered primitive with optional `startElapsedSeconds` relative to its integer startTick. `deriveBattedWorldMotion` consumes own prior cursor, full actors/profiles, all per-role acceleration commands and recorded horizon; returns rebased actors, actual queried World and a derived free/carry/pending response. Export the existing batted-boundary response helper for reuse instead of duplicating material/retention math.

- [x] Write/run RED for fractional and large-clock rebase, extended coverage, acceleration continuity, all-role completeness, free actor/panel/ground contacts and interrupted carried possession.
- [x] Implement the shared continuous primitive basis and actual motion query, preserving existing free-motion API behavior.
- [x] Run relevant motion/World/continuation/acquisition/continuous-root tests and typecheck; record actual counts and terminal results.

## Task 2: Own Native accepted motion prefix

Files: create `src/host/world/SqliteBattedWorldMotionStore.ts`, `BattedWorldMotionFixtures.test-support.ts`, `SqliteBattedWorldMotionStore.test.ts`, `BattedWorldMotionWal.test.ts`; add a narrow future-owner fence for fresh superseded original World/continuation writers where required by actual Source audit.

Interfaces: accepted Source has only IDs/version, original response ID, optional exact original continuation/acquisition IDs, predecessor motion ID, command availability tick, horizon and original-style ten-actor body/primitive acceleration commands. Original root evidence is read on the writer connection; complete contiguous prefix and head are re-derived on read/retry and before/after current writes. Peer response is comparison only.

- [x] Write/run RED for own original/later/carry roots, chained actual motion, immutable old reads/retries, caller state/outcome rejection and full Source/mirror/hash/head ownership.
- [x] Persist actual derived motion with its original proof and all predecessor Sources. Reject stale concurrent alternatives and late mutations, preserving historical recovery behavior.
- [x] Run WAL callback/trigger rollback and superseded lower-owner regressions; typecheck and related Native/Core gates.

## Task 3: Review, frozen gate and stacked publication

- [x] Obtain one fresh readonly review of the whole branch; reproduce and fix concrete findings with tracked RED/GREEN.
- [x] Commit only Source/plans/status; keep scratch untracked. Run a frozen whole gate with Source manifest and process-local K: TEMP/TMP, two workers. Terminal exit0:578files3665tests GREEN;11Source hashes unchanged.
- [ ] After actual GREEN, push the ordinary new branch and create a stacked PR on acquisition. Never overwrite existing stacked branches or merge.

Subsequent actual pickup/transfer/throw/all-World reception/base/running, owned foul/next-pitch/between-pitch physical replay and official actual-role workload closure remain in the full goal. This dependency does not substitute for those required implementations.
