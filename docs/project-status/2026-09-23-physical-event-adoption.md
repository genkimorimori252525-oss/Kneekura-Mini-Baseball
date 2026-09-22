# 2026-09-23 — Physical event adoption

Base: PR41 `63394394c509b78a00a81a4194a350d35063f2c2`.

This slice adds headless exact-tick adoption for three downstream physical-event families:

- runner base touch from the existing runner trajectory + route/base geometry;
- throw glove contact -> catch retention -> secure possession or failed-catch live-ball handoff;
- controlled runner tag from existing tag-contact physics.

It adds no new outcome probability and does not decide OUT/SAFE.

## TDD / audit history

Initial implementation tests established exact timing, ActionFrontier visibility, rebase invalidation and live-ball/possession handoffs.

A causality review found that secure possession could otherwise be requested from a forecast without proving its prior glove-contact event had actually been adopted. A regression was added before the fix; secure possession now requires the matching `GloveBallContactOccurred`.

A later hostile-input review found runtime adoption read top-level fields before inert validation. Run `35780427792` reproduced exactly two getter failures. Commit `32d3895` validates/clones all runtime adoption objects before property access; run `35781051539` then passed **301 files / 2,424 tests**, including 9 physical-event tests and 2 hostile-input tests. Frozen P9 fingerprints remained unchanged.

Author self-review only; no independent reviewer agent is available in this harness.

## Not completed by this slice

- persistent exactly-once event storage;
- durable/authenticated restored forecast receipts;
- generic possession evidence for every possible preexisting holder;
- downstream multi-hop throw flight/reception/tag orchestration;
- all runner/defender contact families;
- complete arbitrary-play ActionFrontier registry and actor policy;
- general PlayEnd -> adjudication -> OfficialPlayClosure integration;
- season/career long-run validation;
- UI/design/rendering.

The final PR records exact-final-head verification after documentation/evidence workflow publication.
