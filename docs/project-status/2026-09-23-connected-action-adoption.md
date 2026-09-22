# 2026-09-23 — Connected action adoption

Base: PR40 `2267cccf1fbfd3b8994a966a0db653d3b51aa3fd`.

Implemented exact runtime adoption for runner control activation, throw release and defensive replan. Each accepted action can project pending intent/physical work plus an event-source watermark into ActionFrontier.

Runtime adoption revalidates the original receipt, current scope/world/emotion and the relevant physical basis. Old work is invalidated on rebase/possession loss/superseding emotion rather than forced. Runner control changes at the reaction event; throw release requires continued possession; defensive replan begins from exact current position/velocity.

TDD history includes explicit RED commits for rewritten receipts, cancellation/frontier handoff, pre-vs-post runner activation state, hostile active getters, and the public index. Getter-boundary GREEN checkpoint `a5db883`: 298 files / 2,412 tests. Public-seam GREEN checkpoint `2590fc5`: 299 files / 2,413 tests.

Author self-review only; no independent reviewer agent is available in this harness.

Final exact-head verification is recorded in the stacked PR after docs/evidence workflow publication.

Still excluded: persistent event registry, atomic world+event storage, downstream throw flight/reception/tag, motion-derived runner/defender contacts, complete actor policy/frontier assembly, general PlayEnd integration, post-PlayEnd adjudication/OfficialPlayClosure, long-run validation, UI/rendering.
