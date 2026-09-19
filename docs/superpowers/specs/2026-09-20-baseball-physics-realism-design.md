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

## 4. Phase B — bat-ball collision

The current capsule collision remains useful, but the realistic model should add the physical quantities that materially change batted-ball speed and spin.

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
2. implement tapered bat geometry + rigid-body effective-mass contact without explicit deformation;
3. replace heuristic tangential spin transfer with measured oblique collision response;
4. add surface-specific bounce/skid/roll;
5. adopt spin/speed/orientation-dependent aerodynamic coefficients after calibration against the 2022 measurements;
6. build a deterministic physics-validation corpus against published laboratory and Statcast observables.

This order attacks the largest current physical omissions without destabilizing the already-verified causal rule/fielding architecture.
