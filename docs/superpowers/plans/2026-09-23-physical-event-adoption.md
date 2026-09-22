# Physical Event Adoption Implementation Plan

**Goal:** extend the approved ActionFrontier chain from scheduled actions to exact physical events using existing Core geometry/physics.

**Base:** PR41 head `63394394c509b78a00a81a4194a350d35063f2c2`.

## Constraints

- Reuse existing runner, reception, retention and tag physics.
- A physical forecast is not a canonical event.
- Never backdate a missed event.
- Current physical state must still match at adoption.
- Contact and secure possession are separate events.
- Physical facts do not decide OUT/SAFE or scoring.
- No new UI/rendering, persistence, OfficialPlayClosure or second physics engine.

## Task 1 — exact event forecasts/adoption

- [x] RED tests for runner base touch, throw reception/retention and controlled tag.
- [x] Implement forecast -> ActionFrontier projection -> exact-tick adoption.
- [x] Preserve downstream ball/possession handoffs.
- [x] Verify existing Core physics supplies event ticks.

## Task 2 — causality audit

- [x] RED regression: secure possession cannot be adopted before its glove-contact event is canonical.
- [x] Require matching adopted contact evidence before secure-possession event.
- [x] Keep failed catch as live-ball continuation.

## Task 3 — hostile runtime input audit

- [x] RED tests show active `forecast` / `currentBody` getters were invoked.
- [x] Clone and validate all runtime adoption request objects before any property read.
- [x] Whole-suite GREEN after the fix.

## Task 4 — close the slice

- [x] Document API, boundaries, and host responsibilities.
- [ ] Exact-final-head native verification with evidence artifact.
- [ ] Publish stacked PR, leave unmerged.

## Deferred

Durable forecast authentication, event database/exactly-once persistence, generic secure-possession fact for every possession source, downstream multi-hop throw/reception/tag chains, arbitrary runner/defender contacts, complete live-action registry, full PlayEnd integration, OfficialPlayClosure, and UI/rendering.
