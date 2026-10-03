# Actual Field Observation Implementation Plan

**Goal:** Persist explicit Player view/attention and replay noisy observations from Native-owned, bounded actual field execution.

**Architecture:** A separate per-physical-pitch/per-Player immutable Source chain pins existing field and execution prefixes and the accepted observation model. Native reconstructs those dependencies on its own database connection; a private sampler feeds existing perception algorithms without exposing physical truth in the perceived state.

**Tech stack:** TypeScript, SQLite WAL, Vitest, Node 26.

**Approved sources:** `docs/superpowers/specs/2026-09-17-time-running-catching-perception-umpire-design.md`, `docs/superpowers/specs/2026-09-17-causal-contact-and-individual-defense-design.md`; current runtime/adjudication contracts 05/06/07. Current design handoff at foundation commit `44b9f5de`; runtime contracts at `4f0a60a3`.

## Constraints and explicit semantics

- World truth precedes observation; no decisions, controllers, communication generation, rule outcomes, play completion, Presentation or production calibration defaults.
- Accepted Source input: IDs/version, observer Player, pinned base field, optional execution head, observation model, previous observation, explicit versioned body-relative eye translation (world axes), forward direction and ball/other-player attention target.
- Eye poseVersion and bodyRelativeEyeOffset are pinned to the first Source. Receipts explicitly label body-primitive-center/world-axis-translation anchoring. The target set is ball plus all other registered Player body primitives, sorted by Player ID.
- No caller coordinates, velocities, observation time/availability, focused-since time, quality, estimates, confidence or results.
- Observation moment is exactly the pinned executed horizon, retaining origin tick and elapsed seconds. Ball truth comes only from an established adopted cursor. Unresolved ball state stays unavailable.
- Sample actual body primitives at that exact moment; eye offset is explicit model input, not inferred anatomy. All other owned actor spheres provide occlusion; exclude observer and sampled target primitives.
- Attention begins at the first accepted Source in the contiguous same-target history. Exact focus age is attention provenance only, not proof of continuous visibility. The instantaneous sampler uses observationDurationSeconds=0 and the owned instantaneousDurationQuality; attended/peripheral quality is categorical 1/0. Existing refresh and memory age remain integer-tick policies; exact receipt time must not be represented as sub-tick memory precision.
- Owned base/wall intersections are conservatively unavailable until optical policy exists, including tangent and endpoint contact; no collider is silently declared transparent or opaque.
- Nondetection and refresh-not-due retain prior samples. The perceived state contains only noisy memory, attention, null known context, and no communications.
- Fresh writes pin current physical heads and current original actors, model and fixture. Historical reads validate all prefix metadata but never consume future physical or observation payloads.
- Observation writes do not acquire physical ownership or advance time. Immutable retries/reopen and late-write rollback are required.

## Review focus

- Same canonical tick with distinct actual elapsed seconds retains distinct sampling and duration semantics
- Pending scheduled transfer never exposes future release metadata as current truth
- Incoming contact velocity never replaces an adopted post-response cursor
- A changed indexed mirror cannot hide conflicting Source ownership
- Invalid future payload cannot contaminate bounded historical replay, while invalid future metadata still fails closed

## Tasks

### 1. Receipt and private sampler

Files: add `src/host/world/ActualFieldObservation.ts`, `ActualObservationSurfaceGuard.ts`, and focused tests/support.

- [x] Write failing tests for exact moment sampling, independent perception streams, FOV/primitive occlusion, old-memory retention, unknown ball state and focus history
- [x] Run focused tests and verify intended missing-module/API failure
- [x] Define accepted view/observation input and result-only receipt types; sample owned actors/cursor privately using existing geometry, quality, capture, refresh, memory and perceived-state builders
- [x] Verify tests pass, with synthetic explicitly named test calibration only

### 2. Native immutable observation store

Files: add `src/host/world/SqliteActualFieldObservationStore.ts`; minimally extend `SqliteBattedWorldFieldExecutionStore.ts` bounded scope with a null zero-payload bound.

- [x] Write failing Native tests for provenance, scope/model/time rejection, immutable history/currentness and injection rejection
- [x] Reconstruct original physical prefix, actor/Person bindings and pinned model on own SQLite connection
- [x] Persist Source/snapshot hashes, indexed mirrors, directed chain and head under one IMMEDIATE transaction; rederive dependencies before/after insertion
- [x] Verify bounded replay after future physical/observation payload and metadata mutations

### 3. Adversarial and integration verification

Files: add `src/host/world/ActualFieldObservationWal.test.ts` and extend focused receipt/store tests.

- [x] Exercise same-tick exact samples, pending scheduled transfer, response cursor, actual late WAL mutations, rollback/retry and preserved original archive hashes
- [x] Run typecheck and only focused new/affected suites with Node 26, one worker, and isolated TMPDIR
- [x] Obtain independent review, resolve findings with regression tests, rerun applicable verification
- [x] Commit reviewed local changes with command-local author identity; report exact evidence and remaining seams

## Verification record

- Initial Native API tests failed for the missing owner module before implementation.
- The null execution-bound regression reproduced rejection of legitimate later descendant field ownership before its metadata-only anchor fix.
- Future observation model-pointer corruption was accepted by the initial metadata loop; the targeted regression now covers model, field and execution pointer integrity without reading future payloads.
- The inherited sphere endpoint-overlap regression failed before closest-point clamping and passes afterward, including clear non-overlap and tangent cases.
- Native sightline coverage uses an explicitly synthetic overhead wall: actual ball transfer stays below the wall while the eye ray crosses it. The later unavailable receipt preserves and ages its original noisy memory.
- Independent code review found no remaining correctness issues after the geometry and retention additions.
- Final verification is limited to the new suites, existing perception regressions, public exports, and affected Native field-execution/rollback suites. Whole-repository verification belongs to integration.

### Final results

- Pre-freeze breadth run: **198 tests passed across 17 files** (all existing perception tests, public exports, new observation suites, and affected field-execution/rollback suites).
- Two final boundary regressions independently reproduced RED: delimiter-colliding accepted vector keys and finite calibrated noisy samples overflowing on later actual-prefix memory prediction.
- Frozen final delta run: **120 tests passed across 14 files**, including all existing perception tests, the new input/sampler/Native/rollback/surface suites, and both new regressions.
- `tsc --noEmit` passed after the repository catalog-generation prerequisite. `git diff --check` passed. Final production hashes were unchanged before/after the final gates.
- Independent final review found no remaining correctness findings.
- No whole-repository suite, remote write, home CI, merge, deployment, UI/art change, or production calibration default was included.

Final delta command (Node 26, one worker):

```sh
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run src/core/sim/perception \
  src/host/world/ActualFieldObservationInput.test.ts \
  src/host/world/ActualFieldObservation.test.ts \
  src/host/world/SqliteActualFieldObservationStore.test.ts \
  src/host/world/ActualFieldObservationWal.test.ts \
  src/host/world/ActualObservationSurfaceGuard.test.ts \
  --maxWorkers=1 --minWorkers=1
```
