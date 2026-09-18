# P7 Plate-Appearance Command Acceptance Audit — 2026-09-18

**Status:** IMPLEMENTATION COMPLETE FOR FOUNDATION; GitHub Actions remains pre-step blocked.

**Parent roadmap:** P7 — one-plate-appearance managerial command integration.

## Acceptance map

| Requirement | State | Evidence | Boundary |
| --- | --- | --- | --- |
| one command schema for one plate appearance | **implemented** | `PlateAppearanceCommand` | pitcher / batter / runner instructions are semantic intents |
| command bound to one play | **implemented** | `PlateAppearanceCommandSession` | playId + batterRunnerId + acceptance tick |
| no command replacement between pitches | **implemented by session contract** | immutable command session | per-pitch generation reads the same accepted command |
| command -> physical pitch input | **implemented** | `PlateAppearanceCommandPitchAdapter` | outputs ordinary `PitchAgainstBatterInput` |
| pitcher command changes physical target | **implemented** | attack zone / vertical plan / aggression -> plate target | does not directly declare ball/strike |
| batter command changes action/timing | **implemented** | take/balanced/aggressive + early/neutral/late | does not directly declare contact/miss |
| deterministic per-pitch command stream | **implemented** | `SeedRoot.streamRng` keyed by playId + pitch ordinal | independent of Presentation cadence |
| one command drives multiple pitches | **implemented** | `CommandedPlateAppearanceSequence` | no new command between pitches |
| automatic stop at PA end | **implemented** | canonical status gate | unused pre-scheduled environments are not generated |
| commanded PA -> CanonicalMatchState | **implemented** | `CommandedPlateAppearanceCoordinator` | existing walk/strikeout adapters reused |
| runner posture -> P6 | **implemented** | `PlateAppearanceRunnerPosture` | modifies required safety margin only |
| risky / no-effect instructions explained | **implemented** | `PlateAppearanceCommandValidation` | warnings do not fake outcomes |
| same seed + same command replay | **implemented source acceptance** | sequence tests | same generated pitch sequence |
| command does not bypass P2 physical timeline | **implemented** | all generated pitches pass through `resolveAndRecordPitchAgainstBatter` | canonical pitch events remain authoritative |

## Architecture

```text
user / manager
  -> PlateAppearanceCommand
  -> immutable PlateAppearanceCommandSession
        ↓
  pitch ordinal 0,1,2...
        ↓
  P7 command adapter
        ↓
  ordinary PitchAgainstBatterInput
        ↓
  P2 pitch / take / swing / contact physics
        ↓
  CanonicalPlateAppearanceTimeline
        ↓
  existing MatchState adapters / live-ball handoff
```

Runner command:

```text
PlateAppearanceCommand.runners.posture
        ↓
P6 RunnerAdvanceRiskPolicy margin
        ↓
RunnerDecision
        ↓
existing RunnerMotion
```

## One-command lifetime

The session is bound to:
- `playId`;
- `batterRunnerId`;
- `acceptedAtTick`;
- one immutable command;
- match seed.

The session may drive multiple pitches only while the canonical plate-appearance timeline remains active.

It rejects:
- use against another playId;
- acceptance time after current canonical timeline state;
- pitch generation after walk / strikeout / batted-ball transition.

## Per-pitch autonomy

`CommandedPlateAppearanceSequence` accepts the engine-side pitch environment schedule up front.

The caller does **not** submit a new managerial command for each pitch.

For each ordinal, the same accepted command is expanded into a fresh physical pitch input.

The sequence stops automatically as soon as the canonical timeline stops accepting pitches.

Therefore an overlong autonomous schedule is safe:
- strikeout on pitch 3 -> pitch 4+ are unused;
- walk on pitch 4 -> pitch 5+ are unused;
- bat-ball contact -> later scheduled pitches are unused.

## Deterministic command streams

Batter swing/take choice uses an independent stream:

