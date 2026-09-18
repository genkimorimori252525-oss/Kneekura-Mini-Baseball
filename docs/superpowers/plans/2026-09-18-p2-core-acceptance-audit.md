# P2 Canonical Timeline Acceptance Audit — 2026-09-18

**Status:** IMPLEMENTATION COMPLETE; GitHub Actions remains pre-step blocked.

**Parent roadmap:** P2 — canonical time / world / plate appearance.

This audit compares the current `jolly/core-realism-2026-09-18` implementation against the P2 requirements in `docs/game-design/03-roadmap.md`.

## P2 acceptance map

| Requirement | State | Current evidence | Remaining gap |
| --- | --- | --- | --- |
| one plate appearance resolves as an ordered canonical pitch sequence | **implemented** | `CanonicalPlateAppearanceTimeline`, `PlateAppearancePitchSequence`, `PlateAppearanceSequenceCoordinator` | high-level manager command -> per-pitch intent remains P7 |
| physical take/swing/contact produce count/live-ball facts rather than injected outcomes | **implemented** | `PitchTrajectory`, taken-pitch geometry, swinging-pitch contact/miss path, `BatBallContactResult` | specialized pitch-model calibration can expand later |
| raw bat contact does not prematurely become live ball | **implemented** | `batted_ball_pending` + fair/foul physical disposition adapters | none for P2 acceptance |
| fair/foul chronology uses physical evidence | **implemented representative set** | first ground contact, first fielder touch, post-bounce gate passage, settled ball, rolling first/third-base contact | airborne direct bag contact and foul-pole/out-of-park geometry remain tracked extensions |
| fair live ball reaches play end and next match state | **implemented** | `GroundBallPlateAppearanceCoordinator`, live-ball MatchState adapter | broader play families expand through P5/P6 without changing P2 boundary |
| strikeout/walk terminal plate appearances reach next match state | **implemented** | `PlateAppearanceMatchState`, walk forced advancement | none for P2 acceptance |
| same match seed + same resolved inputs replay identically | **implemented source acceptance** | `P2PlateAppearanceReplayAcceptance.test.ts`, `P2CoreAcceptanceMatrix.test.ts` | CI execution externally blocked |
| 30fps / 60fps / fast playback / render-off do not alter canonical events or final state | **implemented source acceptance** | event-aware `MiniPresentationTimeline`, `P2PresentationCadenceAcceptance.test.ts` | CI execution externally blocked |
| Presentation consumes canonical state and exact event ticks rather than driving Core | **implemented** | exact event-tick sample schedule; camera cut now driven by `BattedBallDeclaredFair` | later P8 visual design remains presentation-only |

## Important architecture corrections completed during P2

### Contact is not automatically live

The old prototype assumption:

```text
BatBallContact -> live ball
```

was removed.

Current canonical path:

```text
BatBallContact
  -> batted_ball_pending
  -> physical evidence
  -> fair -> live_ball
  -> foul -> count / caught-foul live action
```

### Presentation no longer uses the stale live-contact flag

Mini presentation previously switched camera from a `BatBallContact` payload flag.

Current behavior:

```text
raw BatBallContact
  -> no camera-mode semantic assumption

BattedBallDeclaredFair
  -> exact canonical sample required
  -> FIELD_OVERHEAD transition
```

Presentation cadence schedules merge canonical event ticks into ordinary render cadence, so a 30fps/60fps difference cannot move the canonical event time.

### Ground-ball continuation is finite

`BallFlight` now includes configurable ground rolling deceleration and an authoritative stop tick. This made settled-ball fair/foul physically representable and avoids infinite constant-speed rolling.

### Direct first/third-base contact

For the before-base rolling slice, the batted ball is a sphere and first/third base is a 3D prism.

Collision uses an exact rounded-rectangle horizontal Minkowski geometry rather than inflating the base rectangle at corners. The first physical first/third-base contact is recorded as `BattedBallFirstThirdBaseContact` and becomes decisive fair evidence.

Airborne direct bag contact remains a tracked geometry extension; it does not require a new P2 architecture.

## P2 acceptance evidence

Representative source acceptance files:

- `src/core/sim/plateAppearance/P2CoreAcceptanceMatrix.test.ts`
- `src/core/sim/plateAppearance/P2PlateAppearanceReplayAcceptance.test.ts`
- `src/presentation/mini/P2PresentationCadenceAcceptance.test.ts`
- `src/core/sim/plateAppearance/GroundBallPlateAppearanceCoordinator.test.ts`
- `src/core/sim/plateAppearance/CanonicalPlateAppearanceTimeline.test.ts`

Recent checkpoints:
- `4262cd50...`: deterministic whole-plate-appearance replay fixture;
- `7982d33d...`: presentation cadence acceptance;
- `dd284c1c...`: same-seed physical pitch sequence replay;
- `b45bf960...`: P2 Core acceptance matrix;
- `f5d55de2...`: rolling first/third-base contact -> fair timeline;
- `96444a95...`: Mini presentation uses fair declaration and event-aware cadence.

## Boundary with P3 / P7 / P8

P2 owns canonical physical chronology and immutable authoritative event/state progression.

P3 now supplies player physical/rating calibration inputs such as height-derived reach without changing result semantics directly.

P7 will own high-level plate-appearance manager commands -> pitch/batting/running intents. P2 already owns the per-pitch canonical resolution once those intents/physical inputs exist.

P8 will finish the Mini point/dot presentation. Dot size may reflect a player physical profile for readability, but Presentation size is never a collision input.

## Known extensions that do not reopen P2 architecture

- airborne batted-ball direct contact with first/third base;
- foul pole / stadium out-of-park geometry;
- later umpire/replay judgment above canonical physical truth;
- additional fair live-ball play families as P5/P6 expand.

These must reuse the same canonical evidence -> rule -> timeline boundaries.

## Current CI caveat

Latest GitHub Actions evidence:
- run `35346137112`
- job `105603044554`
- `steps=[]`

The workflow still fails before commands execute. Therefore repository GREEN is not claimed.

## P3 handoff

The roadmap's next active phase is P3.

Start with:
1. `PlayerPhysicalProfile` schema;
2. average-height calibration baseline;
3. derived physical reach/body-origin values;
4. tests proving large/small profiles alter physical reach but never direct success probability;
5. a Presentation-only dot-size mapping using the same profile, with tests proving dot-size changes cannot alter Core outcomes.
