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
| 1 | Roster references, Rights / Registration / Assignment / Availability — 32 | First administrative slice implemented and verified in PR #26. State, atomic operations, pinned profile and roster-only eligibility, independent of screens. No player generator, full transfers or season engine claimed. |
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

- Baseline: `7af4dfd7fca518fbd2fac423a7d7c9077e402704`, P0 Core #1483 / `35654541121`, success.
- Initial test-first RED: `1f928b66293973428e498c918cce12e4c4d2a6da`, #1489 / `35658466868`, missing roster API (`TS2307`) and dependent typing errors. This was a compile-time missing-feature failure.
- First full GREEN: `8992f01329e7e4b54cbd4cd2831195ff3ad35512`, #1492 / `35659463026`, strict TypeScript and **244 files / 1165 tests passed**.
- Inline adversarial review reproduced four failing Node cases for two defects: cross-club registration ownership and sparse runtime arrays. Fixed both root causes and added native boundary regressions. Local strict compile and **13/13 Node checks passed**.
- A publication blob comparison caught a one-line transcription mismatch in `RosterValidation.ts`; it was corrected before dispatching the reviewed-source verification.
- Reviewed-source run #1494 / `35659942965` failed on **test-only TS2352 at RosterBoundary.test.ts:80**. The intentionally malformed input now passes through `unknown`; no assertion, compiler check or production behavior was weakened.
- Reviewed full GREEN: **`72ededa600621e3f49265b2ad59a3c98c82f3dd2`**, P0 Core **#1496 / `35660292695`**, job `106533677150`: strict TypeScript and **245 files / 1181 tests passed**. New roster tests: state 20, commands/queries 19, boundaries 16 = **55**.
- All 10 source/test blobs matched locally verified content after connector terminal-newline normalization. Final corrected boundary test blob: `fcc6c36c975834f142b6f5e0cdd9830dde20792d`.
- Diff review: 14 newly added files; no existing files deleted/modified. Existing `src/presentation`, `src/core/sim`, `src/core/rules`, and `.github/workflows` subtree hashes are unchanged from the baseline.
- PR **#26** targets `jolly/core-realism-2026-09-18`; not merged. Review was inline, not an independent agent audit.

## Completion and next action

The first roster **administrative** implementation slice is complete and source-verified; this is not completion of full doc32 or every approved plan. See `docs/core/roster-v1-headless-api.md` for the public entrypoint, caller responsibilities, usage and precise limitations, and `docs/core/roster-v1-review.md` for review evidence.

Next dependency-ready slice: **Human Control Overlay / decision-origin attribution**, reading full doc32 §18 and the current canonical 38/42/49 contracts before editing. Preserve original manager identity and prevent human overrides from becoming fictitious original-manager self-chosen learning. Start from the verified PR #26 work or explicitly integrate it; do not reimplement its roster state, silently merge unrelated physics branches, or add UI/Work connections.