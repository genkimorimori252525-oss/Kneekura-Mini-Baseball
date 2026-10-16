# GitHub / Local Worktree Reality & Safety Handoff

> **Status:** REPOSITORY NAVIGATION / EVIDENCE-BOUND SNAPSHOT. Updated 2026-10-16. This page does not claim to know the user's at-home local machine.
>
> **Task:** prevent future AIs from losing, misclassifying or overwriting active work merely because GitHub's default branch and local state differ.

## What was actually visible in GitHub during the 2026-10-16 review

| Surface | Observed | Meaning |
| --- | --- | --- |
| GitHub default branch | `main` | Older bootstrapping/design-only snapshot. Its root originally had just `README.md` and `docs/`. **Not an authoritative indicator of latest source or design.** |
| Document development branch | `jolly/core-foundation-plan-2026-09-17` | Contains `src/`, `assets/`, and `docs/` including the 10/16 AI implementation plans, the adopted PNG presentation docs, and preserved Pixel archive. |
| Other remote branches | Many `codex/*` and specialized work branches, including physical-game work | They exist, but this review **did not certify their implementation, verify all merges, or choose one as the latest integrated game**. Do not discard merely because branch hasn't been merged. |
| Approved design | Numerous CANONICAL / DESIGN FROZEN documents and newer refinements | Approval of architecture is **not proof of code execution**. |
| Code on the documentary branch | P0 deterministic shared Core files; `src/core/sim/contact/BatBallContact.ts` and `.../plateAppearance/ContactVerticalSlice.ts` are observable in GitHub | Contact/flight parts exist; **not proof** of complete pitch → fielding → runner → RuleEngine → 9 innings on this branch. |
| Oct 14 TBD vs LAD slice | `IMPLEMENTATION PLAN / NOT YET VERIFIED` | Not proof of a playable 9-inning cross-device match. |
| Owner's local computer | User says many working files reside at home | **Unknown/unaudited from GitHub.** No GitHub tool can enumerate uncommitted, unpushed, untracked files on that PC. |

**Status policy:** `DESIGN FROZEN`, `IMPLEMENTATION PLAN`, `SOURCE PRESENT`, `TEST PASS`, `INTEGRATED`, `DEVICE VERIFIED` are different. Never upgrade a status just because another stage is complete or a detached fixture passes.

## Before a future agent changes local files

On the user's *actual intended workspace* (PowerShell or Git shell), first inspect rather than alter:

```sh
git status --porcelain=v1 -uall
git branch -vv
git worktree list
git remote -v
git log --all --oneline --decorate -n 30
git diff --stat
git diff --cached --stat
```

Then inspect current untracked and modified files, provenance, and concurrent agents. If a real worktree is absent or disconnected, **do not infer it is clean**. Ask for remote upload or use the actual connected local tool if authorized and available. A remote GitHub commit does not automatically reach the user's disk.

If necessary, `git fetch origin` updates remote tracking info without a merge; it does not authorize `git checkout`, `git reset --hard`, `git clean -fd`, `git pull --rebase` on a dirty worktree, stash/drop, branch deletion, force-push, or checkout over valuable changes. Preserve separate working trees and staged/unstaged files. Never quietly auto-merge the active documents into `main`.

## Recommended safe reconciliation procedure

1. **Inventory:** compare actual local `HEAD`/branch to the intended active remote branch. Record uncommitted code, generated assets, custom scripts and exact tests. Preserve users' local material first.
2. **Compare source:** distinguish unpushed local code vs remotely committed branches vs prototype HTML vs actual Node/Native match Core. Inspect source and receipts rather than old prose claims.
3. **Compare docs:** read [AI Index](../AI-INDEX.md), [Plan Register](../PLAN-REGISTER.md), [Current Design Handoff](../game-design/00-current-design-handoff.md) and [World-First Broadcast](../architecture/WORLD-FIRST-BROADCAST.md). Explicitly identify genuine conflicts, not invented dependencies.
4. **Propose minimal integration:** update docs in appropriate branch; combine source only after a clear owner map and actual tests. Reuse existing files and avoid per-situation defensive AI fixes or parallel physical/official outcomes.
5. **Verify:** typecheck, unit tests, fixed seed official event/score invariance, player/ball physical traces, headless vs view state, valid rule interpretation, multi-seed scenarios and device tests *when accessible*.
6. **Record:** branch, before/after hashes, changed paths, local-only files, commits, test commands, `PASS/FAIL/NOT RUN/NOT CONNECTED` and source-of-truth links. Only after evidence should plan register statuses change.

## Architectural conflicts an AI must not paper over

- **Canonical world vs broadcast frame:** The match world executes independent of a chosen camera and low FPS. The lower cadence never becomes a coarser physical collision/Rule clock. See [dedicated principle](../architecture/WORLD-FIRST-BROADCAST.md).
- **User-corrected visual sampling (2026-10-16):** the owner says pitch and batted-ball scenes already draw more frequently in local work; Presentation's **scene-wide frame cadence may vary by situation** and 55ms is a reference, not a fixed per-scene interval. **No isolated high-resolution/high-quality/FPS treatment for the ball**, no mandatory ball-only 2× scheme. The corrected Oct 14 plan supersedes its older wording. Reconcile older generic interpolation permission in `00-decisions.md` and anti-tween rule in `07-drone-art-presentation.md` by grounding every displayed scene in the appropriate canonical time, without inventing trajectories or altering physics. Verify local code before refactoring any current scene timing.
- **Pixel vs PNG:** current user decision is PNG originals, Pixel/JSON experiment archived and on hold. Archived code may still be present.
- **Batter/Catcher/Direction AI:** three Oct 16 linked plans share one batter belief and swing owner; they are not three different ready-to-run batting engines.
- **“Flow” vs form/psychology:** the user's proposed 1..4 hidden in-game state conflicts with an older documented `Condition=1..5` seed and ActiveEmotion no-ordinary-buff gating. Record open decision and do not quietly implement a new momentum modifier.
- **README vs complete game:** an older README or a feature branch's isolated tests cannot override verified source/test evidence.

## Docs-only housekeeping performed on this branch

On 2026-10-16, the assistant added an AI/document navigation layer: `AGENTS.md`, [AI-INDEX](../AI-INDEX.md), [PLAN-REGISTER](../PLAN-REGISTER.md), [World-First Broadcast](../architecture/WORLD-FIRST-BROADCAST.md), this status guide and a discussion-only Flow note. This task **did not modify baseball runtime code, merge source branches, run tests or inspect the user's local PC**. New branch commit hashes should be read from GitHub at execution time; any static hash in a plan indicates an older planning snapshot, not an automatically refreshed HEAD.
