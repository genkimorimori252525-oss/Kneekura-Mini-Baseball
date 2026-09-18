# P8 Mini Canonical Live Observer — 2026-09-18

**Status:** IMPLEMENTATION COMPLETE FOR FOUNDATION; GitHub Actions remains pre-step blocked.

## Direction

P8 does not restore the abandoned ASCII / fixed Drone-Art prototype as a simulation constraint.

Mini is a read-only observer of canonical Core state.

## First slice

Create a field-overhead render state that:

- reads `CanonicalPresentationSample.world`;
- projects world X/Z into Mini logical screen coordinates;
- includes all nine defenders;
- includes all baserunners;
- includes the canonical ball;
- exposes each defender's current P5 assignment for visual motion/debug;
- optionally derives 9/10/11px player-dot diameter from `PlayerPhysicalProfile`;
- uses a reference dot size when no profile is supplied;
- never writes back to Core.

## Camera contract

Top-down projection is presentation calibration only:

```text
screenX = viewportCenterX + (worldX - worldOriginX) * pixelsPerMeter
screenY = viewportCenterY - (worldZ - worldOriginZ) * pixelsPerMeter
```

Ball altitude remains metadata; overhead X/Y position uses world X/Z.

Changing:
- viewport center;
- pixels-per-meter;
- dot-size calibration;
- player physical-profile display mapping;

must not alter canonical coordinates or event results.

## Point rendering

Defenders and runners remain points/markers.

There is no requirement to render:
- feet;
- glove;
- tag hand;
- body skeleton;
- collision primitive geometry.

Those remain numeric Core internals.

Natural 3D may later visualize the same physical profile, but P8 point rendering is independent.

## Acceptance

1. all nine defenders appear from canonical coordinates;
2. shifted CF remains at its actual shifted world coordinate;
3. P5 assignment is visible in render state;
4. baserunners and ball are projected from canonical state;
5. player dot diameter may derive from height profile only in Presentation;
6. alternate dot calibration changes render state only;
7. source canonical sample remains byte-for-byte/equality unchanged.
