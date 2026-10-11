# PL01-R2: remaining occupied suffix from cp8

The existing exact retained entry now accepts only cp8 from the completed
PL01-R run. The earlier cp173 contract remains published at commit
`d6dfd095dd6c59fd195484394d1be21e0705dfdc`; its historical controls, frozen source,
checkpoint and stopped database are unchanged. There is no arbitrary-stage API.

## Actual boundary

The prior run completed the ten-participant settlement, official transition,
release, original terminal retry/reopen assertions and physical reopen checks.
It then accepted the next actor, next-batter body/batting model, and the walked
runner's body and decision-motion model. Its new-batter baseline initialization
did not return before the wall cap. No occupied pitch or whole-suffix PASS was
established.

cp8 is the committed snapshot after runner-model acceptance and before that
baseline initialization:

- Gzip: 533,242 bytes; SHA-256
  `9a99a67d954223248507bce6c85caff85f0548a9cb8659bfce834ba898e5a5f4`
- SQLite: 8,171,520 bytes; SHA-256
  `59bbb5fa8eb7fa92bd448e4e3cca476a195f952f272ad0d2dd0f216d8915f035`
- 108 tables, eleven workload activities, released original reservations and
  no away-2 workload baseline/head or occupied enrollment
- Original run source: `d6dfd095dd6c59fd195484394d1be21e0705dfdc`, source tree
  `023b3d8bb7027b08257036ccd2375ced6cfff9b2`

The exact byte pins identify the checkpoint independently of private witnesses.
The runtime also authenticates the original released enrollment, settlement,
transition, endpoint, accepted next actor, body/batting and runner model through
production readers. The runner model's returned value must match its observed
result digest. No completed model or terminal writer is called to reconstruct
these inputs.

## Original remaining work

`continueSamePaOccupiedWalkFromBaselineFixture` extracts the original occupied
helper immediately before its new-batter baseline check. All 75 remaining
statements and 26 assertion expressions retain their original bodies and order.
The fresh PL callback remains unchanged and reaches this same tail through its
original actor/model preparation.

The retained adapter restores only fixture maps and wrappers around authenticated
owner returns. It then runs the original baseline initialization, eleven-member
enrollment, empty prefix/TOTAL/view, runner hold, exact 32 dispatch calibrations,
first occupied TAKE, workload/official-state checks and retry/reopen assertions.
It does not rerun the six-TAKE prefix, terminal settlement/transition/release or
already completed terminal retry/reopen checks.

Previous prefix and terminal assertions remain historical evidence. The result
uses `pl01_cp8_occupied_suffix_result_v1`, identifies the resumed boundary and
sets `wholeCasePass: false` even if every remaining assertion succeeds.

## Controlled input

After joint review and central qualification, use the existing
`BASEBALL_PL01_RETAINED_INPUT` and `vitest.pl01-retained-suffix.config.mjs`. The
acceptance case is unambiguously named `PL01-R2` and identifies exact cp8 and the
unperformed new-batter baseline. The private JSON has exactly three fields:

- `nativeReleased`: `true`
- `checkpointGzip`: canonical absolute path to the pinned cp8 gzip
- `destinationDirectory`: a fresh directory under an existing canonical parent

The materializer verifies compressed/raw sizes and hashes before exclusively
creating the output. A Library-restored gzip is sufficient. Historical receipt,
run-control and prior terminal digests remain provenance declarations; the result
explicitly marks all three private witnesses as not rechecked. It neither
requires nor synthesizes missing witness files.

## Author verification

- Four finite input-boundary tests passed, including rejection of a stage selector.
- A direct file-only materializer check restored the exact cp8 gzip without
  witness files and rejected reuse of the destination; no Native owner opened.
- Syntax-only parsing passed for changed TypeScript files.
- AST comparison confirmed all 75 extracted remaining statements are unchanged,
  all 26 remaining assertions are preserved, and the original occupied file's
  complete 48 assertion expressions retain their order.
- A separate read-only immutable cp8 copy passed SQLite integrity and the exact
  byte/size, table-count, effect-boundary and observed runner-result digest checks.
  The original gzip and inspection copy stayed byte-identical.
- No production owner authentication, genuine continuation or full compiler ran
  during author checks.

The joint IFN/PL batch at source tree `912c0a98573ab8d90307fc83d1a8f0670ea92464` then passed independent review of all 22 changed files, full compiler (31.088 seconds), and nine focused input/import checks (5.844 seconds). All pin groups stayed stable, no resource guard fired and no child survived. Formal report SHA-256: `478f5f2ba86a0d6dca9b42e40bb36f8dbf87d04ede6cb67e336cd898d0771376`. Runtime owner admission and the remaining occupied suffix are still unexecuted. Earlier failed runs retain their own attribution.

## Actual first continuation and correlated-baseline correction

The first cp8 continuation on fixed `fd0846a5` failed functionally after 334.506 seconds, exit 1, with no resource guard. Original terminal/actor/model authentication completed; the first remaining new-batter workload initialization rejected the dispatch ownership claim. That owner call committed no change and no new checkpoint was saved. The original gzip stayed unchanged, all handles and processes closed, and all pins stayed stable. Terminal SHA-256: `2a1c9076ea427f48e8a843c8526e974a56385262020479457229d1a13b6c8b39`. The result remains FAILED with `wholeCasePass:false`.

The dispatch-claim SQL used `identity` for both an outer baseline identity and the inner metadata identity. This shadowing turned the original-baseline comparison into a self-comparison, so inserting an unrelated new-batter baseline caused a false claim. Renaming only the outer alias restores the correlation. Existing active, malformed and moved-identity rejection remains intact; no saved row or original Source is replaced. The enriched regression uses retained member/lineage metadata and covers all four initialization assertions and exact retry. The same helper's existing call sites were checked for this precise collision.

The correction was integrated with the IFN workload-census fix and passed the [consolidated correction qualification](2026-10-11-ifn01-original-retained-suffix.md#consolidated-correction-qualification). The completed compiler, nine unchanged passing selected checks, and final DO15-only pass are separately attributed. A corrected genuine remaining-only retry is still pending; cp8 remains the input boundary.
