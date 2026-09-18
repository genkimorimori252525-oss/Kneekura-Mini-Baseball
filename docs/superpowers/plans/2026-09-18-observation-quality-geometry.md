# Observation Quality and Geometry Implementation Plan

**Goal:** Convert selected canonical physical facts into deterministic player observations whose confidence/error emerge from view geometry, distance, relative motion, occlusion, attention, observation duration, and perception ability.

**Architecture:** Decision code still receives only `PlayerPerceivedWorldState`. A dedicated perception-capture boundary is allowed to inspect selected physical target facts, computes normalized quality factors, optionally applies compact occlusion geometry, and emits `ObservationSample` values. The canonical snapshot itself is never embedded in perceived state.

**Principles**

- Observation quality is an intermediate measurement quantity, not a success percentage.
- Hard invisibility comes only from causal visibility conditions such as outside configured FOV or complete occlusion.
- Player perception/awareness changes measurement fidelity/error, never canonical position/velocity.
- Every numeric curve is explicit calibration input.
- Random error uses named `perception` RNG streams and a fixed draw count.
- Renderer/FPS never participates.
- No ray-traced rendering is required.

---

### Task 1: Deterministic view geometry quality

**Files**
- Create: `src/core/sim/perception/ObservationGeometry.ts`
- Create/Test: `src/core/sim/perception/ObservationGeometry.test.ts`

Implement:
- observer 3D position/forward/velocity;
- target 3D position/velocity;
- distance;
- off-axis view angle;
- FOV quality: 1 inside full-quality half-angle, 0 outside maximum half-angle, explicit interpolation between;
- distance quality: 1 through full-quality distance, 0 at/beyond max observable distance;
- relative-speed quality: 1 below configured full-quality relative speed, 0 at/beyond configured maximum.

Reject zero forward vectors and invalid/non-finite calibration values.

### Task 2: Compact occlusion geometry

**Files**
- Create: `src/core/sim/perception/Occlusion.ts`
- Create/Test: `src/core/sim/perception/Occlusion.test.ts`

Use explicit spherical occluders as a compact physical approximation:
`{ center: Vec3, radiusMeters: number }`.

A blocker only occludes if the observer-target segment intersects it between observer and target. Return a normalized visibility fraction:
- no blocker => 1;
- blocker fully covering target ray => 0.

This first boundary is deliberately binary; partial-body visibility remains future calibration rather than fake precision.

### Task 3: Compose observation quality

**Files**
- Create: `src/core/sim/perception/ObservationQuality.ts`
- Create/Test: `src/core/sim/perception/ObservationQuality.test.ts`

Inputs:
- FOV, distance, relative-speed, occlusion visibility;
- attended/peripheral factor;
- observation duration factor;
- normalized perception ability.

Composition:
- causal visibility gate = FOV * occlusion;
- remaining fidelity factors use explicit non-negative weights and a weighted arithmetic mean;
- ability is mapped through explicit `minimumAbilityQuality` so a low rating does not imply literal blindness.

Output includes every component plus total quality for debug/replay calibration.

### Task 4: Deterministic noisy observation capture

**Files**
- Create: `src/core/sim/perception/ObservationCapture.ts`
- Create/Test: `src/core/sim/perception/ObservationCapture.test.ts`

Implement planar and spatial moving-target capture.

Use fixed-draw symmetric triangular error:
`(u1 - u2) * errorScale`
per coordinate, avoiding stochastic pass/fail.

Quality interpolates explicit min/max position and velocity error amplitudes. Quality 1 can still retain configured minimum human error. Quality below an explicit deterministic detection threshold returns `null`.

The result is an `ObservationSample`; canonical truth is never modified.

### Task 5: Shared Core API and regression

**Files**
- Modify: `src/core/index.test.ts`
- Modify: `src/core/index.ts`

Expose geometry, occlusion, quality composition, and observation capture via Core API. Run full `npm run verify` and preserve all previous runner/fielding/perception tests.

### Deferred

- player-body/camera-specific occluder generation;
- partial occlusion fraction;
- head/eye turn dynamics;
- empirical calibration of FOV/error curves;
- attention switching policy;
- specialized runner/defender decision policy.
