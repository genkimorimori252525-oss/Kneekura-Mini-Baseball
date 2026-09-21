# Swing Kinematics v1 Design

Date: 2026-09-22

Status: **implementation-authorized; upstream extension of frozen baseball-physics-architecture-v1**

Version:

```text
swing-kinematics-v1
```

## 1. Why this exists

The existing rigid/reduced-order bat-ball collision is materially more complete
than the upstream swing motion that feeds it.

The current compatibility sampler `sampleBatterSwingState()` advances the grip
with constant linear velocity and approximates the tip displacement with one
first-order `angularVelocity × batAxis × dt` term. It is useful for deterministic
contact-search fixtures, but it is not a production claim about a baseball
player's 3D bat path.

This distinction matters because Mini is an observer of the canonical physical
world. A 4px / 55ms broadcast cannot repair a poor underlying bat trajectory.

Swing Kinematics v1 therefore adds a canonical, deterministic rigid-bat motion
layer upstream of the already-frozen contact solver.

## 2. Non-negotiable world-first boundary

```text
batter perception / intent
        ↓
predicted pitch location
        ↓
preferred contact depth + target
        ↓
Swing Kinematics v1
        ↓
rigid bat pose / velocity / angular velocity at time t
        ↓
AerodynamicRigidBatSwingingPitchPhysicalResult
        ↓
RigidBatBallContact
        ↓
canonical batted-ball state
        ↓
Presentation observes only
```

Presentation never chooses a down/level/upper result and never changes a bat pose
to make a frame look better.

The user's supplied down/level/upper and swing-phase diagrams are qualitative
visual references only. They do not become three canned physics trajectories.

## 3. Coordinate contract

Existing world axes remain authoritative:

- `x`: lateral across the plate / batter boxes;
- `y`: vertical;
- `z`: home plate toward pitcher is positive;
- aerodynamic pitches travel generally toward negative `z`.

Handedness is represented by one mirror sign only:

```text
R batter: pull-side x sign = -1
L batter: pull-side x sign = +1
```

The world, bases, pitcher, plate and pitch are never mirrored.

## 4. Canonical swing state

The authoritative v1 swing sample is still compatible with
`BatterSwingState`:

```ts
type BatterSwingState = {
  pose: {
    grip: Vec3;
    tip: Vec3;
  };
  linearVelocity: Vec3;   // grip velocity
  angularVelocity: Vec3;  // rigid bat angular velocity
};
```

Swing Kinematics v1 generates those values from a rigid trajectory rather than
integrating the tip independently.

Internally the trajectory is defined by:

- fixed bat length;
- a fixed sweet-spot fraction along the bat axis;
- sweet-spot position as a smooth 3D trajectory;
- a unit bat-axis direction as a smooth 3D trajectory;
- analytic derivatives of both.

For every sample:

```text
grip = sweetSpot - axis * batLength * sweetSpotT
tip  = grip + axis * batLength

gripVelocity =
    sweetSpotVelocity
  - axisDerivative * batLength * sweetSpotT

angularVelocity = axis × axisDerivative
```

No axial twist is required for v1 capsule/tapered contact geometry. Future
visual grain/label rotation may add axial roll without changing the centerline
contact path.

This construction guarantees fixed grip-tip length and makes the supplied
angular velocity consistent with the changing bat axis.

## 5. Phase contract

v1 uses one continuous physical trajectory with three key states:

1. launch / early acceleration;
2. intended contact;
3. follow-through.

The trajectory is not a three-frame animation. The three states are knots in
continuous piecewise cubic-Hermite curves with shared contact derivatives.

The contact sweet-spot velocity is a first-class physical quantity.

The bat may visually resemble a down, level or upper swing in different
situations, but those labels are derived descriptions only.

## 6. Continuous course coordinates

Course planning uses continuous normalized values:

```text
heightNormalized:
  -1 = bottom of zone
   0 = zone center
  +1 = top of zone

insideOutsideNormalized:
  -1 = inside
   0 = center
  +1 = outside
```

For a right-handed batter, negative world-x is inside. For a left-handed batter,
positive world-x is inside. The conversion is explicit and tested.

Nine-zone UI/debug views are samples from this continuous space, not nine
different swing programs.

## 7. Adopted empirical relations

The following relations are adopted as v1 evidence constraints.

### 7.1 Contact depth and course

Maeda (2007), `Effect of pitch trajectory on batting swing`:

- inside trajectories were contacted closer to the pitcher;
- outside trajectories were contacted closer to the catcher;
- most body motion outside the arms changed little across course;
- batters appeared to adjust the swing near impact.

Katsumata et al. (2017), `Coordination of hitting movement revealed in baseball
tee-batting`:

- preferred impact location moved forward for high/inside;
- preferred impact location moved backward for low/outside;
- trunk and arm motion changed systematically with location;
- inside locations required a longer bat-movement duration than outside.

Therefore v1 must satisfy monotonically:

```text
contactDepth(inside) > contactDepth(outside)
contactDepth(high+inside) > contactDepth(low+outside)
preContactDuration(inside) > preContactDuration(outside)
```

### 7.2 Bat-head speed and swing-angle location dependence

The 2019 study `The effect of changes in hitting location on bat-swing
parameters in baseball batting` recorded 644 swings from professional and
university-level players.

