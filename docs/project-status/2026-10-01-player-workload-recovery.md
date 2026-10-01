# Causal Player workload/recovery — 2026-10-01

## Approved scope

Foundation `560670be519a01f07e2e4b7dd12a1ca3821c88a4`, frozen document14 causal fatigue/no off-day reset, document32 health/development and document53 actual practice. The user authorized all confirmed nonvisual work. No UI/design connection or merge.

Latest foundation head `44b9f5de7b9d87e649f12f1af78c202f2b5ab44d` was fetched and compared. Its additional changes concern Presentation/PNG and archived Pixel experiments; the nonvisual frozen documents above are unchanged. Those experiments remain excluded.

## Implementation

- Core derives fatigue from explicit accepted match/practice effort, actual travel distance and actual recovery hours/quality/medical availability/Player recovery capacity. Rates are explicit versioned calibration; there are no default league, calendar density or outcome modifiers. Missing days do not create rest. Finite results saturate in [0,1]; malformed/nonfinite/overflow, future policy, backdated/cross-scoped facts and stale revisions fail.
- Native requires the complete actual persisted Person link, including accepted day. Reduced link projections omit that provenance and are not used. Baseline/policy and immutable activity BEFORE/AFTER states are persisted. Activity and CAS head commit together; strict original retries survive reopen without a live activity reader. Replay verifies every accepted transition and head, and detects corruption.
- Production practice binding reads each exact archived practice BEFORE fatigue and its independently accepted health availability. Caller fatigue/health fields are excluded. Later rest cannot rewrite past practice. The existing practice bundle/learning DTO is preserved.
- Actual Native pitch-timing learning rejects the exhausted cohort and leaves revision unchanged. After accepted recovery, fresh practice permits the measured Source change. Old learning retains exhausted evidence and historical Source reads remain unchanged after reopen.

## Evidence

- Separate Core and Native RED tests reproduced absent production modules before implementation.
- Focused affected owners: 4 files / 13 tests passed in 1.04 seconds. Catalog compilation and typecheck passed after correcting a test-only union narrowing error.
- One fresh independent read-only review reported no Critical/Important/Minor findings; independently passed 2 new files / 8 tests in 2.35 seconds.
- Forced SQLite head-update failure leaves neither activity nor head change; subsequent retry succeeds. Corrupt archived BEFORE state is detected after reopen.

Resumed `npm run verify` passed: catalog compilation/typecheck succeeded; 526 test files / 3,131 tests passed in 657.61 seconds. Existing long National actor/roster integration and P9 fingerprints are preserved.

The first whole-suite log was interrupted without a final result at the user's restart pause. Resumed verification writes `workload-verify-after-restart.log`; only its completed evidence will be reported. Base PR231 P0 run36828553033 attempt3 succeeded at exact `312a8704acb6f61b9e7a680533b84d19594fd47c` after the approved single CI checkout lock removal.

## Remaining approved work

Published as PR232 stacked on PR231 at `8d23e9f89c21240610315fceb53842e547544751`. P0 run36832112606 succeeded at that exact SHA. Attachment was attempted once; the app's 100-artifact limit rejected it.

This causal state does not claim a complete injury model, evolving physical recovery capacity, autonomous scheduling of sleep/rest or all fatigue effects on Match actors. Physical/runtime fatigue consumers, calibrated Career content, larger national-pool selection and full season/Career orchestration remain in the overall approved audit. No approved scope is removed from the goal.
