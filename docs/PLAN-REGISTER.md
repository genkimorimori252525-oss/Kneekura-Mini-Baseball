# Implementation Plan Register — status, owners and dependencies

> **Updated:** 2026-10-16. **This is a discoverability index, not implementation authorization or a new canonical specification.** Each linked document's internal Status and the later explicitly approved canonical design take precedence.
>
> **Caution:** The user mentioned **four** plans in this conversation, but this GitHub branch currently contains **three newly written 2026-10-16 implementation plans**. The “flow / in-game form” discussion has **not** been approved as a fourth implementation plan. It has its own [discovery note](notes/2026-10-16-in-game-form-discussion.md) so an AI will not silently omit or implement it.

## Current 2026-10-16 baseball decision/action plans

| ID | Link | Status | Dependencies / how to use |
| --- | --- | --- | --- |
| **CATCH** | [Catcher Game Intelligence v1](superpowers/plans/2026-10-16-catcher-game-intelligence-system.md) | **IMPLEMENTATION PLAN / PROPOSED / NOT IMPLEMENTED** | Generic pitch choice, manager instruction, seven distinct cognition domains, `CATCHER_LED`/`PITCHER_LED`, pitch-cadence separation; **CATCH-01..25**. The batter-belief portion is refined by BAT, not independently duplicated. |
| **BAT** | [Batter Anticipation, Intent & Adaptive Swing v1](superpowers/plans/2026-10-16-batter-anticipation-intent-adaptive-swing.md) | **USER-APPROVED DIRECTION / IMPLEMENTATION PLAN / NOT IMPLEMENTED** | Subjective pitch family × region probabilities, 反応型 vs 狙い球型, TAKE/SWING decision times, temporal/spatial in-swing correction, existing ミート/パワー/選球眼/悪球打ち source, continuous physical swing; **BAT-01..29**. Owns the single planned BatterPitchBelief with CATCH and includes DIR as supplementary scope. |
| **DIR** | [Batter Directional Intent & Causal Spray v1](superpowers/plans/2026-10-16-batter-directional-intent-and-spray.md) | **USER-APPROVED DIRECTION / IMPLEMENTATION PLAN / NOT IMPLEMENTED** | `PULL / CENTER / OPPOSITE / REACTIVE`, intent-only zero frequencies, existing Pull/流し/広角 technical skills, world and handed spray coordinates, contact-output direction; **DIR-01..26**. **Extends BAT's existing policy and swing, does not create a duplicate engine.** |

**Unified acceptance:** The three plans are interconnected, not three independently working products. Taken together their specified regression set is **CATCH-01..25 + BAT-01..29 + DIR-01..26 = 80 named acceptance cases**, subject to actual live-Core availability. Checking boxes in Markdown does not prove tests passed.

### Cross-cutting quality department — **newly created; not a fourth Match Core implementation plan**

| Topic | Entry | Status | Meaning |
| --- | --- | --- | --- |
| **選手再現部 / Historical OB reconstruction** | [Department README](player-reconstruction/README.md), [OB Prime Principles](player-reconstruction/PRINCIPLES.md) | **USER-DIRECTED PRINCIPLES / DOCUMENTATION & QA WORKFLOW / NOT IMPLEMENTED** | Frozen OB ability, full-career historical evidence, representative multi-year prime means, peak attainment without yearly scripted max. |
| Reproduction methodology / quality gates | [METHOD-V1-PROPOSAL](player-reconstruction/METHOD-V1-PROPOSAL.md) | **METHOD PROPOSED / NOT CALIBRATED** | 14 future REC test gates; source-first normalization, season environment, no cherry-pick. |
| Fixed OB + season fluctuation | [SEASON-EXPRESSION-PROPOSAL](player-reconstruction/SEASON-EXPRESSION-PROPOSAL.md) | **DESIGN OPTION / NOT APPROVED AS RUNTIME / NOT IMPLEMENTED** | First test daily Condition + matchup/physics variation; add slower coherent execution state only if evidence requires. |
| Sadaharu Oh prime example | [Reconstruction case 001](player-reconstruction/cases/sadaharu-oh-prime.md) | **PROVISIONAL / NOT CALIBRATED** | 引っ張り屋 candidate, 広角打法 hold, fixed skills, 55-HR-capable with no yearly guarantee. |

**This department does not change the earlier three CATCH/BAT/DIR implementation plans into four, and the hidden “流れ” discussion remains independently undecided.**

