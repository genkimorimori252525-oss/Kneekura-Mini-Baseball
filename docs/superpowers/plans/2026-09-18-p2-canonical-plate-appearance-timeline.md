# P2 Canonical Plate-Appearance Timeline Plan

**Status:** IMPLEMENTATION IN PROGRESS.

**Parent roadmap:** P2 — canonical time / world / plate appearance.

**Acceptance condition closed by this plan:** one plate appearance can be represented as a deterministic authoritative event timeline whose count transitions come from P1 rules and whose live-ball branch can begin only from existing physical bat-ball contact evidence.

## Architecture

```text
CanonicalMatchState
        ↓
createCanonicalPlateAppearanceTimeline
        ↓
physical PitchTrajectory
        ↓
take / swing
        ↓
plate crossing OR BatBallContact
        ↓
ball / called strike / swinging strike
        ↓
existing PitchCountRule
        ↓
continue | walk | strikeout

OR

BatBallContact
        ↓
batted_ball_pending
        ↓
BallFlight / first-ground / fielder-touch evidence
        ↓
fair / foul disposition
        ├─ foul -> existing PitchCountRule
        └─ fair -> live_ball
                    ↓
              fielding / running / RuleEngine
                    ↓
                 play end
```

## Permanent constraints

- P2 does not create a second pitch/contact physics implementation.
- Counted non-contact pitch outcomes are limited to physical take/swing results: `ball`, `called_strike`, `swinging_strike`.
- `ball_in_play`, `foul`, and `foul_bunt` cannot be injected through that counted-pitch boundary.
- `BatBallContactResult` creates `batted_ball_pending`, not `live_ball`; physical fair/foul disposition must occur before a fair ball becomes live.
- Timeline event ticks never move backward.
- `TimedMatchEvent.sequence` provides stable storage ordering only; equal ticks remain physically simultaneous.
- A terminal walk/strikeout or non-active batted-ball timeline rejects further pitch records; an uncaught foul may return the same ledger to `active` and resume the same plate appearance.
- The timeline owns a single `playId` inherited from `CanonicalMatchState`.
- P1 rule modules remain the only source of count semantics.
- Walk force advancement, strikeout state application, live-ball state application, and `playId` progression are implemented. Batting-order ownership remains a later P2/P7 boundary.
- Presentation is a read-only consumer.

### Task 1: Canonical plate-appearance event ledger

Create `CanonicalPlateAppearanceTimeline.ts`.

Provide:
- timeline creation from `CanonicalMatchState`;
- counted pitch recording;
- physical bat-ball contact recording;
- authoritative event sequence and current status.

### Task 2: Count chronology regression

Require:
- ball -> foul -> two-strike foul -> strikeout chronology;
- walk chronology;
- monotonic tick enforcement;
- terminal timeline rejects additional pitches.

### Task 3: Physical contact boundary

Require:
- actual `resolveBatBallContact` result creates `batted_ball_pending`, never immediate `live_ball`;
- contact event preserves contact tick/ball center/contact point/exit velocity/spin;
- only later physical fair/foul evidence may promote the pending ball to `live_ball` or return it to foul-count semantics;
- counted-pitch API cannot accept `ball_in_play`, `foul`, or `foul_bunt`.

### Task 4: Match-state application stages

Follow-up slices after the ledger:
1. strikeout -> out / half-inning transition;
2. walk -> forced base advancement;
3. live-ball play-end facts -> CanonicalMatchState;
4. next-batter / next-play-id orchestration.

### Task 5: P2 replay/determinism acceptance

Same initial state + same resolved physical inputs must produce the same timeline events and state transitions independent of Presentation cadence.


---

## Implementation checkpoint — 2026-09-18

Implemented so far:

- `CanonicalPlateAppearanceTimeline`
  - immutable event ledger per `playId`;
  - monotonic authoritative ticks;
  - stable `TimedMatchEvent.sequence`;
  - counted pitches delegate to P1 `PitchCountRule`;
  - terminal walk/strikeout/live-ball states reject later pitches;
  - `ball_in_play` cannot enter through counted-pitch API;
  - actual `BatBallContactResult` is required to enter live-ball state;
  - deterministic identical-input regression.

- `PlateAppearanceMatchState`
  - strikeout -> out increment;
  - third strikeout out -> P1 half-inning transition;
  - B/S reset;
  - bases preserved before third out / cleared on half-inning transition;
  - `playId` advances once a plate appearance ends.

