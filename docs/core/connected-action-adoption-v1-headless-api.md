# Connected action adoption v1 — headless API

This slice connects accepted runner control, throw release, and defensive replan plans to PR40's ActionFrontier/event-watermark boundary. It does not implement persistence, OfficialPlayClosure, UI, or rendering.

Public import: `src/core/world/psychology/scheduling/index.ts`.

## Projection

`projectRunnerActionFrontier` and `projectFieldingActionFrontier` revalidate the saved acceptance receipt and expose:

- exact due tick;
- source watermark / next pending event;
- pending intent work;
- pending physical work.

A projection is not a canonical event and does not mutate world state.

## Exact-tick adoption

`adoptRunnerControlAtTick` accepts the runner control change only at the reaction tick. Position/speed must still match the saved trajectory while the canonical body is still in its pre-activation control mode. The event itself changes control ownership. Rebase, newer emotion state, stale world/scope, or a missed tick cancels the old plan rather than forcing it.

`adoptFieldingActionAtTick` handles two boundaries:

- throw release: same ball/holder/origin/holder velocity must still hold at the exact release tick;
- defensive replan: exact current defender position/velocity must still match at motor onset.

Lost possession or rebase invalidates instead of backdating or snapping an actor onto an obsolete plan. A successful throw release returns a physical handoff blocker which must be replaced by the downstream flight owner.

## Integrity

Saved acceptances are recomputed with the existing acceptance functions and must match exactly. Runtime adoption input is cloned with the inert-data validator before any property is read; accessors/getters, functions, symbols, cycles, malformed descriptors and non-finite values are rejected without executing caller code.

A missed/invalidated action returns a closed source watermark. The host removes that action's old projected work from its active frontier set.

## Host responsibilities

The host owns the complete active-action registry, global watermark composition, actor dispositions, canonical event/world atomic application, downstream throw flight/reception/tag work, subsequent runner/defender motion and interruption, global deduplication, persistence/crash recovery, PlayEnd finalization and later OfficialPlayClosure.
