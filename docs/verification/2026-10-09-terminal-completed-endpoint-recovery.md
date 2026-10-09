# Recovery of the actual completed ordinary closure endpoint

CO-N01 reached its unchanged 3600-second cap and remains failed with zero aggregate credit. Six actual returned values were fsynced: official application, scoring, effort, workload, completion and exact completion retry. Both completion values have SHA-256 `7d021a2e9a677a81f260178ac56367d610f36e34f83fcb74a80638a4e823c11c`. The unfinished driver inspection/close/reopen does not receive retrospective credit.

A separate raw copy of the full main/WAL/SHM tuple showed a committed COMPLETED closure and exact SQL matches for all six returns, with no next actor. It preserved the original tuple and proved schema equality. That inspection is metadata/raw evidence only. The new Native recovery is separately held.

The test-only adapter first copies the complete retained tuple, authenticates the completed closure with the original evidence readers, verifies its exact Q1 Source/proposal and all retained original lineage, and closes a genuine admission checkpoint. The original Q1 database is never opened; its pinned conservation census supplies the before-state check. A fresh copy of the closed admission then performs the normal completed-owner resume and a fresh close/reopen resume. Official, scoring, effort, workload apply and workload initialization calls are forbidden before invocation. Normal readers and completed resume remain real. All rows/schema must remain unchanged through recovery and every original tuple file stays pinned.

The admission and recovery have distinct receipts. The v2 continuation view names the actual closed Native admission as its input and predecessor receipt, preserving the existing split-pitch origin. A1 therefore receives a genuinely closed input, with no manufactured successful CO-N01 or P1 receipt. Completed timing spans and actual resume values are synchronously fsynced. A failed or interrupted recovery keeps its own partial evidence and earns no qualification.

All production and existing continuation code under src remains byte-identical `7e54641d26f28813ea1a8c3c84e5e0b3ee3ef1ff`. New harness files are outside src. Five structural contracts cover inert/released controls, full nonempty-WAL input, effect-call refusal with receiver binding, closed-admission provenance and frozen queued Source/proposal identity. They do not substitute for original Native proofs.

- Initial four missing-API RED terminal: `2dbd2c50d3bb474b2d68933d0dbc9eaa66bf7422861113715aa1beb49d085b52`
- Frozen queued-identity RED: `b3b57b02a79bff250ce5ac9caffdfe807564479512abb1b345a152766a18ad4e`
- Five GREEN: `a8f1bbc13d6d5d13047ed4585eafb8786168f4b4f2a2d0d18e65034b5776e87e`
- Final full compiler PASS: `101b6d55af2520fee9a01db91ea868eceb9b19d5c03ff5a69d90b43b8f128ee0`

GREEN and compiler used the same final sparse snapshot, containing all src and required tools while omitting unused documents/artifacts. The compiler used1664/1760/2304 MiB and180 seconds, with no diagnostics. The earlier compiler's missing sparse helper imports and unsupported trace labels remain a failed receipt (`061d2ad4ced5c851cebb1448d40cead066daaae96fb7f68f7c8995ba8baeb9e6`). All completed finite lanes reaped their processes and retained stable input groups.

No recovery Native qualification or A1 admission is claimed by this source checkpoint. Private tuples, returned values, censuses, controls and traces are excluded from publication. The independent effort proof optimization remains on a separate source.
