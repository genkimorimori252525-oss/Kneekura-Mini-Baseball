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
[counted pitch adjudication]
  ball / called strike / swinging strike / foul / foul bunt
        ↓
existing PitchCountRule
        ↓
continue | walk | strikeout

OR

existing BatBallContactResult
        ↓
recordBatBallContact
        ↓
live_ball
        ↓
existing ball / fielding / running / rule slices
```

## Permanent constraints

- P2 does not create a second pitch/contact physics implementation.
- Counted non-contact pitch outcomes enter through an explicit adjudication boundary.
- `ball_in_play` cannot be injected through that counted-pitch boundary.
- The only first-slice route into `live_ball` is an actual existing `BatBallContactResult`.
- Timeline event ticks never move backward.
- `TimedMatchEvent.sequence` provides stable storage ordering only; equal ticks remain physically simultaneous.
- A terminal walk/strikeout/live-ball timeline rejects further pitch records.
- The timeline owns a single `playId` inherited from `CanonicalMatchState`.
- P1 rule modules remain the only source of count semantics.
- This first slice does not yet advance batting order, force runners on a walk, or mutate score/bases after a live play. Those are later P2 state-application stages.
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
- actual `resolveBatBallContact` result can start live-ball state;
- contact event preserves contact tick/point/exit velocity/spin;
- counted-pitch API cannot accept `ball_in_play`.

### Task 4: Match-state application stages

Follow-up slices after the ledger:
1. strikeout -> out / half-inning transition;
2. walk -> forced base advancement;
3. live-ball play-end facts -> CanonicalMatchState;
4. next-batter / next-play-id orchestration.

### Task 5: P2 replay/determinism acceptance

Same initial state + same resolved physical inputs must produce the same timeline events and state transitions independent of Presentation cadence.
