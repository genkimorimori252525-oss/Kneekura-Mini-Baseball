# Baseball Physics Realism Design — 2026-09-20

Status: Phase A implementation started on `jolly/baseball-physics-realism-2026-09-20`.

## 1. Goal

The Shared Match Core should reproduce baseball through causal physical state, not through result labels.

The target chain is:

```text
pitch state
+ bat rigid-body state
+ ball spin
+ environment
        ↓
physical bat-ball collision
        ↓
exit velocity / launch vector / spin
        ↓
3D aerodynamic flight
        ↓
surface collision / skid / roll
        ↓
fielder and runner interaction
        ↓
rules and official outcome
```

`ground_ball`, `line_drive`, `fly_ball`, `hit`, `out`, and similar labels are observations of the physical play. They are never authoritative inputs to trajectory generation.

## 2. Scientific anchors

The implementation should prefer experimentally constrained baseball-specific models over generic smooth-sphere or game-feel tuning.

Primary references for this work:

- Rod Cross and Alan M. Nathan, *Scattering of a Baseball by a Bat*, American Journal of Physics 74, 896-904 (2006).
  - https://baseball.physics.illinois.edu/AJP-Oct2006.pdf
- Alan M. Nathan, *The Effect of Spin on the Flight of a Baseball*, American Journal of Physics 76, 119-124 (2008).
  - https://baseball.physics.illinois.edu/AJPFeb08.pdf
- David Kagan and Alan M. Nathan, *Simplified Models for the Drag Coefficient of a Pitched Baseball*, The Physics Teacher 52, 278-280 (2014).
  - https://baseball.physics.illinois.edu/DragTPTMay2014.pdf
- Jeffrey R. Kensrud, Alan M. Nathan, and Lloyd V. Smith, *Oblique Collisions of Baseballs or Softballs with a Bat*, American Journal of Physics 85, 503-509 (2017).
  - indexed from https://baseball.physics.illinois.edu/nathan/nathan-papers.html
- Bin Lyu, Lloyd Smith, Jack Elliott, and Jeff Kensrud, *The Dependence of Baseball Lift and Drag on Spin* (2022).
  - https://baseball.physics.illinois.edu/LyuDragLiftSpin.pdf
- MLB Baseball Savant Statcast Drag Dashboard.
  - https://baseballsavant.mlb.com/drag-dashboard

The references do not imply that one universal coefficient exactly describes every baseball. Real balls vary, and aerodynamic coefficients depend on speed, spin, seam orientation, atmosphere, and ball properties. The Core must expose those physical inputs rather than hide the variation in outcome tuning.

## 2.1 Permanent no-deformation boundary

This project deliberately does **not** put explicit bat or ball deformation into the authoritative Match Core.

The canonical contact model remains a rigid-body / reduced-order model.

Forbidden as authoritative result-producing physics:

- finite-element bat flex;
- explicit ball compression meshes or shape states;
- local seam deformation;
- high-degree-of-freedom elastic-body contact;
- a separate deformation solver for Natural presentation.

This is not a claim that real bats and baseballs do not deform. They do. The design choice is to represent the **observable consequences** of that deformation through experimentally calibrated reduced parameters:

- normal coefficient of restitution;
- effective tangential response;
- contact friction;
- effective mass and moment of inertia;
- impact location;
- measured aerodynamic coefficients.

The governing rule is:

```text
real deformation and vibration
        ↓ laboratory measurement
reduced contact coefficients / rigid-body properties
        ↓
authoritative deterministic collision
```

Never:

```text
authoritative finite-element deformation
        ↓
different Mini/Natural result paths
```

Natural may later render visual bat flex or ball compression, but those effects are presentation-only and must not feed back into canonical velocity, spin, trajectory, or adjudication.

This permanently preserves the 2026-09-17 causal-contact decision while still allowing the reduced model to become substantially more faithful to measured baseball behavior.

## 3. Phase A — aerodynamic flight

### 3.1 Implemented foundation

The new `BaseballAerodynamics` module computes aerodynamic acceleration from:

- regulation-scale baseball mass and radius;
- air density;
- wind velocity;
- ball velocity relative to the air;
- drag coefficient;
- full 3D spin vector.

Drag follows:

```text
Fd = 1/2 * rho * A * Cd * v^2
```

and acts opposite the air-relative velocity.

Magnus lift follows:

```text
Fl = 1/2 * rho * A * Cl * v^2
```

with lift direction from the active spin component perpendicular to the velocity.

The current empirical lift relation is:

```text
S = R * omega_perpendicular / v

Cl = 1.5 S             when S <= 0.1
Cl = 0.09 + 0.6 S      when S > 0.1
```

Pure gyrospin is therefore not incorrectly treated as Magnus-active spin.

