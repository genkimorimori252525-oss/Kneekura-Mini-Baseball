# Defender Controlled Base Contact Physical Foundation

**Status:** IMPLEMENTATION COMPLETE; GitHub Actions remains pre-step blocked.

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


---

## Completion evidence

Implemented through HEAD `6b04856e5d4d772fb7b285663c35c61bf798b564`:

- explicit `left_foot` / `right_foot` defender physical primitive roles;
- exact accelerated foot-contact-point vs rotated base rectangle timing;
- explicit base-surface world Y height;
- X/Z overlap alone is insufficient: sole representative point must coincide with base-surface Y at the same authoritative instant;
- secure-possession and base-contact remain separate physical conditions;
- controlled-base timing is resolved only inside the explicit `secureTick ... controlThroughTick` window;
- left/right feet compete by exact tick and earliest valid controlled contact wins;
- glove/body/tag-hand primitives are intentionally ignored for base contact in this first slice rather than approximated from body-center geometry;
- physics layer returns only the controlled-contact tick;
- Rule-layer adapter converts that tick into the existing `ControlledBaseContactFact`, preserving dependency direction;
- fully physical first-base race regression covers defender-first by one tick, runner-first by one tick, and exact simultaneity.

Important correction made during implementation:
- the initial X/Z-only foot/base solver was rejected because it could count a foot floating above the base;
- vertical surface coincidence is now required;
- primitive radius is still not reused as a rectangle-expansion shortcut, avoiding false corner contacts.

Key checkpoints:
- `2e0a6ab9...` / `146d91f9...`: defender foot primitive RED/GREEN;
- `b4c0d5a6...` / `318eb07f...`: initial analytic foot/base contact RED/GREEN;
- `f6b580ef...` / `a01a9281...`: secure-possession overlap RED/GREEN;
- `d2dcacef...` / `fbbdfca9...`: physics/rules dependency-direction correction;
- `ff842bf3...` / `b47efe92...`: Rule-layer controlled-base fact adapter;
- `1efbe9d7...` / `aa897948...`: fully physical first-base race RED/GREEN;
- `b70448ca...` / `6c05f84a...` / `da17c6b8...`: vertical contact requirement plan/RED/GREEN;
- `6b04856e...`: fully physical simultaneous-race regression.

Repository CI:
- P0 Core run `35326140555` for `6b04856e...` failed before any workflow command executed;
- job `105539511967` reports `steps=[]`;
- full-repository GREEN is not claimed.
