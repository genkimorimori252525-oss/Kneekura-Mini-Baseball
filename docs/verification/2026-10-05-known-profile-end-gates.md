# Fresh registered-profile physical end gates

These two opt-in tests preserve the next verification steps after the successful
`npb-2026` construction in Draft #304. They change no production implementation.
Both the fresh tail and the separate physical-end acceptance gate have now passed.

`ActualKnownProfilePreEndArtifact.test.ts` continues a closed original construction
through the second defender's genuine future decision, rule consumption, delayed
operative call, retained physical tail and ten future communications. It closes
and reopens the normal owners, then exports a closed pre-end database and complete
row manifest. End and seal rows must still be absent. The construction receipt,
input bytes, original Source and registered rule profile are explicitly bound.

`ActualKnownProfileArtifactAcceptance.test.ts` separately checks that manifest,
then tests the real seal INSERT with a transaction-local dependency mutation.
It records the actual rollback witness before clean acceptance, close/reopen,
identical retry and export. The original nonterminal tables must remain unchanged.
The legacy unregistered-profile fixture and its prior evidence are not relabeled.

## Verification and current limits

- Independent source review covered the actual owner calls, original-input
  immutability, raw construction receipt, rollback witness and closed exports
- Fixed Source `f86a7de6b117da5d6d08c2e6bd71cfefe7ea62d4` passed full TypeScript
  compilation in 24.327 seconds. Its import-only check deliberately skipped all
  three Native cases. Combined raw terminal SHA-256:
  `c1c3f8548442652c6f89bd8385b94fc2133472a247c6e501f43fcaf6d8d97797`
- Fixed Source `56d96a7728d21dc3b250e4e0bb5d8722fbc023c7` changes only the tail
  timeout literal from one hour to two hours, matching the owned run limit.
  Syntax and import-only checks passed with all three Native cases deliberately
  skipped. Raw terminal SHA-256:
  `262ea2e4516f1c21a70d2934dcfc20ec177cdc5c344b921afcc6f4905887eb0d`
- The published test files and complete `src` tree match that latter fixed cut:
  `67414f0d80b20cafd341c039e0b7eca7e5d8a04b`. Publication documentation differs
  from the test checkout; the compiler result stays qualified to the earlier cut
- The real fresh tail completed with **1/1 actual Native test, zero skips and
  exit 0**, in 2,818.44 seconds. Both processes were reaped; all source, control,
  runtime, configuration, original input and construction-receipt hashes stayed
  unchanged. Actual parent/worker heaps were 1,120 MiB; sampled aggregate peak
  RSS was 538,576 KiB. Raw terminal SHA-256:
  `1f36913e0de088686345056a108c1d1e79d948125face9e8eabc72eeb7182c9f`
- The closed result is preserved as the [registered-profile fixture](fixtures/README.md#fresh-registered-profile-pre-end-fixture):
  72 tables / 143 rows, no end/seal rows, no test trigger, and WAL 0. Database
  SHA-256 `64fc22bf43b656492aad85b6a8042e3862bd4fcf8132482cceca5f6109e8dc71`;
  raw input-manifest SHA-256
  `d7d2e1bf7783fb7a92e18cfeb7d63f4f730eda8c4ee8a6e34119596ea42a3dec`
- The fresh end gate passed **2/2 actual Native tests, zero skips and exit 0**,
  in 716.72 seconds. It witnessed a real seal INSERT rollback, cleanly accepted
  the end/seal, closed and reopened every owner, and verified identical retry.
  All source/control/runtime/configuration/input/witness hashes stayed unchanged;
  all processes were reaped. Actual heaps were 1,120 MiB; aggregate peak RSS was
  516,668 KiB. Raw terminal SHA-256:
  `02531e471eb2130a800c76e44e1e5f6d6daa108049c5ceb25357cc1b4c4eaa0a`
- The [closed ended fixture](fixtures/README.md#fresh-registered-profile-ended-fixture)
  has 72 tables / 145 rows, one end and seal, no test trigger and WAL 0. Its 70
  nonterminal tables are unchanged from the pre-end input. Database SHA-256:
  `585ab7862ab93991e97cd5032ba8d520e113635559aa0019b5dd9bd43257a04a`.
  Fresh seal-witness SHA-256:
  `85598590eba3406950a8dfbc11a5bb35741125396d1d11ab61f543c520fb2f76`
- Official-only integration started separately on fixed `6eb9dd6` at 07:48 UTC
  after compiler, 355 producer controls, helper import, actual 15-file byte
  admission and supervisor smoke checks. Its terminal result remains pending;
  physical-end success is not official/workload/next-pitch success

The existing Source-specific results and remaining scope are recorded in the
[continuation checkpoint](../project-status/2026-10-04-nonvisual-continuation-checkpoint.md).
No current-source cumulative regression success is claimed here.
