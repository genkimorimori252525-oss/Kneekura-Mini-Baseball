# Swing Kinematics v1 — Production Closure

Date: 2026-09-22

Status: **FROZEN for the aerodynamic rigid-bat swing path**

Version:

```text
swing-kinematics-v1
```

Base physics:

```text
baseball-physics-architecture-v1
baseball-reality-profile-v1
```

## 1. Freeze decision

The physical bat-trajectory architecture is now frozen for v1.

The authoritative v1 trajectory is not a named "down", "level", or "upper"
animation and is not a nine-zone lookup table.

It is one continuous deterministic 3D rigid-bat trajectory generated from:

- predicted pitch location;
- batter handedness;
- preferred contact depth;
- target contact location;
- contact sweet-spot velocity;
- vertical attack angle;
- horizontal attack direction;
- pre-contact timing;
- follow-through timing.

The resulting state supplies, at every sampled physical time:

- fixed-length bat axis;
- grip;
- tip;
- sweet spot;
- grip linear velocity;
- rigid angular velocity.

The collision solver consumes that state directly.

## 2. Rigid-body trajectory contract

`SwingKinematicsV1` is the canonical trajectory sampler.

The bat centerline is derived from a unit axis and a fixed bat length rather
than advancing grip and tip independently.

For a fixed sweet-spot fraction `t_s`:

```text
grip = sweetSpot - axis * batLength * t_s
tip  = grip + axis * batLength
```

Velocity and angular velocity are derived from the same smooth trajectory:

```text
gripVelocity =
    sweetSpotVelocity
  - axisDerivative * batLength * t_s

angularVelocity = axis × axisDerivative
```

Therefore `angularVelocity × axis = axisDerivative` and the grip-tip length
does not drift.

The start/contact/follow-through knots are connected by deterministic smooth
piecewise Hermite motion. They are trajectory knots, not animation frames.

## 3. Course-aware motion contract

`CourseAwareSwingKinematicsV1` maps continuous course coordinates into the
trajectory. The nine debug courses are samples of that continuous map only.

Accepted evidence-direction relations include:

- inside contact is forward of outside contact;
- high/inside preferred contact is forward of low/outside;
- the default inside course has a longer pre-contact duration than outside;
- low-zone default attack angle exceeds high-zone default attack angle;
- contact-depth variation changes physical sweet-spot speed through the
  evidence-backed within-batter depth/speed relation.

The current versioned population-default profile contains:

- center contact depth: 20.1 in = 0.51054 m;
- reported population contact-depth spread retained as an evidence bound:
  +/- 7.2 in;
- inside/outside contact-depth gain: 0.075 m;
- height contact-depth gain: 0.035 m;
- contact sweet-spot base speed: 31 m/s;
- contact-depth speed slope: 4 m/s per m;
- attack angle: high 7 deg / middle 9 deg / low 16 deg;
- course attack-direction gain: 6 deg;
- base pre-contact duration: 165 ms;
- inside/outside timing gain: 10 ms;
- height timing gain: 4 ms;
- follow-through duration: 135 ms;
- bat length: 0.84 m;
- sweet-spot fraction: 0.72.

Important: the measured contact-depth center/spread, speed/depth relation and
public attack-angle height values are evidence anchors. Exact depth/timing/
horizontal-direction gains remain explicitly versioned default-profile
coefficients. Freezing v1 means they are stable for this profile version, not
that they are universal constants for every hitter.

Player-specific swing identities may later replace/version the profile without
changing the v1 rigid trajectory architecture.

## 4. Production rigid-contact path

The production-capable v1 entry is:

```text
resolveCourseAwareAerodynamicRigidSwingV1(...)
```

Its causal path is:

```text
predicted AerodynamicPitchTrajectory
        ↓
plate crossing + preferred contact-depth crossing
        ↓
CourseAwareSwingKinematicsV1
        ↓
SwingKinematicsV1
        ↓
RigidBatSwingWindow(kinematicsV1)
        ↓
resolveAerodynamicRigidBatSwing
        ↓
tapered rigid bat / baseball contact
        ↓
evidence-backed wood contact resolver
        ↓
canonical contact / batted-ball state
```

The actual/canonical pitch trajectory may differ from the batter's predicted
trajectory. That mismatch changes real geometry. A test verifies that a
laterally shifted actual pitch turns the same planned swing into a physical
swinging miss instead of invoking a hidden "whiff" probability.

## 5. Compatibility boundary

The historical first-order sampler is retained under the explicit name:

```text
sampleCompatibilityBatterSwingState
```

`sampleBatterSwingState` remains a backward-compatible alias for older
fixtures/modules.

The following older paths are compatibility/reduced-order paths and are not the
Swing Kinematics v1 production claim:

- `SwingingPitchPhysicalResult`;
- `AerodynamicSwingingPitchPhysicalResult`;
- `PitchAgainstBatter`;
- `AnticipationAwareAerodynamicSwing` as currently implemented.

Those modules advance the historical swing seed rather than consuming the new
kinematics trajectory.

This repository still contains legacy plate-appearance/catcher-led sequences
that call `PitchAgainstBatter`. Migrating those whole sequences from
`PitchTrajectorySegment` to the aerodynamic rigid path is a separate
integration migration. It does not reopen or change the frozen Swing Kinematics
v1 trajectory equations.

No closure claim should say that every legacy match coordinator has already
been migrated.

## 6. Observer / Presentation evidence

The diagnostic observer is:

```text
docs/presentation/swing-kinematics-v1-core-observer.html
```

Its embedded fixture is generated by Core:

```text
createCompactSwingKinematicsObserverFixtureV1()
```

The observer contains:

