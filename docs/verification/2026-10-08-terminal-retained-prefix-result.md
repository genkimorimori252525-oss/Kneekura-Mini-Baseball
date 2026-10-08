# Qualified retained TAKE-0 recovery

TR-N01 passed on the frozen test-only recovery source `e06044f00313380319f12a082d855b0ac9d8d7d3` (src `051cbcd6b4d5bd407cd2df9c807d36b30284a311`). One case passed with no skips, exit 0 and no remaining owned processes. The supervised readback completed in about 128 seconds.

The original main/WAL/SHM tuple was preserved byte/stat-exact. Only its private copy underwent SQLite recovery/checkpointing. Exact committed, checkpointed and reopened row/schema census hashes matched. All handles closed and the output has a separately authenticated TAKE-0 Source/result: progress revision 1, count 0–1, last event tick 48,295,719, with the original terminal and away-2 actor lineage retained. No new pitch, official application, score or workload effect was admitted.

All fourteen synchronous spans completed. Current terminal readiness took 41.397 seconds; the one-pitch replay took 83.308 seconds; original recipe-prefix replay took 14 ms; current pitcher workload took 0.8 ms. These are completed top-level observations, not inferred durations or counts of nested derivations. The trace, closed receipt and exact original tuple provenance are retained privately.

Released config: `759f4e81eafa58287e735e0724dd6d43abad29c16a9cf7b073db8befefa93a91`.
Passed terminal receipt: `44328ba0d8f2d0c3c8b6cffc3b88c4894fb2c1c7844a96c79fa66e7ab1cc1d3a`.
Closed recovery receipt: `e54703624b806d9952f0baead4583c9c2d6453e6692591f011583803df204762`.
Qualified one-pitch input manifest: `e5ce300cd4078ee1815257eb399a9f7c37546d82c30efa9deb1d76620714bafc`.

The 1800-second gate used the reviewed 1024/1120/2048 MiB old-space/measured-heap/RSS profile. Continuous available memory remained above 7,881,756 KiB across 1,272 samples; peak process-group RSS was 503,688 KiB. Source, dependencies, controls and runtime pins remained unchanged.

The original three-pitch P1 run remains failed with zero aggregate credit. This recovery qualifies only the retained one-pitch input. TAKE-1 and TAKE-2 require separately reviewed closed stages; no recipe tuning, root reconstruction or implicit later-stage credit follows from this result. Private databases, WAL/SHM, logs, controls and receipts are excluded from the source change.
