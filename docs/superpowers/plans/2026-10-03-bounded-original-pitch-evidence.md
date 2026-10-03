# Bounded original physical pitch evidence

Authority: approved Foundation44b9f5de7b9d87e649f12f1af78c202f2b5ab44d and Realism4f0a60a3818926327b6bf5877ab3dec456a76530. Continue actual-base-history task4 and first-base interpretation task4. Base98f307f8a859857ef5286b7bda1455eab435db35. Reuse idle fielding checkout; retain existing published branches and shared dependencies. The history and first-base whole gates remain frozen in their own checkouts.

## Evidence and required connection

`SqliteBattedBallFlightStore` currently reconstructs its original pitch by replaying every current pitch row, requiring its Source to remain the latest head, then capturing all current pitch rows. This is incompatible with an immutable original bat-contact prefix when later whole-play progress is added: flight -> full pitch -> future batted extension -> flight would be a reader cycle. Historical proof and current write authorization must be separate. Existing archives, hash formats, Source shapes, original pitch semantics and the non-live closure owner remain preserved.

## Tasks

1. Add a strict Source-identity bounded pitch-prefix reader. Obtain game/play/revision from the owned endpoint row, replay every original row through that endpoint from the immutable original frame, and validate Source/mirror/revision/hash/snapshot/Player/evidence as before. Validate current head/prefix structure without executing future row Sources. A corrupt/missing original row or incompatible head remains rejected; later rows are not original physical evidence.
2. Capture the original row hashes and the endpoint's canonical prefix-head identity. At the original head this must equal existing archived `originalPitchRows`, byte for byte. Later legitimate progress must not rewrite or replace that identity. Tests must use real accepted successive pitch actions and separately prove bounded replay does not parse future Sources. Do not describe deliberate future corruption as legitimate progress.
3. Connect batted flight historical read/retry to the bounded reader/capture. Preserve a fresh whole-current-pitch proof and exact latest Source check for new writes, both before and inside/after the transaction, together with existing actor/workload/closure guards. Protect cached-peer/retry/late-original and head mutation rollback. No arbitrary new flight may start from an old pitch.
4. Continue actual first-base known-absence/continuous race, ball gates/base/surface/dead owners, whole-play adjudication/final closure/scoring/actual-role workload and all remaining confirmed nonvisual systems. This directed reader is a dependency, not goal completion.

## Verification

Tracked RED/GREEN, real accepted multi-pitch earlier prefix, original tampering, head corruption and later-source replay boundary, unchanged batted flight archives/retry/reopen, Native/WAL transaction tests, existing physical pitch/non-live closure tests and typecheck. One fresh readonly major-branch reviewer after implementation; fix proved findings, Source commit and frozen whole verification before publication. No UI/Presentation, PR merge, archive rewrite, dependency/config/lock/migration/generated change, or old/draft revival.
