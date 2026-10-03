# Bounded original pitch evidence — work in progress

Authority: approved Foundation44b9f5de7b9d87e649f12f1af78c202f2b5ab44d / Realism4f0a60a3818926327b6bf5877ab3dec456a76530. Base98f307f8a859857ef5286b7bda1455eab435db35. Reused idle fielding checkout and dependencies; original published throw branch is preserved. Presentation remains disconnected.

## Implementation

- Add strict original physical pitch-prefix replay selected by owned Source identity, deriving scope/revision from its database row. Reconstruct every original action through that endpoint from the original frame and validate Source, mirrors, revision, hashes, snapshots and original actor/evidence with the same replay path as full progress.
- Check the current head and sequence structure through metadata without executing future Sources. A missing or incompatible head and corrupt original evidence are rejected. Later accepted pitches are not imported into an earlier original prefix.
- Capture original row hashes and the endpoint's canonical prefix-head identity. At original acceptance this equals the existing head hash; after later legitimately accepted pitch progress it stays unchanged. Existing archives and data formats are preserved.
- Batted flight historical read/retry now uses this bounded prefix and capture, avoiding a flight-to-full-pitch-to-future-batted-to-flight reader cycle. New writes still use a full current pitch replay and exact latest Source/snapshot proof through `openFrame`, plus existing original actor, closure, workload and transaction checks. Existing non-live closure uses its full final pitch proof unchanged.

## Verification so far

- Missing bounded API reproduced2RED; reject cases before the API existed did not establish its validation. New12case prefix suite plus3old pitch cases subsequently passed:15tests,32.60seconds. Real accepted successive pitches establish earlier-prefix/hash preservation and byte-equality with the old original head capture. A deliberately corrupted future Source probes the replay boundary and is explicitly not described as legitimate progress.
- Native existing flight historical reconstruction initially failed an explicit future-replay barrier. Connected its original reader/capture and preserved a separate full current-write proof. Related4files22tests passed,24.71seconds, with typecheck/diff-check0. Added a real accepted multi-pitch case distinguishing valid historical proof from stale new-write authority.
- Combined initial7file Native/WAL/pitch/non-live/flight gate7284 completed with actual exit0:65tests GREEN,462.02seconds. The reviewer separately ran old Native flight/WAL18tests GREEN,297.35seconds, and established old canonical hash equality at legitimately accepted second/third endpoints.
- Review found a P2: aggregate count/min/max could accept non-STRICT SQLite fractional revisions such as1,2.5,3. Three tracked REDs also exposed malformed future Source identity. Replaced the aggregate with metadata-only ordered Source/revision validation for every exact integer index+1 and valid ID; future Source JSON/snapshots remain outside original replay. Post-fix4files26tests GREEN,25.35seconds, typecheck/diff-check0. The reviewer independently confirmed the same fractional repro RED-to-GREEN, old hash compatibility, future replay boundary and stale new-write rejection:3files19tests GREEN,27.86seconds,4Source hashes unchanged; no other concrete P1/P2.
- Post-fix Native flight/WAL/prefix gate43591 completed with actual exit0:4files35tests GREEN,281.08seconds, including12real-file WAL,15original-prefix,2historical/current boundary and6existing flight cases. Four Source hashes remained unchanged during the gate. Frozen whole verification remains pending after the Source commit; the earlier successful gate did not substitute for this post-fix gate.

## Remaining goal

This is a directed physical proof dependency. Actual first-base known-absence/early OUT and continuous race timing, ball base gates/base contact and legal surface/dead-ball owners, whole-play adjudication/final closure/scoring/actual-role workload and all other latest confirmed nonvisual systems remain required. The history and first-base whole gates remain independently frozen. No goal-completion claim, UI/Presentation connection, PR merge, archive rewrite, dependency/config/lock/migration/generated change or old/draft revival.
