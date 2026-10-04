# Causal first-base umpire: bounded Native checkpoint

**Review status:** Accepted for this bounded legacy Native owner and the P1 repair. Independent review reproduced a P1: a later call transaction could delete or coherently rewrite an earlier pending call. The repair byte-pins the relevant complete prior raw rowset across preflight, BEGIN and post-insert checks. Both lightweight real-SQLite/mock-dependency mutation regressions passed after assertion RED, with a bounded-future-payload regression also passing. Six genuine disk/WAL regressions passed (533.98 seconds, terminal 0, unchanged source manifests): delete/rewrite trigger rollback, writer-local mutation after BEGIN, committed peer rewrite before BEGIN, stale cuts/later admission, and escaped aliases/mirrors. Every case asserted the actual main filename and WAL mode and closed every original connection before reopening its concrete owner. These are normal-close/reopen and transaction proofs, not process-crash recovery. Independent final review verified the exact six-case receipt and tested bytes and accepted the legacy/P1 scope. The separately reviewed v2 identity patch is not included in this checkpoint branch, and genuine v2 chain proof remains separate. No whole-project or complete-play approval is claimed.

## Implemented scope

The approved first-base slice now has a parametric causal producer:

1. A versioned accepted setup owns the assigned umpire identity, explicit static view interval, attention and timing calibration
2. An observation references an original actual `first_base_race` execution using `release_exclusive_v1`; its owner reconstructs the original field/execution prefix on the same SQLite connection
3. Fair-ground applicability and actual confirmed defender-control/runner-touch events come from the physical/rule owner. The classifier never reads `correctRuleResult`
4. Existing geometry, spherical body occlusion and observation quality drive an additive seconds-domain extension of the established symmetric-triangular capture law. Each event uses an independent deterministic umpire stream
5. The classifier compares only the two estimated event times. A perceived exact tie stays pending
6. The frozen observation/calibration schedules the call. A separate current actual execution cut adopts it only when due, preserving the original exact called/available time and its quantized record tick
7. An authenticated owned operative OUT can project legal retirement of the original sole batter; SAFE projects active participation. Neither projection changes bodies, velocities, committed motors, touches or correct-rule evidence

Both actual event occurrences must exist. A true OUT alone is insufficient. This slice intentionally waits for the event pair instead of predicting a future runner arrival.

## Visibility and calibration boundaries

The representative visual cue is the primitive's exposed upper point, derived from its actual position and radius. All distinct body spheres, including the cue player's own body, participate in occlusion. All actual bag prisms participate in the conservative surface-policy guard; the first-base bag is not removed.

Defender control is composite: the glove/possession cue does not grant knowledge of the separate foot/base contact. The actual contacting defender foot must independently satisfy existing geometry, visibility, attention, ability and detection-threshold checks. This is a required-component detection gate, not an empirical temporal-fusion law. The explicit timing calibration applies to the recognized control event. No production ranges, correctness rates or default umpire position/ability are supplied.

Sparse event samples use instantaneous observation duration (0 seconds); they do not establish continuous visual exposure. A static pose is an explicit accepted setup, not inferred umpire movement. Missing calibration, pose, attention, applicable race or actual pair remains named pending. Nondetection is distinct. Unmodeled surface visibility remains pending.

## Native APIs and ownership

`openSqliteActualFirstBaseUmpireStore`:

- `acceptSetup` / `readSetup`: immutable assigned setup and original pitch binding
- `observe` / `readObservation`: immutable event-pair perception and observation availability
- `advanceCall` / `readCall`: scheduled/due call adoption and immutable original ruling
- `readAvailableCall`: exact event-availability comparison, including distinct fractional moments in one tick

`actualFirstBaseUmpireEvidenceFromSqlite` exposes source reconstruction on an existing connection, authenticated `offensiveDisposition`, and `importReferences` for the additive Core owned-live-call import seam.

The store has separate setup/observation/call tables, strict accepted Source fields, canonical immutable source/snapshot archives, original game/pitch/umpire bindings, current physical-cut checks, and pre-BEGIN/inside-BEGIN/post-INSERT rechecks. It rejects caller-injected truth, ruling, call time and retirement fields. One assigned first-base setup and one frozen observation are supported per original pitch. A call can have earlier pending advances but only one operative event. Readers reject a second claimed operative event without replaying later domain payloads into the original cut.

Call-owner event availability is not player reception. No sent/received communication, acknowledgement, motor cancellation, physical PlayEnd, official closure, review, scoring, next-play activation or autonomous complete-game capability is inferred.

## Verification receipts

All tests use explicit synthetic parameters. They prove mechanics for those fixtures, not production calibration.

- Pure TDD: real assertion RED observed; 12 new causal tests and 24 adjacent geometry/quality/capture/RNG tests passed
- Initial Native owner RED: 6 tests reached the deliberate missing-owner implementation after valid actual fixtures were built; preserved as an error receipt, not an assertion-mismatch claim
- Original Native candidate: 9/9 causal tests passed; source manifests unchanged
- Visibility/duplicate-call RED: two tests failed with four real assertions; independently verified body/bag intersections, omitted required control-foot detection and readable duplicate operative call
- Corrected eleven-test run: aggregate exit 1, 10/11 tests passed; all nine causal cases and the duplicate-call case passed. The remaining expectation selected the later touch cue even though the newly required control-foot component hit the same torso sightline first
- Final integrity correction was test-only. Its two tests passed; the explicit earlier control-foot/body intersection is asserted. This shared view does not isolate the later touch cue. Every production byte remained identical to the corrected eleven-test production candidate
- Every Native gate used Node v26.10.0, one worker, a 1 GiB heap limit, disk TMPDIR, the shared auxiliary lock, a >=3 GiB start-memory guard and immutable before/after source manifests. The original causal fixtures used their default shared-memory SQLite URI; a disk TMPDIR does not make those databases disk/WAL. The six strengthened cases described above explicitly used disk filenames and verified WAL, close-all and reopen

The aggregate eleven-test exit 1 receipt remains a failed aggregate receipt; it is not relabeled a full-suite pass. No broad repository Native suite, merge, home-PC CI or deployment is claimed.

Integrated on the corrected event-disk checkpoint at local `c2633b8f32bafa942fb7ca2b97812b483dc86e83`: all ten changed source/test files matched the reviewed legacy/P1 candidate exactly. A fresh catalog-backed typecheck plus six light files / 39 tests passed on that integration with all 1,866 tracked hashes unchanged. The six-case Native receipt belongs to its separately frozen worker source; it is not relabeled as a rerun of the integrated tree. This subsequent documentation-only update records that distinction.

## Integration still pending

This is a legacy-base connection. The coherent owned-scheduled-motion v2 family uses its owner's archive hash, not an expanded generic logical JSON hash. Before v2 integration, audit these consumers against `ownedScheduledMotionArchiveHash` and the existing versioned `ActualObservationPhysicalPrefixHash` contract:

- observation `ruleEvidenceHash`
- call `currentExecutionHash`
- `importReferences.ruleEvidence.snapshotHash`
- physical-prefix identity/convention

Complete Native producer registration, exact bucket generation/consumption, late-writer fences, communication reception and post-PlayEnd import/official closure remain separate connections. The new call can supply an operative retirement basis; it does not certify `all_offense_terminal` or close a play by itself.
