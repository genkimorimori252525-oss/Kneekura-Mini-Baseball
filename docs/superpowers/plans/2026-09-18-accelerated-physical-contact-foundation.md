# Accelerated Physical Contact Foundation Plan

**Goal:** Extend physical contact timing so accelerating defender/glove/tag primitives can participate in authoritative contact without being flattened back to constant velocity.

**Context**
- `DefenderMotion` now emits constant-acceleration trajectory segments.
- Existing `MovingSphereContact` is analytic but assumes constant velocity.
- Existing glove and tag contact must remain physical-contact-only boundaries: contact != possession, and tag contact != out.

## Architecture

```text
physical primitive A segment
  p0, v0, a, radius
physical primitive B segment
  p0, v0, a, radius
          ↓
relative constant-acceleration trajectory
          ↓
continuous sphere-contact root
          ↓
first authoritative integer tick
          ↓
GloveBallContact / TagContact
```

**Important boundary:** defender body-center motion is NOT automatically treated as glove or tagging-hand motion. A later pose/body layer must supply the actual physical primitive. This phase only makes the contact solver acceleration-capable.

### Task 1: Generic constant-acceleration sphere contact

Create:
- `src/core/sim/collision/AcceleratedSphereContact.ts`
- `src/core/sim/collision/AcceleratedSphereContact.test.ts`

State:
- tick
- center `Vec3`
- velocity `Vec3`
- acceleration `Vec3`
- radius

Requirements:
- already-overlapping -> start tick;
- zero acceleration agrees with `MovingSphereContact`;
- contact that starts and ends inside the interval is detected;
- acceleration can create a contact that constant-velocity motion would miss;
- tangent contact is detected;
- no-contact returns null;
- first continuous root is quantized with the existing authoritative tick policy.

Implementation strategy:
- relative position is quadratic in time;
- squared separation minus contact-radius squared is quartic;
- find stationary points from its cubic derivative;
- isolate derivative roots deterministically using the derivative's quadratic critical points;
- split the quartic into monotonic intervals;
- bisection finds the earliest contact root;
- zero-relative-acceleration delegates to the existing constant-velocity solver for compatibility.

### Task 2: Accelerated glove-ball contact

Extend `GloveBallContact.ts` + tests with a separate acceleration-capable function.

Inputs remain actual physical glove and ball states. Acceleration is explicit input. No defender-center shortcut.

Regression:
- zero acceleration exactly matches existing glove contact timing;
- gravity and glove acceleration can change authoritative contact time;
- result is still contact only; catch retention remains a separate stage.

### Task 3: Accelerated tag contact

Extend `TagContact.ts` + tests with an acceleration-capable function.

Regression:
- zero acceleration matches existing tag timing;
- accelerating tagging primitive can cause contact;
- accelerating runner primitive can change contact;
- no rule result is emitted.

### Task 4: Core API and full regression

Export the generic accelerated contact and accelerated glove/tag functions through `src/core/index.ts`.

Run full `npm run verify` and record test counts.

## Deferred

- body/pose model that turns defender body trajectory into actual glove/hand trajectories;
- runner curved-route primitive segmentation for fully accelerated tag geometry;
- catch possession and RuleEngine remain separate consumers.
