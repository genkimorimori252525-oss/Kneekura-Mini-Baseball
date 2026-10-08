# Terminal pending runner: bounded verification

This is the pre-genuine-GREEN checkpoint. The later [genuine qualification report](2026-10-08-terminal-pending-genuine-qualified.md) records P11 and all three P17 passes against the same src tree.

The terminal application runner now consumes an authenticated queued Source through the shared pending writer and preserves an explicit post-play block. It owns the transaction, verifies original evidence and the three durable mirrors, and authenticates retries without applying again. No acknowledgement, settlement, reset or next-play activation is claimed.

## Exact tested source and results

The following stages all qualified commit `562ad1edd12f9052704902f22ac73558ac607299`, src tree `8c0ad51bc2e444b5ac97f6c697c0c76eae73d9fe`. This note is a subsequent documentation-only change. Each receipt reports exit zero, no failures or surviving owned processes, and unchanged source, dependency, control and runtime fingerprints.

| Bounded stage | Result | Terminal SHA-256 |
| --- | --- | --- |
| Focused compiler, including the dynamically loaded runner explicitly | Passed | `d398bba5b06ba8c6d3619f4c7236cb33a94384e71d89dd4823f74ce9a76b0592` |
| Pending writer and runner-opening cases | 25 passed | `d1bca8dd3f400eb74d766b83e4e2872c9286238c52ca86b0a16d05eee9d84482` |
| Raw metadata and historical guards | 18 passed | `0d67b913e3b4cdcd0fbf32c3f9a43c815f59ffa26628afbc8124bae1df4efced` |
| Existing shared-writer parity | 24 passed | `de76c9bc1f6d8779171e01ededc1398b69aca2020ea1bb4e1a454e7bead89252` |
| Existing official-store/actual-live compatibility | 17 passed | `170a6af99cfc393637e34528fb859bd79574261f61129bb198a44298d37b596b` |

This is 84 selected passing cases with no skips, not a whole-suite pass or a genuine terminal application GREEN. The shared source filesystem fingerprint was `a13034b60c17d2f826364c5e4b6fee3018053afb2eb6a6555de17e0a39f4ab6c`. The focused compiler did not execute project code. The LIGHT cases used their bounded private controls.

## Genuine RED and review repair

Before runner implementation, the real producer successfully created and closed its v2 terminal queue. The acceptance controller observed the owned producer's exit and close, copied the closed database to a new private artifact, upgraded that copy to v3, and observed the exact frozen v2 official-store rejection. Only then did P11 fail with `GENUINE_QUEUED_TERMINAL_RUNNER_API_MISSING`. The expected-RED controller passed with zero GREEN credit, unchanged inputs and no remaining owned processes; terminal SHA-256: `d82164f606434d8043d2dfd39a096013b1cdc5d5474a30235db118318f1eea6a`.

Independent review then found that a missing terminal owner could hide surviving shared-application or Match claims. Seven new regression cases at `7d07bd2` exposed the missing rejection. Commit `a18c6f9` repairs the raw ownership census and absent-owner read path. All seven are included in the final 18 metadata passes above. Commit `562ad1e` explicitly includes the dynamically loaded runner in the focused compiler input.

## Retained producer and remaining gates

The original private producer survives with its complete successful one-case report, receipt, process/runtime lineage and output logs. Its closed v2 database SHA-256 is `8305d345aecd3ec15df6f6cea2870279bb93afe57bdf402ce2aac89731d177d5`; receipt SHA-256 is `7a74a8e52b7557b38553af50c716bc2f5aca20d33c764bd29c57103213911a60`. Read-only byte checks after environment recovery match all retained manifest pins. These checks do not open a database or qualify a new runtime.

P11 genuine application/retry/reopen and P17's three real-writer rollback cases remain unqualified. Their next runs must use the explicitly pinned retained producer, a fresh private v3 copy and coordinator-released controls; no physical fixture regeneration is needed or authorized by this checkpoint. The earlier pre-child launch failure remains preserved with zero credit. Missing or corrupt artifacts do not grant runtime. A second genuine terminal origin and the full project suite also remain outside this result.

Private databases and controller run artifacts are not included in repository publication. UI/design, PitchArsenal, CI, merge and deployment remain outside this work.
