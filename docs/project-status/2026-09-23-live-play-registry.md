# 2026-09-23 — Shared live-play registry

Base: PR42 `95e89b22bbe7fc94d68d111702f912e49431dcde`.

This slice assembles independent live-action/event-source contributions into the already approved EventQueueWatermark -> ActionFrontier -> PlayEnd chain.

Implemented:

- revisioned registry of active live-play sources;
- source queue/work contribution aggregation;
- CAS-style registry updates;
- monotonic source revisions;
- removed-source revision tombstones to prevent stale work resurrection;
- global watermark composition;
- ActionFrontier assembly;
- physical PlayEnd resolution using the existing terminal semantics;
- inert input cloning and explicit terminal-value validation.

The registry does not calculate motion/contact, does not decide OUT/SAFE or scoring, and does not implement OfficialPlayClosure.

Self-review findings addressed with tests:
- active getters at registry/runtime boundary;
- unknown terminal values;
- stale source resurrection after removal.

Final exact-head verification is recorded on the stacked PR after the evidence workflow completes.

Still outside this slice:

- persistent exactly-once event/action store;
- atomic world/event database transaction;
- automatic actor-disposition policy;
- source generation for every remaining live-play process;
- post-PlayEnd appeal/review ledger;
- OfficialPlayClosure and durable next-play activation;
- UI/design/rendering.
