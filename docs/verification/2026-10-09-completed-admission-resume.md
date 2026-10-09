# Resume from the closed completed-endpoint admission

The first completed-endpoint recovery was interrupted during its first normal owner retry. No terminal or returned retry observation was written. Its historical exit and reap are unknown; a later process inspection found no live matching process. The original ordinary-completion attempt remains failed, and the interrupted recovery receives zero aggregate credit.

Before interruption, the recovery had completed the authentic closure admission and original terminal proof, then closed and fsynced its independent admission database and receipt. Completed timings were 121.569 seconds for closure admission and 38.553 seconds for original-terminal proof. The unfinished retry span is not credited or reported as completed work.

This test-only continuation takes that exact closed admission. It authenticates the original failed tuple, the interrupted recovery controls and complete tuple inventory, the completed span sequence, the admission receipt, and the closed main-file checksum. It preserves the distinct interrupted retry main/WAL/SHM tuple. No original artifact is opened by SQLite.

The copied row is used only for checksum-bound owner setup; parsing it is not an authenticated owner result. Both normal `closure.resume` calls independently derive their real current proof, with immediate fsynced returned-value observations. The first closes before the fresh reopen and second retry. Raw rows and schema must remain unchanged. Official, scoring, effort and workload effects remain guarded before invocation.

The resulting continuation receipt names the actual closed admission as its input and predecessor. A separate v2 recovery receipt binds the original failed attempt, interrupted recovery, admission, actual two returns and closed output. It cannot retroactively pass either earlier attempt. Production source and accepted recipe are unchanged.

## Finite qualification

Three structural RED cases failed for the missing continuation API, alongside five passing original recovery contracts: terminal `d1115ca4013b0e4ff71faca745100c3d8b18fba949c2deba9d771db012d3f03d`.

Eight GREEN structural cases passed with no skips: terminal `19ad313fdb53cc0bc42adc6f07b0d9889198f6ccb48e575f0f5b7a94e7f6caae`. They cover inert release capture, actual closed-admission lineage and raw Source/proposal/result seals, plus existing full-tuple, effect-call guard and continuation contracts. These are structural tests, not substitutes for a genuine reader.

The full root plus terminal-completion harness compiler passed: terminal `cd2363cb455482340fd1292bae5e871158247be7c7d0cd9e0dbf18a1efed985a`. Both final lanes used frozen source SHA-256 `726dbd477100a884fa008f27915d9189181e85cc3172ae0d4ca26f2de54822ff`, exited zero, reaped all owned processes and retained all four input groups. An initial compiler configuration pointing at the old source was corrected before any launch and receives no compiler credit.

The structural lane used 512/608/1024 MiB old-space/measured-heap/RSS with 120 seconds; compilation used 1664/1760/2304 MiB with 180 seconds. Admission required RSS plus 4096 MiB available and both enforced the continuous 4096 MiB reserve.

The separately reviewed Native proposal remains one two-retry case, 1800 seconds, 1024/1120/2048 MiB, and the same admission and continuous reserve rules. No new physical pitch, actor, official progression, workload charge or game rule is introduced. Native launch is held for exact source/input/control review.