### 3.2 Integration

When aerodynamic flight is enabled, `BallFlight` uses deterministic fourth-order Runge-Kutta integration for position and velocity.

The legacy gravity-only path is preserved so existing frozen Core fingerprints do not change merely because a new physical model exists.

Two profiles are now distinct:

```text
DEFAULT_BALL_FLIGHT_PARAMETERS
  -> legacy compatibility / no aerodynamics

REALISTIC_BASEBALL_FLIGHT_PARAMETERS
  -> drag + Magnus + wind-aware flight
```

The realistic profile is not yet declared statistically calibrated. It is a physically grounded reference profile.

### 3.3 Still missing from flight

Do not silently pretend these are solved:

- speed-dependent drag;
- spin-dependent drag;
- explicit two-seam/four-seam orientation effects;
- seam-shifted-wake forces;
- ball-to-ball aerodynamic variation;
- weather adapter from temperature/pressure/humidity to air density;
- stadium altitude profile;
- optional spin decay.

The 2022 Lyu/Smith/Kensrud measurements should be the next source for replacing the single reference `Cd` with a measured baseball-specific coefficient model.

## 3.4 Pitch-flight physics from the supplied reference images

The supplied reference images are useful for three concepts that now have explicit Core representation:

1. Magnus force acts perpendicular to the instantaneous flight direction and active spin axis;
2. total spin must be split into true/active spin and gyro spin;
3. the force direction can evolve during flight because the **velocity direction** evolves, even when the physical spin vector remains nearly fixed.

The implementation must not infer more than the images establish. In particular, diagrams showing a changing force direction are **not** treated as proof that a pitched baseball's spin axis should be manually precessed through a large angle.

External checks used for this boundary:

- Jinji & Sakurai, *Direction of spin axis and spin rate of the pitched baseball* (Sports Biomechanics, 2006): lift correlates with the spin component perpendicular to velocity and is greatest when spin and translational velocity are perpendicular.
  - https://pubmed.ncbi.nlm.nih.gov/16939153/
- Alan Nathan, *Determining the 3D Spin Axis from Statcast Data*: formalizes drag, Magnus and active-spin geometry for pitched baseballs.
  - https://baseball.physics.illinois.edu/trackman/SpinAxis.pdf
- MLB Statcast Active Spin: defines Active Spin as the spin that contributes to movement and Gyro Spin as the component aligned with the flight direction.
  - https://baseballsavant.mlb.com/leaderboard/active-spin
- Hasegawa et al., *Measurement of rotational characteristics of a baseball in flight* (2019): measured spin axis was nearly constant during flight, while spin rate decreased modestly.
  - https://doi.org/10.1299/transjsme.18-00440
- Smith & Smith, *Using baseball seams to alter a pitch direction: The seam shifted wake* (2020/2021): seam orientation can generate an additional non-Magnus force by shifting the wake.
  - https://doi.org/10.1177/1754337120961609

### 3.4.1 Implemented pitching foundation

The opt-in realistic pitch path now contains:

- `PitchSpinPhysics`
  - decomposes the full 3D angular-velocity vector into active/true spin and gyro spin relative to the **instantaneous** velocity vector;
  - reports active-spin fraction and gyro-spin fraction;
  - derives the instantaneous Magnus direction;
- `AerodynamicPitchTrajectory`
  - gravity;
  - baseball drag;
  - Magnus acceleration from active spin only;
  - wind through air-relative velocity;
  - deterministic fourth-order Runge-Kutta integration;
  - exact authoritative integer-tick plate-crossing search with sub-tick interpolation for crossing geometry;
- `AerodynamicTakenPitchPhysicalResult`
  - uses the aerodynamic plate crossing directly for strike-zone geometry instead of a preselected pitch result.

The spin vector is currently held fixed in inertial space during an ordinary pitch. Active/gyro decomposition is recomputed continuously from the changing velocity direction.

Therefore a pitch released with nearly pure gyro spin can acquire a small active component later as gravity and aerodynamic forces bend the velocity vector, without inventing a large physical precession of the ball's spin axis.

### 3.4.2 Seam-shifted wake boundary

Do **not** force every observed pitch movement into the Magnus model.

Hawkeye/Statcast and laboratory work support non-Magnus movement associated with seam orientation. The current implementation deliberately leaves this unimplemented rather than introducing an arbitrary `movementBonus`.

The future generative path should be:

```text
release seam orientation
+ 3D spin axis
+ spin phase
+ velocity / Reynolds number
        ↓
validated seam/wake force model
        ↓
non-Magnus aerodynamic force
```

Never:

```text
pitch type name = sinker
        ↓
add hidden arm-side break
```

