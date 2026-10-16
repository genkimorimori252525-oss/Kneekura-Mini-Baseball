# Contact Physics Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first deterministic causal bat-ball contact and post-contact ball-flight slice that produces canonical snapshots consumable by the existing Mini Presentation Adapter.

**Architecture:** Add a small Core-only contact model, a minimal gravity/ground flight integrator, and a vertical-slice orchestration function. Normal swings and bunts share the same collision function; their results differ only because bat pose and bat velocity differ. Core returns canonical snapshots/events and does not import Presentation.

**Tech Stack:** TypeScript 5.5, Vitest 2, existing Core model types.

**Spec:** `docs/superpowers/specs/2026-09-17-contact-physics-vertical-slice-design.md`

## Global Constraints

- Deterministic: no random values.
- Integer ticks remain authoritative.
- No result-label-driven contact generation.
- Normal swing and bunt use the same contact equation.
- Minimal flight includes gravity and simple ground response only.
- Core must not import `src/presentation`.
- `npm run verify` must pass.

---

### Task 1: Bat-ball contact model

**Files:**
- Create: `src/core/sim/contact/BatBallContact.test.ts`
- Create: `src/core/sim/contact/BatBallContact.ts`

**Interfaces:**
- Produces: `PitchWorldState`, `BatPose`, `BatterSwingState`, `ContactParameters`, `BatBallContactResult`, `resolveBatBallContact()`.

- [ ] **Step 1: Write failing tests**

Test a miss, deterministic repeatability, and two contacts with the same collision equation where a fast normal swing produces higher exit speed than a low-speed bunt pose.

- [ ] **Step 2: Run CI and verify RED**

Expected: type/test failure because `BatBallContact.ts` does not exist.

- [ ] **Step 3: Implement capsule-vs-sphere contact**

Use closest point on bat segment, local bat velocity, relative normal/tangent decomposition, restitution, and friction.

- [ ] **Step 4: Verify contact tests GREEN**

Run: `npm run verify`

Expected: all tests pass.

### Task 2: Minimal post-contact ball flight

**Files:**
- Create: `src/core/sim/ball/BallFlight.test.ts`
- Create: `src/core/sim/ball/BallFlight.ts`

**Interfaces:**
- Consumes: `BattedBallInitialState`.
- Produces: `BallFlightParameters`, `advanceBallState()`, `sampleBallFlight()`.

- [ ] **Step 1: Write failing tests**

Test gravity, deterministic repeatability, and ground bounce/friction.

- [ ] **Step 2: Run CI and verify RED**

Expected: failure because the ball-flight implementation does not exist.

- [ ] **Step 3: Implement minimal flight**

Advance with fixed deterministic time steps; apply gravity, clamp to ball radius on ground crossing, reflect vertical velocity with restitution, and damp horizontal velocity.

- [ ] **Step 4: Verify ball-flight tests GREEN**

Run: `npm run verify`

Expected: all tests pass.

### Task 3: Canonical vertical-slice orchestration

**Files:**
- Create: `src/core/sim/plateAppearance/ContactVerticalSlice.test.ts`
- Create: `src/core/sim/plateAppearance/ContactVerticalSlice.ts`
- Modify: `src/core/index.ts`

**Interfaces:**
- Consumes: contact input, defenders/runners, sample cadence/duration.
- Produces: `ContactVerticalSliceResult` containing `contact`, `initialBall`, `snapshots`, and `events`.

- [ ] **Step 1: Write failing tests**

Test exact contact snapshot, `BatBallContact` event payload, stable defenders/runners, deterministic repeatability, and normal-vs-bunt exit-speed difference through the vertical-slice API.

- [ ] **Step 2: Run CI and verify RED**

Expected: failure because vertical-slice API does not exist.

- [ ] **Step 3: Implement orchestration**

Resolve contact once, create the exact contact snapshot/event, sample post-contact flight at the requested cadence, and preserve defender/runner state unchanged.

- [ ] **Step 4: Export Core API**

Export the new contact, flight, and vertical-slice modules from `src/core/index.ts`.

- [ ] **Step 5: Run full verification**

Run: `npm run verify`

Expected: TypeScript passes and all Vitest suites pass.
