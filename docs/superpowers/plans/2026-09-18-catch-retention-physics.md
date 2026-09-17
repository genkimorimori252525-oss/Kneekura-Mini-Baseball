# Catch Retention Physics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic first-order catch-retention model that turns physical glove-ball contact into either exact secure possession or a physically continued live ball without using direct catch-success probabilities.

**Architecture:** `GloveBallContact` remains responsible only for contact feasibility/timing. A new focused `CatchRetention` module consumes the contact-time ball/glove states plus pocket offset and body stability, computes physically interpretable retention load from relative translational and rotational kinetic energy, compares it with an effective energy capacity, then returns either a secure `CatchOutcome` with an exact settling tick or a failed `CatchOutcome` with a post-contact live-ball state. All tunable physical behavior is supplied through explicit calibration parameters; no player-rating-to-success-percent conversion or hidden randomness is introduced.

**Tech Stack:** TypeScript, Vitest, existing integer-microsecond Core clock, `CatchOutcome`, `quantizeEventTick`.

**Spec:** `docs/superpowers/specs/2026-09-17-time-running-catching-perception-umpire-design.md`

## Global Constraints

- Canonical event time remains integer microseconds and must be deterministic across renderer cadence.
- Catching is split into Contact Feasibility and Secure Possession; glove contact alone never establishes a catch.
- `catching` must affect intermediate physical tolerances/errors rather than act as a direct success probability.
- Failed catches keep a live ball with authoritative position, velocity, spin, and tick.
- High-degree-of-freedom glove deformation is not simulated; effective contact region, damping, and retention tolerance are compressed into calibrated parameters.
- No hard-coded real-world calibration constants are introduced by this task; tests may use explicit fixture values.

---

### Task 1: Retention load and effective capacity

**Files:**
- Create: `src/core/sim/fielding/CatchRetention.ts`
- Test: `src/core/sim/fielding/CatchRetention.test.ts`

**Interfaces:**
- Consumes: `LiveBallState`, `GloveWorldState`, `Vec3`.
- Produces: `evaluateCatchRetentionLoad(contact, parameters)` and diagnostic energy/capacity values used by the resolver.

- [ ] **Step 1: Write the failing tests**

Add tests proving that relative translational kinetic energy contributes to load, ball spin contributes rotational kinetic energy, body instability reduces effective capacity, and an off-center pocket contact reduces effective capacity without any random draw.

- [ ] **Step 2: Run verification and confirm RED**

Run: `npm run verify`

Expected: typecheck/test failure because `CatchRetention` does not exist yet.

- [ ] **Step 3: Implement the minimal deterministic evaluator**

Use:

```ts
relativeVelocity = ball.velocity - glove.velocity
translationalEnergyJ = 0.5 * ballMassKg * |relativeVelocity|^2
sphereInertia = (2 / 5) * ballMassKg * ballRadiusM^2
rotationalEnergyJ = 0.5 * sphereInertia * |spin|^2
retentionLoadJ = translationalEnergyJ + rotationalEnergyJ
pocketFactor = sqrt(max(0, 1 - (pocketOffsetMeters / pocketRadiusMeters)^2))
effectiveCapacityJ = centerRetentionCapacityJ * bodyStability * pocketFactor
```

Validate finite vectors, positive mass/radii/capacity, `bodyStability` in `[0, 1]`, and non-negative pocket offset.

- [ ] **Step 4: Run verification and confirm GREEN**

Run: `npm run verify`

Expected: all existing tests plus the new load/capacity tests pass.

- [ ] **Step 5: Commit**

Commit message: `feat: model deterministic catch retention load`

---

### Task 2: Secure-possession path and exact settle tick

**Files:**
- Modify: `src/core/sim/fielding/CatchRetention.ts`
- Modify/Test: `src/core/sim/fielding/CatchRetention.test.ts`

**Interfaces:**
- Consumes: load/capacity diagnostics from Task 1, `createSecuredCatchOutcome`, `quantizeEventTick`.
- Produces: `resolveCatchRetention(contact, parameters)` returning `CatchRetentionResolution`.

- [ ] **Step 1: Write the failing secure-path test**

Use an explicit fixture where a centered, stable contact has `7.25 J` translational load, `10 J` capacity, and `725 W` capture dissipation power. Require secure possession exactly `10,000 us` after contact.

- [ ] **Step 2: Run verification and confirm RED**

Run: `npm run verify`

Expected: failure because `resolveCatchRetention` is not implemented.

- [ ] **Step 3: Implement minimal secure resolution**

When `retentionLoadJ <= effectiveCapacityJ`, compute:

```ts
settleSeconds = retentionLoadJ / captureDissipationPowerW
secureTick = quantizeEventTick(contactTick, settleSeconds, ticksPerSecond)
```

Return `createSecuredCatchOutcome(contactTick, secureTick)` plus diagnostics. Zero load secures at the contact tick. Do not introduce a fixed catch delay.

- [ ] **Step 4: Run verification and confirm GREEN**

Run: `npm run verify`

Expected: secure path and all prior tests pass.

- [ ] **Step 5: Commit**

Commit message: `feat: resolve secure catch settling time`

---

### Task 3: Failed-retention live-ball deflection

**Files:**
- Modify: `src/core/sim/fielding/CatchRetention.ts`
- Modify/Test: `src/core/sim/fielding/CatchRetention.test.ts`

**Interfaces:**
- Consumes: contact normal, ball/glove contact-time states, failure calibration values.
- Produces: `createLiveBallCatchOutcome(contactTick, postContactBall)` with deterministic velocity/spin.

- [ ] **Step 1: Write failing failure-path tests**

Cover three causal flips: lower body stability, large pocket offset, and added spin can each turn the same basic catch into a failed retention. Add one exact deflection test proving the returned ball remains live at `contactTick` with deterministic post-contact velocity/spin.

- [ ] **Step 2: Run verification and confirm RED**

Run: `npm run verify`

Expected: tests fail because failure resolution is absent.

- [ ] **Step 3: Implement deterministic deflection**

Normalize `contactNormal`. Split relative velocity into normal and tangential components. For an approaching normal component, apply `failedContactRestitution` to reverse/dampen the normal component; apply `failedTangentialDamping` to the tangential component; then add glove velocity back. Apply `failedSpinDamping` to spin. All three calibration values must be in `[0, 1]`.

Return a `live-ball` outcome at `contactTick`; do not delete or summarize the ball as a result-only failure.

- [ ] **Step 4: Run verification and confirm GREEN**

Run: `npm run verify`

Expected: all catch-retention and existing tests pass.

- [ ] **Step 5: Commit**

Commit message: `feat: continue live ball after failed retention`

---

### Task 4: Shared Core API and full regression gate

**Files:**
- Modify: `src/core/index.test.ts`
- Modify: `src/core/index.ts`

**Interfaces:**
- Consumes: `resolveCatchRetention`, `evaluateCatchRetentionLoad`.
- Produces: stable shared Core exports for later body/fielding simulation integration.

- [ ] **Step 1: Add failing Core API export test**

Require both new functions through `src/core/index.ts`.

- [ ] **Step 2: Run verification and confirm RED**

Run: `npm run verify`

Expected: typecheck failure for missing exports.

- [ ] **Step 3: Export the module**

Add:

```ts
export * from './sim/fielding/CatchRetention';
```

- [ ] **Step 4: Run the full verification gate**

Run: `npm run verify`

Expected: `tsc --noEmit` succeeds and every Vitest file/test passes.

- [ ] **Step 5: Commit**

Commit message: `feat: export catch retention physics from Core`