Until a validated seam-orientation model is available, the realistic pitch path is explicitly **Magnus + drag + gravity + wind**, not a claim to reproduce all seam-shifted-wake movement.

### 3.4.3 Reduced-order release mechanics

The next implemented layer now begins before aerodynamic flight.

Published pitching biomechanics support several important constraints:

- Kinoshita et al. (2017), *Finger forces in fastball baseball pitching*: index/middle finger forces show strong late-release peaks, with summed shear force supplying a kinetic source for backspin.
  - https://pubmed.ncbi.nlm.nih.gov/28500954/
- Kinoshita et al. (2017), *Middle finger and ball movements around ball release during baseball fastball pitching*: the ball begins rolling toward the fingertip only several milliseconds before release, while substantial force remains applied.
  - https://pubmed.ncbi.nlm.nih.gov/28632054/
- Nagami et al. (2011), *Factors determining the spin axis of a pitched fastball in baseball*: spin-axis direction correlates strongly with hand orientation immediately before release.
  - https://pubmed.ncbi.nlm.nih.gov/21400344/
- Recent friction work shows greater fingertip slip is associated with lower ball speed and lower spin rate.
  - https://pubmed.ncbi.nlm.nih.gov/40148381/

The Core therefore represents release through physical impulses rather than a pitch-type lookup:

```text
ball pre-release linear velocity
+ ball pre-release angular velocity
+ seam/material orientation
+ finger contact locations on ball
+ time-integrated finger forces
        ↓
ΣJ
Σ(r × J)
        ↓
release velocity
release spin vector
release seam orientation
        ↓
aerodynamic pitch flight
```

Implemented modules:

- `BaseballOrientation`
  - normalized quaternion material orientation;
  - body-space seam/grip directions -> world-space directions;
  - deterministic seam-phase advance from the physical angular-velocity vector;
- `PitchReleaseMechanics`
  - individual finger/contact impulses;
  - `Δv = J / m`;
  - `Δω = I^-1 (r × J)`;
  - force-duration helper so measured force pulses can be represented as physical impulse;
  - no explicit finger/ball deformation state;
- `PitchReleaseFlightSlice`
  - connects finger-generated release velocity/spin/orientation directly to aerodynamic flight and plate crossing;
  - enforces identical ball mass/radius between release and aerodynamic models.

This is deliberately a **reduced-order release boundary**, not a claim to simulate the full arm, hand, tendon, skin, or ball deformation process.

The model accepts the final hand/finger impulses as physical inputs. A future pitcher biomechanics layer may generate those impulses from wrist/forearm/finger state, but it must remain upstream and cannot bypass the release impulse equations with hidden pitch-type movement bonuses.

### 3.4.4 Seam orientation is state, not yet force

The material orientation of the baseball is now preserved and advanced through flight. This gives the Core a real seam phase/orientation state for later seam-aware aerodynamics.

However, the current aerodynamic force remains Magnus + drag + gravity + wind. Seam orientation is currently **observed state only**.

This distinction is intentional:

```text
now:
release grip/seam orientation
        ↓
material orientation through flight
        ↓
recorded / available for validation

later, after calibration:
material seam orientation
+ spin phase
+ velocity
        ↓
validated seam-wake force
```

No seam-shifted-wake force is created merely because seam orientation state now exists.

### 3.4.5 Aerodynamic pitch interaction with the batter

The realistic pitch path now reaches both take and swing decisions.

Implemented:

- `AerodynamicSwingingPitchPhysicalResult`
  - searches bat/ball contact along the continuously integrated aerodynamic pitch path;
  - uses conservative advancement based on an upper bound on pitch/ball geometric closing speed rather than renderer cadence;
  - therefore lateral/vertical pitch movement changes the actual contact geometry and timing;
  - intentionally reuses the frozen legacy contact response after contact is found, until the reduced-order rigid collision has completed calibration;
- `AerodynamicPitchAgainstBatter`
  - records aerodynamic taken pitches and aerodynamic swing/contact results through the existing canonical plate-appearance timeline;
  - preserves the existing rule/count adapters rather than creating a second rules engine.

The boundary is therefore:

```text
release mechanics
        ↓
aerodynamic pitch flight
        ↓
actual take/swing geometry
        ↓
canonical pitch/contact event
        ↓
existing rules
```

There is still only one authoritative rules timeline.

### 3.4.6 Pitch identity is physical; pitch name is registered metadata

A pitch type name must never drive the trajectory.

The authoritative identity is split into two layers:

```text
physical identity
  - induced horizontal movement
  - induced vertical movement
  - broad movement direction
  - release / plate speed
  - spin
  - active-spin fraction
  - release mechanics / seam state
        ↓
human-readable registration
  - nearest calibrated pitch-name archetype
```

