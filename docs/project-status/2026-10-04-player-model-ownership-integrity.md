# Player model ownership under mirror corruption

Status: implementation and focused verification, 2026-10-04 JST

Published: [Draft PR #268](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/268), [implementation bc29c37c](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/bc29c37cdb6787007202851363a4066d1cee1bf9). Final isolated and integrated gates each passed 5 files / 80 tests and typecheck; integrated tracked hashes stayed unchanged.

## Reproduced defects

The immutable fielding and observation model owners originally discovered a Player baseline through indexed career/Player columns and the Source JSON. If both identities moved while an original identity remained in the archived snapshot, a second baseline for the original Player could be accepted. Real SQLite reproductions cover both owners.

A related Source-ID case moved the row's primary ID and all career/Player identities while retaining the original ID in Source or snapshot JSON. Primary-key-only lookup missed that existing claim and admitted another original Source. The regression checks each JSON ID mirror separately and multiple rows claiming one ID.

These are own-database corruption/ownership failures. No incorrect baseball outcome or external access mechanism is claimed.

## Repair

- Discover original Player scope through all existing snapshot Source, fielding-model and Person identities as well as indexed and Source JSON identities
- Discover a requested Source ID through the primary ID, Source JSON ID and snapshot Source ID
- Reject multiple claimants and disagreeing ID mirrors, then retain the original complete rederivation/hash checks
- Preserve serializers, tables, accepted input shapes, original model values and valid archived bytes; no migration or replacement baseline

## Evidence

Five Player-scope regressions and four independent JSON Source-ID regressions failed before their corresponding fixes. Additional checks cover duplicate ID claimants and unchanged healthy archive bytes. Focused tests include both existing model stores and their WAL suites; final exact counts and publication commit are recorded in the PR.

This bounded repair does not create decision receipts, change ratings, add calibration defaults, advance physics or settle a play.