### Discussion / decision pending, not an implementation plan

| Topic | Link | Status |
| --- | --- | --- |
| Hidden in-game “流れ” / short-term form | [In-Game Form discussion record](notes/2026-10-16-in-game-form-discussion.md) | **DISCUSSION ONLY / NOT DESIGN FROZEN / NOT IMPLEMENTED.** User proposed an unseen four-step in-game state with smaller execution effects than pre-game Condition; existing canonical seed's `Condition=1..5` conflicts with the colloquial 1..4 + 絶好調 / スランプ. Requires a separate decision, not magic momentum. |

## Other plans that an AI should actively find

| Document | Status / warning | Relevant domain |
| --- | --- | --- |
| [Pitch Timing / Cadence / Quick Delivery — 2026-09-23](superpowers/plans/2026-09-23-pitch-timing-cadence-quick-delivery.md) | APPROVED direction + implementation plan; actual integration not proven here | Batter preparation, pitcher rhythm/quick, `BatteryPitchDecision`; PitchCall cannot be mutated by cadence |
| [Pitch Arsenal Development — 2026-10-07](superpowers/plans/2026-10-07-pitch-arsenal-development-system.md) | **PLANNED / principles frozen; implementation unstarted per handoff** | No arbitrary count cap, no hidden per-pitch ceiling, finite practice and causal quality, 2-pitch/8-pitch variety |
| [TBD home vs LAD first playable match — 2026-10-14, clarified 10/16](implementation/2026-10-14-tbd-vs-lad-match-slice.md) | **IMPLEMENTATION PLAN / NOT YET VERIFIED** | Real nine-inning canonical Core on mobile/desktop, PNG and **scene-appropriate drawing cadence** for pitching/batted-ball play; **not** a ball-only quality upgrade or mandatory 2×, versioned LAD roster |
| [Shared Core foundation — 2026-09-17](superpowers/plans/2026-09-17-core-foundation.md) | Historical foundation implementation plan; inspect source and tests, not completion by title | Determinism, seed roots, CanonicalMatchState, WorldSnapshot |
| [Contact physics vertical slice — 2026-09-17](superpowers/plans/2026-09-17-contact-physics-vertical-slice.md) | Implementation plan; `src/core/sim/contact/` / `plateAppearance/` source exists in branch | Single-time physical bat-ball contact; does NOT prove whole at-bat or complete game |

Other Sept 17 view/runtime/POV plans are reference/context; inspect their own Status before treating them as currently active presentation tasks. [Approved PNG continuation](presentation/2026-10-01-png-player-continuation.md) overrides any stale instruction to mass-produce Pixel Player JSON.

### Archived experiments — **do not auto-resume**

- [Pixel Player System archived package](archive/pixel-player-system/README.md), with prior [Oct 1 plan redirect](superpowers/plans/2026-10-01-pixel-player-system.md). The user explicitly chose to return to PNG originals. Archived files may remain in code for reproducibility, not promotion to current production.
- Earlier ASCII/fixed-render approaches are not the source of baseball results; old prototypes may serve as screenshots/visual references only. Actual implementation needs the shared Core.

## Ownership and navigation rules

1. **Design doctrine/status:** [Current Design Handoff](game-design/00-current-design-handoff.md) and [World-First Broadcast](architecture/WORLD-FIRST-BROADCAST.md).
2. **Pitch/batter dependency:** CATCH produces a legal/accepted pitch intent with authority; BAT owns the batter's private pitch anticipation and actual swing decisions; DIR refines BAT's direction intentions. Only **one** batter belief and one active SwingController.
3. **AI/manager:** [Manager Architecture v1](game-design/49-manager-architecture-v1.md), [Player Trait Catalog](game-design/09-player-trait-catalog.md), [Player trait philosophy](game-design/08-player-traits-design-seed.md). Traits and displayed grades summarize true skill; no direct outcome buff.
4. **Local code before GitHub:** The owner has files being worked on locally at home. This index knows nothing about their contents. On a real workspace, inspect before overwriting, pulling, cherry-picking or “cleaning up.” [Safety checklist](implementation/GITHUB-LOCAL-STATUS.md).
5. **Update protocol:** When a plan is implemented, verify commit/tests/integration, then update its **status here** and the existing internal Status with evidence and link to the actual owner. Never claim `PASS` for `NOT RUN`/fixture-only or infer a complete match from documentation.
