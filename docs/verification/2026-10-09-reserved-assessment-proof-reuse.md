# Reserved assessment ownership reuse — 2026-10-09

The saved genuine capture-cut profile attributes about 7.8 seconds to three
assessment ownership checks. Exact query counting narrows the reusable work:
reserved TOTAL assessment checks repeat six times within each immutable phase.
The continuation assessment checks are unique, and are unchanged.

`assertSamePaAssessmentOwnership` now shares only a completely successful
reserved ownership proof through the existing Native continuation map. Its key
contains both the Source identity and assessment provenance identity. Original
main/TEMP namespace, exact name and object-type checks still execute on every
access. Owner/alias SQL and its accepted-owner rule are unchanged. All queries
remain main-qualified, so attached lookalikes cannot satisfy the proof.

The existing phase owns mutation, transaction and caught-failure expiry.
Independent proofs, writes, retries and committed verification cannot reuse
earlier success. Mutable and non-Native callers retain the full inspection.
No other assessment domain, admission rule or cache lifespan is changed.

## Saved operation comparison

Baseline: `5dc8d20b0fba34fe29227be854a563248bda5579`, source tree
`a62fe84ed31bf6413e096a47ed9cd731a9bd56d3`. Both runs use initially identical
consistent SQLite backups of the genuine pre-capture state and the same
accepted capture-cut Source. Each worker exited normally within a 115-second
cap and flushed its own profile; no fixture or full scenario was rebuilt.

| Initial capture cut | Baseline | Changed |
| --- | ---: | ---: |
| Reserved assessment ownership queries | 2,880 | 480 |
| Unique assessment/owner queries within phases | 480 | 480 |
| Other assessment queries | 7,092 | 7,092 |
| Total prepares, including proof guards | 216,400 | 222,280 |
| Reserved ownership cumulative sampled time | 3.089 s | 0.783 s |
| Complete operation time | 28.334 s | 27.503 s |

The hard result is elimination of 2,400 duplicate ownership queries, with
identical complete persisted table/schema contents and two declared writes.
Returned cut, stored cut and head all retain hash
`50039c3d1bccc4bdcb16e7169ed9cc231f09ade5dfd92ac974db03c9e9857522`.
Additional immutable-phase scalar checks increase total prepare count. The
small wall-time difference is not evidence of a major overall speedup.

The short National process ran around 15:56:56–15:57:03 UTC. The baseline ran
15:55:51–15:56:24 UTC and changed worker 16:00:23–16:00:56 UTC; neither overlapped
that process. Private databases, per-query records and profiles are excluded.

## Affected checks

- Five new Native ownership cases passed after the reuse/failure controls
  first failed on the baseline: completed reuse, fresh namespaces, both key
  identities, caught failures, in-proof/between-proof alias mutations, TEMP
  replacement, and attached lookalikes.
- The existing continuation phase control passed (DML, schema changes,
  transaction replacement, cycles and independent-proof lifetime).
- Existing TOTAL-set cases passed: changed earlier row between effects, and
  forced transaction replacement retirement. The other 19 cases in that file
  were deliberately unselected.
- All 18 protected blobs remain exact; `git diff --check` passed. Integrated
  source `494a19790a4e28d7e61c43c795814240a35ff922` passed the full compiler
  in 31.44 seconds and the six ownership/phase controls in 5.40 seconds.
  The two unchanged write-fault results above are retained separately.

This is eight affected passing checks plus the saved actual-operation
comparison, not qualification of a full Native scenario.
