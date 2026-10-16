# Batter POV Drone-Art Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone mobile-friendly HTML prototype that reproduces the Mini Baseball Drone-Art presentation in batter first-person view, then hard-cuts to the overhead field view on the exact contact frame.

**Architecture:** Keep the prototype presentation-only. A deterministic fixed sample timeline drives both camera modes; renderers read the same sample state and never decide baseball outcomes. The batter view uses perspective projection onto a 4px display grid, while the field view uses the existing overhead grid mapping. Controls advance exactly one presentation sample at a time or play samples every 55ms.

**Tech Stack:** Standalone HTML/CSS/JavaScript, SVG rendering, no external dependencies.

**Spec:** `docs/superpowers/specs/2026-09-17-batter-pov-drone-art-design.md`

## Global Constraints

- Base display coordinate system: `600 x 430`.
- Presentation grid: `4px` equivalent.
- Presentation cadence: `55ms` per regular display sample.
- No CSS position transitions, tweening, easing, or visual interpolation.
- Insert an exact contact sample between regular cadence samples when needed.
- Camera cut is instantaneous at the contact sample.
- Prototype trajectory is presentation test data, not authoritative product physics.
- Prototype must remain usable on a narrow mobile viewport.

---

### Task 1: Build the deterministic sample timeline and render contract

**Files:**
- Create: `/mnt/data/mini-baseball-batter-pov-prototype.html`

**Interfaces:**
- Consumes: fixed prototype configuration only.
- Produces: `TIMELINE`, `renderFrame(index)`, and `setPlaying(boolean)` used by the UI controls.

- [ ] **Step 1: Define fixed presentation samples**

Create a 48-frame timeline with a batter-POV phase, one explicit contact frame, and an overhead phase. Every frame contains `timeMs`, `camera`, `ball`, and `label`; the contact frame additionally contains `event: "BatBallContact"`.

- [ ] **Step 2: Assert deterministic invariants in JavaScript**

At startup, validate that regular pre-contact samples differ by `55ms`, exactly one contact event exists, all screen-space coordinates snap to 4px, and every frame after contact uses `FIELD_OVERHEAD`.

- [ ] **Step 3: Render frame 0 without animation**

Call `renderFrame(0)` once. No timer starts automatically.

---

### Task 2: Implement Batter POV SVG rendering

**Files:**
- Modify: `/mnt/data/mini-baseball-batter-pov-prototype.html`

**Interfaces:**
- Consumes: one `BATTER_POV` timeline frame.
- Produces: SVG elements for pitcher, mound, strike-zone guide, home plate, ball, and minimal bat silhouette.

- [ ] **Step 1: Draw the batter-view field geometry**

Use a dark presentation surface with subtle perspective foul lines, home plate near the lower center, mound/pitcher near the upper center, and a low-contrast strike-zone guide.

- [ ] **Step 2: Project and quantize the ball**

Render the ball from each frame's already-computed projected coordinates. Snap x/y and radius to the 4px visual grid. Do not interpolate between samples.

- [ ] **Step 3: Keep the batter body out of the way**

Show only a restrained bat/hand cue along the lower edge so the pitcher and ball remain the visual focus.

---

### Task 3: Implement exact-contact hard cut and overhead field rendering

**Files:**
- Modify: `/mnt/data/mini-baseball-batter-pov-prototype.html`

**Interfaces:**
- Consumes: one `FIELD_OVERHEAD` timeline frame.
- Produces: overhead diamond, nine defenders, batter-runner, ball trail, and current ball marker.

- [ ] **Step 1: Draw the existing Drone-Art overhead geometry**

Use the same `600 x 430` coordinate system and fine-grid feel as the prior prototype: diamond lines, bases, mound, labels for defenders, and distinct attacking/defending markers.

- [ ] **Step 2: Switch camera exactly on contact**

When `frame.event === "BatBallContact"`, render the contact state once, then subsequent frame rendering uses the overhead camera with no fade, zoom, or camera-motion transition.

- [ ] **Step 3: Preserve the batted-ball origin across the cut**

The first overhead frame must show the ball beginning from the home-plate contact area so the viewer does not lose direction.

---

### Task 4: Add mobile controls and status presentation

**Files:**
- Modify: `/mnt/data/mini-baseball-batter-pov-prototype.html`

**Interfaces:**
- Consumes: `renderFrame`, timeline length, current frame index.
- Produces: Play/Pause, one-frame step, Reset, progress, frame counter, camera label, play-state card.

- [ ] **Step 1: Add controls matching the existing prototype language**

Buttons: `再生`, `1コマ`, `リセット`. While playing, the first button reads `停止`.

- [ ] **Step 2: Add status fields**

Show current play phase, camera mode, event label, frame count, and progress bar. Use Japanese copy and keep the field viewport visually dominant.

- [ ] **Step 3: Wire 55ms playback**

Use `setInterval(..., 55)` only to select the next discrete sample. Never animate an object's position between frames.

---

### Task 5: Verify behavior and package the artifact

**Files:**
- Verify: `/mnt/data/mini-baseball-batter-pov-prototype.html`

**Interfaces:**
- Produces: one self-contained HTML file for user review.

- [ ] **Step 1: Run static assertions**

Check that the file contains no CSS `transition`, `animation`, or requestAnimationFrame usage; verify exactly one `BatBallContact` event and a `55` cadence constant.

- [ ] **Step 2: Open in a local browser-capable check or parse the DOM source**

Confirm controls, SVG viewport, timeline data, and reset/play/step handlers are all present and syntactically valid.

- [ ] **Step 3: Deliver the HTML**

Provide the sandbox link and explicitly label it a presentation prototype using fixed sample data, not final baseball physics.
