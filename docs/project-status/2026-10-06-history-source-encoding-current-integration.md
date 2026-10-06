# History Source encoding: current integration verified

This integrates the reviewed serialization change onto
`ce7fcbb879e86b1249a40bce2bf34fcefe0d6fb1` (base source tree
`48a1e2b568ce21f56ac377119b159203a597f28d`). Existing Manager/scorer and physical
closure code is preserved. Fixed source `27e63faca24756f043bf23c8c30781b122c2a35c`
(src tree `1079190678f1a2dea8822f519b51362479cef54d`) passed all 164 selected
cases across 21 files, catalog validation and the full compiler at
2026-10-06 01:28:45 UTC. This includes 116 affected serialization/Native cases
and 48 scoring/physical-closure compatibility cases on the current module graph.
The publication changes this evidence document only; its source tree is identical.

## Current fixed-source verification

All ten stages exited zero, with no skipped, pending, unexpected or unhandled
cases. The controller verified source, dependency and control hashes before and
after execution, checked actual Node launcher/worker heap limits, and reaped all
owned processes. The final process census is empty. Compiler took 31.51 seconds;
the four Native stages took 67.72, 131.81, 10.31 and 148.13 seconds. These durations
are resource evidence, not a performance comparison.

- Terminal receipt SHA-256: `6126968a19344ea41be6e1c6ac913c09ddb7df06bb6fb43707a3d8a26b683c3a`
- Controller: `335e7e164ed502699a420e37b4d042fdb9bcac72870a3e54cae6770f970f8720`
- Configuration: `8a084ca86046bc585e6a4ef9ed9461c5c593a148c8b56cfc9c74d31a664ce807`
- Source manifest, 2,336 files: `9d29c382345ea91360e21b3da0ab5aba3f2db491c792fced89a7a3c86e5be7c1`
- Dependency manifest, 983 files: `e9624551894fd127f81b5e475c928741bce41fac2012d369b6cd62b9b08fc542`

This focused gate does not establish a cumulative whole-suite pass, completion
of the original Positive case, or completion of the non-design plan. The frozen
c68 remainder and the separate ended-checkpoint continuation retain their own
coverage and source attribution.

## Change and invariants

The private physical-prefix history comparison reuses its existing projection-local
Source encoder for exact deeply frozen identities. The public two-argument helper
still validates afresh. Array descriptor checks, original/history evaluation order,
raw/v1 aggregate validation, node/depth limits, canonical bytes and row-byte/
transaction validation remain unchanged. There is no new serializer, global cache
or reuse across projections, transactions or writes.

Native replay freezes each completed Source recursively and appends the same
Source references to later histories before forwarding the prefix through
execution, composition and kinematics. Independent reads rebuild identities, and
the encoder starts fresh for each projection. Mixed sibling histories may contain
distinct equal identities and reduce hits. Mutable public inputs remain misses
and incur additional hash/immutability-check work.

## Historical evidence, attributed to its actual source

- `bfca1c7`: selected RED observed terminal Source serialization count 2 versus 1;
  18 other cases were explicitly excluded. Receipt SHA-256:
  `c494d2db70f668e12e9774df8a9d2391d6246ed99560d4004bb9d7296252b3f4`.
- `06a4476`: all 116 selected runtime cases passed; compiler failed with TS2352
  at the intentional invalid-input cast. Its whole gate was not a PASS. Receipt:
  `7ce77ae0ed375e560502772436931a73d857081e0af73ed200633b44b818c83c`.
- `d6e7b49`: the single test cast became `as unknown as Source`; production bytes
  were unchanged. Compiler and all 19 contract cases then passed. The other 97
  successful runtime cases remain attributed to 06a4476. Receipt:
  `17b21c9e71f54907b185d3fd4d1c0be158f82cfb1333024f7b9811b6629e1a7d`.

None of those receipts is presented as a run on this current integration.

## Actual end-read comparison

Four fresh-process authenticated historical end reads compared baseline `c68a3dc`
with repaired `d6e7b49` in B1/R1/R2/B2 order. Exact end bytes, whole-history bytes
and SQL counts agreed. This is not a SQL statement-order claim.

Baseline reads took 73.31 and 66.81 seconds; repaired reads took 68.82 and 70.42
seconds. These ranges overlap, OS caches were uncontrolled, and no timing
improvement is demonstrated. The comparison does not establish the original
Positive test or whole-pipeline PASS. The earlier c68 cumulative run stopped at
Positive's 61-minute cap.

The separate result-only summary records full source attribution and receipt
identities: [paired end-read result](2026-10-06-history-source-encoding-paired-read-result.json).
No database, end-projection payload or whole-history payload is included.
