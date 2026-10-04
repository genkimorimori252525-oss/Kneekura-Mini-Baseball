# Player model ownership with ambiguous JSON metadata

Status: bounded implementation and focused verification, 2026-10-04 UTC

This extends the [ordinary moved-mirror repair](2026-10-04-player-model-ownership-integrity.md)
to duplicate JSON member names in the existing fielding, observation and decision
model owners. The original repair's evidence and published scope remain separate.

## Reproduction and boundary

SQLite `json_extract` selects the first occurrence of an object member, while
`JSON.parse` keeps its last occurrence. An archived model can therefore move its
indexed ownership and first JSON claims while retaining an original Player or
Source ID in later duplicate leaves or containers. A discovery query using only
`json_extract` misses that row before canonical rederivation can reject it.

Real SQLite tests first produced **30 failing cases / 3 healthy passes** against
the existing three stores. Moving every index and competing mirror, retaining a
claim only in duplicate JSON, and recomputing both hashes still allowed an extra
baseline or original Source retry. The expanded test file against unchanged
production code produced **36 failures / 6 passes**, including middle-occurrence
Source claims and duplicate Person containers inserted by a transaction trigger.

This is an own-database archive integrity failure. No external attack, incorrect
baseball outcome, calibration defect or broader owner audit is claimed.

## Repair

- Use the shared `SqliteOwnershipMetadata` duplicate-preserving traversal for
  the existing ownership paths, including every nested Source/Person container
- Keep career/Player pairs within the same owner object, with explicit text
  types; never combine two partial pairs from separate duplicate containers
- Discover the model's own Source ID through indexed ID and every occurrence in
  Source JSON or snapshot Source JSON, including a middle occurrence
- After discovery, keep the existing complete canonical Source/snapshot bytes,
  hashes, immutable baseline rules and original Person/fielding rederivation;
  duplicate metadata cannot become a valid canonical archive

Shared helper dependency: `63dd60c4b847134917ae13eda6636edddd1bd978` (locally
cherry-picked as `83b53a5`). No alternate JSON parser or new domain interpretation
was added. Tables, serializer, accepted input shapes, ratings, calibration values
and healthy archive bytes remain unchanged.

## Verification

- **9 files / 207 tests PASS**, including 42 new model-metadata cases, the existing
  model mirror suite, all three model-store and WAL suites, and 21 helper tests
- `npm run typecheck`: PASS, including the catalog precheck
- Final focused gate took 6.84 seconds; tracked file hashes were unchanged across
  the gate and typecheck
- Authority-free reopen, public read/retry/day selection and byte-for-byte healthy
  archive compatibility; replacement baseline rejection without writes
- Post-insert duplicate Person claimant rolls back the attempted baseline and
  trigger row, preserving original Person/fielding bytes; normal acceptance works
  after the trigger is removed
- Separate duplicate Source containers containing only partial matching pairs do
  not falsely poison an unrelated healthy baseline
- Node 26, cloud-local temporary directory, one Vitest worker; whole suite and
  home-computer CI were not run, and no workflow/config/lockfile changes were made

Fresh independent review found no blocking issue. Its separate 18 temporary
probes covered middle escaped duplicate owner containers, identical duplicate
Source IDs, sparse duplicate ancestors, competing middle escaped Source-ID rows,
separate-pair negative controls and malformed-unrelated negative controls across
all three owners. Those probes are additional evidence, not part of the 207-test
committed focused gate.

This repair does not add runtime decision receipts, locomotion, physics, official
settlement, presentation or UI behavior.
