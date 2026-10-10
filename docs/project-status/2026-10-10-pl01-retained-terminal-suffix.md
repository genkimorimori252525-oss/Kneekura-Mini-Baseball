# PL01 retained terminal suffix

This is a test-support entry for exactly the returned-owner checkpoint 173 of
PL01, observed after settlement `freeze` call 179. It does not create a generic
recovery API or change a production owner.

## Boundary and evidence

The retained prefix is the real six-TAKE walk and its accepted terminal outcome,
final lifecycle view, endpoint and ten-participant frozen settlement plan. It
contains zero settlement activities and all ten original reservations. Its
original run used commit `d4a17d490cba76cac4e8427503ee9ec726e7b758`, source tree
`728b6e36cee03cc0667904b6ada2ea7661d5b427`.

`PL01RetainedCheckpoint.test-support.ts` pins the gzip bytes, decompressed
database bytes and observed freeze result. The original source identity and
run-control/receipt digests remain declarations of historical audited provenance;
recovery does not require the original private control or receipt files. The exact database SHA-256 is
`0c1028926bd351d850accec089ccc319399441f7986f6c0ede7a73cae9482708`.
The input paths are supplied privately at execution time. The entry authenticates
all inputs before exclusively creating a fresh destination directory. It only
opens the new database copy, preserving that copy if the suffix fails. This lets
the SQLite gzip backup survive loss of the original execution environment. The
result explicitly reports both private witness files as not rechecked; it does
not fabricate replacement witnesses or claim fresh source-provenance validation.

The retained runner authenticates the original actor, initial World, enrollment,
terminal outcome/endpoint, final lifecycle view, frozen plan, batting/body model,
scene posture and dispatch calibration set through their existing owner readers.
The calibration set preserves the original insertion order required by its owner.
The ordinary workload reader authenticates the original baseline before its
accepted Source is reused by the unchanged next-batter fixture. The existing
participation authority and closure game declaration are shared verbatim with
the fresh fixture; no replacement policy or result is introduced.

## Shared original assertions

Both fresh PL01 and the retained entry call
`completeSamePaFrozenTerminalFixture`. It preserves the original settlement,
release-before-effects rejection, durable workload checks, release-before-official-
transition rejection, official/scoring transition, release, retries and reopen
assertions. Fresh PL01 still creates and verifies its original prefix first.

Both entries also call `finishSamePaPhysicalWalkFixture`, which contains PL01's
original final walk/release/physical-reopen checks and invokes the existing
`continueSamePaOccupiedWalkFixture` with the original label. Its original
occupied-next-pitch, workload conservation, event, retry and reopen assertions
remain unchanged. Only the fixture dependency types are narrowed for reopening;
full fresh fixture types remain available to further physical continuations.

The retained prefix and continued suffix are separate evidence. The runtime
result explicitly sets `wholeCasePass: false`; a successful suffix does not
establish a fresh whole-case PL01 PASS.

## Controlled execution

After independent review and consolidated qualification, supply a private JSON
file with exactly these fields:

- `nativeReleased`: `true`
- `checkpointGzip`: absolute canonical path to the pinned gzip
- `destinationDirectory`: a new directory beneath an existing canonical parent

Set `BASEBALL_PL01_RETAINED_INPUT` to that JSON file and run Vitest with
`vitest.pl01-retained-suffix.config.mjs`. It collects only the separately named
PL01-R suffix acceptance case. Use the qualified runtime and external execution
limits. Do not start it merely because the ongoing original PL01 has not returned.
The retained runner does not stop, restart or inspect an original live run.

## Author checks and remaining validation

- Four finite input-boundary tests passed: unreleased execution, injected input,
  caller getters/three-field capture isolation, and substituted gzip before output.
- A syntax-only parser check covered the ten changed/new TypeScript files.
- An AST comparison confirmed the same ordered 45 terminal, 41 occupied and 28
  PL01 assertion expressions, including the seven moved final PL01 assertions.
- A separate read-only immutable checkpoint copy confirmed required source IDs,
  zero terminal effects and the exact observed freeze-result digest. The copy
  and original gzip hashes remained unchanged. No owner reauthentication ran.
- JavaScript config syntax and `git diff --check` passed.

Independent review identified and corrected the private-witness-file recovery
dependency, then cleared the complete final batch `48431c696a7efbf9fe5f7557c153cd7ef35a6e7a`,
source tree `023b3d8bb7027b08257036ccd2375ced6cfff9b2`.

One consolidated qualification passed:

- Full TypeScript compiler: **PASS, 33.408 seconds**, peak aggregate RSS 2,177,464 KiB.
- Four finite input-boundary cases plus one import-only check of the retained/fresh
  shared fixture graph: **5/5 PASS, 6.351 seconds**, peak aggregate RSS 450,024 KiB.
  Formal report SHA256: `f7b2ad269a8815c86c4eab77bcc20ac0d62eca0eee8e14a9ba9f4dac19dff73c`.
- Source, dependency, runtime and control pins remained stable; no resource guard
  fired and no child process remained. The import check executed no Native callback.

No retained Native suffix has run. Actual retained-owner authentication and the
original remaining genuine assertions are pending. The active original PL01 keeps
its previous fixed source and controls; this batch does not establish a fresh or
combined PL01 PASS.
