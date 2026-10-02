# Baseball Physics Architecture v1 Freeze

Date: 2026-09-21

Status: **historical freeze snapshot; causal architecture frozen; calibration and production promotion were still open at this checkpoint**

Successor closure: `docs/superpowers/specs/2026-09-22-baseball-physics-v1-production-closure.md` records the completed production-readiness gate and promoted v1 reality-profile entry point.

Version:

```text
baseball-physics-architecture-v1
```

## 1. Frozen causal graph

The authoritative realism architecture is now:

```text
manager macro intent
        ↓
catcher lead
        ↓
pitcher accepts / overrides
        ↓
pitcher-owned pitchSkillId
+ pitcher-specific release response
+ deterministic repeatability
        ↓
finger / release mechanics
        ↓
release velocity + spin + seam orientation
        ↓
pitch drag + Magnus + gravity + wind
        ↓
batter anticipation / recognition timing
        ↓
physical swing state
        ↓
tapered rigid/reduced-order bat-ball contact
        ↓
exit velocity + spin
        ↓
batted-ball aerodynamics
        ↓
surface material response
        ↓
bounce / skid / roll / wall impact
        ↓
canonical baseball events and rules
```

No human-readable pitch type, batted-ball label, hit type, or presentation mode
is allowed to feed backward into the physical result.

## 2. Frozen architecture rules

1. Pitch names are downstream metadata only.
2. Mini and Natural observe the same canonical physics.
3. Exact outcome labels never select a trajectory or collision result.
4. Explicit bat/ball finite-element deformation is outside canonical v1.
5. Real deformation/vibration consequences may enter only through measured
   reduced-order coefficients or profiles.
6. Bat-ball collision uses finite mass, COM, inertia, impact location, surface
   velocity, normal/tangential impulse and spin transfer through momentum.
7. Collision coefficients may depend on measured pre-impact kinematics through
   versioned calibration resolvers.
8. Batted-ball flight uses the same physical state produced by contact.
9. Ground and wall impacts use the same spinning-ball surface impulse model.
10. Surface materials are versioned data and may depend on impact speed and
    incidence angle.
11. Ground skid is finite-duration physical motion; no-slip rolling is a state
    reached through friction, not an immediate named outcome.
12. Integer canonical ticks and deterministic Core RNG remain authoritative.
13. Rule adjudication remains a single canonical rules path.

## 3. Architecture included in v1

- `pitching-physics-architecture-v1`;
- pitcher-specific learned release skills and repeatability;
- catcher lead and pitcher sign autonomy;
- batter anticipation timing;
- Active/True Spin and Gyro Spin decomposition;
- deterministic pitch aerodynamics;
- tapered rigid/reduced-order bat-ball contact;
- measured baseball rotational inertia option;
- speed-dependent evidence-backed wood-bat contact response;
- aerodynamic rigid-bat swing contact search;
- canonical rigid-contact adapter;
- aerodynamic batted-ball flight;
- unified `BallSurfaceMaterial`;
- speed- and angle-dependent material response grids;
- spin-coupled ground/wall impulses;
- finite skid-to-roll transition;
- rolling resistance;
- deterministic planar wall/fence contact timing.

## 4. Explicit v1 deferrals

The following remain outside v1 instead of being approximated by hidden bonuses:

- explicit bat/ball deformation state;
- finite-element contact simulation;
- generative seam-shifted-wake force;
- knuckleball-specific unsteady seam force;
- full arm/hand/tendon biomechanics.

A future implementation may add these only through an explicit versioned
architecture extension.

## 5. Calibration gates still open

Architecture freeze is **not** production closure.

The opt-in realistic paths must not replace frozen compatibility defaults until
the following are either calibrated or explicitly scoped out:

- wood-bat production contact parameters;
- infield dirt material profile;
- natural-grass material profile;
- artificial-turf material profile;
- warning-track material profile;
- wall/padding material profiles;
- sliding-friction calibration;
- rolling-resistance calibration;
- remaining pitching coefficient calibration;
- deterministic end-to-end validation corpus.

Pennbounce total rebound-speed observations are underdetermined with respect to
normal COR, tangential COR and friction. `PennbounceEquivalentSurfaceFit`
therefore exposes its tangential/friction assumptions and reports
boundary-limited fits rather than pretending the data uniquely identify a
material.

## 5.1 Validation-corpus boundary

`PhysicsObservableValidation` now defines the production-closure evidence
format.

A validation case contains only physical observables such as:

- pitch plate position/speed;
- exit velocity;
- launch/spray angle;
- spin;
- hang time/apex/landing distance;
- ground rebound speed/transit/roll distance;
- wall rebound speed.

Every target must carry:

- source id;
- source version;
- explicit absolute and/or relative tolerance.

The Core does **not** invent a default tolerance. The tolerance belongs to the
measurement/evidence contract.

A multi-case corpus receives a deterministic canonical fingerprint. This lets
the final promotion decision be reproducible while still preventing league
outcomes such as batting average, ERA or home-run rate from becoming hidden
physics targets.

## 5.2 Reality-profile boundary

`BaseballRealityProfileV1` is the explicit configuration boundary for
evidence-backed physical play.

A reality profile must carry:

- measured/weather-derived atmosphere;
- the realistic baseball rigid-body properties;
- a versioned, bat-specific wood-bat speed-response profile;
- explicit field material profiles for infield dirt, natural grass, warning
  track and wall, plus artificial turf when the ballpark uses it.

The profile intentionally has **no universal field surface**. A batted ball
must select the actual surface segment it is contacting.

Likewise, the profile does not invent a generic wooden-bat speed law. The
bat-speed response must come from one bat/construction or a justified
population with explicit evidence ids.

This boundary exists so that “reality mode” cannot silently fall back to
compatibility constants while appearing to run the evidence-backed model.

## 5.3 Current closure ledger

`CurrentBaseballPhysicsV1Closure` records the present evidence state for every
production calibration gate.

The ledger intentionally distinguishes:

- physics already implemented;
- evidence already retained;
- evidence still missing before a production coefficient/profile can be
  defended.

A gate remains `open` when the equations exist but the available experiments
do not uniquely identify the required production parameters. This is
especially important for field surfaces, where total surface pace alone cannot
separate normal restitution, tangential restitution and friction.

The current ledger therefore prevents architecture completion from being
misreported as empirical calibration completion.

## 6. Promotion rule

`BaseballPhysicsProductionReadiness` now makes promotion mechanical rather
than conversational.

Default promotion requires:

- the frozen `baseball-physics-architecture-v1`;
- one explicit evidence record for every v1 calibration gate;
- no gate left `open`;
- a passing `PhysicsObservableValidation` corpus;
- explicit acknowledgement before any gate marked
  `explicitly_scoped_out` can count as closed.

There is no implicit “good enough” state. Missing evidence is an error, and
league outcomes are not accepted as substitutes for physical-observable
validation.



The v1 causal architecture is now frozen.

The new physical paths remain opt-in until empirical calibration gates are
satisfied and a final verification corpus is green.

At that point the production change should be a **profile/default promotion**,
not another physics rewrite.