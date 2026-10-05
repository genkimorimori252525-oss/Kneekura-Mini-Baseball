# Official-stage continuation and authenticated read replay

The actual-role workload provider now reads each accepted activity inside its own short read transaction. The transaction ends before the consumer starts its separate write transaction; the consumer's fresh pre-write, written-state, retry and mutation guards remain active. This permits the existing physical-read reuse within that callback without retaining evidence between operations.

The verification continuation route authenticates the original official-stage files before executing downstream code. Ordinary source continuity remains strict. A separately named read-replay transition permits only the exact reviewed callback implementation change, then requires two fresh read-only SQLite connections and identical reconstructed official observations. Source, configuration, original inputs and closed DB bytes are checked throughout; stage results retain their original source identities.

## Current-stack code verification

Fixed integration Source `75258d5a33d588aabb5e44c9cb8d99097e2cd237` contains the preceding runner/practice stack and this callback/continuation implementation.

- Full tree before documentation: `373caa480425bdc04e77e16bed51ba8eb9c3ac66`
- Complete `src` tree: `a0aa688e58838550f2822c05d9fe69416b92b860`
- Tracked/generated Source manifest SHA-256: `99e8175def35700d809931c96deea869ff09e02f43c010126635d77724be92f7`
- Final gate receipt SHA-256: `20a3383c5effdf33eb62d018de034d2be25638175a33349b28d8cdaf10652dde`

Passed 27 Native tests in five files, 1,419 Node contract controls, 42 Python supervisor controls and full TypeScript compilation, with no skips. Native checks took 41.660 seconds with peak aggregate RSS 407,128 KiB; compilation took 29.685 seconds with peak 1,371,620 KiB. Actual heaps were 288 MiB for the Native/control runs and 1,504 MiB for compilation. The three runtime locks remained exclusive, all processes were reaped, and Source/control/runtime hashes stayed unchanged. The Native helper tests explicitly substitute expensive physical-context construction; they are separate from the real artifact proof below.

Publication adds documentation after that gate and retains the identical complete `src` tree. One trailing blank line in a test-only fixture was removed during integration; all current-stack controls above include that exact change.

## Genuine artifact proof, with its original Source

The original official stage passed on `6eb9dd6d6d46d6c6e9f8f2282b9b5ab45129bade`: real adjudication/application INSERT mutation rollback, exactly one official application, retirement of the original ten controllers, closed-file reopen and identical retry. Those original write/fault results continue to belong to that Source.

The subsequent genuine read replay passed on **`9350c204a7d758f511155e6d79913e3b818e4db7`**, whose complete `src` tree is `ce5a7b0489c8f6f3ac4613020582c9d593a976c1`. The first and second independently closed reads took 291.135329049 and 309.958968640 seconds; the fully reaped outer attempt took 611.881 seconds. Both returned observation digest `ef6d5de22635e3ffb4246aaf6c3fa475edd17508a8cf84a3e7d1b883c951c9ff`.

The replay checked the actual original official receipt, scoring/workload status, current Match, all ten original participant references, retired controllers and complete table census. It opened two read-only connections, owned and closed two read transactions, performed zero writes and preserved the original DB/WAL and all pinned evidence bytes.

- Replay receipt SHA-256: `a9351290bbf667e2288a9e0f054fdb0f1bf84b4afd1a39dce9e8cb9d96ecda2b`
- Stage terminal SHA-256: `6505b4b4eebb31fb4447f0642be061f8d415552a3ba137eea8da315120b8c81f`
- Supervisor terminal SHA-256: `5657e129660fb01b0814208f73ecbbf9becd4853fb272e4861dcb24f69fa4f5a`
- Source manifest SHA-256: `b52efc4a53d539e640b777aea94654e535b80eda1216fd11bdc0af3c53cd6c9c`

Its final compiler, 1,419 Node/42 Python controls, helper import, actual eight-file admission, CLI-preload rejection and supervisor smoke also passed. Review regressions separately exposed and fixed final manifest-byte/path drift and child-creation signal cleanup. The unchanged callback-only route is included in this checkpoint; later paired-closure optimization and its artifact timing remain separate work.

## Remaining work and publication boundary

The real replay establishes authenticated read continuity. Actual all-player workload settlement, the next physical pitch, the forty-piece archive gate and the latest cumulative whole are still pending. Scoring remains explicitly unsupported for H/E as permitted by the design. The newest completed cumulative whole remains PR277: 697 files / 5,159 tests plus typecheck.

This checkpoint contains code, tests and verification prose only. The distinct official-stage synthetic DB and its raw local receipts are not uploaded here; that DB publication remains a separate pending action. The read-replay result must not be relabeled as a whole pipeline or whole non-design-plan completion.
