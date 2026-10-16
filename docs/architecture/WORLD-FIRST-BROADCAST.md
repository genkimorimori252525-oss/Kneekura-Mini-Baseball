# World-First Baseball / Low-FPS Broadcast Contract

> **Status:** NAVIGATION / PRINCIPLE RESTATEMENT. These principles come from established Mini Baseball decisions and approved presentation/physical-world specifications; this page is a map and explanation, **not a new simulation implementation**.
>
> **Snapshot:** 2026-10-16 / working branch `jolly/core-foundation-plan-2026-09-17`.

## The user-intended picture

**The baseball match is actually taking place in a physical, time-indexed stadium.** The players, batter, bat, pitcher, ball, runners and fielders exist and act there, subject to perception, tactics, motion, collisions and rules. A low-frame-rate camera broadcasts some of that live world. The camera **does not make the world happen**.

> **「計算は精密、映像は粗い。」**  
> **World First. Render / Broadcast Second.**
>
> “The world moves entities; baseball rules interpret what happened.”

This distinction applies even when the viewer sees a pixelated PNG figure, discrete 4px movement, a 55ms screen update or a camera cut. The low visual sampling rate is a property of **observation**, not a coarse collision/rules frequency. Also, physically detailed simulation need not run at real wall-clock speed; headless/replay/paused presentation must still reproduce the same canonical event sequence for the same seed, inputs and Core version.

## Causal pipeline — never reverse arrows

```text
Match context, rules, players, actual physical state
       + players' own imperfect observations
       + pre-pitch scouting / manager commands / memory
                  ↓
         Person-specific intents
                  ↓
      Physical action and ball/bat motion
                  ↓
       Physical contact / field events
                  ↓
       Rule interpretation / umpires /
          reviews / official scoring
                  ↓
       CanonicalWorldSnapshot + events
                  │
        read-only observation
                  ▼
   Presentation Adapter / Camera / Replay
                  ↓
        Mini broadcast (low FPS,
         4px grid, approved PNG art)
                  or
      Natural broadcast (future 3D)
```

Physical events can be evaluated before the presentation frame; no renderer may define contact or official timing by rounding to the nearest displayed frame. The `CanonicalMatchState` record is the official score/count/bases-facing state, not a substitute for moving 3D actors or the intermediate physical world.

## Two independent clocks

| Clock | Owns | Must not own |
| --- | --- | --- |
| **Simulation / canonical event clock** | World motion, precise event order, ball/bat/glove/base collisions, decisions and time of rules-relevant actions | Camera framerate, CSS/tween timing, whether display is open |
| **Presentation / broadcast clock** | Which actual canonical time to show, camera/crop, visibility and quantization, low-rate output, replay speed | Pitch selection, actual body movement, scored runs, umpire timing |

The adopted Mini visual presentation has a **55ms/display-step standard** (~18.18 updates per second) and a **4px presentation grid**. These are not 55ms physics ticks or 4px physical coordinates. A device might present at 30/60fps while reusing or observing snapshots; the logical game result cannot vary. Important contact/catch/tag/base-touch frames can be explicitly retained.

The underlying time spec suggests integer microsecond event coordinates, fixed physics steps plus precise interval events, analytic/swept contact or fixed-repetition refinement. The spec's example 2ms is **not a universally finalized physics step**.

### Frame sampling and interpolation — preserve status boundaries

- The adopted `07-drone-art-presentation.md` prohibits **invented tweened entity trajectories**, and favors observation of sufficiently dense canonical snapshots or deterministic Core-owned motion segments.
- The later [2026-10-14 first playable slice plan](../implementation/2026-10-14-tbd-vs-lad-match-slice.md) proposes **2× ball visual sampling/interpolation**; its status is **IMPLEMENTATION PLAN / NOT YET VERIFIED**, not permission to change simulation ticks, geometry, official results or adopted art.
- **Known wording tension:** the older `00-decisions.md` allows presentation-only interpolation in general; the later discrete-view specification rejects casual visual tweening, and the 10/14 proposal mentions ball interpolation. Do **not** silently choose whichever is convenient. Before implementing, decide which **Core-grounded ball resampling** is allowed under the adopted discrete-broadcast style, document the precise exception (if any), and demonstrate official-results invariance.
- Neither a display refresh increase nor frame resampling means a 60Hz screen magically displays 120 truly distinct refreshes.

