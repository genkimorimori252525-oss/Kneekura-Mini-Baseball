# Core Realism Master Progress — 2026-09-18

**Status:** P0-P9 FOUNDATION COMPLETE AND VERIFIED; POST-ROADMAP CALIBRATION ACTIVE.

This document is the parent progress map for Shared Match Core realism work on `jolly/core-realism-2026-09-18`.

It does not replace `docs/game-design/03-roadmap.md`. The P0-P9 roadmap remains authoritative. This file exists to prevent a deep local vertical slice from being mistaken for the whole Core project.

## 1. Core objective

Mini Baseball is not a simplified baseball engine.

The target is one authoritative Match Core shared by:

```text
                  Shared Match Core
                 /                 \
                /                   \
        Mini Presentation      Natural Presentation
          points / bat          future 3D models
```

The Core owns baseball truth:

- rules;
- pitch / swing / contact;
- ball physics;
- player perception and decisions;
- defender and runner motion;
- catch / throw / tag / base-touch timing;
- scoring and official rule consequences;
- deterministic event time.

Presentation observes that truth. It does not create it.

## 2. Parent roadmap mapping

| Roadmap | Workstream | 2026-09-18 state |
| --- | --- | --- |
| P0 | Core boundary / determinism | Complete |
| P1 | Correct NPB rule result | Implementation complete; full CI verified |
| P2 | Canonical time / world / plate appearance | Implementation complete for roadmap foundation; full CI verified |
| P3 | Ratings / physical calibration | Roadmap foundation complete; full CI verified |
| P4 | Scouting / pre-play alignment | Roadmap foundation complete; full CI verified |
| P5 | Nine-defender decisions / coverage / throws | Roadmap foundation complete; full CI verified |
| P6 | Individual baserunning / special plays | Roadmap foundation complete; full CI verified |
| P7 | Manager plate-appearance commands | Roadmap foundation complete; full CI verified |
| P8 | Mini observation renderer | Roadmap foundation complete; full CI verified |
| P9 | Statistical validation / Natural contract | Foundation complete; fixed-seed frozen; initial batch calibration verified |

## 3. Why recent work looked like a defense-only project

The recent first-base work deliberately used one difficult baseball event as a **causal integration probe**.

A first-base ground-ball race crosses several parent phases at once:

```text
P2 physical time/world
   runner trajectory
   thrown-ball/glove contact
        +
P5 defender perception/movement/coverage
        +
P6 runner movement/base touch
        +
P1 correct force-out/scoring rule
        ↓
one exact OUT / SAFE / simultaneous result
```

Therefore the work was useful, but it is not the entire plan.

The defense branch must stop deepening once the integration boundary is proven. New defender realism work should only proceed when it closes an explicit P5 acceptance condition or is required by another parent phase.

## 4. Current first-base vertical slice checkpoint

Implemented foundations include:

- batter stance to first-base geometry;
- swing-exit body state to runner launch;
- recovery world trajectory;
- unified batter-runner world timeline;
- prebuilt RunnerMotion trajectory sampling;
- exact runner foot/hand base-touch timing;
- runner physical fact -> existing RuleEngine;
- accelerated glove-ball contact;
- catch contact vs secure possession separation;
- catch-retention success/failure with live-ball continuation;
- defender body / glove / hand / left-foot / right-foot numerical physical primitives;
- exact 3D sole-point/base-surface contact;
- secure-possession + foot/base overlap -> defender control tick;
- defender physical control fact -> existing RuleEngine;
- fully physical first-base race evidence chain;
- defender body-cover target separated from physical base center;
- bounded defender foot reach from body kinematics.

The base-cover integration checkpoint is now closed by regression `958c768f...`:

```text
base-cover decision
  -> body-cover movement target
  -> DefenderMotion
  -> DefenderBodyKinematics
  -> bounded foot reach
  -> actual base contact
```

This satisfies the defender-anatomy stop condition. Do not continue expanding first-base anatomy by default.

## 5. Roadmap closure and next Core focus

The original P0-P9 roadmap foundation is now implemented and verified.

Verification closure includes:

- full self-hosted GitHub Actions execution rather than pre-step failure;
- representative fixed-seed evidence reproduced on the exact same source head across two CI attempts;
- frozen fixed-seed expectations verified after the freeze commit;
- renderer OFF / Mini / Natural presentation isolation;
- deterministic 1,024-contact batch calibration using the same contact corpus through multiple defensive alignments;
- no Presentation state used as Core or calibration input.

The next work is no longer "finish P2" or "start P9".

Post-roadmap priorities are:

1. broaden production causal outcome resolution where validation-only buckets still stand in for incomplete game paths;
2. calibrate larger deterministic corpora against explicit baseball targets rather than tuning to a preferred result;
3. measure full-game / season-scale throughput;
4. preserve fixed-seed regression fingerprints while statistical calibration changes;
5. build Natural Presentation strictly as an observer of canonical world / event state.

The existing first-base and defensive vertical slices remain useful regression evidence, but should not become a reason to keep deepening one subsystem without a new acceptance target.

## 6. Anthropometrics and point rendering

The current Mini design uses roughly 10px player pieces as the baseline visual size.

Treat that size as the presentation representation of an average physical profile.

Initial visual candidate:

```text
smaller profile  -> 9px
average profile  -> 10px
larger profile   -> 11px
```

These values are not yet final calibration.

The architecture is:

```text
PlayerPhysicalProfile
        |
        +--> physical reach / body dimensions
        |
        +--> visual point-size tier
```

Never:

```text
visual point size
        -> collision radius
        -> baseball result
```

For Batter POV or any perspective view, body visual scale may combine with camera apparent scale inside Presentation only.

## 7. Rendering remains deliberately simple

Internal physical state may contain:

- body origin;
- glove;
- tag hand;
- left foot;
- right foot;
- bat rigid-body state;
- ball 3D state.

Mini is still free to render:

```text
defender = one point
runner   = one point
batter   = bat-centric minimal representation
ball     = one point
```

The physical primitives are adjudication geometry, not render geometry.

Natural Baseball may later visualize a human model whose limbs are aesthetically consistent with those events, but its model bones do not become the source of physical truth.

## 8. Focus discipline

Before creating a new realism sub-plan, identify its parent roadmap phase and acceptance condition.

Template:

```text
Parent phase:
Acceptance condition closed:
Why existing Core cannot satisfy it:
Minimal new physical/rule boundary:
What is explicitly deferred:
```

If a new task only makes one local subsystem more anatomically detailed but closes no roadmap acceptance condition, defer it until P9 evidence demonstrates that the approximation is inadequate.

## 9. CI recovery and verification evidence

The historical GitHub Actions pre-step blocker is resolved for the current validation path.

Key evidence:

- `35394466844` attempt 1 and attempt 2 on `83d01d52...`: 228 files / 1065 tests green and identical unfrozen fixed-seed fingerprints;
- `35395593056` on `c3a409cf...`: 228 files / 1065 tests green with all frozen fixed-seed expectations matching;
- `35396396378` attempts 1 and 2 on `8b306a15...`: 229 files / 1068 tests green on both attempts, with identical deterministic 1,024-contact batch calibration evidence;
- calibration fingerprint: `f5058efd2d23784c`.

Implementation status and CI status are now aligned for the P0-P9 foundation.