- nine representative continuous-course samples;
- 5 ms high-fidelity physical grip/tip/sweet-spot samples;
- the same physical poses projected by the existing Batter POV camera;
- Mini 55 ms samples plus exact start/contact/end boundaries;
- 150 x 108 logical Mini raster;
- 4 px display scaling.

The HTML contains no swing planner, no contact-depth law, no attack-angle law,
no rigid-body integration and no trajectory interpolation.

A repository test compares the serialized Core-generated fixture byte-for-byte
with the HTML payload.

The authoritative visual design remains **Work integrated preview revision 16**.
This diagnostic observer does not replace it.

Revision-16 rules remain unchanged:

- canonical world first;
- 4 px fixed display grid;
- 55 ms standard presentation cadence;
- no display interpolation that invents physical movement;
- normal continuous-bat views observe grip/tip;
- Pitcher POV B1 keeps the physical bat active but visually hidden and displays
  the approved four-frame body+bat artwork instead;
- artwork never drives contact geometry.

## 7. Validation evidence

Verified invariants and relations include:

- fixed 0.84 m grip-tip length through the full trajectory;
- normalized bat axis;
- angular velocity reproduces the axis derivative;
- grip velocity matches the finite-difference derivative of grip position;
- deterministic identical-input sampling;
- handedness mirrors batter-relative x behavior without mirroring the world;
- continuous nine-course planning;
- high/inside depth > low/outside depth;
- inside depth > outside depth;
- inside pre-contact time > outside pre-contact time;
- low attack angle > high attack angle;
- intended ball-center distance is perpendicular to the contact bat axis;
- aerodynamic predicted pitch -> v1 swing -> tapered rigid contact is connected;
- prediction error can physically create a miss;
- observer fixture preserves physical bat length;
- Mini samples use 55 ms cadence plus exact physical boundaries;
- HTML payload equals the Core-generated compact artifact.

Successful checkpoints include:

- P0 Core #1458 — rigid trajectory invariants;
- P0 Core #1461 — continuous course-aware planner;
- P0 Core #1467 — aerodynamic pitch -> v1 swing -> rigid contact integration;
- P0 Core #1475 / #1476 / #1477 — observer fixture and compact artifact;
- P0 Core #1482 — byte-exact observer HTML contract at
  `d8de58290eb0c8c1e4a16f87c2b55eeb887d6482`.

A final exact-head CI run after this closure document is still required before
the branch is considered completely closed.

## 8. Explicit v1 deferrals

The freeze does not claim:

- full skeletal inverse dynamics;
- explicit pelvis/torso/shoulder/elbow/wrist torque simulation;
- muscle/tendon or ground-reaction-force simulation;
- player-specific motion-capture reconstruction;
- universal course/timing coefficients for every hitter;
- axial bat grain/label twist as a contact degree of freedom;
- online learned trajectory correction after commitment;
- migration of every legacy `PitchAgainstBatter` sequence to the aerodynamic
  rigid path.

These are future upstream or integration tasks and must not be faked inside
Presentation.

## 9. Final interpretation

After final exact-head CI succeeds, the correct status is:

```text
Swing Kinematics v1 architecture: FROZEN
current evidence-bounded default profile: VERSIONED / FROZEN
aerodynamic rigid-bat production entry: IMPLEMENTED
physical contact integration: GREEN
nine-course Core observer: GREEN
v16 4px/55ms observer boundary: GREEN
legacy first-order sampler: COMPATIBILITY ONLY
legacy plate-appearance migration: SEPARATE INTEGRATION TASK
```

The physical bat trajectory itself is no longer to be redesigned casually.
Future improvements should arrive as evidence-backed profile revisions or a
new upstream kinematics version, not as Presentation-side trajectory invention.

## 10. Product scope decision — do not add human-body simulation

User decision: **Mini Baseball does not need a skeletal / muscle / ground-reaction-force batting simulator.**

The product intentionally represents player differences through baseball/player
ratings and versioned swing parameters. The game does not need a second
biomechanics simulation stack underneath those ratings merely to explain how a
pixel-art batter generated the bat motion.

Therefore the following are not backlog items for Swing Kinematics v1 and
should not be implemented unless the product direction is explicitly changed
in the future:

- full-body skeletal dynamics;
- pelvis / torso / shoulder / elbow / wrist torque simulation;
- muscle / tendon force simulation;
- ground-reaction-force simulation;
- player-specific motion-capture reconstruction as an authoritative runtime
  motion source.

These features would add another source of authority for player movement and
would overlap with or conflict with the existing responsibilities of:

- player numerical ratings and physical profiles;
- Swing Kinematics;
- canonical bat-ball physics;
- Presentation / B1 pixel-art observation.

For Mini, player ratings are sufficient to parameterize differences in timing,
bat speed, contact control, course handling, swing profile and other baseball
behaviour. Swing Kinematics turns those numerical inputs into the physical bat
trajectory. Presentation observes the resulting canonical state.

The intended authority chain is therefore:

```text
player numerical attributes / ratings
        ↓
versioned swing parameters
        ↓
Swing Kinematics v1
        ↓
physical bat trajectory
        ↓
bat-ball contact
        ↓
canonical game state
        ↓
pixel-art Presentation
```

Do not insert a skeletal, torque, muscle or motion-capture authority between
player ratings and Swing Kinematics.

### Remaining required migration

The only remaining swing-path integration task from this closure is migration
of legacy `PitchAgainstBatter` / historical first-order swing callers onto the
new aerodynamic rigid-bat Swing Kinematics v1 path.

That migration is required for consistency so that real match flow does not
sometimes use the compatibility sampler while diagnostics use the new physical
trajectory.

This migration should preserve the existing product boundary above. It must
not be used as an excuse to introduce body biomechanics simulation.