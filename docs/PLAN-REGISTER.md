# Implementation Plan Register — status, owners and dependencies

> **Updated:** 2026-10-26 (SWG design plan registered; 2026-10-16 CATCH/BAT/DIR statuses unchanged). **This is a discoverability index, not implementation authorization or a new canonical specification.** Each linked document's internal Status and the later explicitly approved canonical design take precedence.
>
> **Caution:** The user mentioned **four** plans in this conversation, but this GitHub branch currently contains **three newly written 2026-10-16 implementation plans**. The “flow / in-game form” discussion has **not** been approved as a fourth implementation plan. It has its own [discovery note](notes/2026-10-16-in-game-form-discussion.md) so an AI will not silently omit or implement it.

## Current 2026-10-16 baseball decision/action plans

| ID | Link | Status | Dependencies / how to use |
| --- | --- | --- | --- |
| **CATCH** | [Catcher Game Intelligence v1](superpowers/plans/2026-10-16-catcher-game-intelligence-system.md) | **IMPLEMENTATION PLAN / PROPOSED / NOT IMPLEMENTED** | Generic pitch choice, manager instruction, seven distinct cognition domains, `CATCHER_LED`/`PITCHER_LED`, pitch-cadence separation; **CATCH-01..25**. The batter-belief portion is refined by BAT, not independently duplicated. |
| **BAT** | [Batter Anticipation, Intent & Adaptive Swing v1](superpowers/plans/2026-10-16-batter-anticipation-intent-adaptive-swing.md) | **USER-APPROVED DIRECTION / IMPLEMENTATION PLAN / NOT IMPLEMENTED** | Subjective pitch family × region probabilities, 反応型 vs 狙い球型, TAKE/SWING decision times, temporal/spatial in-swing correction, existing ミート/パワー/選球眼/悪球打ち source, continuous physical swing; **BAT-01..29**. Owns the single planned BatterPitchBelief with CATCH and includes DIR as supplementary scope. |
| **DIR** | [Batter Directional Intent & Causal Spray v1](superpowers/plans/2026-10-16-batter-directional-intent-and-spray.md) | **USER-APPROVED DIRECTION / IMPLEMENTATION PLAN / NOT IMPLEMENTED** | `PULL / CENTER / OPPOSITE / REACTIVE`, intent-only zero frequencies, existing Pull/流し/広角 technical skills, world and handed spray coordinates, contact-output direction; **DIR-01..26**. **Extends BAT's existing policy and swing, does not create a duplicate engine.** |

### 2026-10-26 Batter Swing Capacity × Intent × Context (SWG)

| ID | Link | Status | Dependencies / how to use |
| --- | --- | --- | --- |
| **SWG** | [Batter swing capacity, personal approach and count-dependent execution](superpowers/plans/2026-10-26-batter-swing-capacity-intent-context.md) | **USER-AGREED DESIGN PRINCIPLES / IMPLEMENTATION PLAN DRAFT / NOT IMPLEMENTED** | Follow-up to **BAT** (one BatterApproachPolicy and Swing Controller) and **DIR**. Separates physical potential from actual swing effort/speed; individual long-term preference from pitch-by-pitch count/manager/pitch context; continuous motor action from POWER/CONTACT labels. Reuse Native rigid-bat effective-mass contact; inspect true active worktree before integration. Do not treat plan presence as evidence of completed implementation. |

**Unified acceptance:** The three plans are interconnected, not three independently working products. Taken together their specified regression set is **CATCH-01..25 + BAT-01..29 + DIR-01..26 = 80 named acceptance cases**, subject to actual live-Core availability. Checking boxes in Markdown does not prove tests passed.

### Cross-cutting quality department — **newly created; not a fourth Match Core implementation plan**

