# P8 Mini Canonical Live Observer Acceptance Audit — 2026-09-19

**Status:** IMPLEMENTATION COMPLETE FOR FOUNDATION; GitHub Actions remains pre-step blocked.

**Parent roadmap:** P8 — Mini live observer / presentation.

## Acceptance map

| Requirement | State | Evidence | Boundary |
| --- | --- | --- | --- |
| Canonical world -> point-based overhead field | **implemented** | `FieldOverheadRenderState` | defenders/runners/ball come from canonical coordinates |
| all nine defenders + shifted positions | **implemented source acceptance** | `P8PresentationIsolationAcceptance.test.ts`, `FieldOverheadRenderState.test.ts` | registered position never replaces actual world position |
| P5 coverage/relay/backup visible | **implemented** | defender `assignment` is carried into render state | debug/presentation metadata only |
| player body size -> 9/10/11px presentation tier | **implemented** | `PlayerDotProfile` | never used as Core collision/reach input |
| ball height -> visual size tier | **implemented** | `MiniBallHeightProfile` | derives from canonical ball.y only |
| discrete ball trail from canonical history | **implemented** | `MiniBallTrail` | no generated spline / fake trajectory |
| batter POV | **implemented** | `BatterPovCamera`, `BatterPovRenderState` | canonical sample only |
| pitcher-operation catcher-eye POV | **implemented** | `PitcherPovCamera`, `PitcherPovRenderState` | documented by D-015 |
| fair-ball camera cut -> overhead | **implemented** | `MiniPresentationTimeline` | exact canonical fair-declaration tick |
| same-tick camera-cut pair | **implemented** | timeline + replay support | pre/post-cut frames may share the same tick |
| HUD inning / B-S-O / score / bases | **implemented** | `MiniHudState` | direct CanonicalMatchState projection |
| authoritative 9+ inning R/H/E line score | **implemented** | `CanonicalLineScoreSnapshot`, `MiniLineScoreState` | H/E are never inferred from runs |
| score / line-score consistency | **implemented** | Mini HUD validation | mismatch is rejected |
| three-base runner diamond | **implemented** | `MiniBaseDiamondState` | occupied = red; no home marker |
| right red / left blue | **implemented** | `MiniHandednessBadge` | batter + pitcher |
| player cards | **implemented foundation** | `MiniPlayerCardState` | only explicit public metadata; hidden ratings are not accepted |
| current command summary | **implemented** | `MiniCommandBandState` | read-only P7 command projection |
| horizontal command options | **implemented** | `MiniCommandOptionBandState` | generated from actual P7 command schema |
| portrait screen composition | **implemented renderer-neutral** | `MiniPortraitScreenState` | no React/DOM dependency added |
| live frame composition | **implemented** | `MiniGameLiveFrame` | HUD + matchup + command + cards + render |
| replay from saved canonical frames | **implemented** | `MiniReplaySequence` | no replay-only baseball calculation |
| 30/60fps canonical cut stability | **implemented source acceptance** | `P8PresentationIsolationAcceptance.test.ts` | same event tick |
| render-off non-interference | **implemented source acceptance** | `P8PresentationIsolationAcceptance.test.ts` | no Presentation call required |
| camera/dot-size recalibration non-interference | **implemented source acceptance** | P8 isolation acceptance + overhead tests | canonical inputs stay unchanged |

## Core / Presentation boundary

P8 remains a one-way observer:

```text
CanonicalMatchState
CanonicalWorldSnapshot
TimedMatchEvent[]
CanonicalLineScoreSnapshot
        ↓
Mini Presentation state
        ↓
renderer
```

There is no reverse API from screen coordinates, dot sizes, camera choices, R/H/E layout, command labels, or replay timing into Core.

## Player body representation

P8 intentionally does **not** render Core body primitives such as:

- left/right foot;
- glove;
- tag hand;
- body collision primitive;
- reach segment.

Those remain numeric Core internals.

Mini defenders/runners may remain points.

`PlayerPhysicalProfile` can independently affect:

```text
Core:
  body origin / leg reach / glove reach / tag reach

Presentation:
  small / reference / large dot tier
```

Presentation dot calibration can be changed or disabled without changing the Core physical profile or any safe/out/contact result.

## Overhead field observer

Top-down projection uses only Presentation calibration:

```text
screenX = centerX + (worldX - originX) * pixelsPerMeter
screenY = centerY - (worldZ - originZ) * pixelsPerMeter
```

A shifted CF remains a CF and is rendered at the actual shifted world coordinate.

P5 assignments such as:
- ball handler;
- base cover;
- relay;
- backup;
- deep coverage;
- hold

remain available to renderer/debug tooling.

## Ball visualization

Ball plane position comes from canonical X/Z.

Ball altitude comes from canonical Y and is mapped to a discrete visual diameter tier.

The short trail is built only from earlier canonical samples.

P8 does not create:
- fake bounces;
- fake arcs;
- Bezier trajectories;
- label-driven ground/fly paths.

## Camera modes

P8 supports:

