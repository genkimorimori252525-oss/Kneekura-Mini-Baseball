# Fly Catch and Tag-Up Compliance Foundation Plan

**Goal:** Add the physical/correct-rule foundation for caught fly balls and runner tag-up compliance while preserving the distinction between first fielder touch, secure catch, and appeal-based outs.

## Rule-critical timing

For a caught fly:
- the batter is not out merely because the ball first touches a glove;
- the catch becomes a Correct Rule Result only after secure possession is established without the ball first becoming grounded;
- runners may legally leave their base from the **first fielder touch** of the fly, not from the later secure-possession tick;
- leaving before first touch creates an appealable tag-up violation, not an automatic out.

This intentionally uses the existing separation between `gloveContactTick` and `secureTick`.

## Architecture

```text
physical glove-ball first touch tick
        +
secure catch tick
        +
first ground-contact tick (if any)
        ↓
FlyCatchRule
  valid secured fly catch -> batter out at secureTick
        ↓
firstFielderTouchTick
        +
runner origin-base departure tick
        +
runner retouch tick (optional)
        ↓
TagUpCompliance
  legal departure
  legal after retouch
  appealable early departure
        ↓
Appeal Rule (later phase)
```

## Permanent constraints

- First glove contact is not itself a catch.
- Secure possession after the ball has already touched the ground is not a fly catch.
- Runner release legality is keyed to **first fielder touch**, not secure catch.
- Early departure does not directly create an out.
- An appealable violation remains separate from an accepted/valid defensive appeal.
- Physical truth, Correct Rule Result, Human Umpire Call, and Official Ruling remain distinct.
- Equal authoritative ticks stay simultaneous and are never ordered by serialization sequence.
- Foul/fair status and Infield Fly declaration are deferred to later dedicated rules.

### Task 1: Fly-contact physical facts

Extend `PhysicalRuleFacts.ts`:
- `FlyBallFirstFielderTouchFact`: fielder id, tick;
- `RunnerBaseDepartureFact`: runner id, base, tick.

### Task 2: FlyCatchRule

Create `FlyCatchRule.ts`.

Input:
- batter runner id;
- first fielder touch fact;
- secure catch tick or null;
- first ground-contact tick or null.

Result:
- secure catch exists and ground contact is null or strictly later -> batter out at secure tick;
- ground contact at/before secure tick -> not caught;
- no secure catch -> unresolved/live;
- secure tick before first fielder touch -> reject invalid physical chronology.

### Task 3: TagUpCompliance

Create `TagUpCompliance.ts`.

Input:
- runner id;
- origin base;
- first fielder touch tick;
- departure fact;
- optional retouch fact.

Result:
- departure at/after first touch -> compliant, legalAdvanceFrom = departure tick;
- departure before first touch + retouch at/after first touch -> compliant after retouch, legalAdvanceFrom = retouch tick;
- departure before first touch without valid retouch -> `appealable_early_departure`;
- no automatic out.

### Task 4: Vertical slice

Fixture:
- fly first touched at 1.000000 s;
- ball juggled and secured at 1.150000 s;
- runner leaves at 1.050000 s;
- runner is compliant even though departure precedes secure catch.

Companion:
- runner leaves at 0.990000 s and never retouches -> appealable violation;
- same runner retouches at 1.010000 s -> compliant from 1.010000 s.

### Task 5: Core API + local verification; retry P0 CI without claiming full repository GREEN while jobs remain pre-step blocked.

## Deferred

- defensive appeal execution and appeal-window expiry;
- fourth-out appeal;
- fair/foul fly classification;
- foul fly;
- Infield Fly declaration;
- dead-ball catch awards;
- runner leaving a base and later re-touching after multiple intermediate contacts.
