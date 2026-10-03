# Player fielding model implementation brief

Authority: current approved Realism4f0a60a3818926327b6bf5877ab3dec456a76530 plans `2026-09-18-p3-defensive-ratings-schema-foundation.md` and `2026-09-18-p3-throw-transfer-tag-rating-integration.md`, plus current Foundation44b9f5d handoff and user's all-confirmed-nonvisual scope. Normalized eleven defensive ability fields and nine positions are already defined; transfer/arm/accuracy affect existing physical intermediates, never a success roll. No new formula/design/default is introduced.

Goal: own an immutable accepted global Player/Person-bound fielding baseline with explicit transfer and throw calibration. This supplies verified Native provenance for the next actual World transfer/release/throw action. It does not claim generated abilities, learning/development changes or World release are complete.

Source fields: IDs/version, careerId/playerId/personLinkSourceId, acceptedAtDay, ratings, transferParameters, throwCalibration. Reconstruct the actual own immutable intake link and validate every mirror/hash/snapshot. Missing/foreign/future Player data and caller result fields fail closed. One baseline per global Player; original sources remain immutable. Later validated learning/development may add separate history without overwriting this baseline.

Task1: tracked RED for own accepted link, actual Player scope/day, strict ratings/calibration and immutable reopen/read/retry. Implement Native Source reader/store using existing Core validators/physical adapters, no dependencies or defaults.

Task2: actual late-WAL/callback/source/hash/mirror/Person corruption and rollback; own Source re-read after retry callbacks. Verify relevant Native/Core/transfer/throw gates and typecheck; one fresh readonly whole-branch review. Commit Source/docs. Integrate this dependency with actual World throw execution and verify that combined physical path before final publication. Avoid another unrelated whole run for this isolated additive data owner; three prior complete-system gates are already live and final physical integration still requires its own comprehensive gate.

Ruling: all three existing checkouts have confirmed live frozen gates (98923/86130/39800). A new K: linked checkout is required to preserve their Source; reuse the existing ignored node_modules junction. Do not copy TEMP DBs or delete active/review files. App worktree creation has already failed because app cwd is the non-Git parent; existing manual Git fallback remains appropriate.

Remaining full objective: connect actual carried transfer/release/throw/reception/base/running, foul/next-pitch/between-pitch replay, official/scoring/actual-role workload, capability generation/development and other approved nonvisual Source connections. Presentation disconnected, no merges/force/reset, no permission bypass for config/locks/generated/migration changes.
