# Shared Live Play Registry and PlayEnd Assembly Plan

**Goal:** compose approved live action/event sources into one revisioned registry, global event watermark, ActionFrontier, and physical PlayEnd resolution.

**Base:** PR42 head `95e89b22bbe7fc94d68d111702f912e49431dcde`.

**Constraints:**
- no new physics, outcome sampling, scoring or UI;
- preserve existing ActionFrontier/EventQueueWatermark authority;
- no arbitrary inactivity timeout;
- stale registry/source updates must not overwrite newer work;
- removed source IDs must not resurrect at an old source revision;
- OfficialPlayClosure remains separate.

## Tasks

- [x] RED tests for empty/quiescent PlayEnd, runner work, event watermark, unresolved evidence, information/decision blockers and dead-ball semantics.
- [x] Implement revisioned `LivePlayRegistry` and source upsert/remove.
- [x] Assemble existing watermark -> frontier -> PlayEnd chain.
- [x] Delegate duplicate work-ID rejection to existing ActionFrontier.
- [x] Add hostile-input/unknown-terminal regression tests.
- [x] Descriptor-clone registry/runtime input before property access and validate terminal enum.
- [x] Add stale-source-resurrection regression and retired-source revision tombstones.
- [ ] Exact-final-head native verification + evidence artifact inspection.
- [ ] Publish stacked PR and keep unmerged.

Deferred: canonical database transaction/exactly-once store, automatic actor-settlement policy, all remaining live-action source producers, post-PlayEnd appeals/reviews and OfficialPlayClosure.
