# Connected Action Adoption Implementation Plan

**Goal:** connect accepted runner, throw and defensive-replan actions to ActionFrontier and exact runtime event adoption.

**Base:** PR40 head `2267cccf1fbfd3b8994a966a0db653d3b51aa3fd`.

**Constraints:** world-first causality; no backdating; current physical state must still match; stale/rebased/superseded actions cancel; saved receipts are recomputed; no UI/rendering/persistence/OfficialPlayClosure.

## Tasks

- [x] Runner projection and reaction-tick activation.
- [x] Throw release projection/adoption with possession/body revalidation.
- [x] Defensive replan activation from exact current position/velocity.
- [x] Closed watermark on missed/invalidated scheduled actions.
- [x] Preserve throw handoff and remaining runner/defender physical frontier work.
- [x] Recompute mutated/restored acceptance receipts.
- [x] RED→GREEN hostile top-level getter tests.
- [x] RED→GREEN public scheduling module seam.
- [ ] Exact-final-head native verification + artifact inspection.
- [ ] Publish stacked PR and keep unmerged.

Deferred: downstream throw flight/reception/tag adoption, runner/base-touch and defender/contact event generation, full arbitrary-play frontier assembly, persistence, PlayEnd integration across all families, OfficialPlayClosure.
