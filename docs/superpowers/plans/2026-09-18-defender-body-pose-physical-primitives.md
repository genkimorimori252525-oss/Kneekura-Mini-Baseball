# Defender Body / Pose Physical Primitives Plan

**Goal:** Bridge canonical defender body motion to actual physical glove / tagging-hand contact primitives without treating the defender body center as the hand.

**Source:** Approved causal-defense design requires `DefensiveIntent -> movement / catch / throw / cover`. The exact body/pose representation was intentionally left unspecified; this plan adds that missing physical boundary without changing the approved principles.

## Architecture

```text
DefenderMotionSegment
(body center XZ, velocity, acceleration)
          +
DefenderPosePrimitiveSegment
(relative 3D end-effector position / velocity / acceleration)
          ↓
DefenderPhysicalPrimitiveSegment
(world-space 3D sphere primitive)
          ↓
AcceleratedSphereContact
     ├─ glove-ball contact
     └─ tag contact
          ↓
CatchRetention / future RuleEngine
```

## Permanent constraints

- Defender body center is never implicitly treated as the glove or tagging hand.
- Core does not simulate a high-DOF skeleton.
- A pose/body layer supplies effective end-effector motion; Core composes it with body motion.
- The relative pose segment is expressed in world-axis offsets from the body origin. A future skeletal/animation layer may derive those offsets from facing/joints, but that derivation is not required here.
- Body motion and pose motion remain causal physical inputs. Ratings may later parameterize reach speed, reach distance, stability, etc.; they do not directly decide catch/tag success.
- Glove contact remains distinct from secure possession.
- Tag contact remains distinct from an out/rule decision.
- Renderer animation cannot alter these primitives.

### Task 1: 3D body kinematics adapter

Create `DefenderBodyKinematics.ts` + tests.

Convert one `DefenderMotionSegment` into a 3D body-origin segment:
- X/Z come exactly from the canonical defender segment;
- Y is supplied explicitly as body-origin height;
- horizontal velocity/acceleration are preserved;
- vertical velocity/acceleration default to zero in this foundation;
- sampling at any authoritative tick agrees with `sampleDefenderMotionSegment` in X/Z.

### Task 2: Effective pose primitive composition

Create `DefenderPhysicalPrimitive.ts` + tests.

Pose segment:
- role: `glove | tag_hand | body`;
- radius;
- same start/end ticks and ticks-per-second as the body segment;
- relative start offset `Vec3`;
- relative velocity `Vec3`;
- relative acceleration `Vec3`.

Compose body + pose into a world-space constant-acceleration sphere segment.

Tests:
- neutral offset follows the body exactly;
- reach velocity adds to body velocity;
- reach acceleration adds to body acceleration;
- vertical glove motion is independent of 2D body motion;
- timing mismatch is rejected;
- wrong/invalid radii and non-finite kinematics are rejected.

### Task 3: Glove and tag adapters

Add semantic adapters:
- glove primitive -> `GloveWorldState + acceleration + deltaTicks`;
- tag-hand/body primitive -> acceleration-capable tag contact state.

The adapters must reject the wrong primitive role where semantic identity matters.

Integration tests:
- a stationary body with a reaching glove can contact a ball even though the body origin cannot;
- a moving defender plus glove reach composes both accelerations;
- a tag hand can physically contact a runner while the defender body center remains separated.

### Task 4: Core API and regression

Export the new body/pose physical primitives through `src/core/index.ts`.
Run full `npm run verify` and record exact test counts.

## Deferred follow-up

- facing-aware local skeletal transform and angular velocity;
- jump / dive / crouch body-origin Y motion;
- reach planning and pose selection from perceived ball/runner trajectories;
- empirical calibration of reach speed, extension, stability, and handedness;
- throwing-arm / release end-effector mechanics.