- `BATTER_POV`;
- `PITCHER_POV`;
- `FIELD_OVERHEAD`.

D-015 defines `PITCHER_POV` as the **pitcher-operation view using a catcher-eye camera behind home plate**.

Both pre-contact modes use the same canonical fair-ball declaration to hard-cut to `FIELD_OVERHEAD`.

A regression discovered during P8 final audit where only `BATTER_POV` cut to overhead was fixed in commit `c94eb729...`.

## HUD and line score

`MiniHudState` exposes:
- inning / half;
- offense / defense;
- B/S/O;
- base identity;
- total score;
- playId;
- optional authoritative line score.

`MiniLineScoreState` shows at least innings 1-9 and retains extras beyond nine.

Future preallocated inning slots are allowed only while their run values remain null.

R/H/E is supplied by `CanonicalLineScoreSnapshot`.

Presentation never derives hits/errors from score.

## Base diamond

The runner diamond contains only:
- first;
- second;
- third.

Occupied bases use red presentation accent.

Home is not a fourth runner marker.

Runner identity is preserved behind the marker for presentation/debug use.

## Player cards and handedness

Right-handed:
- right pitch / right bat -> red.

Left-handed:
- left pitch / left bat -> blue.

Player cards accept only explicitly supplied public presentation metadata:
- playerId;
- optional display name;
- optional jersey number;
- optional public metrics;
- handedness.

They do not accept `DefensiveRatings` or other hidden internal rating objects.

## Command band

P8 has two command surfaces derived from the immutable P7 plate-appearance command:

1. compact selected-command summary;
2. renderer-neutral horizontal option groups.

The option groups come from the actual P7 command schema, avoiding a UI-only command vocabulary that Core cannot execute.

Presentation selection state does not resolve the plate appearance; P7 remains authoritative.

## Portrait shell

The Mini game screen is represented as renderer-neutral vertical regions:

1. scoreboard;
2. situation;
3. player cards;
4. live game view;
5. command band.

This does not force the baseball viewport itself to become portrait.

The existing logical field viewport can remain a compact sub-region inside a portrait application screen.

No React/DOM/UI framework dependency was introduced into the simulation repository.

## Replay

`MiniReplaySequence` re-renders saved canonical sources through the same `MiniGameLiveFrame` path used for live display.

It allows the canonical same-tick camera-cut pair.

It supplies previous canonical samples to the discrete ball-trail builder.

Changing replay camera calibration changes screen coordinates only, not saved world positions.

Replay does not:
- recompute contact;
- rerun defense AI;
- rerun runner decisions;
- redraw a different result from the current code.

## Isolation acceptance

Existing P2/P8 acceptance covers:

- 30fps;
- 60fps;
- render-off;
- different camera scale;
- different dot calibration.

Canonical event tick/state remains unchanged.

P8 source builders also preserve their source objects in focused tests.

## Renderer status

P8 foundation intentionally stops at renderer-neutral presentation state.

This repository currently has TypeScript/Vitest only and no React/Canvas framework dependency.

The finished P8 contract is ready for a concrete Web/Canvas/Desktop renderer without moving baseball logic into the renderer.

## Representative acceptance sources

- `src/presentation/mini/P8PresentationIsolationAcceptance.test.ts`
- `src/presentation/mini/FieldOverheadRenderState.test.ts`
- `src/presentation/mini/MiniBallHeightProfile.test.ts`
- `src/presentation/mini/MiniBallTrail.test.ts`
- `src/presentation/mini/MiniPresentationTimeline.test.ts`
- `src/presentation/mini/PitcherPovCamera.test.ts`
- `src/presentation/mini/PitcherPovRenderState.test.ts`
- `src/presentation/mini/MiniHudState.test.ts`
- `src/presentation/mini/MiniLineScoreState.test.ts`
- `src/presentation/mini/MiniBaseDiamondState.test.ts`
- `src/presentation/mini/MiniHandednessBadge.test.ts`
- `src/presentation/mini/MiniPlayerCardState.test.ts`
- `src/presentation/mini/MiniCommandOptionBandState.test.ts`
- `src/presentation/mini/MiniGameLiveFrame.test.ts`
- `src/presentation/mini/MiniPortraitScreenState.test.ts`
- `src/presentation/mini/MiniReplaySequence.test.ts`

## P9 handoff

P9 now owns:

1. fixed-seed game/plate/play corpus;
2. deterministic replay hashes / evidence fingerprints;
3. batch simulation performance;
4. same contact set across defensive alignments;
5. BABIP / run / extra-base differences emerging from physical outcomes;
6. debug provenance from input -> estimate -> alignment -> coverage -> runner -> rule result;
7. Natural renderer read-only contract;
8. proof that Mini/Natural visual changes cannot alter canonical event sequence.

## CI caveat

Latest GitHub Actions evidence:
- run `35367040857`;
- head `c94eb729b5de9764a0945e05df224f7a34405d83`;
- verify job `105671907416`;
- `steps=[]`.

The workflow still fails before repository commands execute.

Repository GREEN is not claimed.
