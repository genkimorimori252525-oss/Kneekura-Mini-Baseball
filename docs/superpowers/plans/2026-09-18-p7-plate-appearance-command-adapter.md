# P7 Plate-Appearance Command Adapter — 2026-09-18

**Status:** IMPLEMENTATION IN PROGRESS.

## Goal

Accept one managerial command for a plate appearance, then resolve every pitch through the existing P2 canonical pitch pipeline without asking for another command between pitches.

## Permanent boundary

```text
PlateAppearanceCommand
      ↓ once
PlateAppearanceCommandSession
      ↓ per pitch
high-level pitcher / batter / runner policy
      ↓
PitchAgainstBatterInput + runner policy inputs
      ↓
existing P2 / P6 physics
      ↓
CanonicalPlateAppearanceTimeline
      ↓
RuleEngine / MatchState
```

P7 must never directly declare:
- ball / strike;
- contact / miss;
- hit / out;
- steal success;
- run score.

Those remain physical/rules outcomes.

## Command schema

First slice:

- pitcher:
  - attackZone: inside / middle / outside;
  - verticalPlan: low / middle / high;
  - aggression: challenge / balanced / waste;
- batter:
  - approach: take / balanced / aggressive;
  - swingBias: early / neutral / late;
- runners:
  - posture: conservative / balanced / aggressive.

These are semantic instructions, not UI-only labels.

## Session contract

A command session is bound to:
- `playId`;
- `batterRunnerId`;
- one accepted command;
- acceptance tick;
- deterministic seed namespace.

The same session may generate many pitch inputs.

It rejects:
- applying the session to another `playId`;
- accepting/replacing the command after the session is created;
- generating another pitch after the plate appearance is terminal;
- direct outcome fields disguised as commands.

## Pitch generation boundary

P7 may convert pitcher/batter instructions into:
- target plate coordinates;
- release / flight calibration inputs;
- take vs swing choice;
- swing-window timing offset.

The generated object must still be a normal `PitchAgainstBatterInput`.

The existing pitch trajectory / strike-zone / bat-contact physics then decide what actually happens.

## Runner boundary

Runner posture changes P6 risk-policy calibration / advance margin only.

It does not change:
- runner top speed;
- runner acceleration;
- defender timing;
- safe/out result.

## First acceptance

1. command accepted once;
2. one command expands into multiple pitch inputs;
3. all pitches are recorded in the existing canonical timeline;
4. no user input is required between pitches;
5. same seed + same command = same generated sequence;
6. terminal plate appearance rejects further generation;
7. command does not bypass physical pitch/contact resolution.