## The stadium and the camera are not sprites

The stadium is world geometry for lawful fielding, wall/ground contact, ball flight and runner movement, not a background painted around fixed player sprites.

Camera plans include:
- Batter viewpoint for the batting side.
- Pitcher-side observation from behind the catcher (the user's requested catcher-behind pitcher view).
- Overhead field observation after the true `BatBallContact` event.
- Camera orientation/handedness follow actual world coordinates; do not mirror the world to make a left-hander image convenient.
- Drawn physical ball height/spin and bounces derive from the underlying ball state; no “fly ball” label switching to a pre-authored animation.
- Physical bat vs displayed PNG bat are separate: the approved presentation may render symbolic 4-frame animation/PNG artwork, but it does not supply the physical bat's true position/velocity to physics.

**Current media choice as of 2026-10-01:** continue the approved PNG player originals. The Pixel Player JSON system and experimental v1/v2 variants are **ARCHIVED / ON HOLD** (see [continuation](../presentation/2026-10-01-png-player-continuation.md), [PNG manifest](../presentation/2026-10-01-png-baseline-manifest.json), and [archive](../archive/pixel-player-system/README.md)). Retained experimental code and preview files are not automatically production systems.

## What a smarter simulation must respect

1. **Individual information boundaries:** batter guesses pitch family/course using available evidence; catcher estimates batter intent from observed actions; defenders and umpires observe instead of accessing all future truth.
2. **Skills vs intentions:** `キャッチャー G〜A / 球界の頭脳`, batter contact/power/discipline, Pull/流し/広角, and Green preferences influence relevant sources and decisions. Labels never directly apply a hit/strikeout/win modifier.
3. **No forced outcomes:** “Pull intent 100%” or “Opposite intent 0%” does **not** force the corresponding observed batted-ball direction. Actual exit vector/spin is from contact geometry.
4. **Players move even when not on-camera:** all nine defenders, runners, base coverage, backup and the live ball belong to the same canonical world. Invisible does not mean uncomputed.
5. **Same seed / same inputs / same Core version -> same authoritative results**, regardless of PNG/3D, headless, 30/60fps or camera choices.

## Existing implementation is not the full ideal yet

As checked in the working GitHub branch, `src/core/index.ts` exports deterministic seed/clock, canonical match/world types, a bat-ball contact function, flight samples and a contact vertical slice. **Those are code evidence of partial foundations, not confirmation that full nine-inning physical gameplay is working**. The current [TBD home vs LAD match plan](../implementation/2026-10-14-tbd-vs-lad-match-slice.md) itself says `NOT YET VERIFIED`.

Other Codex branches or the user's local PC may contain more recent and extensive work. Consult [status and local reconciliation](../implementation/GITHUB-LOCAL-STATUS.md) rather than overwriting or dismissing it.

## Evidence / original owners

- [00-decisions.md — D-002, D-008, D-009, D-010, D-011, D-012](../game-design/00-decisions.md)
- [Current Design Handoff — current statuses and overrides](../game-design/00-current-design-handoff.md)
- [07-drone-art-presentation.md — V-001.. and 55ms/4px display](../game-design/07-drone-art-presentation.md)
- [Time, Running, Catching, Perception and Umpires](../superpowers/specs/2026-09-17-time-running-catching-perception-umpire-design.md)
- [Causal Contact and Individual Defense](../superpowers/specs/2026-09-17-causal-contact-and-individual-defense-design.md)
- [PNG player continuation / archive boundaries](../presentation/2026-10-01-png-player-continuation.md)
- [10/14 first playable slice — future, not verified](../implementation/2026-10-14-tbd-vs-lad-match-slice.md)

This page summarizes established philosophy; **if any wording conflicts with later explicit user-approved canonical changes, use that canonical source and update this navigation page**.
