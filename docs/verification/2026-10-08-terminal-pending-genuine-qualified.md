# Terminal pending application: bounded genuine qualification

The terminal-bunt pending application slice now has a genuine GREEN and three genuine atomic rollback passes. An authentic durable queue is applied once through the shared writer, survives retry and reopen, and remains explicitly blocked from next-play admission. This checkpoint does not implement acknowledgement, scoring/workload settlement, reset or next-play activation.

## Exact source attribution

- Focused compiler and 84 selected LIGHT cases qualified commit `562ad1edd12f9052704902f22ac73558ac607299`.
- P11 and P17 below qualified commit `28868f1fe102fd471a020b46fefa34885f840cc8`, which adds only the bounded result note and plan update to that commit.
- Both commits have the identical src tree `8c0ad51bc2e444b5ac97f6c697c0c76eae73d9fe`. This final report is a later documentation-only change; no production or test code changed after those passes.

The total is 88 selected passing cases: 25 pending writer/runner opening, 18 raw metadata/historical guards, 24 legacy writer parity, 17 adjacent official-store/actual-live compatibility, one genuine application, and three genuine rollback cases. The producer's successful prerequisite case is not added to this total. This is not the full project suite. The compiler and 84 LIGHT terminal hashes remain in [the bounded runner report](2026-10-08-terminal-pending-runner-bounded.md).

## Fresh controlled genuine results

| Stage | Result | Released config SHA-256 | Terminal SHA-256 |
| --- | --- | --- | --- |
| P11 genuine application, exact retry and reopen | 1 passed | `9bd0bf76fb8e57ed73416a79bf9f397017f078034ca07d8464a61548012f854c` | `89de1c8e17c816716b31315cb7834f3a3345f23deaa45e82dbcd343e664afe38` |
| P17 real Match/application/terminal write rollback | 3 passed | `222284fabc5219806e39fe15757182cf9f69b9ba8d8b81b246012f792918f344` | `7df524321fe5fe02389272f95744b246b9ee69a5f6251769a1c2b10e60787b85` |

Both stages completed with controller and original-child exit zero, no failed/skipped cases, no unhandled or suite errors, no surviving owned processes, and unchanged source/dependency/control/runtime fingerprints. The shared source filesystem fingerprint was `2ba7d117915b7efb8509435992ce2e7444c89768324cb3c72083ee9994afc3b4`. P11's report SHA-256 is `44c2a91c1101a1871f31bf1c2484fd1a04992639f3d0b607d7f6d6e9b17a8fbd`; P17's is `3f58786e3a2a3449b41bb4a9328c3cb1d60c065d51887e1f1858f3525c28e561`.

The stages used Node 26.10.0, one Vitest thread worker, 1024 MiB old space, a measured 1120 MiB heap ceiling and 2048 MiB aggregate RSS cap. P11 retained its 2520-second outer/2400-second case caps and completed its test in 88.87 seconds; P17 retained its 1980-second outer/600-second per-case caps and completed all three tests in 116.27 seconds. Peak aggregate RSS was 592196 KiB and 589928 KiB respectively. Each stage held the original three shared lock files through exclusive nonblocking flock and inherited verified descriptors. The independently reviewed private supervisor opens those existing files read-only; their paths and identities were unchanged, and no replacement locks were created.

## Producer lineage and assertions

Both stages explicitly consumed the preserved successful v2 producer from the genuine missing-runner RED; neither regenerated physical evidence. The RED terminal SHA-256 remains `d82164f606434d8043d2dfd39a096013b1cdc5d5474a30235db118318f1eea6a`. The original closed v2 database SHA-256 remains `8305d345aecd3ec15df6f6cea2870279bb93afe57bdf402ce2aac89731d177d5`, with receipt SHA-256 `7a74a8e52b7557b38553af50c716bc2f5aca20d33c764bd29c57103213911a60`. Its successful child report, original admitted source bytes, process birth/runtime identity, observed owned exit/close and empty remaining-process census were verified before reuse. Each consumer copied that closed artifact exclusively into a new private destination, migrated only its copy to v3 and observed rejection by the exact frozen v2 official-state store.

P11 observes the real transactional terminal write and independently verifies exactly one Match UPDATE, one application INSERT and one terminal UPDATE. It checks the three exact mirrors, original evidence conservation, unchanged schema, missing-Source refusal, zero-change exact retry, close/reopen equality, pending `getMatch`, and rejection of prior-closure admission. P17 uses a separate private copy for each write point. Real AFTER triggers corrupt original end evidence after the Match UPDATE, application INSERT or terminal UPDATE; each witness observes the mutation inside the real writer's transaction, and each application then rejects and restores the complete pre-application logical rows. Schema, trigger, v3 version, transaction/query-only state and the original retained producer are preserved.

## Boundaries

This qualifies one genuine terminal-bunt origin and its three rollback points. A second genuine origin and the full project suite remain unqualified. The frozen v2 rejection covers the official-state store entry point; it is not an all-old-writer fence or a claim about unmanaged external writers. The earlier pre-child EROFS attempt remains preserved with zero credit.

The next concrete owner extension is an authenticated terminal official-child acknowledgement bound to the existing E obligation and durable application receipt. It has not been implemented by this slice. Private databases/controller artifacts are not repository deliverables. No CI, merge, deployment, UI/design or PitchArsenal work was performed.
