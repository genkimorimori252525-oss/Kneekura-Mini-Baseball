# Physical event adoption v1 — headless API

This slice continues the ActionFrontier chain after connected runner/throw/defensive actions. It converts existing physical calculations into exact-tick event proposals without deciding baseball rules, scoring, UI, or rendering.

Implementation: `src/core/sim/liveAction/PhysicalEventAdoption.ts`.

## Runner base touch

`forecastRunnerBaseTouch(input)` reuses the existing `RunnerMotionTrajectory`, runner route, base geometry and body-contact lead model to derive the first physical base-touch tick.

`projectPhysicalEventForecast(forecast, currentTick)` exposes that future touch as event-source watermark evidence plus pending `runner_motion` work, so a known future touch cannot disappear behind an early PlayEnd.

`adoptRunnerBaseTouchAtTick(input)` emits the existing `RunnerBaseTouchFact` only at the exact touch tick and only if the current runner body still matches the saved physical trajectory. Rebased motion invalidates the old touch; a late scheduler never backdates it.

## Throw reception

`forecastThrowReception(input)` reuses:

1. accelerated glove/ball contact geometry from `DefenderThrowReceptionContact`;
2. existing `CatchRetention` energy/capacity physics.

No catch-success roll is introduced.

Glove contact and secure possession remain separate authoritative events.

`adoptThrowReceptionContactAtTick` verifies the exact current ball and glove state at contact.

- retained contact -> emits `GloveBallContactOccurred`, keeps a `possession_transition` blocker, and leaves the source watermark open until the secure tick;
- failed retention -> emits `GloveBallContactOccurred` + `CatchRetentionFailed`, closes this event source, and hands the returned live-ball state to downstream `ball_motion`.

`adoptSecurePossessionAtTick` cannot run from the forecast alone. It requires the matching adopted `GloveBallContactOccurred` event and current retained control. Only then may it emit `SecurePossessionEstablished`.

## Controlled tag

`forecastControlledTag(input)` reuses the existing physical tag-contact solver. Contact must not precede the supplied secure-possession time.

`adoptControlledTagAtTick` requires continued possession plus the exact current tagger/runner contact primitive states. It emits the existing `ControlledRunnerTagFact` only at the physical contact tick.

The tag fact does not mean OUT. Base protection and OUT/SAFE remain RuleEngine responsibilities.

## Common scheduling behavior

All forecasts carry an explicit `forecastId`, `actionKey`, and authoritative `dueTick`.

Before due tick -> `WAITING`.
After due tick -> `MISSED_EVENT` and no backdating.
Changed physical basis -> `INVALIDATED`.
Exact current basis -> `ADOPTED`.

Missed/invalidated work closes this event source's watermark. Successful outcomes return any required downstream physical handoff so ActionFrontier cannot become quiescent merely because one event was adopted.

## Input integrity

Runtime adoption inputs are cloned through a descriptor-based inert-data validator before any property is read. Active getters/accessors, functions, symbols, cycles, non-plain objects, malformed arrays, non-finite numbers, and excessive depth/size are rejected without executing caller code.

Forecast construction itself is a Core-internal physical calculation boundary and expects authenticated physical source inputs. This v1 does not provide a durable cryptographic forecast receipt. If forecasts are persisted/restored, the host must authenticate their provenance or regenerate them from canonical physical state before use.

## Host responsibilities

The host still owns:

- the active event/action registry and global exactly-once identity;
- authentic forecast/source provenance across persistence;
- global watermark composition and full ActionFrontier assembly;
- replacing physical handoff blockers with downstream owners;
- atomic canonical world + event-log writes;
- downstream ball flight, reception chains, runner/defender continuation and interruption;
- RuleEngine interpretation of base touch/tag/possession facts;
- PlayEnd and later OfficialPlayClosure;
- crash recovery and long-run validation.

No Presentation/UI/rendering code is touched.
