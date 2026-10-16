# Kneekura Mini Baseball — AI / Coding Agent Entry Point

> **Read this before planning, editing, claiming implementation, or asking another agent to work.**
> This repository's GitHub default branch is **`main`**, which contains an older bootstrap/design snapshot. The documented design work and the three 2026-10-16 baseball-AI implementation plans live on **`jolly/core-foundation-plan-2026-09-17`** as of 2026-10-16. This does **not** prove that this branch contains all of the user's current local or parallel-branch code. Inspect rather than assume.

## Required reading order

1. [AI Navigation / Design Index](docs/AI-INDEX.md) — find the correct document and learn its actual status.
2. [World-First Match / Broadcast Contract](docs/architecture/WORLD-FIRST-BROADCAST.md) — inviolable Core vs observed broadcast distinction.
3. [Current Design Handoff and Source Precedence](docs/game-design/00-current-design-handoff.md) — canonical, archived, historical, and pending states.
4. [Implementation Plan Register](docs/PLAN-REGISTER.md) — active plans, dependencies, and explicitly unapproved discussions.
5. [GitHub vs Local Work Safety / Status](docs/implementation/GITHUB-LOCAL-STATUS.md) — find work before touching files.
6. Relevant per-domain canonical docs and exact implementation source, **not just an old README, filename, or checklist**.
7. **For historical/OB/NPB recreation:** [Player Reconstruction Department](docs/player-reconstruction/README.md) → [1936–2026 NPB source atlas](docs/player-reconstruction/NPB-SOURCE-ATLAS-1936-2026.md) → [Era environment](docs/player-reconstruction/NPB-HISTORICAL-ENVIRONMENT-MODEL.md) → [Full public/hidden/Blue-Gold-Red-Green Trait index](docs/player-reconstruction/PLAYER-CAPABILITY-TRAIT-ATLAS.md) → [AI-first reconstruction runbook](docs/player-reconstruction/AI-RECONSTRUCTION-RUNBOOK.md). Source URLs and season indexes are **not** a licensed player database.

## Non-negotiable project philosophy

- **World first; broadcast second.** A baseball match exists in its own causal, spatial, time-indexed world. The camera and low-frame-rate Mini presentation merely observe it, as a broadcast crew would. The match is not recreated from frames, sprites, ASCII, fixed PNG poses, outcome tables, or broadcast FPS.
- **精密な試合計算、意図的に粗い中継。** Simulation Clock, physical events, snapshots, official rulings, player positions and ball trajectories do not become coarser just because Mini draws at 4px/55ms or some other Presentation cadence. A low-FPS broadcast must not skip a physical or legal event. FPS/replay/quality/headless changes cannot affect results.
- **Scene-adaptive broadcast rate, uniform visual treatment (2026-10-16 user clarification).** Pitching and batted-ball action can and should use higher Presentation frame cadence than low-motion scenes; 55ms is a reference, not a universal FPS cap. The owner reports this already being done in local work—verify before changing. **Never isolate the ball for higher image quality, special texture/resolution or separate display-FPS interpolation.** Sample ball/bat/players at mutually coherent canonical scene times; use the same approved PNG/pixel style. The Oct 14 '2× ball sampling' phrasing has been corrected. The simulation remains independent.
- **One shared Mini/Natural authoritative Core.** Mini is not a simplified baseball rules engine. Natural can later render the same world in richer 3D; no parallel official outcome engine.
- **Causality, not post-hoc outcome fabrication.** Entity perception -> decision/intention -> feasible physical motion -> collisions/events -> rule/umpire/official scoring. A hit/out/runs label does not invent the trajectory.
- **No omniscient agents.** Batter, catcher, pitcher, fielder, manager and umpire see their own observable/evidenced information and may be wrong. Preserve uncertainty and decision-time provenance.
- **Rating/Trait labels are projections, not magic buffs.** Physical and cognitive sources affect meaningful intermediate processes once. UI grades, league-relative summaries, Green traits, Gold traits and the words "flow/momentum" do not directly multiply hit/strikeout/win chance.
- **Approved art stays approved.** Current presentation uses the preserved **PNG** player originals. Pixel Player / JSON authoring experiments are **ARCHIVED / ON HOLD**, not production instructions. Read current Presentation docs before edits.
- **Historical OB reconstruction follows fixed skill + varied outcomes.** In the user's **選手再現部**, a prime OB's underlying ability and fixed baseline player card must not grow or decline annually; infer an evidence-based prime from **multiple seasons** (avoid cherry-picking only best years). A real peak such as Sadaharu Oh's 55 HR must be physically attainable in comparable conditions **without becoming a guaranteed yearly result**. Source-linked [historical player reconstruction department](docs/player-reconstruction/README.md); its season-long expression mechanics remain PROPOSED, not code. Oh's preferred Trait candidate is **引っ張り屋**, with 広角打法 pending evidence.
- **Historical source evidence and licensing.** The 1936–2025 official first-team NPB archive, game summaries and third-party repositories can inform recreation, but old-season physical/cognitive skills are not all measured. The OOTP NPB Historical repo self-restricts reuse to personal/non-commercial **with OOTP**, and a 1936 Korakuen stadium anachronism was found vs NPB's 1937 opening. Never bulk ingest/copy historical data, assets, or inferred statistics just because a GitHub repo is public; [source registry](docs/player-reconstruction/sources/npb-evidence-source-registry.json) flags all unapproved imports and uncertainty.
- **Preserve user work.** Do not reset/rebase/clean, overwrite, stage unrelated edits, remove branches, force-push or merge to `main` merely to make the repository look tidy. First inspect local changes, worktrees, branches, open work and commit provenance. The user's at-home uncommitted work is NOT visible merely because GitHub was checked.

