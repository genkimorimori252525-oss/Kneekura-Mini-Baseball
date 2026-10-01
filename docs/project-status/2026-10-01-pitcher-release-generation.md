# New Pitcher release generation — 2026-10-01

## Approved source

Foundation `560670be519a01f07e2e4b7dd12a1ca3821c88a4`, frozen document55 sections14/18/19 and the existing accepted Player intake, Person genesis and Native release contracts. The overall nonvisual user authorization applies. No design/UI integration, old candidate plan, real-football ability import or merge.

## Implementation

- Core generation uses the existing derived Player-specific Career seed and a separate fixed generation namespace. A complete explicit versioned policy supplies class weights, continuous ranges, tier boundaries and the attempt budget; there are no production calibration defaults.
- Select a class once, sample continuous geometry, validate the existing body reach envelope and project its height tier. Bounded rejection sampling fails an impossible selected prior without clamping the position or silently substituting a class. Class ranges may overlap; the label is not a physics modifier.
- Native generation requires actual persisted Person identity/creation day and Career seed, plus an independently accepted body/prior creation record. Store the full input, generated result, accepted release baseline and checksum; replay all content. Policy ID/version is frozen across Players in a Career and Player creation cannot be reissued under another Source.
- The existing Native release owner accepts the archived generated baseline. Two sequential idempotent stages recover a crash gap; no cross-database atomicity is claimed. Ordinary pitches read the resulting history, not a genesis seed. Explicit later form-change events revise that history without rerolling creation evidence.

## Evidence

- Separate Core and Native RED logs reproduced the missing production modules before implementation.
- Core tests cover 200 distinct reproducible Players, overlapping priors, tier projection, body validation, partial/impossible ranges, malformed/future policy, invalid seed and getter rejection.
- Actual Native intake/Person/timing/release owners generate two distinct Pitchers. The existing physical runtime executes 101 varied NORMAL/QUICK pitches from one fixed generated position and records their actual plate crossings.
- Changed Source/policy, duplicate Player Source and same-version policy drift are rejected. Reopened owners reproduce archived generation without a live prior reader. Formal later form change affects only subsequent release history. Corrupt generated content is detected.
- Forced SQLite insertion failure rolls back a newly inserted policy and its generation record; a later retry succeeds.
- Focused affected owners: 5 files / 16 tests passed; typecheck passed. One fresh independent read-only review reported no findings and independently passed the 2 new files / 7 tests.

Final `npm run verify` passed: catalog compilation and typecheck succeeded; 524 test files / 3,123 tests passed in 980.41 seconds. The existing long regional/national integration gate and P9 fingerprints were preserved.

## Remaining scope

Body measurements and prior calibration are explicit accepted inputs; this generator does not create an entire calibrated world population. Causal activity/travel/recovery state and its actual development/runtime consumers, larger national-pool selection and full season/Career orchestration remain in the ongoing approved audit. The overall goal remains active.