- `WalkAdvancementRule`
  - only contiguous forced runners advance;
  - bases-loaded walk forces the runner from third home;
  - duplicate runner identities are rejected.

- walk -> `CanonicalMatchState`
  - forced base advancement;
  - batting-side score update;
  - B/S reset;
  - `playId` advance.

Key checkpoints:
- `7874c500...` / `6afc5aa6...`: canonical plate-appearance timeline RED/GREEN;
- `4ccc18a4...` / `054f45ba...`: strikeout MatchState application RED/GREEN;
- `93ebee23...` / `a25ecf4d...`: walk forced-advancement RED/GREEN;
- `be5345b8...` / `399dfb86...`: walk MatchState application RED/GREEN;
- `6e9d2ab0...`: shared Core API coverage.

Latest GitHub Actions evidence:
- run `35331301516`
- job `105556017156`
- `steps=[]`

The workflow still fails before commands execute, so repository GREEN is not claimed.

### Next P2 slice

Apply an existing resolved live-ball play result to `CanonicalMatchState` without inventing a second fielding/running engine.

Target boundary:

```text
CanonicalPlateAppearanceTimeline(status = live_ball)
  + existing Correct Rule Result / play-end facts
        ↓
CanonicalMatchState
  score / outs / bases / inning-half / count reset / next playId
```

After that, connect the existing physical contact/ball-flight/fielding slices into one chronological plate-appearance coordinator.


---

## Implementation checkpoint — 2026-09-18 later pass

P2 has advanced beyond the original first-slice plan.

### Physical pitch path

Implemented:

```text
PitchTrajectory
  -> exact plate crossing
  -> geometric strike-zone overlap
  -> TakenPitchPhysicalResult
  -> TakenPitchPlateCrossed event
  -> PitchCountRule
```

and:

```text
PitchTrajectory
  + BatterSwingWindow
  -> shared BatBallContact equation
  -> contact OR swinging miss
  -> canonical timeline
```

The same pitch/contact physics is used rather than adding a result-probability path.

### Multi-pitch plate appearance

Implemented:
- `PitchAgainstBatter`;
- `PlateAppearancePitchSequence`;
- `PlateAppearanceSequenceCoordinator`;
- continued pitch processing after a physical foul returns the timeline to `active`;
- physical strikeout/walk through to the next `CanonicalMatchState`;
- active/pending/unresolved states do not mutate match state prematurely.

A single plate appearance can now carry multiple physical pitch events in one ledger.

### Contact disposition correction

An architectural error was caught and fixed:

```text
WRONG:
BatBallContact -> live_ball

CURRENT:
BatBallContact
  -> batted_ball_pending
  -> physical disposition evidence
  -> fair -> live_ball
  -> foul -> count / caught-foul live action
```

The legacy `ContactVerticalSlice` no longer marks raw contact as `liveBattedBall=true`.

`BatBallContactResult` now preserves the physical ball center and can directly create a `BattedBallInitialState`.

### Batted-ball physical evidence

Implemented:

```text
BatBallContact
  -> BattedBallInitialState
  -> BallFlight
  -> exact first ground contact
  -> FairTerritoryGeometry
  -> BattedBallFirstGroundContact event
```

The first-ground physical fact does not itself decide fair/foul.

### Limited safe fair/foul automation

Implemented the rule-safe subset for an untouched batted ball whose **first ground contact occurs beyond first or third base**.

For that subset:

```text
first ground contact
  + foul-line geometry
  + first/second/third-base gates
  + explicit no-prior-fielder-touch guarantee
        ↓
fair OR foul
        ↓
fair -> live_ball
foul -> dead-ball foul count semantics
```

A first ground contact before the first/third-base gates remains `not_decisive`; the engine does not guess. It still needs later evidence such as crossing/passing a base in fair territory, settling, or fielder touch.

Grounded foul handling no longer requires inventing a fake fly-catch/fielder-touch result.

### Ground-ball live-play completion

Implemented:
- existing `GroundBallFirstBaseRuleEngineResult` -> resolved live-ball state adapter;
- pending-run finalization at authoritative play end;
- third-out run suppression preservation;
- completed live-ball timeline required before MatchState application;
- final bases come from authoritative running evidence, not P2 inference;
- `GroundBallPlateAppearanceCoordinator` closes fair live-ball play through next `CanonicalMatchState`.

### Current continuation point

Do **not** return to defender anatomy.

