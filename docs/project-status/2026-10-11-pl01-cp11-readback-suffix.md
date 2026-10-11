# PL01-R4: exact cp11 occupied pitch readback

The single retained PL entry now accepts only PL01-R3 cp11. Its remaining
original work is one real `readPhysicalPitch` deep-equality assertion, followed
by the original sixteen-table row comparison. It does not recreate the prefix,
accepted writers, completed retry or the fixture context they needed. No
production owner, proof or authentication requirement changes.

## Actual completed boundary

PL01-R3 ran source commit `4d452cea7ee37d41ca4f517612ffa96a7bb878d2`, source tree
`3dcc76c69323fdd3461d4af7ec7f61bafe646e2a`. It ended at the 14,400-second wall
limit on 2026-10-11 at 05:33:42 UTC, with elapsed 14,400.134 seconds, all nine
input pins stable, complete process enumeration/cleanup, and no owner error.
There was no final result artifact or Vitest summary. This is a failed capped
run, never a PL01 whole-case PASS.

- Call 11, the original occupied `acceptPhysicalPitch`, returned at
  05:22:26.416 UTC and produced cp11.
- The following original outcome, hold-coverage and workload assertions,
  sixteen-table capture, dispatch close and reopen precede call 12 in the
  unchanged source. Reaching call 12 establishes this earlier section completed.
- Call 12, the reopened same-source `acceptPhysicalPitch`, returned at
  05:31:23.988 UTC with `committedChange: false`. Its owner return is historical
  evidence. The entry neither repeats it nor credits it as new suffix work.
- Completion of the subsequent original readback and row comparison was not
  established. The actual cp1 entry has no final history loop after the occupied
  helper returns; its earlier `priorActivities` capture is not such a loop.

The checkpoint contains 109 tables and 803 rows. The occupied physical pitch
is the actual called strike at tick 80,056,482, with physical count 0–1 and
pitch-head revision 1. There is one pitch consumption and one episode admission.
Official Match remains play 8, away-1 at first, count 0–0. These are checkpoint
facts, not regenerated expected pitch results.

## Exact provenance

`PL01RetainedCheckpoint.test-support.ts` pins:

- Gzip: 584,079 bytes; SHA-256
  `b2381759b16c5e8f4b23dbf394679f722d0d730e42d1e815bf2049e9fb0b4860`
- SQLite: 8,867,840 bytes; SHA-256
  `829ef942e2b19a51d9cfc80e8b738c9e8129474f949a19a3f4b5ec6bb58c9fa7`
- Accepted persisted pitch snapshot SHA-256
  `8da24f6a2866aa98be16a29eb78943cb1ebab2bb37cfc277d3ba01f6f0515cf9`
- Historical cp11 receipt SHA-256
  `551939891b33be280c746521261c8d10dad957e41bf054282544e8737d877a61`
- Historical terminal SHA-256
  `82b56374c163a65f079dedef79ef625913be9aa9bc9a684962dd2cfadf4d054e`
- Historical final journal SHA-256
  `d62ca21c5c9cda5d087291bc4d4cf9018b74fd3a286eba192daf5180194e8efd`

The call-11 serialized return digest is
`ad7de0f5253aaa268ddf0274368b672df804421b6beaf30f1b4658567456deb0`;
the call-12 serialized return digest is
`baf4d3b3e2435402d249e0f2169faf2179cce8991c2d6cd53c30b6ddd5a7d3e7`.
They remain separate provenance. Observer JSON serialization depends on property
order; its digest is not the original Vitest deep-equality semantics and is not
used instead of that assertion. The accepted snapshot is independently pinned
and compared as a complete parsed object. The original acceptance implementation
checks its committed snapshot against the returned pitch before returning.

Earlier [cp173](2026-10-10-pl01-retained-terminal-suffix.md),
[cp8](2026-10-11-pl01-cp8-occupied-suffix.md) and
[cp1](2026-10-11-pl01-cp1-enrollment-suffix.md) provenance stays separately
attributed. Current cp11 pins do not relabel those runs.

## Small continuation and evidence boundary

The private input still has exactly three fields: `nativeReleased: true`,
canonical absolute `checkpointGzip`, and an exclusive new
`destinationDirectory` beneath an existing canonical parent. No checkpoint
selector, injected pitch or caller result is accepted. Compressed/raw hashes
and sizes are checked before any destination is created. A restored exact gzip
alone suffices; historical private control, receipt, terminal and journal files
are neither required nor synthesized, and the result marks them not rechecked.

The runner loads the original persisted pitch from the exact archive and
checks its independently pinned snapshot and Source hashes. This value is only
the expected side of the original assertion. The real reopened dispatch owner's
`readPhysicalPitch` is called once, performing its complete unchanged production
proof and fulfilling the original readback at the same time. No earlier actor,
model, calibration or terminal owner read is repeated independently.

`SamePlateAppearanceOccupiedReadback.test-support.ts` holds the original
sixteen-table list, `ORDER BY rowid` view and two assertion expressions. Fresh
PL keeps the original same-source retry and invokes this shared final seam.
The retained entry captures the same rows from cp11 before reopening. The
historical retry reported no committed change, and no writer runs here.

Additional whole-schema/table-history conservation and original gzip
preservation are explicitly retained-evidence checks, not newly credited
original assertions. The runner closes both its database and owner on success
or failure and preserves the copied database and result artifact for inspection.
Its result kind is `pl01_cp11_readback_suffix_result_v1`; `wholeCasePass` remains
false regardless of the two-assertion suffix outcome.

## Validation status

Author verification completed without running Native owners or Vitest:

- Seven TypeScript files parsed without syntax diagnostics; `git diff --check`
  passed.
- AST comparison against the actual `4d452cea` source preserved all 48 assertion
  expressions in the shared occupied file in order, with only the final two
  extracted. The original sixteen table names and row query were identical.
- An exact private immutable copy verified archive/raw/snapshot/Source hashes,
  the historical receipt/terminal/final-journal pins, integrity and all 109
  tables/803 rows. Both archive and inspection bytes remained unchanged.
- The first in-memory inspection could not open SQLite's WAL-format image; it
  read no rows. The immutable file inspection above completed successfully.

Independent review of all ten files is CLEAR. On integrated code
`32d744b9de86fb47614d54648c8c61b2e49f9cd3`, source tree
`b96eb4fe15f2577d0041b5c9389f0c5f10e3e59f`, the full compiler passed in
30.987 seconds (peak RSS 2,194,720 KiB). The single selected run passed all eight
checks in two files in 5.640 seconds, zero skipped, peak RSS 437,032 KiB.
Coverage is the exact input/provenance boundary and the no-writer readback
seam, including missing/different results and changed rows. All source,
dependency, runtime and control pins remained stable; no resource guard fired
and no process survived. Formal report SHA-256:
`453f7443628658c73a0820e721fe083ecd0c469ae2b75967369bad706864daf9`.

The actual owner read remains pending. A plain existing supervisor and entry
are sufficient: this remaining path has no mutating-owner calls to observe or
checkpoint, and the already preserved exact input remains the recovery point.
No new Native continuation, smoke run or whole-case PASS is claimed here.
The separate IFN/LAN executions are untouched.