| Topic | Entry | Status | Meaning |
| --- | --- | --- | --- |
| **Mini独立・王貞治Pilot（最新優先）** | [OOTP historical data as reference, Mini physics only](player-reconstruction/OOTP-FIRST-OH-PILOT-PLAN.md), [5-year league baseline](player-reconstruction/cases/sadaharu-oh-1972-1976-league-reference.json), [offline metric calculator](../tools/player-reconstruction/compute-oh-mini-benchmark.mjs) | **OBSERVED BENCHMARK PREPARED / TRUE SKILL NOT CALIBRATED / GAME NOT RUN** | **NO OOTP launch or Editor.** Historical data is a reference; original ODB is not a confirmed exported player-rating table. Need Mini Native skill generator → 1 physical Oh PA → full game only when genuine live-ball closure is connected; then user-ordered OB only, no mass calibration. |
| **選手再現部 / Historical OB reconstruction** | [Department README](player-reconstruction/README.md), [OB Prime Principles](player-reconstruction/PRINCIPLES.md) | **USER-DIRECTED PRINCIPLES / DOCUMENTATION & QA WORKFLOW / NOT IMPLEMENTED** | Frozen OB ability, full-career historical evidence, representative multi-year prime means, peak attainment without yearly scripted max. |
| Reproduction method / lightweight checks | [METHOD-V1-PROPOSAL](player-reconstruction/METHOD-V1-PROPOSAL.md) | **METHOD PROPOSED / NOT CALIBRATED** | Four focused REC checks when needed; use historical facts directly, no full-audit prerequisite. |
| Fixed OB + season fluctuation | [SEASON-EXPRESSION-PROPOSAL](player-reconstruction/SEASON-EXPRESSION-PROPOSAL.md) | **DESIGN OPTION / NOT APPROVED AS RUNTIME / NOT IMPLEMENTED** | First test daily Condition + matchup/physics variation; add slower coherent execution state only if evidence requires. |
| Sadaharu Oh prime example | [Reconstruction case 001](player-reconstruction/cases/sadaharu-oh-prime.md) | **PROVISIONAL / NOT CALIBRATED** | 引っ張り屋 candidate, 広角打法 hold, fixed skills, 55-HR-capable with no yearly guarantee. |
| **1936–2026 NPB era / league / ballpark reconstruction** | [NPB historical source atlas](player-reconstruction/NPB-SOURCE-ATLAS-1936-2026.md), [historical environment model](player-reconstruction/NPB-HISTORICAL-ENVIRONMENT-MODEL.md) | **SOURCE RESEARCH AND MODEL PROPOSAL / NOT IMPLEMENTED** | Official 1936 onward first-team, 1936–38 spring/autumn, no 1945, 1950 CL/PL, changed rules/stadiums, optional non-first-team. Known historical errors are annotated locally; former 16 ENV gates withdrawn by user. |
| **All public/hidden player ability and special-trait mapping** | [Capability/Trait Atlas](player-reconstruction/PLAYER-CAPABILITY-TRAIT-ATLAS.md) | **REFERENCE TO EXISTING CANONICAL; NOT IMPLEMENTED** | 02/04/08/09 current ratings, all Blue/Gold/Red/Green/Blue-Red Trait/MOVE/REJECT, batting/perception/physical/fielding/pitching, confidence and provenance. |
| **AI player reconstruction and research workflow** | [AI runbook](player-reconstruction/AI-RECONSTRUCTION-RUNBOOK.md), [official year index](player-reconstruction/sources/npb-official-season-index.json), [optional case schema](player-reconstruction/schemas/reconstruction-case.schema.json), [reference source registry](player-reconstruction/sources/npb-evidence-source-registry.json) | **REFERENCE TOOLS / GAME NOT RUN** | Evidence → era/roster → skills/traits → representative simulated seasons; **no mandatory historical mass-audit**. Annotations for known mistakes, optional metadata validator and rights check only when actually copying/redistributing data. |

**This department does not change the earlier three CATCH/BAT/DIR implementation plans into four, and the hidden “流れ” discussion remains independently undecided.**

### Discussion / decision pending, not an implementation plan

| Topic | Link | Status |
| --- | --- | --- |
| Hidden in-game “流れ” / short-term form | [In-Game Form discussion record](notes/2026-10-16-in-game-form-discussion.md) | **DISCUSSION ONLY / NOT DESIGN FROZEN / NOT IMPLEMENTED.** User proposed an unseen four-step in-game state with smaller execution effects than pre-game Condition; existing canonical seed's `Condition=1..5` conflicts with the colloquial 1..4 + 絶好調 / スランプ. Requires a separate decision, not magic momentum. |

## Other plans that an AI should actively find

| Document | Status / warning | Relevant domain |
| --- | --- | --- |
| **[Lossless mobile/desktop performance & scene-wide FPS — 2026-10-20](superpowers/plans/2026-10-20-zero-degradation-mobile-desktop-performance.md)** + [historical lv76 evidence](performance/2026-10-20-lv76-lossless-optimization-evidence.md) | **USER-DIRECTED QUALITY POLICY / FUTURE PORTING PLAN; LEGACY HTML EXPERIMENT VERIFIED / CURRENT GITHUB RUNTIME NOT INTEGRATED** | No visual/PNG/pixel/UI/audio degradation; no change to physical/official Core, observe one canonical scene time, raise scene-relative cadence and remove redundant work. Old lv76 v1/v2 benchmarks ≠ present project or Android/iOS telemetry; profile actual worktree first, include further headroom and multiplayer authority boundary. |
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


## v81 最新版への無劣化性能実装（2026-10-20）

[恒久標準](performance/PERFORMANCE-STANDARD.md)・[採否と実測](performance/2026-10-20-v81-lossless-results.md)。実装/3HTMLは `1f2155fd4c7241ca627dca53d288f28478c94654`（既存Draft PR #380、main未merge）。通常144/調整室60/メーカー64場面の画素一致、9回320＋別seed82球の全record一致。全673軌道を保持。全シーン同期更新を実装したが、初回起動コスト増・実機/60FPS全場面・Worker/GPU等は未達/未検証として残す。旧lv76証跡とは区別する。
