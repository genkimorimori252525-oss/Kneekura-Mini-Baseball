# Action Frontier and exact event adoption implementation plan

> Continue the user-approved nonvisual implementation queue. Use test-first changes and existing Core authorities; do not introduce UI, rendering or a second match engine.

**Goal:** implement the first approved ActionFrontier finalization boundary, event-queue watermark, and exact-tick adoption of the connected batting forecast.

**Authority:** `docs/game-design/05-world-first-live-ball-architecture.md` and `06-world-first-runtime-contracts.md` on `jolly/core-realism-2026-09-18`; batting consumer PR39 head `ee5f64873afb8dfdf12a3c9584bd5631e4f00ebf`.

## Constraints

- World and canonical events own truth; forecasts do not.
- PlayEnd is physical-live-action closure, not OfficialPlayClosure.
- Same-tick canonical events must be settled before PlayEnd.
- No arbitrary inactivity timeout.
- Only information already causally in flight may block the live frontier.
- No future canonical event may be inserted early or backdated after its authoritative tick.
- Reuse existing CanonicalPlateAppearanceTimeline recorders.
- UI/design/rendering and persistence are excluded.

## Task 1 — specify the frontier and watermark

- [x] Add failing tests for all live-work categories, explicit actor settlement, terminal exits, rule windows and same-tick watermark.
- [x] Add failing tests for multi-source event settlement and next-pending constraints.
- [x] Implement minimal frozen `LiveActionFrontier`, explicit blockers and `resolvePlayEndFromFrontier`.
- [x] Implement source-combined `resolveEventQueueWatermark`.
- [x] Run the full repository verification.

## Task 2 — exact batting event adoption

- [x] Add failing tests for WAITING / exact ADOPTED / MISSED_EVENT / ALREADY_ADOPTED / unresolved forecast.
- [x] Require exact canonical cursor history and recompute the saved physical result at adoption.
- [x] Reuse existing timeline recording path; same-tick physical + count events remain an atomic batch.
- [x] Prevent unresolved physical forecasts from falsely advancing the watermark beyond known canonical evidence.
- [x] Run the full repository verification.

## Task 3 — close the slice

- [x] Self-review the implementation against the authoritative ActionFrontier sections.
- [x] Document the API and explicit host responsibilities.
- [ ] Run exact-final-head native verification and inspect install/verify logs and artifact.
- [ ] Publish a stacked PR against PR39 and leave it unmerged.

## Deferred by design

OfficialPlayClosure, appeal/review adjudication state, next-play durable MatchState activation, general multi-action scheduler, running/throwing/defense event adoption, live source generation, crash-safe persistence and UI remain separate work.