Reported tendencies:

- bat-head speed increased as the hitting point moved inside, forward and low;
- measured swing angle and swing time increased with location changes including
  forward/high/inside components.

v1 uses these as relation tests, not as permission to invent exact universal
zone coefficients.

### 7.3 Contact depth as a major covariate

The 2026 live NCAA markerless-motion study `Contact Depth Affects Most of the
Other Hitting Metrics We Analyze` reported:

- mean contact depth: 20.1 +/- 7.2 inches in front of hitter center of mass;
- within-batter maximum bat speed increased about 0.040 m/s per 1 cm increase
  in contact depth;
- contact depth strongly covaried with combined vertical/horizontal attack
  angles.

v1 therefore uses 20.1 inches as the default population center for preferred
contact depth and uses the reported within-batter speed/depth slope as an
optional evidence-backed default relation.

The +/- 7.2 inch population spread is a bound/context, not a claim that every
course should move by one standard deviation.

### 7.4 Attack angle

MLB Statcast's public swing-path/attack-angle definitions are used for
terminology:

- attack angle = vertical direction of the sweet spot at contact;
- attack direction = horizontal direction of the sweet spot at contact;
- swing-path tilt describes the recent path shape and is not the same quantity.

The 2025 public MLB summary reports average attack angle by height at about:

- high: 7 degrees;
- middle: 9 degrees;
- low: 16 degrees.

Swing Kinematics v1 may use this as a versioned population-default height curve.
It is not a universal player optimum.

### 7.5 Multi-view path matters

Nakashima et al. (2025), `Acceptable range of timing error at bat-ball impact
in baseball depends on the bat swing path`, found timing windows varied widely
and depended on the combination of:

- side-view bat path;
- top-view bat path;
- bat angle at impact.

Therefore v1 must retain full 3D path information. A single 2D attack-angle
number cannot define the swing.

## 8. Evidence-bounded default profile

The default profile is a deterministic population prior, not a universal human
swing.

It may provide:

- center contact depth from the 20.1-inch live-game mean;
- continuous inside/outside and high/low contact-depth offsets constrained to a
  conservative fraction of the reported population spread;
- the Statcast high/middle/low attack-angle curve;
- player-specific base contact sweet-spot speed;
- the measured 0.040 m/s per cm contact-depth/max-speed relation;
- explicit provisional timing/course gains where only direction, not numeric
  magnitude, is identified by adopted studies.

Every provisional coefficient is versioned and labeled as such.

Player development, ratings and individual swing identities must later vary the
profile rather than alter post-contact outcomes directly.

## 9. Contact target and bat geometry

The intended target is a predicted ball center at the preferred contact depth.

For a centered nominal hit, the barrel centerline at intended contact is placed
behind the predicted ball center along +z contact normal by approximately:

```text
ballRadius + localBatRadius
```

The actual aerodynamic pitch remains authoritative. Prediction error, timing
error or location error causes off-center contact or a miss through ordinary
geometry.

The planner does not move the real ball to the intended target.

## 10. Production integration

A new kinematic trajectory is optional in the existing
`RigidBatSwingWindow` during migration.

Resolution rule:

```text
if kinematicsV1 exists:
    sample Swing Kinematics v1
else:
    sample legacy first-order BatterSwingState compatibility path
```

The legacy path must be explicitly named/documented as compatibility-only.

No existing contact equations, material calibration or release physics are
rewritten by this work.

## 11. Presentation contract

Presentation receives the sampled physical bat pose:

```text
grip(t)
tip(t)
```

and projects it.

- Batter POV / catcher POV / overhead may draw the continuous observed bat.
- Pitcher POV B1 may keep the physical bat invisible and display the approved
  four-frame body+bat artwork, as already decided.
- The hidden physical pose remains available for contact and diagnostics.
- 4px grid and 55ms cadence are observer properties only.

A diagnostic observer must show both:

1. high-fidelity sampled Core path;
2. the same samples reduced to Mini's 4px / 55ms observation.

The observer must not contain an independent swing generator.

## 12. Explicit v1 deferrals

Swing Kinematics v1 does not yet claim:

- full skeletal inverse dynamics;
- pelvis/torso/shoulder/elbow/wrist joint torques;
- muscle/tendon dynamics;
- ground-reaction-force simulation;
- bat axial twist/grain orientation as a contact input;
- individualized motion-capture reconstruction for every player;
- learned online swing correction after commitment.

Those can be future upstream extensions if they preserve the same canonical
bat-state boundary.

## 13. Acceptance criteria

- bat length is invariant to numerical precision for all sampled times;
- returned angular velocity reproduces the axis derivative;
- grip velocity matches the derivative of sampled grip position;
- handedness mirrors only the batter-relative x behavior;
- high/inside preferred contact is forward of low/outside;
- inside contact is forward of outside;
- inside pre-contact duration is longer than outside in the adopted default;
- low-zone default attack angle exceeds high-zone default attack angle;
- nine-zone debug samples arise from one continuous planner;
- changing timing/location changes real contact geometry rather than a result
  probability;
- identical inputs are bit/deterministically repeatable within the existing
  numeric contract;
- old compatibility tests remain green;
- Presentation remains read-only.