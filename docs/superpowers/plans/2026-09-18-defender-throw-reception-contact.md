# Defender Throw Reception Contact Plan

**Status:** IMPLEMENTATION IN PROGRESS.

**Goal:** Build the CatchRetentionContact used by first-base reception from the existing accelerated ball/glove collision model instead of manually injecting contact-time states.

## Architecture

```text
LiveBallState at reception-window start
 + ball acceleration
 + defender glove physical primitive
        ↓
findAcceleratedGloveBallContactTick
        ↓
sample ball + glove at authoritative contact tick
        ↓
contact normal from glove center toward ball center
        ↓
CatchRetentionContact
        ↓
existing resolveCatchRetention
        ↓
CatchOutcome
        ↓
controlled-base contact + first-base race
```

## Constraints

- No new collision equation: reuse `findAcceleratedGloveBallContactTick`.
- The ball and glove must share the same authoritative start tick.
- The glove primitive must have role `glove`.
- The glove primitive's own radius is the glove contact radius.
- Ball radius is an explicit input.
- This first slice assumes constant acceleration for ball and glove across one reception window.
  A window containing a ground bounce or another discontinuity must be split upstream.
- Ball/glove state is sampled at the quantized authoritative contact tick using the same constant-acceleration equations.
- Contact normal is derived from sampled glove center toward sampled ball center.
- Pocket offset and body stability remain explicit inputs supplied by existing glove/body execution layers; this adapter does not invent skill.
- If no glove-ball contact occurs, return `null`; do not fabricate a catch attempt.
- No possession is inferred here. Existing `resolveCatchRetention` remains the only retention boundary.

### Task 1: Accelerated reception-contact adapter

Create `DefenderThrowReceptionContact.ts` with:
- `createCatchRetentionContactFromAcceleratedReception`.

### Task 2: Regression fixtures

Require:
- known zero-acceleration fixture preserves existing exact contact tick;
- gravity / glove acceleration affect sampled contact consistently;
- no-contact returns null;
- non-glove primitive fails explicitly;
- mismatched clock/start tick fails explicitly.

### Task 3: Catch retention integration

Feed produced contact into `resolveCatchRetention` and prove:
- high enough physical capacity yields `secured`;
- insufficient retention yields `live-ball`;
- no direct catch-success roll is introduced.

### Task 4: Core API + evidence

Export through Core and retry P0 Core CI without claiming repository GREEN if Actions remains pre-step blocked.
