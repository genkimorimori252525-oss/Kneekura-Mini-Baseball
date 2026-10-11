# IFN01 original retained cut31 suffix

This entry continues only the original IFN01 checkpoint `000273.sqlite.gz` after
the original run failed its 14,400-second wall cap. It is not a new whole-case
pass and does not regenerate the completed TAKE, swing, field, throw, received
observation, or caught-response prefix.

## Exact admitted boundary

- Original source commit: `35c050668106d5d564e7419892db953040b37af2`.
- Original `src` tree: `7e90c1ace30d36e8a0e0c87261e0c258ece6d910`.
- Gzip: 1,065,804 bytes; SHA-256
  `0966986cf9398d606347d72c3e30ab818098de91ce9ec23982916a398d1f8e4d`.
- Raw database: 17,838,080 bytes; SHA-256
  `e0f15ab4cb9574131c48fb854c8a28c19162375329b24d6a69f7e38fd3b2beab`.
- Returned physical operation: `in-flight-fixture:catch-response:6`, with its
  original selected response at the movement-start boundary.
- Persisted `physical-fixture:cut31:prefix` and all ten cumulative TOTALs;
  no cut31 view or cut31 calibrations. The interrupted cut31 view is the first
  unfinished owner effect.

The only file input is that pinned gzip. The input object has exactly
`nativeReleased`, `checkpointGzip`, and `destinationDirectory`. Release must be
explicitly true; paths must be absolute and canonical, and the destination must
not exist. The original database is never opened. The archive is authenticated
and decompressed into an exclusive private database before any Native owner is
opened. Existing destinations and substituted archives are refused.

Receipt, census, and failed-terminal hashes are retained as historical
provenance, not runtime dependencies. No journal, control, original live database,
or fabricated replacement witness is required. The result explicitly says that
these private witnesses were not rechecked.

## Original owner proof and remaining work

`IFN01RetainedOriginalSuffix.acceptance.ts` is an explicit acceptance entry,
outside ordinary `*.test.ts` collection. A reviewed Native harness supplies the
JSON input through `BASEBALL_IFN01_RETAINED_INPUT` and explicitly selects that
entry. No genuine suffix execution was started while authoring this change.

The recovery entry authenticates the actor, initial World, participation,
reserved workload heads, dispatch inputs, lifecycle prefix and complete TOTAL
set, physical head and response chain, original catch communication Sources,
original swing owners, and original cut30 calibration declarations through
existing owner readers. Raw hash equality does not substitute for those reads.
Missing or inconsistent original context fails admission. In particular, the
explicit observation and locomotion declarations are recovered from accepted
records, rather than recreated from fixture defaults.

The unchanged shared fixture bodies then:

1. Complete the missing cut31 view and 32 calibrations.
2. Run the remaining caught-response assertions and original motor adoption.
3. Run the original batter motion and received hold.
4. Complete the original fair-catch seal, review, physical end, terminal TOTAL
   settlement, official closure, scoring, reopen checks, and next-actor activation.

Earlier transient negative/fault checks are not rerun and earn no new credit.
The retained history rows are checked for preservation after the suffix. The
result records separate historical-prefix and continued-suffix attribution and
always sets `wholeCasePass: false`. A failed continuation keeps its new database
and result for inspection; the pinned gzip is checked again after cleanup.

## Author checks, not Native qualification

- Four focused input-boundary tests passed under Node 26 with a 30-second cap.
- A separate bounded input-only check copied the actual pinned gzip, confirmed
  the raw hash and private file/directory modes, and refused destination reuse.
  It opened no Native owners.
- Syntax/transpilation checks passed for all 14 changed TypeScript files.
- TypeScript AST comparison against the fixed original source confirmed all
  232 original assertion statements in the IFN case and its response, batter,
  review, fair-catch, and terminal helpers retain their expression text and
  order. The remaining response adoption's 13 statements also match exactly.

The joint IFN/PL batch at source tree `912c0a98573ab8d90307fc83d1a8f0670ea92464` passed independent review of all 22 changed files, full compiler (31.088 seconds), and all nine focused input/import checks (5.844 seconds). All source, dependency, runtime and control pins remained stable, no resource guard fired and no child survived. Formal report SHA-256: `478f5f2ba86a0d6dca9b42e40bb36f8dbf87d04ede6cb67e336cd898d0771376`.

These bounded checks do not establish runtime owner admission, suffix PASS, or a whole IFN01 case PASS. The exact remaining-only Native entry is prepared separately under the existing reviewed resource controls.
