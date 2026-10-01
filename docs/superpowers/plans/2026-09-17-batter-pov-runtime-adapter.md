# Batter POV Runtime Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed-fixture-only presentation boundary with reusable Mini Baseball runtime sample types, batter camera projection, bunt-capable bat presentation state, and contact-driven hard-cut timeline generation.

**Architecture:** Add a presentation-only package under `src/presentation/mini`. Core remains authoritative and unchanged. The adapter consumes `CanonicalWorldSnapshot`, batter presentation metadata, and `TimedMatchEvent[]`; it preserves canonical positions and duplicates the exact contact sample only for the same-tick Batter POV → Field Overhead hard cut.

**Tech Stack:** TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-17-batter-pov-runtime-and-bunt-design.md`

## Global Constraints

- Standard presentation cadence is `55_000` microseconds.
- No position interpolation or rerolling.
- Live `BatBallContact` requires an exact canonical sample at the event tick.
- Right/left handedness changes the batter camera, not the canonical field.
- Bunt uses common bat rendering with action-specific canonical grip/tip pose.

---

### Task 1: Runtime presentation model

**Files:**
- Create: `src/presentation/mini/model.ts`
- Create: `src/presentation/mini/model.test.ts`

**Interfaces:**
- Consumes: `Vec3`, `CanonicalWorldSnapshot`, `TimedMatchEvent`.
- Produces: `BatterHandedness`, `BatActionType`, `BatPose`, `BatterPresentationState`, `CanonicalPresentationSample`, `MiniPresentationFrame`.

- [ ] Write failing tests for bunt action values and immutable sample structure.
- [ ] Run the focused test and confirm failure because the module does not exist.
- [ ] Implement the minimal presentation types and cadence constant.
- [ ] Run the focused test and confirm pass.

### Task 2: Batter camera adapter

**Files:**
- Create: `src/presentation/mini/BatterPovCamera.ts`
- Create: `src/presentation/mini/BatterPovCamera.test.ts`

**Interfaces:**
- Consumes: `BatterHandedness`, `Vec3`, `BatPose`.
- Produces: `createBatterPovCamera()`, `projectWorldToBatterPov()`, `projectBatPoseToBatterPov()`.

- [ ] Write failing tests proving right/left eye X mirroring and mirrored projection of mirrored points.
- [ ] Run the focused test and confirm failure.
- [ ] Implement the perspective projection and logical-grid quantization.
- [ ] Add a bunt-pose projection test proving the same bat projector accepts a near-horizontal grip/tip pose.
- [ ] Run the focused test and confirm pass.

### Task 3: Contact-driven timeline adapter

**Files:**
- Create: `src/presentation/mini/MiniPresentationTimeline.ts`
- Create: `src/presentation/mini/MiniPresentationTimeline.test.ts`

**Interfaces:**
- Consumes: ordered `CanonicalPresentationSample[]`, `TimedMatchEvent[]`.
- Produces: `buildMiniPresentationTimeline()`.

- [ ] Write failing tests for live contact same-tick hard cut, non-live contact staying Batter POV, missing exact contact sample error, and canonical sample identity preservation.
- [ ] Run focused tests and confirm failure.
- [ ] Implement timeline generation with no interpolation.
- [ ] Run focused tests and confirm pass.

### Task 4: Public presentation exports and verification

**Files:**
- Create: `src/presentation/mini/index.ts`
- Create: `src/presentation/index.ts`

- [ ] Export the Mini presentation API.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm test`.
- [ ] Run `npm run verify` and confirm zero failures.
