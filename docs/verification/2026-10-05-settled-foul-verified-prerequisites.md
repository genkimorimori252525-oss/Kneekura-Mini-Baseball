# Settled-foul evidence prerequisites

The pure Core implementation introduced at `68c6700` passed its 32 contract cases plus 23 existing territory/foul/count regressions on combined source `71bb6da`. Full TypeScript compilation also passed on that source. Source and runtime/control hashes remained unchanged for both gates. These results do not prove a Native policy/evidence adapter.

The first Native fixture at `71bb6da` genuinely reached a stationary stop but was fair; that failed source and receipt are retained. Its later close/reopen assertions were not executed.

The corrected original-input candidate `243d32d1a4298a0d7a8b52da6a5bef35ffa429ef` passed its single Native case with no skips and unchanged source/control hashes. The incoming x velocity was `1` m/s, the actual bat-contact exit x velocity was `-0.5200000000000004` m/s, and the physical stop was:

- origin tick `11180360`, elapsed `2.921400026539861` seconds, recorded tick `14101761`;
- center `(-0.043206587288437126, 0.0366, 21.536197618653116)` m;
- velocity `(0, 0, 0)` m/s;
- existing Core territory: foul, basis: settling.

This gate also completed the real-file close/reopen boundary after all original handles closed, rederived the physical prefix without callbacks, verified exact immutable archive/head bytes, and kept official Match state unchanged. Receipt SHA256: `a330110222f02fc274e616abdc07220a89b577d257fa4f1dee13e869cb15ea9c`.

The next step is the explicit accepted Native policy contract. No policy result, live dead-ball application, count change, bunt intent, umpire decision or closure was produced by the physical prerequisite gate.