This follows the same conceptual separation used by modern tracking systems: Statcast exposes both total movement and induced movement, while induced vertical break attempts to isolate movement generated by spin/manipulation from gravity.

References:

- MLB Statcast Pitch Movement:
  - https://www.mlb.com/glossary/statcast/pitch-movement
- MLB Statcast Induced Vertical Break:
  - https://www.mlb.com/glossary/statcast/induced-vertical-break
- Baseball Savant Pitch Movement Leaderboard:
  - https://baseballsavant.mlb.com/pitch-movement

Implemented modules:

- `PitchMovementSignature`
  - compares the actual aerodynamic pitch with the **same release state at zero spin**;
  - records induced horizontal/vertical movement in meters;
  - assigns only a broad 8-way movement family plus neutral;
  - keeps coordinate sign separate from human “left/right” display convention;
- `PitchNameRegistry`
  - builds pitch-name archetypes from labeled calibration samples;
  - calibration data must use one explicit horizontal coordinate frame; raw right/left-handed samples must not be mixed without mirroring into a common pitcher-relative arm-side/glove-side frame;
  - names a physical pitch by nearest movement centroid;
  - first gates by the broad movement family, then chooses the nearest numeric movement centroid;
  - stores registry version and classification distance so naming can be recalibrated without changing old physics;
- `PitchArsenalProfile`
  - aggregates multiple throws belonging to one stable internal `pitchSkillId`;
  - stores mean movement, speed, spin and per-pitch variation;
  - registers the **aggregate cluster**, not every individual throw, so normal release noise does not rename the pitch every pitch;
- `MiniPitchArsenalState`
  - presents the registered human-readable name beside the actual movement/speed numbers.

The permanent direction of dependency is:

```text
pitchSkillId / release skill
        ↓
release mechanics
        ↓
physical flight
        ↓
movement signature
        ↓
broad direction family
        ↓
nearest calibrated human pitch name
        ↓
player card / scouting / UI
```

Never:

```text
"slider"
        ↓
hidden slider break
        ↓
trajectory
```

The name is therefore allowed to change when the player's physical pitch evolves or when a newer, explicitly versioned calibration registry is applied. The underlying pitch skill and its physical history do not change just because the display label changes.

For player-specific individuality, the arsenal profile also keeps dispersion (variation) rather than only the mean. Two pitchers may both have a registered “slider” while having materially different mean movement, velocity, spin, active-spin efficiency, and repeatability.

### 3.4.7 2025 MLB Statcast seed registry

A first real-data pitch-name calibration registry now exists as
`MlbStatcast2025PitchNameRegistry`.

The source is the 2025 Baseball Savant / Statcast-derived grouped movement
artifact in `Jakeyv22/mlb-season-pitching-dashboard`, cross-checked against
the official Baseball Savant CSV definitions for `pfx_x` and `pfx_z`.

The hand-split source rows are normalized from catcher-view horizontal movement
into one pitcher-relative frame:

```text
positive horizontal = arm side
negative horizontal = glove side
positive vertical   = induced rise / less drop than zero-spin reference
negative vertical   = induced drop
```

Both LHP and RHP source rows are kept as separate calibration samples before
the centroid is formed. This prevents the archetype from being biased merely
because one throwing hand supplied more MLB pitches.

The first seed includes only pitch labels with at least 500 pitches in the
published grouped 2025 artifact:

- Four-Seam Fastball (FF)
- Sinker (SI)
- Cutter (FC)
- Slider (SL)
- Sweeper (ST)
- Curveball (CU)
- Knuckle Curve (KC)
- Changeup (CH)
- Split-Finger (FS)
- Slurve (SV)

Forkball (FO) is **not** included yet. The MLB grouped artifact contains only
139 forkballs, which is too thin a base to pretend that it is a strong
universal forkball archetype. Because this project targets Japanese baseball
as well, an NPB/Hawkeye forkball calibration should be added separately when
a reliable dataset is available.

This is an intentionally versioned registry:

```text
mlb-statcast-2025-arm-side-v1
```

Recalibrating or replacing the registry may change the human-readable pitch
name attached to a physical pitch cluster, but it must never rewrite the
underlying `pitchSkillId`, release history, movement history, or canonical
trajectory.

### 3.4.8 Pitcher-specific learned pitch skills

Pitch identity now has an upstream player-owned physical state.

A learned pitch is represented by a stable `pitchSkillId`, not by a pitch
type name. Its physical state contains:

- a learned release template:
  - release-point offset;
  - pre-release linear velocity;
  - pre-release angular velocity;
  - ball/seam material orientation;
  - finger contact directions;
  - finger impulses;
- repeatability expressed as physical standard deviations for those same
  release quantities.

The per-pitch chain is now:

