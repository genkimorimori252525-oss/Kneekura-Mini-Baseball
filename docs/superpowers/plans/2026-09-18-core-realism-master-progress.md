# Core Realism Master Progress — 2026-09-18

**Status:** ACTIVE MASTER PLAN.

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
| P1 | Correct NPB rule result | Implementation complete; CI pre-step blocked |
| P2 | Canonical time / world / plate appearance | Advanced partial |
| P3 | Ratings / physical calibration | Foundation only |
| P4 | Scouting / pre-play alignment | Foundation only |
| P5 | Nine-defender decisions / coverage / throws | Advanced partial |
| P6 | Individual baserunning / special plays | Partial |
| P7 | Manager plate-appearance commands | Not yet integrated |
| P8 | Mini observation renderer | Prototype/foundation only |
| P9 | Statistical validation / Natural contract | Not started |

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

## 5. Next Core focus rotation

### A. P1 rule gap audit — closed

P1 roadmap implementation is now complete for the core acceptance set.

Added/confirmed:
- RuleProfile / NPB 2026;
- pitch-count terminal rules;
- ordinary foul vs foul-bunt semantics;
- caught/uncaught foul-fly rule integration;
- force obligations and force dissolution;
- first-base force result;
- third-out scoring;
- runner precedence;
- tag arrival;
- tag-up / appeal;
- advantageous fourth out;
- infield-fly batter-out/force-removal semantics;
- half-inning transition;
- consolidated `P1RuleAcceptanceMatrix`.

CI still fails before workflow steps execute, so this is an implementation-complete status rather than a repository-GREEN claim.

### B. CURRENT FOCUS — Build the P2 canonical plate-appearance timeline

Current causal pieces must become one authoritative play progression:

```text
pitch
 -> batter decision/action
 -> bat-ball contact OR take/miss/foul
 -> count transition OR live ball
 -> fielding/running
 -> play end
 -> CanonicalMatchState transition
```

This is the next large non-defense integration target.

### C. Start P3 unified ratings and physical profile

Introduce a player-owned calibration boundary rather than passing anonymous fixture numbers forever.

Planned shape:

```text
PlayerPhysicalProfile
  heightMeters
  optional armSpanMeters
  optional legLengthMeters
  ...
        |
        +--> Core calibration
        |      bodyOriginHeight
        |      maximumLegReach
        |      glove/tag reachable region
        |
        +--> Presentation calibration
               Mini dot-size scale
```

Important:

- height is not a direct success bonus;
- height is not the only possible reach determinant;
- future arm span / leg length can override simple proportional assumptions;
- no skeleton or 3D character model is required for Core;
- physical primitives remain numerical state only.

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

## 9. CI evidence caveat

GitHub Actions is currently repeatedly terminating the P0 Core verify job before workflow steps execute (`steps=[]`).

Until that infrastructure blocker is resolved:

- local/TDD design evidence can advance;
- do not claim full-repository GREEN from GitHub Actions;
- keep implementation and CI-infrastructure status separate.
