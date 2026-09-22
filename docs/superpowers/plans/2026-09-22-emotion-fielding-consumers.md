# Emotion fielding consumers implementation plan

> For agentic workers: use superpowers:executing-plans and test-driven-development.

**Goal:** Connect accepted single-gate intent time and throw aggression to existing throwing and defensive-motion owners, without UI or a new physics engine.
**Architecture:** PR37 prepares/accepts an emotion decision. A later scheduled fielding event must use that exact gate state and fresh, matching physical/perception sources. The consumer returns a revalidated launch/motion proposal; persistence and event execution remain host-owned.
**Tech Stack:** existing TypeScript, Vitest, no dependency change.
**Spec:** frozen `docs/game-design/05-psychology-emotion.md` §§2,3.1,7,8,12,13 at `782f6b8ef2406839de5678b00040001111cd8f77`; existing PR37 API. User authorizes approved nonvisual continuation.

## Global constraints
- No UI/rendering connection, shared-branch merge, direct outcome or flat ability bonus.
- One accepted gate; no new appraisal at execution and no cumulative modifiers.
- Current source identity, observation cutoff and physical time are separate.
- Pure deterministic plans, not assertions that a ball was released or the world was saved.
- Transfer, launch, first-step and motion reuse their current Core owners.

## Decisions / tradeoffs
- Execute sending/replan before batting because they are on this dependency branch; PR27 Swing Kinematics is independent and not silently merged. Batting remains explicitly open.
- Due-event contract: before due -> WAITING; after due -> MISSED_COMMITMENT; no retroactive action. A missed source window does not become an automatic out or failed catch.
- Throw repertoire is supplied by the physical owner, versioned and speed-bounded. Aggression selects an existing threshold profile; it does not change arm/accuracy/transfer ratings. Profile thresholds and motor durations are calibration inputs, not approved numeric constants.
- Initial throw pose supports stationary holders only. Moving throws and actual release-pose validation are separate; no false stationary-to-moving generalization.
- Replan candidates are existing perceived-plan outputs. Candidate generation is not replaced. Old motion continues through motor latency; new target follows with position/velocity continuity.

## Review focus
1. A newer gate/source invalidates a queued plan, even if its label happens to match.
2. Impossible/future evidence, invalid ownership, unsafe arithmetic and non-inert payloads reject.
3. Decision delay must affect launch time, not arm strength, and must not double charge completed transfer.
4. Motion keeps momentum and must not teleport or stop while waiting to replan.
5. Missing control/trigger and missed commitment produce no launch/replan; modified proposal acceptance rejects.

## Tasks
- [x] Task 1: `FieldingTypes`, `FieldingValidation`, `FieldingExecution` plus due/source tests; bind a real accepted PR37 proposal to a current frame/gate without reappraisal.
- [x] Task 2: `EmotionThrowPlan` plus tests; use `resolveBallTransferTiming` + `createRatedThrowLaunch`, preserve ratings/seed, select bounded physical profiles.
- [x] Task 3: `EmotionDefenseReplan` plus tests; reuse `findNextDefensiveReplanTick`, `chooseDefensiveIntentCandidate`, first-step and motion functions; preserve old movement and enforce cutoff.
- [ ] Task 4: acceptance/adversarial tests, API and partial-plan inventory, native exact-head full verification, PR without merge.

Pre-flight: Tasks2/3 consume the exact accepted inputs from Task1, not raw candidate effects. Task4 recomputes the same normalized source request. No interfaces with renderer or independent swing modules.
