# AGENTS.md — Kneekura Mini Baseball

Effective record: **2026-09-20 03:30 JST**

This file is an operational guardrail for coding/research agents working in this repository. It does not replace approved game-design documents.

## 1. Design ownership

**UI/UX, visual design, art direction, presentation styling, screen composition, and player-facing visual interaction design are owned by ChatGPT Work.**

Ordinary implementation agents must **not independently redesign, restyle, reinterpret, or invent a new visual direction**.

Implementation agents may:

- implement Core/rules/physics/AI work that has an approved scope;
- maintain renderer-neutral Presentation data contracts;
- implement a design handed off by Work or explicitly approved by the user;
- add tests that protect approved Presentation/Core boundaries.

Implementation agents must not, without an explicit approved design handoff:

- choose a new art direction;
- replace the approved camera concept;
- redesign HUD/layout/navigation;
- revive an old prototype because it is easy to implement;
- treat a render-state test fixture as final product design;
- turn a legacy ASCII/Drone-Art document into current authority.

If a task requires a new visual/UI/UX decision and no approved Work design is present, **stop at the design boundary**. Preserve the data/API seam and leave the design decision to Work/user review.

## 2. Fixed product / Presentation direction

The following are currently established constraints and must be preserved unless the user explicitly changes them:

1. **World-first causality.** The world/physics/actors move first; rules interpret what happened.
2. **Presentation is read-only.** Presentation observes canonical state/events and must not decide OUT/SAFE, possession, runner movement, scoring, or any other Core truth.
3. **ASCII / fixed Drone-Art / fixed-grid is not the current product direction.** Those prototypes are legacy reference only.
4. **Camera role contract already exists.**
   - offensive at-bat observation: Batter POV;
   - defensive/pitcher-operation observation: catcher-behind Pitcher POV;
   - fair-ball/live field action: field/overhead observation.
   Exact visual composition, styling, transitions, density, polish, and interaction treatment remain Work-owned.
5. **Simple surface, deep simulation.** The simulation may be detailed; the player-facing surface should remain understandable and avoid exposing every internal variable.
6. **Mini and future Natural share one Match Core.** Natural is a different observer/renderer, not a different baseball-result engine.
7. Existing P8 code is a **renderer-neutral Presentation foundation**, not a finished visual design or finished game client.

## 3. Source precedence

When documents conflict, use this order:

1. the user's latest explicit instruction / approved Work handoff;
2. this operational guardrail for ownership boundaries;
3. current authoritative implementation contracts on `jolly/core-realism-2026-09-18`:
   - `docs/game-design/05-world-first-live-ball-architecture.md`;
   - `docs/game-design/06-world-first-runtime-contracts.md`;
   - `docs/game-design/07-world-first-adjudication-contracts.md`;
   - `docs/game-design/03-roadmap.md`;
4. current approved design handoff/future-system documents on `jolly/core-foundation-plan-2026-09-17` for areas that are explicitly marked design-only;
5. older prototypes/reference documents.

In particular, `docs/game-design/07-drone-art-presentation.md` is explicitly **LEGACY REFERENCE** and cannot override newer direction.

## 4. Implementation status is not the same as design status

The repository currently has two important streams:

- **implementation truth:** `jolly/core-realism-2026-09-18`;
- **design/incubation truth for future systems:** `jolly/core-foundation-plan-2026-09-17`.

A detailed design document on the design branch does **not** mean the feature is implemented.

Use the timestamped status record below before claiming completion:

`docs/project-status/2026-09-20-0330-current-state.md`

## 5. Explicit no-autopilot boundary

Do not choose a new major implementation capability simply because it appears dependency-ready in a design document. The runner controller/rebase seam was explicitly closed without selecting a new next task.

Residual items such as multi-runner orchestration, ActionFrontier, OfficialPlayClosure, broad official scoring, psychology, traits, league/career systems, or renderer/UI work require an explicitly approved scope.

## 6. Unapproved draft fence

`docs/game-design/32-roster-development-architecture-DRAFT.md` on the design branch is **USER REVIEW REQUIRED / unapproved / implementation forbidden**.

Do not promote it to approved design or implementation without explicit user review.