## Document precedence

A document's **current internal Status** and a later explicitly approved canonical successor outrank its filename, dated example, archived content and old README descriptions. E.g., `-DRAFT` does not always mean pending; some old DRAFTs are frozen, while 39/40/43/45/46/47 are superseded by 49. See [current handoff](docs/game-design/00-current-design-handoff.md).

Separate **CANONICAL**, **APPROVED DESIGN**, **PLANNED / PROPOSED**, **ARCHIVED / ON HOLD**, **HISTORICAL**, **IMPLEMENTED**, **VERIFIED**, and **NOT CONNECTED**. A written plan is not runtime evidence. An old branch experiment is not integration proof. Never promote an idea to canonical by adding it to an index.

### 2026-10-16 work you must not overlook

- [Catcher Game Intelligence](docs/superpowers/plans/2026-10-16-catcher-game-intelligence-system.md)
- [Batter Anticipation / Adaptive Swing](docs/superpowers/plans/2026-10-16-batter-anticipation-intent-adaptive-swing.md)
- [Batter Directional Intent / Causal Spray](docs/superpowers/plans/2026-10-16-batter-directional-intent-and-spray.md)

The user referred to four plans; repository audit located **three** such new implementation plans. The additional [in-game "flow" / condition discussion](docs/notes/2026-10-16-in-game-form-discussion.md) is an **unfrozen proposal, not a fourth approved implementation plan**. Do not silently implement it.

## Before modifying code

1. Run or request on the actual user's machine: `git status --short`, `git branch -vv`, `git worktree list`, `git log --all --oneline -n 30`; inspect untracked files and staged/unstaged diffs before resolving branch state. GitHub access alone cannot reveal these local artifacts.
2. Match the working branch, files and source-of-truth owners; coordinate concurrent work; preserve unrelated work. Do not automatically check out or merge the apparently newest remote branch.
3. Identify the last **verified** game-Core milestone separately from all planned integrations, then implement coherent connected changes and test them together rather than piling situation-specific patches.
4. Verify unit/integration, deterministic seeded replay, render-profile invariance, canonical ball/bat and official rules as applicable. Report `PASS`, `FAIL`, `NOT RUN` and `NOT CONNECTED` honestly.
5. Keep this entry, the Index and Plan Register discoverable as new proposals are approved or replaced. Add links and status instead of erasing history.

## Tooling boundary

`npm run typecheck`, `npm test`, `npm run verify` are defined in this branch's package metadata, but run them **only when the actual worktree is available**; reading GitHub docs does not constitute test execution. Never claim a full nine-inning playable match from an isolated contact or decision fixture.
