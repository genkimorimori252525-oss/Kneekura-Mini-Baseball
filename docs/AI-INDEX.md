# AI START HERE — Kneekura Mini Baseball Knowledge Map

> **2026-10-16 repository orientation, on `jolly/core-foundation-plan-2026-09-17`.** This is the central documentation navigator for new AI agents. If you arrived on GitHub's default `main`, **do not assume it contains the latest project**; follow links to this working branch and inspect the user's local checkout before modifying anything.

**Read together:**
- [Root agent instructions](../AGENTS.md)
- [World-First / Low-FPS Broadcast design philosophy](architecture/WORLD-FIRST-BROADCAST.md)
- [Current Design Handoff / source precedence](game-design/00-current-design-handoff.md)
- [Implementation plan register — includes all three Oct 16 plans and “flow” discussion](PLAN-REGISTER.md)
- [Actual GitHub vs local branch/worktree safety](implementation/GITHUB-LOCAL-STATUS.md)

## What this game is (and is not)

**The match happens in an autonomous baseball world, the low-FPS cameras only broadcast it.** Real ball, bat, runners, nine defenders, stadium geometry, tactical perceptions and timed contact events are simulated at their proper physical fidelity. Mini uses simple discrete low-rate visuals from canonical snapshots or Core-owned motion, not a second simplified physics/official scoring engine. Better-looking rendering may **never** invent a hit, move an entity in Core, change a rule decision or compute fielding from pixels.

```text
One physically causal baseball Match Core
 → CanonicalWorldSnapshot / event time / official ledger
 → read-only camera observation at a chosen presentation cadence
 → current approved PNG / discrete Mini broadcast
 → future Natural 3D broadcast from the SAME Core
```

**2026-10-01 presentation choice:** retain the approved PNG originals (B1 style). Old Pixel/JSON/v1/v2 experiments are **ARCHIVED / ON HOLD**. Default 4px-grid/55ms sample remains the adopted discrete broadcast reference; later 2× **ball visual sampling** is a separate unverified plan, not twice the simulation or an overwrite of original visuals. See [broadcast details](architecture/WORLD-FIRST-BROADCAST.md).

## Document authority — first check status, not file name

```text
latest explicit user-approved canonical refinements
  > surviving CANONICAL / DESIGN FROZEN sources
  > APPROVED design direction / specifications
  > IMPLEMENTATION PLAN / PROPOSED (not automatically authorized code)
  > DISCUSSION / open decisions
  > HISTORICAL / SUPERSEDED / ARCHIVED / ON HOLD
```

The [current handoff](game-design/00-current-design-handoff.md) defines lifecycle precedence, especially when filenames have `-DRAFT`. The authoritative **Trait family and lifecycle** source is [09](game-design/09-player-trait-catalog.md), **Manager architecture** is [49](game-design/49-manager-architecture-v1.md), and **approved presentation** is [PNG continuation](presentation/2026-10-01-png-player-continuation.md). Older document sections remain valuable rationale but do not silently override later explicit refinements.

**Caution:** Source code existence, `README` assertions, a proposed path in a plan, approved design, verified tests and a completed full match are **six different evidence classes**. Report each accurately.

## Find design truth by topic

