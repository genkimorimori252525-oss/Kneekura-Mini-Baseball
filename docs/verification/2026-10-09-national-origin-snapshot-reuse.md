# Positive National origin proof within one Native snapshot

Repeated National origin derivation now uses the existing outer physical read snapshot, while child field frames remain independent. Only the National origin reader stores a positive, fully authenticated immutable result. No general evidence cache or public proof setter is introduced.

Every use still enters the Native, main-only snapshot bracket, reads game and source alias ownership, validates canonical source/snapshot bytes and hashes, and compares the complete original row with its completed proof. The outer and current frame guards check transaction, query-only state, changes and schema versions. Mutable writer phases and independent reads establish new identities.

A result is published only after its child bracket releases its private savepoint, restores settings and validates the parent. Descendant failure, cleanup failure or a failed freshness check poisons the snapshot identity. A root cleanup failure ends that identity; an independent retry authenticates again. Missing origins are read afresh and never stored. Rollback/rebegin remains rejected by the owning private savepoint before the operation returns.

## Successful fixed-operation comparison

The first probe, a genuine read of saved `national-foul:field-4`, completed in 365.501 ms but derived National origin only once. It was retained as a negative control and is not used to claim improvement.

The comparison instead used the naturally enclosing `battedVenueFoulCountEvidenceFromSqlite(db).read(request)`. The request's policy, field and execution reference came directly from the persisted `national-foul:stop` Source. Both read-only runs completed with a derived foul consequence.

| Same completed operation | Baseline | Candidate |
| --- | ---: | ---: |
| Instrumented operation time | 776.135 ms | 501.819 ms |
| Complete National origin/registration derivations | 2 | 1 |
| Fresh original archive and alias reads | 2 each | 8 each |
| SQL prepares | 883 | 958 |

This is one comparison, not an end-to-end Native continuation timing. The stronger evidence is the eliminated duplicate complete derivation together with identical complete output. Fresh ownership checks account for the additional prepares. The export observer did not intercept same-module calls; derivation counts use the original registration-history query, which executes once per complete derivation, rather than its unused export counter.

The full result SHA-256 is identical: `4f2587e64653fbb4b2e5ca86377c8932c30f500ad02ddb757fc6cbd646178ea6`. The SQLite file SHA-256 remains `bf9808bf49485f745efcb68cc1af940275108c1018f67f9ad5bdcf56878aa247` before and after both operations. Original databases and private diagnostic artifacts remain untouched and unpublished.

The baseline is commit `45c0549489354ba7645fb0f2a4d672ae14065a99`, source tree `1e30b45982bacd16451ca7765eda8abace44aba3`. The production delta was frozen for the candidate comparison; subsequent edits only correct a test observer overload and add the outer-cleanup regression and this record. No capped actor-read counts are treated as a timing improvement.

## Affected checks

- Seven new controls cover same-snapshot child consumers, fresh raw archive validation, caught descendant failure, child and parent cleanup failures, mutation and transaction replacement, independent retries, missing evidence and attached namespace rejection.
- Six existing paired cleanup cases and the existing real postwrite freshness case pass.
- Three existing National owner controls pass: freshness after an owner write, rollback of a real INSERT that changes original dependencies, and original registration/game alias rejection. Unselected cases were explicitly filtered, not counted as passes.
- Catalog generation and all 18 protected blobs pass. The affected TypeScript graph passes after the observer typing correction. The base's unrelated recruitment-test typing errors are retained for the already planned combined compiler after integration.

No fixture reconstruction, full actor/tail scenario, broad new qualification inventory or home-PC CI was run.