```text
pitcherId
+ pitchSkillId
+ learned release template
+ physical repeatability
+ deterministic pitch RNG stream
        ↓
one sampled release
        ↓
finger / impulse mechanics
        ↓
aerodynamic flight
        ↓
movement signature
        ↓
multiple observations
        ↓
arsenal aggregate
        ↓
human-readable registered pitch name
```

Implemented modules:

- `PitchSkillProfile`
  - owns the stable player-specific `pitchSkillId`;
  - stores the learned release template and repeatability in physical units;
  - samples per-pitch deviations from a stable deterministic
    `SeedRoot(...).streamRng(..., 'pitch', ...)` stream;
  - normal variation therefore changes release point, velocity, spin,
    orientation, finger contact and impulse before flight, rather than adding
    random movement after the trajectory exists;
- `PitchSkillFlightSample`
  - connects one sampled skill release through release mechanics and
    aerodynamic flight into one measured `PitchMovementSignature`;
- `PitchSkillArsenalAdapter`
  - requires repeated observations with the same `pitcherId` and
    `pitchSkillId`;
  - only then passes their physical movement signatures into the downstream
    arsenal/name registry;
- `PitchSkillDevelopment`
  - lets one stable `pitchSkillId` move toward a new physical release target;
  - repeatability can improve by reducing physical release variance;
  - no pitch name participates in the development transition.

This supports the intended distinction:

```text
two pitchers
  both eventually registered as "slider"
        ↓
different release templates
different spin / velocity
different movement means
different repeatability
        ↓
different actual sliders
```

Development remains deliberately uncalibrated at the career/training level.
`adaptPitchSkillTowardPhysicalTarget(..., adaptationRate)` is only a
physical interpolation primitive. It does **not** decide how many training
sessions produce a given adaptation rate, how age/fatigue changes learning,
or whether a pitcher can successfully acquire a new release pattern. Those
rules require separate empirical/game-design calibration and must not be
smuggled into the physics layer.

### 3.4.9 Manager macro intent and catcher-led pitch calling

Manager mode must not require the player to choose every pitch.

The manager command remains a plate-appearance-level macro instruction:

```text
manager
  - inside / middle / outside
  - low / middle / high
  - challenge / balanced / waste
        ↓
broad bias only
```

The catcher owns the pitch-by-pitch lead inside that boundary.

Implemented modules:

- `CatcherLead`
  - selects one stable pitcher-owned `pitchSkillId`;
  - selects one coarse horizontal/vertical target and aggression level;
  - uses the current canonical count;
  - uses deterministic battery-specific pitch RNG;
  - supports catcher/pitcher learned pitch preferences;
  - supports count-specific multipliers;
  - supports sequence memory so a battery may avoid or intentionally repeat the previous pitch/location;
  - treats the manager directive as a **weight multiplier**, never as an exact mandatory call;
- `CatcherLeadCommandAdapter`
  - reads the current count from the canonical plate-appearance timeline;
  - turns the catcher's single-pitch call into a per-pitch command session;
  - preserves the original manager session unchanged;
  - carries the selected `pitchSkillId` beside the existing commanded pitch input;
- `CatcherLedPlateAppearanceSequence`
  - keeps one manager macro command for the plate appearance;
  - lets the catcher generate each successive call from the evolving count;
  - records those pitches through the existing canonical rules timeline;
  - carries previous-call memory between pitches.

The intended dependency is:

```text
manager macro intent
        ↓ bias
catcher + pitcher battery plan
+ current count
+ sequence memory
+ available pitchSkillIds
        ↓
catcher call
  pitchSkillId
  coarse target
        ↓
pitcher execution / physical release
        ↓
actual trajectory
```

Never:

```text
manager clicks every pitch
        ↓
exact pitch + exact coordinate
```

Nor:

```text
catcher says "slider"
        ↓
hard-coded slider trajectory
```

The catcher's repertoire choices are made by `pitchSkillId`. Human-readable registered pitch names remain presentation/scouting metadata downstream of physical pitch behavior.

The compatibility command path still exists, but the catcher call now also has a fully physical execution route:

- `PitchSkillCommandResponse`
  - maps the catcher's coarse horizontal/vertical/aggression call into pitcher-specific **physical release-space deltas**;
  - adjusts release point, release velocity, release spin, orientation and/or finger contact/impulse;
  - never receives an exact plate coordinate and never changes a human-readable pitch name;
  - preserves the pitch's stable `pitchSkillId` and its repeatability model;
- `CatcherCalledPitchSkillFlight`
  - applies the catcher call to the selected `PitchSkillProfile`;
  - then applies the pitcher's deterministic execution variance;
  - then runs finger/release mechanics and aerodynamic flight;
  - therefore two identical catcher calls can still be executed differently by two pitchers because their learned physical skills differ;
