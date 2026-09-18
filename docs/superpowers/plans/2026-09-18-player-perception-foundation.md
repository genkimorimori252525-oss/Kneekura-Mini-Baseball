# Player Perception Foundation Implementation Plan

> Status: implementation plan derived from the approved `2026-09-17-time-running-catching-perception-umpire-design.md`.

**Goal:** Build the deterministic non-omniscient perception substrate shared by runners, defenders, coaches, and later umpires. The subsystem must never expose `CanonicalWorldSnapshot` directly to decision code.

**Architecture:** Canonical truth is sampled into player-owned observations. Attention controls refresh opportunity, observations carry timestamp/confidence, memory predicts stale observations forward with confidence decay, and communication arrives as another perceived information source. Decision systems consume only perceived state.

**Core invariants**

- `Canonical World != Perceived World`.
- Same match seed + play id + observer/target stream key => reproducible perception.
- One observer/target stream cannot perturb another stream or physics RNG.
- No renderer/FPS input enters perception.
- Confidence stays in `[0,1]`; stale memory loses confidence.
- Communication is information, never a forced command.
- Calibration constants are explicit parameters, not hidden success percentages.
- This phase provides perception substrate only; strategic runner/defender decision policy remains a later layer.

---

### Task 1: Independent perception RNG streams

**Files**
- Modify: `src/core/rng/SeedRoot.ts`
- Modify/Test: `src/core/rng/SeedRoot.test.ts`

- [ ] Add `perception` to `CorePhase`.
- [ ] Add deterministic named substream derivation:
  `streamSeed(playId, phase, streamKey)` and `streamRng(...)`.
- [ ] Prove same key reproduces exactly, different observer/target keys differ, and consuming one stream does not perturb another.
- [ ] Run `npm run verify` RED -> GREEN.

### Task 2: Attention and observation samples

**Files**
- Create: `src/core/sim/perception/Observation.ts`
- Create/Test: `src/core/sim/perception/Observation.test.ts`

Define:
- `AttentionTarget`
- `AttentionState`
- `ObservationSample<T>`
- validation helpers
- explicit attention vs peripheral refresh policy inputs

Initial substrate does not invent final FOV/occlusion calibration. Instead it accepts an externally computed normalized observation quality and records the resulting sample deterministically.

Requirements:
- attention target gets high-frequency refresh eligibility;
- non-attended target uses a separate lower-frequency interval;
- observation time is integer authoritative tick;
- confidence is validated in `[0,1]`.

### Task 3: Memory prediction and confidence decay

**Files**
- Create: `src/core/sim/perception/ObservationMemory.ts`
- Create/Test: `src/core/sim/perception/ObservationMemory.test.ts`

For observed planar moving entities, predict current estimate from:
`last position + remembered velocity * elapsed time`.

For ball observations, support 3D position/velocity prediction without pretending this memory model is the authoritative ball physics.

Confidence decay uses explicit calibration parameters and authoritative integer elapsed ticks. Prediction must not mutate the original observation.

Tests:
- zero elapsed = exact observation;
- stale sample advances by remembered velocity;
- confidence decreases monotonically;
- confidence reaches configured floor but never becomes negative.

### Task 4: Communication as perceived information

**Files**
- Create: `src/core/sim/perception/Communication.ts`
- Create/Test: `src/core/sim/perception/Communication.test.ts`

Define:
- `CommunicationEvent`
- target scope
- semantic content envelope
- `ReceivedCommunication`

Reception is determined from explicit audibility/recognition inputs plus deterministic stream, with a receive tick and confidence. It must never modify runner/defender intent directly.

Tests:
- before receive tick, information is unavailable;
- after receive tick, message can enter perceived state;
- same stream inputs replay identically;
- another communication stream remains independent.

### Task 5: Player perceived world boundary

**Files**
- Create: `src/core/sim/perception/PlayerPerceivedWorldState.ts`
- Create/Test: `src/core/sim/perception/PlayerPerceivedWorldState.test.ts`
- Modify: `src/core/index.ts`
- Modify/Test: `src/core/index.test.ts`

Build perceived state only from:
- observer identity and attention;
- observation samples / remembered predictions;
- received communication;
- known game context supplied to the observer.

Do **not** accept `CanonicalWorldSnapshot` in the builder API.

The first public boundary will be generic enough for runner and defender decision layers; specialized `RunnerPerceivedWorldState` / defender decision models can wrap it later.

Tests:
- builder has no canonical-world argument;
- stale target remains represented through memory with lower confidence;
- communication is present as information but no action/intent is emitted;
- public Core API exports the perception substrate.

### Deferred calibration

The following remain explicit follow-up work and are not silently hard-coded here:
- exact FOV geometry;
- occlusion approximation;
- distance/relative-speed observation error distribution;
- attention switching policy;
- perception/awareness rating curves;
- crowd-noise/hearing curves;
- strategic runner and defender decision policies.