Continue P2 fair/foul + batted-ball chronology:

1. resolve before-base first-ground cases using later physical evidence rather than first landing alone;
2. add first-fielder-touch territory evidence as another decisive fair/foul path;
3. connect fair disposition to full BallFlight / fielding chronology without duplicate simulation;
4. cover caught-foul play-end -> MatchState including tag-up/runs;
5. finish deterministic whole-plate-appearance replay acceptance.

Latest CI evidence at this checkpoint:
- run `35336211983`
- job `105571527953`
- `steps=[]`

Repository GREEN is still not claimed because workflow commands never executed.


---

## Implementation checkpoint — 2026-09-18 fair/foul continuation

The before-base fair/foul gap has advanced substantially.

### First fielder touch

Implemented:

```text
physical first fielder contact
  -> ball-center + ball-radius territory evidence
  -> fair/foul rule
  -> fair: live_ball
  -> foul: pending catch resolution
```

The fielder's own standing position is not used to decide fair/foul; the physical ball position is.

Caught foul play-end can now be applied to `CanonicalMatchState` while preserving runner/tag-up finalization.

### Ball radius at foul lines

Fair/foul geometry now evaluates the projected ball disk, not only the center point.

A ball whose center is slightly outside but whose radius still overlaps the foul line remains geometrically over fair territory.

The ball radius is carried through:
- flight evidence;
- first-ground territory evidence;
- first-fielder-touch evidence;
- rule adapters.

### Before-base bounce continuation

The engine no longer stops at `not_decisive` after a first bounce between home and first/third.

Base-gate geometry was extracted into the simulation layer so rules do not own coordinate math.

Implemented:

```text
first ground contact before both gates
  -> continue the SAME BallFlight
  -> exact first authoritative tick beyond first/third gate
  -> ball-radius fair/foul geometry
  -> explicit no-prior-fielder-touch
  -> explicit no-prior-first/third-base-touch
  -> fair OR foul
  -> canonical timeline
```

Key modules:
- `FairFoulBaseGateGeometry`
- `BattedBallBaseGatePassage`
- `FairFoulBaseGatePassageRule`
- `BaseGateFairFoulTimelineAdapter`

### Finite ground-ball rolling

A physical gap in `BallFlight` was found and fixed.

Previously, once a ball entered the on-ground state with horizontal velocity, it could roll forever at constant speed.

Current behavior:

```text
ground impact
  -> horizontal rolling velocity
  -> configurable continuous rolling deceleration
  -> exact authoritative stop tick
  -> zero velocity thereafter
```

`groundRollingDecelerationMps2` is a calibration parameter, not a result bonus. It can later become surface-dependent (grass/dirt/stadium) without changing the causal boundary.

### Settled before-base fair/foul

Finite rolling made another official fair/foul condition physically representable.

Implemented:

```text
first ground contact before both gates
  -> same BallFlight continues
  -> exact settled tick
  -> settled ball-center + radius territory
  -> require no earlier fielder touch
  -> require no first/third-base touch
  -> require no earlier base-gate passage
  -> fair OR foul
  -> canonical timeline
```

Key modules:
- `BattedBallSettlingEvidence`
- `FairFoulSettledBallRule`
- `SettledBallFairFoulTimelineAdapter`
- canonical `BattedBallSettled` event

### Static correction caught during this pass

`CanonicalPlateAppearanceTimeline` referenced
`CanonicalFirstGroundContactEventPayload` and
`CanonicalFirstFielderTouchEventPayload` without definitions.

Those payload types were restored while adding
`BattedBallBaseGatePassed`.

### Current remaining fair/foul work

The major unresolved physical decision paths are now narrower:

1. **direct first/third-base touch by the batted ball** — touching the bag is a decisive fair condition and needs 3D ball/base contact evidence;
2. foul pole / out-of-park fair/foul geometry;
3. any remaining umpire-judgment/replay layer above canonical physical truth.

After those, return to:
- full fair live-ball -> fielding/running chronology without duplicate simulation;
- deterministic whole-plate-appearance replay acceptance;
- then the parent P2 completion audit.

### Latest CI evidence

GitHub Actions:
- run `35342610706`
- job `105591750528`
- `steps=[]`

The workflow still terminates before commands execute, so repository GREEN is not claimed.

A direct local clone/test attempt was also blocked by the execution environment's lack of DNS/network access to GitHub. This is separate from the repository code.
