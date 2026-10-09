# Ordinary K completion: closed recovery result

The actual split-pitch strikeout now has a separately qualified, closed ordinary-completion endpoint. CA-N01 passed after two real completed-owner retries, with no repeated official, scoring, effort or workload call. The official endpoint is revision 2, play 9, top of the first, two outs; the accepted workload advances revision 1 to 2. The original terminal completion and the new ordinary completion remain distinct real ancestors.

The recovery used the authentic closed admission retained before the interrupted CR-N01 attempt. Both real retry results exactly match the original ordinary completion return. Their completed timings were 197.169 and 199.110 seconds. Each returned value was fsynced immediately; the first call closed before the fresh reopen and second call. The final database is closed with no WAL, SHM or journal. Raw row/schema conservation passed. SQLite file bytes are independently pinned for each closed stage; byte identity across checkpoint/open operations is not claimed.

Evidence SHA-256:

- Passed terminal: `bd3404746503f13dcc23d84882fa824402626d925646e1218fb7fa5ac7dc1534`.
- Separate recovery receipt: `ea718f3e6d7914ae578f0d71f6314a0f183c39f8b8b61bed9b3e155de6b0eb40`.
- Continuing closed-stage receipt: `c6b63deda590d889c3a3ab8968e93316c2f7eae1740daaee5aac1ed0382f42ba`.
- Qualified closed main: `90d10003f52b93891a8763947b85cc679999b2c147b24c27aab7dea82b4f71b0`.
- Actual returned completion, identical on both retries: `7d021a2e9a677a81f260178ac56367d610f36e34f83fcb74a80638a4e823c11c`.

The one-case gate used the reviewed test-only checkpoint `1f5197fe65274c0290e4d37c4fdd1d62c16715bc`, production src `7e54641d26f28813ea1a8c3c84e5e0b3ee3ef1ff`, and the unchanged 1800-second, 1024/1120/2048 MiB envelope with continuous 4096 MiB reserve. It exited zero, reaped all owned processes, and preserved all four pinned input groups.

Original CO-N01 remains failed at its cap. Original CR-N01 remains interrupted without a terminal; its historical exit/reap remains unknown. Original aggregate P1 remains failed. All retain zero aggregate credit. Their complete preserved file tuples retain bytes, device/inode, size and timestamps. No original donor was opened by SQLite or repaired.

The explicit away-3 actor stage can now consume this actual closed receipt using its previously reviewed Source and recipe. This result does not claim that actor acceptance, a third out, a half change, a final game, or a later batted root has run. Private artifacts and controls are excluded from this source note.
