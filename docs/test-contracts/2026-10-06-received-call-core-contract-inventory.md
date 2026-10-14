# Received-call Core contracts: coverage and qualification

The suite was authored on frozen base `10934028ff85b00b38b37142dfeda45b9e3c0814`. Its current source `e0bfaa78b6bd15a06e17b8a015fc5562df09f298` passed fresh compiler/catalog checks and all 56 current plus 36 adjacent Core cases on 2026-10-07. This replaces the original source-only status; [the result note](../verification/2026-10-07-received-call-pure-core-qualification.md) records attribution and limits.

## Current selection

- `ReceivedUmpireDefenderReplanAvailability.test.ts`: 1 callable public-entry assertion against the real Core export.
- `ReceivedUmpireDefenderReplan.test.ts`: 52 control/behavior cases registered by `ReceivedUmpireDefenderReplan.contract.test-support.ts`, with no replacement implementation or mocks.
- `ReceivedUmpireDefenderRenewalEligibility.test.ts`: 3 regressions retaining `renewal_due` at the exact first-step boundary, a later integer cut and a strictly later fractional cut after timely cognition. They preserve the original adoption due tick and incumbent command without claiming physical execution.

## Original 52-case inventory

- Existing-kernel controls (2): actual-shaped callouts are not cover-base instructions; future received ticks are excluded by PerceivedWorld.
- Explicit local profiles (13): baseline competition, explicit OUT/SAFE alternatives, inactive-branch isolation, confidence/trust weighting and threshold, ball eligibility, deterministic chooser/ties.
- Exact information and timing (13): original information cut, authenticated same-owner sequence, exact reception/availability, awareness and first-step timing, command retention and future-payload exclusion.
- Stable cause and ownership (13): original lineage/receiver, deterministic continuation, mismatched or future input rejection, immutable model/plan/policy bindings and no duplicate call contribution or restarted deadline.
- Pending and missed work (11): missing profiles, unsupported receiver/motor/intent, no fallback command, genuine predeadline policy binding to original perception, and no backdated selection after a missed commitment.

## Contract boundaries

The input is an internal dependency envelope, not an accepted external Source. Native must authenticate identities, hashes, original perception and command/adoption ownership. Fixtures use explicit synthetic policy/model data; they are not defaults or calibration recommendations. The received-call content uses an erased type-only import and does not execute Native code.

The immutable origin capsule and policy binding preserve the original semantic evidence through continuation. A policy can bind once when genuinely available. `selected` can be a proposal; `selectedAt` identifies the actual cognition commitment. Source-specific `work` retains the cause and original due tick, without a consumed flag, body trajectory, physical adoption or PlayEnd certificate.

Independent source review added missing owner bindings and original evidence to the test envelope. It also strengthened changed-observation and same-recorded-tick missed-decision cases. The missing-entry RED and later renewal-eligibility RED were then qualified separately before the current GREEN run. The renewal correction preserves all test bytes.

The accepted policy Source validator, Native prerequisite/entry gate, replan/renewal owners and compositor/accounting remain separate work. The Native prerequisite failed its wall-time gate. These pure tests do not qualify Native authentication, SQLite persistence, actual adoption, full controller consumption or the whole plan.