- `CatcherLedPhysicalPitch`
  - reads the current canonical count;
  - lets the catcher choose from the pitcher's actual available `pitchSkillId` repertoire;
  - resolves the matching pitcher-specific command-response profile;
  - executes the selected skill through the full physical release/flight chain;
  - provides the direct manager macro -> catcher call -> pitcher skill -> physical pitch bridge.

The catcher chooses *what to try*; the pitcher's learned motor plan and repeatability determine what actually happens.

`PitcherSignDecision` now provides that separate battery-interaction layer instead of hiding disagreement inside catcher quality.

### 3.4.10 Pitcher sign autonomy and batter anticipation

Pitcher personality may change whether a catcher call is accepted, but it must never add a direct good/bad outcome modifier.

Implemented:

- `PitcherSignDecision`
  - stores pitcher-specific `signAutonomy` as a behavioral tendency;
  - deterministically decides whether the catcher call is accepted or overridden;
  - an override selects only from the pitcher's actual `pitchSkillId` repertoire and coarse location/aggression choices;
  - outcome quality still comes entirely from the selected physical skill, execution error, flight and batter response;
- `BatterPitchAnticipation`
  - represents what the batter believed was coming, with explicit confidence;
  - compares that belief with the **final** call after any pitcher override;
  - produces mismatch/surprise evidence only; it does not manufacture a strike or miss;
- `BatterAnticipationSwingAdapter`
  - converts anticipation mismatch into an explicit calibrated recognition delay;
  - calibration is passed in as data rather than hidden in the result engine;
- `AnticipationAwareAerodynamicSwing`
  - applies that timing delay to the real swing window;
  - then ordinary aerodynamic pitch / bat geometry decides contact or swinging miss.

The causal chain is therefore:

```text
catcher read
        ↓
pitcher accepts / overrides
        ↓
final physical pitch plan
        ↓
batter anticipation
        ↓
recognition timing
        ↓
real bat / ball geometry
        ↓
contact or miss
```

Thus a pitcher ignoring a sign can help or hurt with no special bonus. If the batter had correctly anticipated the catcher's original plan, an override may create timing surprise and a miss. If the override happens to produce a worse physical pitch or the batter anticipated the pitcher instead, it may be punished.

### 3.4.11 Pitching physics closure gate

The **architecture** of realistic pitching is now frozen as `pitching-physics-architecture-v1`: release skill, per-pitch repeatability, catcher lead, pitcher autonomy, batter anticipation, spin decomposition, aerodynamic flight and canonical adjudication all have explicit causal boundaries.

The freeze contract is recorded in `docs/superpowers/specs/2026-09-21-pitching-physics-v1-freeze.md` and exported by `PitchingPhysicsV1`.

Architecture freeze does not freeze coefficient calibration.

However, the pitching **physics calibration** is not ready to declare closed until the following are either implemented or explicitly frozen as future optional extensions:

- speed/spin-dependent baseball drag and lift calibration;
- calibrated spin decay;
- seam-orientation / seam-shifted-wake force, or a deliberate v1 decision to leave it out;
- knuckleball-specific unsteady seam force, or a deliberate v1 exclusion;
- calibration of pitcher-specific coarse-call -> release-space response;
- calibration of anticipation -> recognition-delay timing;
- final validation of aerodynamic swing/contact timing against measured data.

Even after pitching is frozen, **baseball physics as a whole is not closed** until Phase B bat-ball collision calibration and Phase C ground/wall bounce-skid-roll physics are completed or explicitly scoped out.

### 3.4.12 Still missing from pitching

- experimentally calibrated speed/spin-dependent drag over the pitch-speed range;
- seam-orientation-dependent lift/drag;
- generative seam-shifted-wake force;
- calibrated angular-speed decay;
- knuckleball unsteady seam-force model;
- full upstream pitcher biomechanics that generate finger impulses from arm/hand state rather than accepting final finger impulses as input;
- calibration of the new aerodynamic swing-search path;
- calibration of pitcher coarse-call -> release-space response;
- calibration of batter anticipation -> recognition-delay timing;
- replacement of its temporary legacy contact response with the calibrated reduced-order rigid bat contact model.

## 4. Phase B — bat-ball collision

The current capsule collision remains useful, but the realistic model should add the physical quantities that materially change batted-ball speed and spin.

### 4.0 Implemented reduced-order foundation

The first Phase B implementation now exists behind an explicit new contact path and does **not** replace the frozen legacy contact path yet.

Implemented:

