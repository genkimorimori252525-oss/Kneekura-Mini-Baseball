# Baseball Physics v1 — Production Closure

Date: 2026-09-22

Status: **production profile promoted; architecture remains frozen**

Architecture: `baseball-physics-architecture-v1`

Production profile: `baseball-reality-profile-v1`

## 1. Closure result

The v1 causal architecture is no longer waiting on an open calibration gate.

`evaluateCurrentBaseballPhysicsV1Readiness()` is now required to return:

- `architectureFrozen = true`;
- `validationPassed = true`;
- `openGateIds = []`;
- the exact acknowledged set of explicitly scoped-out field-material gates;
- `readyForDefaultPromotion = true`.

This is a mechanical release decision. A new open gate, a changed scope-out set, or a failing release corpus closes promotion again.

## 2. What was promoted

The promoted entry point is `createCurrentBaseballPhysicsV1ProductionProfile(...)`.

It selects the evidence-backed global physics that are defensible for v1:

- the frozen architecture;
- the realistic baseball rigid body;
- weather-derived atmosphere and Reynolds-aware seam-averaged aerodynamics;
- aerodynamic spin decay in both pitch and batted-ball free flight;
- the Nathan 2012 same-fixture high-speed local wood-contact response;
- the existing causal rigid-bat collision, flight, surface-contact, skid/roll, wall-contact and rule paths.

The production constructor is guarded by the readiness evaluation. It must not silently create a production profile while readiness is false.

## 3. Wood-bat production contact decision

v1 does not create a synthetic universal wooden-bat curve by joining unrelated low-speed and high-speed studies.

The frozen local contact profile is `nathan-2012-rigid-wood-local-contact`, version `nathan-2012-47-impact-fit-v1`.

It represents one same-fixture high-speed fit from Nathan et al. 2012:

- rigidly mounted three-inch wood cylinder;
- 47 non-gross-slip impacts in the fitted set;
- documented high-speed envelope represented by 85–120 mph knots;
- normal restitution `e_y = 0.52`;
- tangential restitution `e_x = 0.30 ± 0.02`;
- gross-slip friction approximately `mu = 0.15`.

Those numbers are the local reduced-order contact response only. `RigidBatBallContact` still provides finite bat mass, inertia, recoil, impact location and surface velocity.

## 4. Explicitly scoped-out universal coefficients

The following gates are closed by explicit scope-out, not by invented numbers:

- `infield_dirt_material_profile`;
- `natural_grass_material_profile`;
- `artificial_turf_material_profile`;
- `warning_track_material_profile`;
- `wall_padding_material_profile`;
- `sliding_friction_calibration`;
- `rolling_resistance_calibration`.

The adopted experiments often constrain combined rebound pace or whole-trajectory behavior without uniquely separating normal restitution, tangential restitution, sliding friction and rolling resistance. Warning-track and padded-outfield-wall baseball-response data are also not sufficiently specific in the adopted evidence set.

Therefore a production ballpark must supply explicit versioned material profiles for its actual physical surfaces. The promoted constructor requires those field materials instead of falling back to compatibility constants.

## 5. Pitching closure

The seam-averaged v1 pitching calibration is satisfied. `aerodynamic_spin_decay` is now an included v1 causal layer rather than a stale deferral.

Still deferred by architecture-v1:

- seam-shifted-wake force;
- knuckleball-specific unsteady seam force;
- full arm/hand/tendon biomechanics.

Those are future versioned architecture extensions, not hidden missing coefficients in the current production claim.

## 6. Final release validation

The final release corpus is `baseball-physics-v1-release-validation-v1`.

It combines source-level coefficient regression with deterministic integrated observable cases for:

1. pitch-path aerodynamic spin decay;
2. game-speed high-speed wood oblique contact;
3. batted-ball free-flight spin decay;
4. Tahara natural-turf hard-ball vertical rebound;
5. no-slip rolling kinematics with explicit rolling deceleration;
6. Takashima rigid-wall rebound.

Every target carries an explicit source/version and tolerance. The corpus has deterministic case fingerprints and a deterministic corpus fingerprint.

League outcomes such as batting average, ERA or home-run rate remain forbidden as hidden physics targets.

## 7. Compatibility boundary

The old low-level ball-flight constants remain available as `COMPATIBILITY_BALL_FLIGHT_PARAMETERS_V0` for deterministic legacy fixtures and migration.

They are not the promoted production entry point. New production callers should construct `baseball-reality-profile-v1` through the guarded constructor and select the actual field-segment material for ground/wall contact.

## 8. Verification evidence

Pre-closure verification checkpoints:

- P0 Core #1449 — success at `662f3f3a8bc46ca243c18ba14faff874cb2349c2`;
- P0 Core #1450 — success at `88f87d71d4aab5f9e320ba2570e72851de65ab11`;
- P0 Core #1451 — success at `d690f83cd9c9e2170359403349948569cdd1931e`.

A final workflow run is required on the exact closure-documentation head before PR #3 is considered fully evidenced.

## 9. Final interpretation

- causal architecture: frozen;
- global v1 contact/aerodynamic calibration: closed;
- universal ballpark-material coefficients: intentionally not claimed;
- end-to-end release validation: green;
- production reality-profile entry point: promoted;
- legacy compatibility parameters: retained and explicitly named.

This closes the v1 realism calibration plan without pretending that one universal field surface can represent every ballpark.