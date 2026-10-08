# Genuine null-policy received process checkpoint

The genuine null-policy replan passed its Native gate and independent immutable/read-only inspection. It owns one durable received process with a pending decision obligation; it has not selected a new intent or adopted a new motor.

The reviewed implementation is `231b1a7fcfcb769d095caf64a304919e3b740c29` / source `2d22221b289fba2e59919c8b689ec546c23413ff`. The exact genuine harness is `83b08a721ffc5fef36e1cf3422ef2625c2c8cfcb` / source `bd5faa8b4c51fe25bb2c32585b7be386b467d637`. Its only overlay is a small test-support provenance check; all other 1,972 reviewed source files match. The final harness compiler passed with no diagnostics. The accepted enrollment retains its exact original `83d365e9` implementation and `0c1a5820` harness/checkpoint attribution; no historical receipt was relabeled.

Exactly one Native test passed in **464.17 seconds**, peak process-group RSS **507,508 KiB**, within the unchanged 600-second wall cap, 1,024/1,120/2,048 MiB heap/measured-heap/RSS limits, 6,400 MiB launch floor and 4,096 MiB reserve. Both owned processes exited 0 and were reaped. All source/dependency/control/runtime input groups remained unchanged.

The gate made exactly three actual changes: replan revision 1, its head revision 1 and journal sequence 2. Independent inspection confirmed all original sixty-nine tables/135 rows, the inert policy row, twenty-four v1 admissions, original schema/data rowids, physical/observation/decision/motor heads and inherited fifty-role seal were preserved. No new schema was installed. The existing enrollment and journal row remained unchanged, and donor main/sidecar bytes were conserved.

The actual Core result is `call_profile_unavailable` / `semantic_pending`, with `selectedAt: null`. Its single `decision` work item is due at tick **12030302** and retains the first process identity. The incumbent `scheduled-decision-home-1` command, motor/adoption and role commands remain unchanged. Both information-order fields stay null. No selection, renewal adoption, physical advancement, OUT/SAFE closure or production calibration credit is claimed.

Evidence SHA256 identifiers:

- Final harness compiler terminal: `2369a9549c5cf7b96ce444752231a95348fbc389e6413e1156ef4bfe895bad24`
- Null-process Native terminal: `c0ef529465274480b4e4c999e1247518b8442693f43049f64c40070f5730c409`
- Result receipt: `c436bafb158655fe56de49b3cc461831d16de8f0bca8571e6dfb345dffe30b06`
- Independent inspection: `dd16052a67d80f95ca30f99b3b285bc1a8602711ae245f74e137ec30c5c4dff6`
- Closed checkpoint: `07a3722d1ab21de48bbebb1786d15b4b2508df21b1e0bc192187c919264a3a2b`

The earlier 600-second timeout remains a failed attempt with zero process credit; its output and terminal were preserved. The successful retry reused the accepted enrollment directly, without reconstructing root, call, reception or observation. Availability, revision two and callback-free reopen behavior remain separate genuine gates. Private databases, receipts, logs and manifests are excluded from publication.