```text
SeedRoot(matchSeed)
  -> playId
  -> batting
  -> p7:pitch:<ordinal>:decision
```

This prevents unrelated random consumption or Presentation cadence from shifting later pitch decisions.

## Pitcher command boundary

Current semantic dimensions:

- `attackZone`: inside / middle / outside;
- `verticalPlan`: low / middle / high;
- `aggression`: challenge / balanced / waste.

These become a plate target and then a normal physical trajectory.

The command does **not** directly produce:
- ball;
- called strike;
- contact;
- hit;
- out.

Taken-pitch geometry and bat-ball contact physics remain authoritative.

The first P7 foundation uses explicit pitch-environment calibration supplied by the engine. Pitch repertoire, pitcher command skill, fatigue, and execution scatter are later extensions and should alter physical pitch intermediates rather than resolved outcomes.

## Batter command boundary

Current semantic dimensions:

- `approach`: take / balanced / aggressive;
- `swingBias`: early / neutral / late.

Approach changes whether a swing is attempted.

Swing bias changes the physical swing window timing.

Contact remains a geometric result from existing swing/pitch collision physics.

## Runner command boundary

Current semantic runner instruction:

- conservative;
- balanced;
- aggressive.

It adjusts the minimum perceived safety margin required by P6 RunnerDecision.

It does not change:
- top speed;
- acceleration;
- braking;
- body reach;
- safe/out adjudication.

## Command explanation

`PlateAppearanceCommandValidation` currently explains:

- take with two strikes -> called-strike risk;
- waste pitching with three balls -> walk risk;
- non-balanced runner posture with no baserunner -> no current effect.

These are explanations, not direct penalties.

## MatchState integration

For terminal no-contact plate appearances:

- strikeout -> existing `applyStrikeoutPlateAppearanceToMatchState`;
- walk -> existing `applyWalkPlateAppearanceToMatchState`.

For contact:

- P7 stops at `batted_ball_pending`;
- existing P2/P5/P6 live-ball pipeline owns the rest of the play.

P7 does not duplicate live-ball logic.

## Representative source acceptance

- `src/core/sim/plateAppearance/PlateAppearanceCommand.test.ts`
- `src/core/sim/plateAppearance/PlateAppearanceCommandSession.test.ts`
- `src/core/sim/plateAppearance/PlateAppearanceCommandPitchAdapter.test.ts`
- `src/core/sim/plateAppearance/CommandedPlateAppearanceSequence.test.ts`
- `src/core/sim/plateAppearance/CommandedPlateAppearanceCoordinator.test.ts`
- `src/core/sim/plateAppearance/PlateAppearanceRunnerPosture.test.ts`
- `src/core/sim/plateAppearance/PlateAppearanceCommandValidation.test.ts`
- `src/core/index.test.ts`

## Known extensions that do not reopen P7 foundation

- pitcher repertoire / pitch-type selection;
- pitcher command/accuracy rating and physical execution scatter;
- fatigue and pitch-count effects;
- richer batter zone-selectivity;
- hit-and-run / bunt / squeeze commands;
- per-runner steal authorization;
- manager AI selecting the command.

These should all feed the same one-command session and existing P2/P6 physical boundaries.

## P8 handoff

P8 now owns Presentation.

It must:
1. read canonical state only;
2. render ball / runners / all nine defenders from canonical world coordinates;
3. show P5 coverage / relay / backup movement without inventing positions;
4. keep Mini player rendering point-like;
5. keep body-size dot scaling Presentation-only;
6. prove 30/60fps, interpolation, dot-size settings, or renderer OFF cannot alter canonical events;
7. avoid restoring the abandoned ASCII/fixed Drone-Art representation as a Core constraint.

## CI caveat

Latest GitHub Actions evidence:
- run `35354230791`;
- head `b335dc543292619bac25a100fbaf780e4f39242c`;
- verify job `105629499708`;
- `steps=[]`.

The workflow still fails before commands execute.

Repository GREEN is not claimed.
