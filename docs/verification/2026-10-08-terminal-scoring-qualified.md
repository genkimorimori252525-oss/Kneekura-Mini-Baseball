# Terminal deterministic scoring: bounded qualification

The selected scoring slice is qualified with the source attribution below. The final code revision is `2be4a02404d186b9d96cfc7afcd637a0fc7ecebe`, src tree `8c161152fb69ac6587d54cc7b20df51954141bad`. The accompanying [source-only publication manifest](2026-10-08-terminal-scoring-publication.json) lists the exact delta and sanitized verification hashes. It contains no database, raw log, private input path or retained-artifact payload.

## Supported effect

The dedicated terminal owner authenticates the original acknowledged pending terminal on its own SQLite connection, classifies the original assigned call through the shared canonical scoring writer, and creates exactly one canonical scoring row. Read, retry and reopen reauthenticate durable evidence. Original physical P, C/E/journal, frozen oracle projection, acknowledgement, application/Match, workload and schema remain unchanged. The legacy scoring, workload, history and actor consumers reject terminal-pending mode; both next-admission fences remain closed.

No workload, completion/reset, terminal-history replay, finalization, next-play activation, UI or design capability is added.

## Source-attributed evidence

- At `4bc46aa0071dc75717892282bad5511a4d11164d`, **20 genuine cases passed**: all sixteen S02–S04 trigger/rollback, peer freshness and transaction-identity cases, plus the first four S05 dependency-integrity cases. Each four-case batch explicitly excluded the other twelve cases in its file; excluded tests earn no credit. The five batches have no overlapping selected cases.
- One subsequent S05 batch at that cut **failed during private fixture corruption setup**: deleting the referenced application hit a foreign-key constraint before reader assertions. The whole failed batch is uncredited. It is not a scoring RED or a production failure.
- The injector repair temporarily disables FK enforcement only on the private fault-injection connection, restores and verifies its setting before production reads, and leaves the scoring writer's FK enforcement unchanged. The remaining **twelve S05 cases passed** in three disjoint batches on operation-fixed `8427ec9f77304baa835f69111cfc48a4642c23f9` plus that staged test-only repair. The repair is preserved in `2be4a02`; these twelve cases are not relabeled as having run on the later constructor cut.
- Real SQLite TS06 controls first reproduced five operation-boundary failures: BEGIN executed then threw, suppressed BEGIN reached SAVEPOINT work, suppressed COMMIT, COMMIT replaced with BEGIN, and query-only drift after COMMIT. COMMIT executed then threw already retired correctly. The minimal fix in `8427ec9` guards acquisition cleanup, checks transaction acquisition before work, and verifies transaction/query-only state after COMMIT. All **22 storage/mechanics cases passed**. Genuine **S01/S03/S04 passed** on those exact source bytes, with fourteen intentionally excluded rollback cases.
- Existing-WAL TS07 controls proved suppressed/replaced constructor COMMIT already rejects and closes through subsequent PRAGMAs. Constructor COMMIT followed by query-only drift instead returned a live read-only handle, producing one genuine control RED. `2b95693df90606e05040a9bb5c02ead8456de0e7` adds a three-line post-COMMIT check before writer PRAGMAs. All **25 storage/mechanics cases and genuine S01 passed** on that constructor-fixed cut.
- At combined code cut `2be4a02`, the **focused compiler and 70 LIGHT cases passed**, with no skipped or unhandled cases: 25 storage/mechanics, 22 legacy consumer/type, 15 raw metadata and 8 canonical scoring cases. This is the selected compiler configuration, not the whole-project compiler.
- **94 actual-live scoring parity cases passed** at `4bc46aa`. That shared-writer/consumer implementation is unchanged by the later terminal transaction-boundary fixes. The expensive parity gate was not repeated or relabeled as a final-cut run.

All credited controller records confirm unchanged source/dependency/control/runtime input groups and complete owned-process reaping. Native gates used capped fresh processes and independent private copies of the existing pinned acknowledged artifact. No producer was silently regenerated. The original missing-adapter S01 RED and initial GREEN remain separately recorded in the earlier progress note.

## Independent review and limits

Independent source-only review cleared production commit `2b95693` and src tree `949fe09d170f5d9d6ff76094dd05158eeeef4bd1`; the final combined commit adds only the private-injector test repair. Review found no remaining blocking scoring correctness issue.

The predecessor official-table validator checks columns, defaults, nullability, primary and unique keys, but does not independently require the `applications.match_id` FK or the nonnegative `official_fixtures.fixture_revision` CHECK. Authenticated application/Match/fixture contents remain rederived and checked; no scoring-proof or scoring-effect bypass was found. Exact canonical constraints remain enforced for the new scoring table and acknowledged terminal table. Broader inherited-schema hardening is not claimed.

Qualification still concerns one genuine terminal origin. Metadata/negative layout fixtures are not physical provenance, a second genuine origin, or positive coverage of every alternate bound/null game-policy origin. No aggregate whole-project suite, whole-project compiler, home-PC CI, remote CI, merge, deployment or publication was performed by this verification slice. Publication is a separate source-only Draft PR step.
