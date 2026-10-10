# Received enrollment proof reuse checkpoint

Reviewed implementation `231b1a7fcfcb769d095caf64a304919e3b740c29`, source tree `2d22221b289fba2e59919c8b689ec546c23413ff`, removes duplicate original-enrollment authentication inside one existing read proof. It passed independent source review, 188/188 finite regression tests and the full compiler. A genuine null-process retry remains a separate gate.

## Failure retained and diagnosed

The preceding genuine null-policy run on `0c1a5820` reached its fixed 600-second wall cap. Both processes were terminated and reaped, with no test report or result receipt. It earns zero process/Core-semantic credit. No timeout increase or root/call/reception reconstruction was performed.

Immutable read-only comparison found its main file byte-identical to the accepted enrollment checkpoint: all 75 tables, 138 rows, schema/data rowids and 24 v1 admissions matched. Its last durable received stage was one enrollment and journal sequence 1. No replan, replan head or availability committed. This does not identify the exact interrupted runtime call; completed per-operation timings were unavailable.

## Bounded change

The enrollment reader validates the original Source, metadata, canonical archive and journal, then exposes its derived envelope to an internal continuation within that same Native proof. Replan derivation uses that envelope for both enrollment equality and the bridge input. Current proposal qualification runs before the continuation returns. Only the existing durable values leave the proof.

A first null-policy acceptance now performs seven full enrollment derivations instead of twelve, while preserving all six current qualifications. An independent historical read performs one derivation instead of two; each new read or retry authenticates again. No global, per-connection or cross-call cache exists, and no envelope crosses DML or transaction boundaries. This is a measured call-count improvement, not a claimed genuine wall-time result.

Initial lookup, preflight, in-write proposal, pre-insert/post-write qualifications, Source callback checks and committed-row verification remain separate. Transaction/savepoint ownership, query-only restoration, counter/schema conservation, uncertainty reporting and retirement are unchanged. The original v1 bridge, physical traversal owners, durable schema and Source wire remain unchanged.

## Validation and attribution

The isolated Native fixture retains its declared original-owner seam limitation. Before implementation, two focused checks observed 12 versus 7 acceptance derivations and 2 versus 1 historical-read derivations; three dependency/cut/callback mutation controls passed. That RED supervisor result remains failed because unselected cases were reported as `skipped` while its config expected `pending`. The exact intended failures were independently checked from the unchanged report; no bookkeeping rerun or relabeling occurred.

After implementation, all five focused checks passed. The existing 183-case finite set plus the five new checks passed **188/188, zero skipped**, including later-header opacity and all earlier lifecycle/schema corrections. Native original-dependency mutation between proofs, a changed current cut after a real INSERT and a changed Source callback after a real INSERT all reject at the intended boundary. The full compiler exited 0 with no diagnostics.

- Finite regression terminal SHA256: `697e622b6c35d3dd59feb144893d08ec3b1f90e875214d3fba68528cb4066267`
- Compiler terminal SHA256: `e6a971f3e9e92c71b22ded2977da8a40d0d1a014445ce1c0ea3b7c9dc8d10c62`
- Original failed genuine terminal SHA256: `924d44b580fdc8e3003abc910230854ef965dde0a2e5bbea1f9f8bc830bea08e`
- Immutable failure-diagnosis SHA256: `0d7cf55b7c4eddf7461ffb7032e933f0d6225afd7b69b7cee9f0cf3b77558f08`

All bounded test/compiler input groups remained unchanged and owned processes were reaped. The accepted enrollment checkpoint retains its original `83d365e9` implementation / `0c1a5820` genuine harness attribution. Its receipts and the failed output remain intact. Future genuine work requires fresh exact-source controls under the same 600-second and memory limits. No process selection, new motor/adoption, physical advancement, terminal closure or production calibration is credited here; private databases, logs and manifests are excluded from publication.
