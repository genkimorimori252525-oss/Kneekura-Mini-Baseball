# Actual live source-local event ownership

This is the bounded V1-B connection following the pending-only original participant/producer scope. It is not positive Native PlayEnd, exhaustive generation, a late-write fence or autonomous live play.

## Queue evidence

`actualLivePlayQueueEvidenceFromSqlite` reads the original pitch/field/execution prefix and every represented source on its caller's SQLite connection. Its immutable projection retains:

- Original scheduled capture/throw receipts, qualified by their physical archive owner and immutable source/hash
- Physical occurrence and receipt availability separately; secure acquisition is not available until confirmed
- Original source-local successor payloads, including custody, rule evidence and actual post-release cursor/response
- Represented decision/motor adoption lineage from an actual owned-motion execution; retained motion is not an autonomous controller certificate

`openSqliteActualLivePlayQueueStore` accepts only a source identity and original physical cut. It atomically saves the entire graph after same-connection preflight/current admission and post-insert rederivation. This is a durable observation of represented sources, not exclusive producer registration. Historical reads remain pinned to the original physical prefix. Original producer archive bytes are not rewritten.

The graph's `generation` always remains `event_generation_coverage_pending`, `closureFence` remains `not_installed`, and `playEnd` remains null. Missing or unrepresented producers do not become empty queues. A receipt that says the physical capture owner consumed its event says nothing about custody or rule consumption.

## Physical rule consumption

`openSqliteActualLiveRuleConsumptionStore` accepts a confirmed scheduled-acquisition execution and a later actual `first_base_race` execution from the same original physical prefix. It rederives both sources, preserves the actual supported/unresolved result, acknowledges only the acquisition's first-base rule consumer, and atomically retains its rule-result successor for the next real owner. Rule-read existence alone is insufficient. It never supplies an operative call, retires an actor, adopts a motor or consumes custody.

`actualLivePlayQueueConsumersFromSqlite` joins only accepted source-owned acknowledgements to a bounded physical cut on the same connection. A later rule observer is excluded even when its recorded tick equals the earlier cut. Future payloads remain opaque, while their Source ownership metadata is checked. The original checkpoint stays unchanged. A consumed first-base request leaves custody and the new result successor pending.

## Verification status

The corrected fixed source `96d001ebcb6865a4b6f0f1ac47ce271b97af61c5`, src tree `04347b021e4c68dae5f27fee548c28efd4d6125a`, passed Node26 typecheck and independent 127 Core/API/metadata tests. Its final Native gate completed on 2026-10-04 at 12:20:21 UTC: 7 files / 10 tests, terminal exit0, 460.67 seconds. All tracked source hashes were unchanged before and after. Coverage includes capture/throw successor identity, actual decision→motor adoption, confirmed and unresolved first-base rule consumption, writer-local trigger rollback and committed peer-connection changes. Independent review found no remaining Critical/Important issue for this bounded slice. Earlier failed and unstarted attempts remain separate evidence, not passing results.

### Disk/WAL qualification correction

The four original cases in `ActualLivePlayQueueWal.test.ts` and `ActualLiveRuleConsumptionWal.test.ts` used the scheduled-history fixture's default shared-memory URI. A Node26 inspection reported `journal_mode=memory` and an empty main-database filename, despite the stores requesting WAL. Their passing rollback and peer-admission results remain valid, but they do not establish disk/WAL persistence or recovery. The prior Native counts above must not be reused as proof for the strengthened tests.

The test-only correction based on `dc7aaebba4b3857fb95a02beaba1c7f769c2b49b` adds an optional explicit database path without changing the fixture's shared-memory default. All four transaction cases now use fresh disk files and assert both `journal_mode=wal` and the exact main-database filename before exercising the owner. Peer hooks additionally check the actual production writer is distinct from the committing peer and uses that WAL file. After all original fixture connections close, fresh read-only connections inspect unchanged execution/head rows, successful receipt rows or the absence of rejected receipts, and the exact committed peer corruption. The two repaired successful receipts are also rederived by independently reopened concrete owners. This is graceful-close/reopen persistence coverage; it does not simulate process crashes, power loss or uncheckpointed-WAL recovery. No production writer or unrelated WAL test is changed.

Node26.10.0 typecheck passed after the repository's normal offline catalog-generation prerequisite. Four bounded API/isolated-metadata files passed 28 tests in 3.59 seconds with one worker. An earlier direct typecheck omitted that prerequisite and failed because the fresh worktree lacked the ignored generated catalog; that attempt is not a passing result. The separately scheduled strengthened Native gate completed on 2026-10-04 at 14:46:21 UTC: 2 files / 4 tests passed in 102.48 seconds, terminal exit 0, one Node26.10.0 worker with a 1 GiB heap. All 1,855 pinned file hashes were unchanged before and after the run (manifest SHA-256 `863f1adc48b1dc06c596da0e3e60e20400ad5dbd06cd0f98f8ffb4f49c3c9355`). The owner process was reaped. This verifies the explicit disk/WAL, peer mutation, rollback and close-all/reopen assertions described above. This paragraph is a later documentation-only update; the tested source files remain unchanged. No full-suite or home-PC CI result is claimed.

This source supports the original scheduled-operation/owned-motion versions tested here. Scheduled-motion v2 reconciliation, the later coherent integration gate and whole-project verification remain separate. No whole-project or home CI success is claimed for this slice.

## Still missing

- Exhaustive generated-through proof for every participant/producer through the production quantizer's closed interval
- Genuine consumer fixed point for observation, decision, motor, physical and information successors
- Source-owned umpire perception/call, operative retirement and applicable live rule windows
- All-route durable writer fence, physical PlayEnd, official closure/application and next-play continuation

The separate quantizer-closed boundary helper proves arithmetic interval membership only. Neither an executed horizon nor this checkpoint proves generator completeness.
