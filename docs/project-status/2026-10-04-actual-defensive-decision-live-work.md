# Actual defensive decision live work (2026-10-04)

This additive, read-only slice implements the decision portion of the approved perceived-to-motor plan's source-specific frontier. It follows `06-world-first-runtime-contracts.md` §9 and the existing scheduled acquisition/throw projections. It changes no visual or product design.

## Owned read boundary

`openSqliteActualDefensiveDecisionLiveWork(path).read(decisionSourceId)` opens SQLite read-only, enables query-only mode, and rederives one accepted actual defensive decision and its exact observation dependency within a single read transaction. It creates no schema, receipt, decision, Source, physical step or registry row. No authority callback or caller-supplied decision payload is accepted. A missing owned Source returns `null`; corrupt owned evidence rejects.

`actualDefensiveDecisionLiveWorkFromSqlite(db)` is the equivalent same-connection seam for an existing owner. Its caller must supply an existing read transaction/snapshot when atomic multi-query visibility is needed. It does not start or commit the caller's transaction.

The result pins decision Source/hash, original decision-model and contextual-plan Sources/hashes, observation hash, and exact observation/base-field/execution cut. Repeated and reopened reads reproduce the same frozen projection. Historical reads use that decision's observation prefix, not the current observation or physical head. Future ownership metadata remains subject to the original owner's integrity checks; newer non-identity receipt payloads remain opaque and cannot contribute work.

## Projection contract

`deriveActualDefensiveDecisionLiveWork` is a strict inert-data pure projection. Its input is not proof of ownership; the Native adapter above supplies rederived evidence. It validates exact shape, IDs, original clock/availability, deadline arithmetic, evidence chronology and phase consistency. Recorded-tick equality never substitutes for exact elapsed-time eligibility.

- `pending_decision` contributes this Player's decision work at its original decision deadline
- `pending_first_step` contributes its selected intent at the original first-step deadline
- `issued` closes only the decision lifecycle and emits an `intent_issued` receipt. An explicit motor/adoption successor remains pending at the original deadline, even if the observation/issuance receipt became available later
- A `hold` choice remains motor/adoption work. It is not actor settlement
- The unchanged exact first-step deadline and later issue availability are separately exposed; neither is invented physical execution

Source, work, action and event identifiers are JSON-encoded namespaces of physical pitch, Player and original decision, with accepted decision Source/revision on issue events. They do not depend on array order. Output is deeply frozen and detached from input.

No queue-generation/consumption watermark is proved: both projected sources have `queue: null`. The decision-only completion field establishes neither motor completion nor a settled queue. Consumers must retain the successor. This projection never calls a registry/finalizer, supplies actor dispositions, fabricates sensory/communication latency, or reports an all-play result.

## Boundaries

Motor receipt admission, command adoption, executed-through/coverage accounting, all ten actors, compositor, physical advancement, blocked capture/transfer changes, Native registry completeness, PlayEnd, rules consumption, scoring, official closure, UI and Presentation remain outside this slice. The decision view intentionally stays pending for motor/adoption even if an unrelated physical observer advances. A future motor owner must consume an explicitly bound successor with actual adoption evidence; a later clock or observation is insufficient.

Focused tests cover exact fractional timing, original deadline retention, issued handoff, stable namespaces, hold behavior, strict schema/inert/numeric boundaries, large origins, immutable rereads, actual owned decisions and models, archive nonmutation, dependency tampering, future-payload opacity versus future-metadata corruption, and WAL read-snapshot consistency. They do not establish completion of the broader remaining plan or substitute for later integration/full-suite verification.

Verification is deliberately focused: Core + owned Native tests passed 18 tests in two files, and the separate real-file WAL/read-only tests passed two tests. TypeScript checking passed. Independent review additionally exercised 75 clock/origin boundary combinations and malformed inert inputs. No full suite, home-PC CI, publication, merge or deployment was run by this slice.
