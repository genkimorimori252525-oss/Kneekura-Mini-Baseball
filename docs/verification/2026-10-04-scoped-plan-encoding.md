# Scoped immutable plan encoding

This performance slice reuses canonical bytes of the same deeply immutable acquisition or throw plan only within one physical-prefix projection. Separate role namespaces, object identities and call lifetimes remain distinct. Mutable/shallow values continue through the normal encoder; malformed values, lineage comparisons and every Core progress validation remain checked. No SQL row, metadata validation, database-derived value or admission phase is cached.

Production candidate: `cbae4c2371573169544f3ef72da973311d507862`. Additive test-only closure: `c077f86b1cd3b27f8e21f3fbec903d8ad27d9438`. The integrated executable source tree is identical to that final verified cut; fixture/document preservation does not change it.

## Measured scope and tests

- RED showed 28 canonical encodings for a real-Core four-step shared plan; GREEN reduces that to one. Distinct equal immutable objects still receive five separate encodings
- Final 39 tests pass, including mutable/shallow inputs, independent malformed bodies, unchanged validation counts, role isolation, fresh calls, warmed-cache forged acquisition progress and a full throw-prefix/forgery case
- Independent review found no blocking production defect and closed both initial coverage notes
- Full typecheck passed on both candidate and final test-only source at 1,408 MiB. The earlier 1,024 MiB compiler attempt exited 134 from its heap limit and remains a failed allocation receipt
- Actual 39,851-byte plan benchmark: 1,904 comparison requests remain, while canonical encodings fall from 1,904 to 16 per replay. Paired component timings were 4.13–7.96 seconds versus 45–80 milliseconds under variable concurrent load. This is component timing, not a complete acceptance speedup

## One bounded concrete-owner diagnostic

One read-only replay of the genuine seventeen-piece snapshot rederived all nineteen owned rows and matched the saved exact archive bytes/hash. It ran on the production candidate before the two test-only additions, with source manifest SHA256 `198c0e402c0c905e98415178ff626aa51abd83e68e73670f88c89928526b0429`; the input snapshot SHA256 remained `38fbc069aa5ea61e60a5cee1c92327b613d0aea431cd25c9293a25f976e2e0d8`.

The concrete read took 13.68 seconds, the test 14.03 seconds and startup-inclusive process 16.77 seconds, exit 0. Source/input hashes were unchanged and sampled peak RSS was 269.86 MiB. The launcher's intended heap allocation was not separately proven inside this earlier Vitest fork; no one-GiB worker-limit claim is made.

Profiling began after module loading at ten-millisecond intervals. The candidate processed 2,244 plan comparison requests in 46 milliseconds. The largest remaining measured duplicate was 324 archive-hash projections, 5.01 seconds inclusive, followed by 153 Core acquisition-progress validations, 3.27 seconds. These inclusive boundaries overlap and must not be summed. Sampled clone traversal remained 48.97% of self time; archive projection/replacement was 16.73%.

The original forty-piece run was interrupted and reaped with exit 130 for performance diagnosis after twenty-one committed pieces; it was never a construction/archive PASS. A separately reviewed private replay-factory optimization is needed for remaining repeated archive identities. No global cache, skipped SQL comparison, generic-limit increase or full forty-piece/end/whole-suite result is introduced by this slice.