| Need | Open this first | Supporting context |
| --- | --- | --- |
| Philosophy, status and historical decisions | [Current Design Handoff 00](game-design/00-current-design-handoff.md); [Decision Log 00](game-design/00-decisions.md) | [World-First / Broadcast](architecture/WORLD-FIRST-BROADCAST.md) |
| Clock, precise physical contacts, events | [Time / Runner / Catch / Perception / Umpire spec](superpowers/specs/2026-09-17-time-running-catching-perception-umpire-design.md) | [Causal Contact and Individual Defense](superpowers/specs/2026-09-17-causal-contact-and-individual-defense-design.md); [Core foundation plan](superpowers/plans/2026-09-17-core-foundation.md) |
| Batter cognition, aiming, reaction, ball/bat motion | [Batter Anticipation / Adaptive Swing plan](superpowers/plans/2026-10-16-batter-anticipation-intent-adaptive-swing.md) | [Directional Intent / Causal Spray plan](superpowers/plans/2026-10-16-batter-directional-intent-and-spray.md); [Trait 09](game-design/09-player-trait-catalog.md) |
| Catcher game calling, counterplay, battery cooperation | [Catcher Game Intelligence plan](superpowers/plans/2026-10-16-catcher-game-intelligence-system.md) | [Pitch Timing and Cadence](superpowers/plans/2026-09-23-pitch-timing-cadence-quick-delivery.md); [Manager 49](game-design/49-manager-architecture-v1.md) |
| Actual bat-ball physics and resulting batted-ball direction | [Causal Contact spec](superpowers/specs/2026-09-17-causal-contact-and-individual-defense-design.md) | `src/core/sim/contact/BatBallContact.ts`; [Contact vertical-slice plan](superpowers/plans/2026-09-17-contact-physics-vertical-slice.md) |
| Defense, positioning, scouting, base coverage | [Rules / Ratings / Defense 02](game-design/02-rules-ratings-defense.md) | [Defense Ratings 04](game-design/04-defense-ratings.md); [Scouting 31](game-design/31-scouting-recruitment-system.md) |
| Rules and official record | [Rules 02](game-design/02-rules-ratings-defense.md); [Decision Log 00](game-design/00-decisions.md) | [Time/Perception/Umpire spec](superpowers/specs/2026-09-17-time-running-catching-perception-umpire-design.md) |
| Manager commands, judgment, culture and habits | [Manager 49 (CANONICAL)](game-design/49-manager-architecture-v1.md) | [Manager Experience 01](game-design/01-manager-experience.md); [Player Traits 08/09](game-design/08-player-traits-design-seed.md) |
| Player ratings / buffs / development / traits | [Trait Catalog 09](game-design/09-player-trait-catalog.md) | [Trait philosophy 08](game-design/08-player-traits-design-seed.md); [Development 53](game-design/53-player-development-trajectory-breakthrough-v1.md); [Audit 54](game-design/54-player-development-breakthrough-adversarial-audit.md) |
| Condition, psychological reaction, team flow | [Psychology 05](game-design/05-psychology-emotion.md); [Team Mood 37](game-design/37-team-mood-architecture.md) | [Mood consequence 38](game-design/38-team-mood-manager-interventions-DRAFT.md); [In-game form **discussion only**](notes/2026-10-16-in-game-form-discussion.md) |
| Club/world competition / league / career | [World Competition 11](game-design/11-world-competition-architecture.md); [Competition 12](game-design/12-competition-identity-hosting.md) | [Calendar 14](game-design/14-regular-season-calendar-and-volume.md); [Club Model 18](game-design/18-club-state-lifecycle.md); [Roster/Development 32](game-design/32-roster-development-architecture-DRAFT.md); [Scouting 31](game-design/31-scouting-recruitment-system.md) |
| Current approved visual identity, cameras / sprites | [PNG continuation](presentation/2026-10-01-png-player-continuation.md); [Visual baseline manifest](presentation/2026-10-01-png-baseline-manifest.json) | [Display 07](game-design/07-drone-art-presentation.md); [Batter POV spec](superpowers/specs/2026-09-17-batter-pov-drone-art-design.md); [Broadcast Contract](architecture/WORLD-FIRST-BROADCAST.md) |
| Next playable match / runtime | [TBD home vs LAD plan 10/14](implementation/2026-10-14-tbd-vs-lad-match-slice.md) | [Reality/status guide](implementation/GITHUB-LOCAL-STATUS.md); `src/core/index.ts` |
| Legacy/reference media experiments | [Pixel archive](archive/pixel-player-system/README.md) | Older Sept 17 POV plans and historical v16 demonstration; **not automatically implemented** |

For individual competitions/country rosters, first use the relevant numbered [`docs/game-design/` catalog](game-design/) and [`docs/roster-seeds/`](roster-seeds/); do **not** confuse a content catalog or planned fixture with a passed runtime gate.

## 2026-10-16 active conversations: all topics findable

| Conversation topic | Status / entry |
| --- | --- |
| Catcher G–A / 球界の頭脳 cognitive game-calling | [CATCH plan](superpowers/plans/2026-10-16-catcher-game-intelligence-system.md) |
| Batter's own guess, reactive vs committed guessing, in-swing adaptation | [BAT plan](superpowers/plans/2026-10-16-batter-anticipation-intent-adaptive-swing.md) |
| Batter's Pull / Center / Opposite intention vs actual exit spray | [DIR plan](superpowers/plans/2026-10-16-batter-directional-intent-and-spray.md) |
| Unseen in-game “流れ” and 1..4 condition proposal | [OPEN DISCUSSION — no approved implementation plan yet](notes/2026-10-16-in-game-form-discussion.md) |

**Three actual new implementation plans, plus one unresolved concept.** Do not invent a fourth implementation commit. Existing unrelated planned pitch development and Oct 14 match integration remain separately linked in the [plan register](PLAN-REGISTER.md).

## Editing and future-agent onboarding

1. Start with [AGENTS.md](../AGENTS.md); inspect local `git status --short`, worktrees and all relevant uncommitted files before editing. GitHub cannot see uncommitted local changes.
2. Identify the **correct branch and file owner**. `main` is an older bootstrap snapshot; many `codex/*` and other experimental/ongoing branches coexist. Do not cherry-pick, merge, delete or force-push to “make it clean.”
3. Reconcile the **exact canonical status** before reusing a document, and compare newer user decisions with stale proposals. Do not decide which is newest from name alone.
4. When creating a new plan: include explicit Status, sources, owner, dependencies, prohibited shortcuts, implementation/test gates and links in [PLAN-REGISTER.md](PLAN-REGISTER.md) and this Index.
5. When completing code: update verified status **only with concrete test receipts**, and record any worktree/branch-only results rather than implying they exist on this branch.
