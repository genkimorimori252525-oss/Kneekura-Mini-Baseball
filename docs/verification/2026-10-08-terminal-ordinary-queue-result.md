# Qualified ordinary closure queue after the actual split-pitch K

HC-N01 passed on frozen source `96319d3911523313f5d368c728a2d08bf5f4baf3` / src `7e54641d26f28813ea1a8c3c84e5e0b3ee3ef1ff`. The normal closure owner accepted `terminal-continuation-k-close` from the actual closed three-TAKE strikeout, using the unchanged accepted setup and nine-inning policy. Enqueue and exact retry returned identical PENDING Source/proposal identities, recorded synchronously and fsynced. Fresh original-owner readback and a closed ordinary-Native query-only reopen passed.

Only one scoped game-policy row and one closure row were added. Every pre-existing row and the complete schema stayed exact. The official Match, scoring, pitcher workload and next actor have not advanced. The v2 closed receipt explicitly retains the real split-pitch origin; it does not claim a successful aggregate physical-K run or two prior completed plays.

The run passed one case with no skips, child exit 0, unchanged source/dependency/control/runtime groups and no remaining owned processes. It completed in approximately 1227.5 seconds under the reviewed 1800-second envelope. Completed spans: readiness 45.178 s, complete three-pitch replay 47.911 s, enqueue 703.051 s, exact retry 211.399 s and fresh readback 216.093 s. Peak observed RSS was 511860 KiB; minimum available memory was 5305996 KiB, above the continuously enforced 4096 MiB reserve. All handles closed and WAL/SHM/journal sidecars were absent.

- Supervised terminal SHA-256: `d79138512bc79e4a4012ef7a8aee3565f65c0b2ccd2c25fd729bda82309bd993`
- Closed receipt: `588879f101978a6f2a044c3b9950856aa2ad8bae7e1fdcb3eded05646ae61e5f`
- Closed main: `02f05fb49fa641385518570c1c773258ee702c1185f09c28aa6edcf2ae715332`
- Accepted Source: `69f9952dabe27efdf519ce670440c36de1f3e5987ec5fa944f9d82e839344d58`
- Proposal: `e1654ab47b6e9fc81e4efa5210e35727b0f93a3dc4340a0f236d64551edfc971`

The preceding maintenance-interrupted Q1 attempt has no returned queue or supervised terminal and receives zero credit. A separate raw copy of its complete main/WAL/SHM tuple proved no queue row had committed and no logical rows/schema had changed. The original tuple stayed intact and was pinned throughout the fresh retry, which used the already qualified closed TAKE-2 input. Original aggregate P1 also remains failed with zero credit. No qualified pitch or actor path was rerun. Private databases, traces and controls remain outside source publication.
