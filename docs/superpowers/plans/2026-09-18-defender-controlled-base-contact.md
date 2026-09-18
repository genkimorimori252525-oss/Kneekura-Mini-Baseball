# Defender Controlled Base Contact Physical Foundation

**Status:** IMPLEMENTATION IN PROGRESS.

**Goal:** Derive ControlledBaseContactFact from the overlap of secure ball possession and actual defender body/base contact, with explicit foot primitives and deterministic contact timing.

## Architecture

```text
SecuredCatchOutcome.secureTick
        +
known ball-control window end
        +
defender foot contact primitives
  left_foot / right_foot
        +
BaseTouchRegion
        ↓
exact accelerated primitive/base intersection
        ↓
earliest contact while control is valid
        ↓
ControlledBaseContactFact
        ↓
existing first-base RuleEngine
```

## Permanent constraints

- Defender control and base contact remain separate physical conditions.
- Secure possession alone is not a force out.
- Reaching/base-cover body center alone is not a force out.
- The control window is explicit: `secureTick ... controlThroughTick`.
  The adapter does not assume possession continues forever.
- Add `left_foot` and `right_foot` to defender physical primitive roles.
- Base-contact-eligible roles in this first slice are `left_foot` and `right_foot` only.
  Hand/body base contact remains explicit future work rather than being approximated from body-center spheres.
- For a foot-role primitive, the primitive center is the authoritative representative sole contact point for base-touch adjudication.
- Primitive radius is deliberately not reused as a rectangle-expansion shortcut because that would create false corner contacts for a circular footprint.
- Foot contact uses the existing planar BaseTouchRegion **plus an explicit base-surface world Y height** and the foot contact point's existing 3D constant-acceleration analytic trajectory.
- X/Z overlap alone is insufficient: the sole contact point must be on the base surface in Y at the same authoritative instant.
- Earliest contact is solved deterministically from quadratic X/Z boundary roots plus Y=base-surface roots, not Presentation frames.
- Multiple eligible primitives compete by exact tick; earliest valid contact wins.
- A primitive contact before secure possession does not count unless contact still exists at/after secureTick.
- A contact after `controlThroughTick` does not count.
- No new out/safe rule semantics are added.

### Task 1: Foot physical primitives

Extend `DefenderPhysicalPrimitiveRole` with:
- `left_foot`;
- `right_foot`.

Existing compose/sample machinery remains unchanged.

### Task 2: Accelerated defender/base contact

Create `DefenderBaseContact.ts`.

Provide:
- exact earliest primitive/base contact tick inside an explicit search window;
- deterministic accelerated point-vs-expanded-rotated-rectangle solving.

### Task 3: Secure-control overlap

Create `DefenderControlledBaseContact.ts`.

Input:
- defender id;
- base number;
- base region;
- secured catch outcome;
- `controlThroughTick`;
- contact primitives.

Output:
- `ControlledBaseContactFact | null`.

### Task 4: Regression fixtures

Require:
- foot already on base when possession becomes secure => control tick = secureTick;
- secure catch first, foot arrives later => control tick = foot contact;
- foot leaves before secure possession => no controlled base contact;
- contact after control window => no controlled base contact;
- glove-only base intersection => ignored;
- non-foot body/tag-hand primitives are ignored in this first slice;
- left/right foot competition chooses earliest exact tick.

### Task 5: Core API + evidence

Export through Core, retry P0 Core CI, and retain the external `steps=[]` blocker distinction if it recurs.
