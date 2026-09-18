# Individual Defender Decision Foundation Plan

**Goal:** Implement the approved individual-defense decision boundary so each defender replans from its own perceived world, pre-play plan, and abilities without any post-contact central commander.

**Source specs**
- `docs/superpowers/specs/2026-09-17-causal-contact-and-individual-defense-design.md`, especially section 4.
- `docs/game-design/02-rules-ratings-defense.md`, with the later individual-decision spec taking precedence over any earlier central-assignment wording.

**Architecture**

```text
PlayerPerceivedWorldState
+ self profile
+ pre-play defensive plan
+ perceived action cues / communication
        ↓
meaningful replan trigger
        ↓
candidate DefensiveIntent[]
        ↓
individual deterministic choice
        ↓
DefensiveIntent + decisionTick
        ↓
physical movement / catch / throw / cover
```

There is no API that accepts `CanonicalWorldSnapshot` or the other eight defenders' hidden truth.

**Principles**
- situationalAwareness changes recognition/decision timing and candidate recognition, not physical top speed.
- No every-tick global optimization.
- One defender's slow recognition is not automatically corrected by another central system.
- Communication is evidence, not an order that must be obeyed.
- Pre-play strategy influences priorities but does not rewrite post-contact physics.
- Calibration values remain explicit parameters.

---

### Task 1: Meaningful defender replan events

**Files**
- Create: `src/core/sim/fielding/DefensiveReplan.ts`
- Create/Test: `src/core/sim/fielding/DefensiveReplan.test.ts`

Represent the approved event set:
- batted ball recognized;
- teammate commitment recognized;
- catch / drop recognized;
- large ball-direction change recognized;
- throw start recognized;
- runner advance / retreat recognized;
- communication received;
- coverage need changed.

Each trigger has an authoritative perceived tick. A defender replans only when a new relevant trigger occurs after its last decision tick.

### Task 2: Awareness-driven decision latency

**Files**
- Create: `src/core/sim/fielding/DefensiveDecisionTiming.ts`
- Create/Test: `src/core/sim/fielding/DefensiveDecisionTiming.test.ts`

Map normalized situational awareness into explicit decision latency:
- `minimumDecisionDelayTicks`
- `maximumDecisionDelayTicks`
- optional fixed per-defender processing offset.

Higher awareness reduces delay monotonically. It never changes acceleration/top speed/catch physics.

### Task 3: Non-omniscient defender decision context and candidates

**Files**
- Create: `src/core/sim/fielding/DefensiveDecision.ts`
- Create/Test: `src/core/sim/fielding/DefensiveDecision.test.ts`

Define local inputs:
- `PlayerPerceivedWorldState<DefensiveKnownContext>`
- self registered position and current position;
- pre-play plan priorities;
- perceived action cues carrying their own observed time/confidence.

Candidate intents initially:
- `ball_handler`
- `base_cover`
- `relay`
- `backup`
- `deep_coverage`
- `hold`

Candidate generation must not accept canonical truth.

### Task 4: First-base cover vertical slice

Use the approved regression:
- first baseman is perceived committing to a ground ball;
- first base is perceived as needing coverage;
- pitcher has pre-play first-base-cover responsibility;
- pitcher independently generates/selects `base_cover(1)`.

Changing only pitcher's situational awareness changes `decisionTick`, not movement ability or another player's decision.

A missing/late teammate-commitment observation delays or prevents the cover candidate; the system must not globally repair it.

### Task 5: Communication and deterministic choice

A received callout may add/re-rank a local candidate only after `receivedAt`. It does not force obedience.

Choice uses explicit local priority inputs and stable deterministic tie-breaking; no defender evaluation order may alter another defender's choice.

### Task 6: Shared Core API and regression

Export the replan, timing, and decision foundation through `src/core/index.ts`. Add Core API tests and run full `npm run verify`.
