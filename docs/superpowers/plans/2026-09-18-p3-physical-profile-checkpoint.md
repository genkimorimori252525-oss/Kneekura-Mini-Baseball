# P3 Physical Profile Checkpoint — 2026-09-18

## Implemented

### Core physical profile

`PlayerPhysicalProfile` currently contains only:

```ts
{ heightMeters: number }
```

Reference calibration height:

```text
1.80 m
```

This is a **game calibration reference**, not a claim about league-average measured height.

Reference-height players reproduce the pre-P3 Core baselines exactly.

### Derived Core reach calibration

`deriveDefenderPhysicalReachCalibration` scales only physical geometry:

- body origin height;
- maximum leg reach;
- maximum glove reach;
- maximum tag reach.

It does **not** output:

- success probability;
- movement speed;
- acceleration;
- perception quality;
- catching skill;
- throwing skill.

Existing foot/glove physics regression fixtures show that height alone can change a physical target from unreachable to reachable while leaving reach speed/acceleration limits unchanged.

### Mini Presentation dot size

`PlayerDotProfile` is Presentation-only.

Default visual calibration:

- height scale < 0.95 -> 9 px;
- 0.95 <= scale < 1.05 -> 10 px;
- scale >= 1.05 -> 11 px.

The 10 px tier is the current reference-size presentation baseline.

These thresholds and pixel sizes may be changed for readability without modifying any Core physical value or canonical result.

## Permanent separation

```text
height (meters)
   ├─ Core -> physical reach/origin
   └─ Presentation -> small dot-size tier (pixels)
```

The Presentation pixel diameter is never fed back into Core collision or reach.

## Next P3 slice

Introduce a validated normalized defensive-rating schema around the existing independent abilities:

- position suitability;
- first step;
- acceleration;
- batted-ball read;
- route efficiency;
- catching;
- transfer;
- arm strength;
- throwing accuracy;
- situational awareness;
- tag skill.

Do not make a single defense rating directly alter an out probability.

Connect ratings only through meaningful intermediate calibrations already owned by their relevant subsystems.
