# 2026-09-22 — Confirmed plans, headless implementation queue

## Session authority and source pins

The user explicitly authorized sequential implementation of currently confirmed plans, with **no design, rendering, UI, screen/button work, or connection to Work/client prototypes**. Future design work must be able to discover supported operations, input/state/output contracts and rejection reasons without reverse-engineering simulation internals.

- Implementation baseline: `jolly/core-realism-2026-09-18` @ `7af4dfd7fca518fbd2fac423a7d7c9077e402704`.
- Confirmed-design snapshot: `jolly/core-foundation-plan-2026-09-17` @ `782f6b8ef2406839de5678b00040001111cd8f77`.
- Task branch: `jolly/confirmed-headless-roster-2026-09-22`.
- Durable workflow: `5ebc765cf4e04bc987a6a427e9feeead`.
- Baseline CI: P0 Core #1483 / run `35654541121`, success at the exact baseline SHA.

The current design handoff states that no USER REVIEW REQUIRED designs remain in the audited set. In particular 32/34/35/38/41/42 are CANONICAL / DESIGN FROZEN despite legacy `-DRAFT` filenames. The older AGENTS doc32 unapproved fence is superseded for this approved slice by that newer canonical record and the user's explicit implementation request. This does not authorize a UI handoff or revive archived drafts.

## Dependency-driven implementation order

This is an execution queue over existing approved designs, **not a new game architecture**. Read each full canonical contract and recheck exact implementation status before starting its slice. Do not implement a whole row as shallow placeholders.

| Order | Plan group / canonical references | Dependency and current boundary |
|---|---|---|
| 1 | Roster references, Rights / Registration / Assignment / Availability — 32 | Current first slice. State, atomic operations, pinned profile and roster-only eligibility, independent of screens. No player generator, full transfers or season engine claimed. |
| 2 | Human Control Overlay and decision attribution — 32 §18, 38, 42, 49 | Separate HUMAN_OVERRIDE from original-manager delegated/autonomous decisions. Preserve original manager identity and prevent false self-chosen strategy learning. No buttons or social-action menu. |
| 3 | Club state lifecycle / institutional economy / initial seeds — 18, 16, 19, 26–30 | Reference roster/person state and existing Rivalry Lifecycle; do not copy player state, re-seed saves or turn labels into ability buffs. |
| 4 | Competition-edition profiles, domestic qualification, calendars, season events — 11–15 | Build on club/registration identities and pinned versions. Real league-specific values require official year-specific verification, not guessed defaults. Schedule generation is not proof that games were played. |
| 5 | Scouting knowledge, roster need and recruitment records — 31, 32, 02 | Estimate from observations, never hidden truth. Separate decision-time evidence from later results; role-aware headline ratings remain derived. |
| 6 | Manager decision engine, competence and market — 49, 41, 42 | Use legal actions, knowledge and original-manager attribution. Do not implement archived 39/40/43/45/46/47 as parallel competing authorities. |
| 7 | Player psychology/traits; relationships, team traits and mood consequences — 05, 08/09, 34/35, 37/38 | Build causal source state and evidence first; labels are not extra buffs. No social-management chore loop or UI actions. |
| 8 | Development opportunity, trajectory and breakthrough — 32, 53/54 | Depends on actual practice/game repetitions, coaching/health/role evidence and trait lifecycle. No age/pathway/awakening label buffs or fake reserve-game results. |
| 9 | Popularity, Star/Superstar and genesis — 50–52 | Keep latent generation predisposition separate from realized career evidence and current/legacy descriptors. No destiny badge or label-driven match outcomes. |

Actual First Team / Reserve / Farm / Academy season execution remains gated on the shared Match Core's supported world-first play closure and official result/statistics paths. Before that integration, read implementation contracts 05/06/07 on the implementation branch and close any required confirmed nonvisual capabilities. Do not substitute a random outcome engine to satisfy rows 4 or 8.

## Already implemented / separate work

- Rivalry Lifecycle v1 already exists under `src/core/world/rivalry`; do not reimplement it.
- Physics realism PR #3 and Swing Kinematics PR #25 are separate draft/open branches at discovery. Their completed work is not silently merged into this roster task.
- Existing P0–P9 and presentation contracts are preserved. New roster code must not modify existing physics, RuleEngine, RNG or presentation imports.
- Replay reconstruction, Replay Director, and Ballpark Builder future-reference plans are not promoted by this queue. UI/visual tasks are explicitly excluded even when their design is frozen.

## Current batch scope

State/operation/query implementation for doc32's dependency-ready administrative boundary. It provides canonical references and explicit validation, not complete roster/development gameplay.

Remaining outside this slice: person generation, contracts/loan negotiation/transfer execution, national-team registration exceptions, waivers/options/quotas/service time, real-league regulation datasets, season lifecycle integration, medical recovery simulation, promotion AI, coaching allocation, Match Core dispatch, lower-tier games/standings/statistics, persistence storage and UI.

## Evidence ledger

- `1f928b66293973428e498c918cce12e4c4d2a6da`: test-first contracts and plan published.
- RED verified: P0 Core #1489 / `35658466868` / job `106527777028`, failed on missing new roster API (`TS2307`), followed by dependent typing errors. This was a compile-time missing-feature failure, not a game-behavior assertion failure.
- Local new-module strict TypeScript compile passed. Node built-in smoke/state verification passed 9/9. This is not a substitute for the full repository Vitest suite.
- Roster state, pure batch changes, revision guards, pinned profile queries and API handoff are implemented in the dedicated roster module. Full repository GREEN and final review are still pending.

## Next action

Run full repository verification at the published implementation SHA, review adversarial command/input boundaries, and document exact GREEN evidence and PR. Do not repeat the frozen-design audit or start UI work.