- piecewise-linear bat radius profiles, including ordinary or torpedo-like barrel shapes;
- analytic closest-surface search across the tapered profile rather than assuming a constant-radius capsule;
- finite bat mass, center of mass, axial/transverse moments of inertia;
- local surface velocity from bat translation + angular velocity;
- incoming ball surface velocity from ball linear velocity + spin;
- normal impulse from coefficient of restitution and effective mass;
- tangential impulse from effective tangential mass, friction limit, and tangential restitution;
- ball spin generated by the contact impulse itself rather than an arbitrary post-contact spin bonus;
- bat recoil as a rigid-body diagnostic;
- optional measured dynamic effective-mass profile to absorb vibration consequences without deformation state;
- a deterministic end-to-end slice from reduced-order contact directly into aerodynamic flight.

Important boundary:

`normalEffectiveMassProfile` is a reduced experimental/calibration input. When it is used, the returned rigid bat recoil is explicitly marked `rigid_projection_only`; it is not allowed to masquerade as a full vibration solution.

The new path remains opt-in until calibration evidence is strong enough to replace the legacy contact model.

### 4.0.1 Cross/Nathan low-speed validation checkpoint

The reduced-order rigid collision now has a laboratory-geometry regression
fixture based on Cross & Nathan (2006).

The fixture uses the published modified Louisville Slugger properties:

- bat mass 0.989 kg;
- length 0.84 m;
- transverse MOI 0.0460 kg m^2;
- axial MOI 4.39e-4 kg m^2;
- barrel diameter 0.0667 m;
- COM 0.265 m from the barrel end;
- representative impact 0.150 m from the barrel end;
- baseball mass 0.145 kg and diameter 0.072 m.

The rigid effective-mass calculation reproduces the paper's reported recoil
geometry to rounding:

```text
normal recoil factor ry ~= 0.188
tangential recoil factor rx ~= 0.159
```

The low-speed (~4 m/s) measured collision values are retained only as a
validation fixture:

```text
normal COR ey ~= 0.63
tangential COR ex ~= 0.16
ball-bat sliding friction > 0.50
```

With those values, the current solver produces an apparent normal COR near the
reported ~0.37-0.375 and an apparent tangential COR near zero through recoil
and rotational effective mass rather than through an arbitrary spin-retention
bonus.

Important limitation: Cross & Nathan explicitly caution against directly
assuming these low-speed coefficients remain valid at game-speed baseball
impacts. This checkpoint validates the **equations and effective-mass
geometry**, not final MLB/NPB high-speed coefficients.

### 4.1 Tapered bat geometry

A real bat is not a constant-radius capsule.

Represent the bat radius as a function of distance along the longitudinal axis:

```text
radius = r(s)
s in [0, 1]
```

This allows ordinary, torpedo, and future bat profiles without changing the collision architecture.

### 4.2 Effective bat mass and recoil

The current collision treats the local bat velocity as prescribed and applies a fixed restitution directly.

The next model should use:

- ball mass;
- bat mass;
- bat center of mass;
- bat moment of inertia;
- impact location;
- swing angular velocity;
- effective mass at the impact point.

The rigid-body effective-mass calculation is a required baseline, but it is **not by itself the final bat-performance model**. Published bat measurements show that vibration changes the effective mass seen by the ball and that the difference from the perfectly rigid value depends on impact location.

The Core must capture that consequence without simulating deformation explicitly. The planned reduced-order representation is an optional measured/calibrated dynamic effective-mass profile:

```text
impact location s
        ↓
M_eff,dynamic(s)
```

When such a profile is available, it may replace the perfectly-rigid normal effective mass for the ball's normal impulse calculation. It is a coefficient/profile obtained from experiment or a validated bat model, not a finite-element state.

Therefore the permanent hierarchy is:

```text
rigid-body mass / COM / inertia
        ↓ baseline effective mass

measured vibration consequences
        ↓ optional dynamic-effective-mass correction

NO explicit flex/compression state in canonical Core
```

This allows ordinary and torpedo-style mass distributions to differ physically without creating an arbitrary named `sweetSpotBonus`.

### 4.3 Ball surface velocity and incoming spin

Tangential collision velocity must include the velocity of the spinning ball surface at the contact point.

Conceptually:

```text
relative surface velocity
=
(ball COM velocity + omega_ball x contact radius)
-
bat local surface velocity
```

Incoming pitch spin then affects the tangential collision itself rather than being merely added to an outgoing-spin value afterward.

### 4.4 Normal and tangential collision response

Replace the single heuristic `tangentialRetention/spinTransfer` pair with a measured oblique-collision model using:

- normal coefficient of restitution;
- effective tangential response / tangential COR calibrated from deformation-inclusive experiments;
- ball rotational inertia;
- bat recoil;
- contact offset.

Acceptance should target the experimental findings reported by Cross/Nathan and Kensrud/Nathan/Smith:

- squared contact maximizes exit speed;
- squared contact minimizes batted-ball spin;
- launch angle is primarily controlled by centerline offset and secondarily by attack angle;
- off-center contact trades exit speed for spin.

