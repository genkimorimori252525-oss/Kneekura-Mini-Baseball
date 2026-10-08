# Qualified ordinary physical K from separately closed pitches

PS-N01 (TAKE-1) and PS-N02 (TAKE-2) both passed on frozen source `dc09dd892bd8757fbcaef1a6d071a5e586a61e26`, src `b3112b3c95a9aa8c038bda7e3f5800490fcbb30d`, following the independently qualified recovered TAKE-0 input. Each run selected one case; its peer was skipped with zero credit. Both children exited 0, left no owned processes, and preserved all pinned groups and their actual prior closed inputs.

TAKE-1 closed at progress revision 2, actual count 0–2, tick 60,393,368. TAKE-2 then closed at revision 3 with actual physical strikeout, tick 72,473,028. Each added exactly one action and advanced only its existing physical head. Matching accept/retry observations were fsynced before fresh replay and close/reopen; all thirteen spans completed in each run. Exact after-write and reopened row/schema censuses matched.

Completed timings (seconds): TAKE-1 accept 1131.727, retry 47.958, readback 50.003; TAKE-2 accept 1110.898, retry 45.815, readback 44.353. The historical target pairing reduced the observed one-pitch replay from the earlier 83.308 seconds to 44.263 seconds in TAKE-1; those are measured runs, not a promise about future write latency.

TAKE-1 passed terminal: `f384a16a6c728be9c2957dd96e9a28383b171a149f29b53c0257495e9e24f059`; closed receipt: `dfbec5fd8805325a5694760dd7a1a70dfc4dca552d10933cbd5586c084babf00`.
TAKE-2 passed terminal: `6b5ba4838295781be2093fff94229fea5c256f7b5ca36954fafa87f7a5e0b51e`; closed receipt: `55f70c524a8b238f9bdeed3dec43e1a894ab198d2b56886ca5b2fa285e3e5387`.
Qualified actual K input manifest: `1835e0ae6692543a129f5a579bb3689e465d30c438b9533a0dbb2a88d90f4ee8`.

Both runs retained the reviewed 3600-second ceiling and 1024/1120/2048 MiB old-space/measured-heap/RSS profile. Continuous available memory stayed above 6,125,036 KiB for TAKE-1 and 6,182,752 KiB for TAKE-2.

This qualifies the physical K, not its ordinary official/scoring/workload completion. The official Match remains revision 1/play 8/one out until that separate owner stage completes. No next batter or half/final boundary is claimed. Original aggregate P1 remains failed with zero aggregate credit; its main/WAL/SHM evidence and the qualified TAKE-0 input remain preserved. Private databases, traces, controls and receipts are excluded from this source note.