## 5. Phase C — ground and wall interaction

Current ground physics is intentionally simple.

Realistic ground interaction should distinguish:

- infield dirt;
- grass/turf;
- warning track;
- wall/fence materials.

The collision should couple translational and rotational state so topspin/backspin and sidespin affect bounce, skid, and roll.

Do not encode named outcomes such as `high_chop` or `slow_roller`. They must emerge from the same state transition.

### 5.1 Implemented generic surface-contact foundation

A generic reduced-order ball/surface collision solver now exists as
`BallSurfaceContact`.

It applies the same rigid spinning-ball impulse model to any planar surface:

```text
ball COM velocity
+ ball spin
+ contact radius
+ surface normal / velocity
        ↓
normal relative velocity
tangential surface slip
        ↓
normal restitution impulse
+ friction-limited tangential impulse
        ↓
new translation + new spin
```

This single solver can represent ground or wall impact by changing only the
surface normal and calibrated material parameters.

The solver includes:

- normal coefficient of restitution;
- tangential coefficient of restitution;
- Coulomb friction impulse cap;
- translational/rotational coupling through the baseball moment of inertia;
- explicit detection of whether the desired tangential response was reached
  or remained friction-limited sliding;
- moving-surface support.

A low-speed hardwood validation fixture is included from Cross & Nathan (2006):
normal COR 0.59, tangential COR 0.17, and friction coefficient 0.31 used only
as the reported lower-bound fixture. It is **not** treated as a grass/dirt
field calibration.

The physical surface solver is now also integrated as an **optional**
`groundSurfacePhysics` path in `BallFlight`. The frozen legacy ground
response remains the default compatibility path.

Empirical calibration targets are now recorded separately from internal
contact coefficients:

- Pennbounce baseball playing-surface pace (Brosnan/McNitt et al.):
  - Astroturf mean total-speed ratio: 0.562;
  - skinned infield: 0.537;
  - Fieldturf: 0.487;
  - natural turfgrass: 0.378;
  - 31.0 and 40.2 m/s hand-tested velocity targets are retained because the
    surfaces show different speed dependence;
  - 0.44 and 0.61 rad incidence-angle targets are retained because surface
    pace changes materially with impact angle;
- Takashima et al. (2015) historical NPB rigid-wall reference:
  - 75 m/s;
  - desired reported ball COR 0.4134.

These published pace values are validation observables, **not** copied directly
into `normalRestitution`. `BaseballSurfacePaceModel` explicitly converts
the internal normal/tangential/friction model to the published total rebound
speed ratio for fitting.

Still required before Phase C can close:

- fit/version infield dirt contact parameters against surface-pace data;
- fit/version natural grass and artificial-turf parameters;
- warning-track profile;
- padded / hard-wall profiles;
- continuous post-bounce skid-to-roll / rolling resistance refinement.

## 6. Phase D — empirical calibration

Calibration is not outcome tuning.

Use physical observables:

- exit velocity;
- launch angle;
- spray angle;
- spin rate and axis where available;
- hang time;
- apex;
- landing distance;
- ground-bounce speed;
- roll distance.

Statcast can be used as an external validation distribution, while laboratory collision/aerodynamic measurements constrain the local physical equations.

The calibration objective is:

```text
same physical inputs
        ↓
realistic physical observables
        ↓
baseball outcomes emerge
```

Never:

```text
desired batting average / home-run rate
        ↓
secretly change trajectory
```

League-level output statistics may be used as a final validation layer only after the physical observables are credible.

## 7. Determinism and product boundary

All realism work remains inside Shared Match Core.

Requirements:

- same inputs and same Core version -> same state sequence;
- integer canonical ticks remain authoritative;
- no renderer input affects physics;
- Mini and Natural read the same canonical trajectory;
- coefficient/profile changes are explicit versioned inputs;
- random ball-to-ball variation, if later added, comes from deterministic Core RNG streams with stable identifiers.

## 8. Immediate next physics slices

The preferred order is:

1. finish and verify Phase A reference aerodynamics;
2. finish the realistic pitch-flight path and validate active/gyro movement against published pitch data;
3. implement tapered bat geometry + rigid-body effective-mass contact without explicit deformation;
4. replace heuristic tangential spin transfer with measured oblique collision response;
5. add surface-specific bounce/skid/roll;
6. adopt spin/speed/orientation-dependent aerodynamic coefficients after calibration against the 2022 measurements;
7. add seam-orientation / seam-shifted-wake physics only after a validated generative model is available;
8. build a deterministic physics-validation corpus against published laboratory and Statcast observables.

This order attacks the largest current physical omissions without destabilizing the already-verified causal rule/fielding architecture.
