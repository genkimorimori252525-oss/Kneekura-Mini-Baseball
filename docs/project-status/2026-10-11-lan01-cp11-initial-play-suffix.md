# LAN01-R2: original remainder after the accepted occupied right

LAN01-R1 on `4d452cea7ee37d41ca4f517612ffa96a7bb878d2`
(source tree `3dcc76c69323fdd3461d4af7ec7f61bafe646e2a`) ended FAILED
at 2026-10-11 04:45:35 UTC after 9,955.857 seconds. Its eleven writer calls
committed the original occupied baseline, enrollment, empty prefix, eleven
zero TOTALs, view, runner hold, action, 32 calibrations, consumer set, episode
and first-pitch right. Initial Play and the occupied physical pitch never began.
Formal Vitest reports one failed case and no passed case; the terminal reports
no resource guard, all pins stable and complete process cleanup.

The failure was a fixture read outside its required transaction:
`prepareSamePaInitialPlayFixture` called
`readSamePaOccupiedRunnerHoldFromSqlite` on the raw fixture connection.
`BatterRunSourceArchive.read` correctly refused it with
`same-PA continuation requires Native query-only ownership`.

## Coherent fixture correction

The initial-Play helper now reads original participants and hold coverage in
one existing `withSqliteReadTransaction` scope, completed before the posture
writer. A static audit found the same mistake in its direct second-TAKE
continuation, `prepareSamePaPhysicalLifecycleContinuation`; that read group
receives the same correction. Coverage calculations, Sources, accepted models,
original geometry and all assertions retain their values and order. No owner
proof, guard or currentness condition changes.

The same audit covered the original post-right body and its initial-Play,
occupied-physical, nonempty/lifecycle, in-flight swing, field preparation,
throw/reception, catch, journal and terminal fixture calls. Their other
query-only reader calls already use explicit read transactions; remaining
ordinary SQL reads and private-owner API calls do not require an extra caller
transaction. No additional obvious accepted-source/model/geometry mismatch was
found in this static pass. This is not evidence that later Native assertions
will pass. PL01-R3 does not reach either corrected read: it has no initial Play
and stops after its first occupied TAKE and replay assertions.

## Single exact input boundary

The existing retained entry accepts only corrected-run cp11, returned after
`acceptRight('lan01:occupied:right')`. It exposes no stage selector.

- Checkpoint receipt: `4b48d007d6aa39fe1d28e959910db9d48493d4d2abd7b3243b6e4c75522832f3`
- Gzip, 573,730 bytes: `5720c873e30a30ebab59cd4e34ec3ef737147473de8e57a5b3eed215c2181bbf`
- SQLite, 8,753,152 bytes: `f05e3df69ee5dd1ab6401c15740bd985f63963e2e4f8918f810602291ad73bb3`
- Schema/row census: `4ea171170c70d66f79de06b9f32949bc9b07629b48d6c5a6e831b43dfc987515`
- Corrected-run controls: `9e542ea279b8b46be37beb65edf6ab280160ef3a4685c64e00b383d0d2c08ce1`
- Failed terminal: `879536e357502ebcb4c2b089be35482aa3d6ba946e8d57febdc515bb9653e7c5`
- Failed Vitest report: `411141cb4d124d5ba91444771e3f06589b608871e9568252350f2c7888d851c6`
- Returned right (observer serialization): `68cdc9492ea75f93bdb978a3dd2f29f30e1833e9e8355d6e0e57e15eb4c42ae2`

Compressed/raw byte verification precedes exclusive private materialization.
The entry authenticates the original released walk and existing actor/models,
then the accepted occupied baseline, current enrollment, empty prefix, complete
zero-TOTAL set/view, hold, action, complete calibration set, consumers, episode
and right using their existing owners. Original first-PA calibrations are read
by that enrollment; the new set's IDs come from the original role/route recipe.
No accepted writer is replayed. Previously accepted immutable rows are compared
again after the suffix. The original archive remains unopened and byte-pinned.

The earlier cp181 failure and provenance remain separately attributed in
`priorCp181` and the [historical record](2026-10-11-lan01-cp181-original-suffix.md).
They are not assigned the corrected run's source identity or outcome. The new
result is `lan01_cp11_original_remaining_suffix_result_v1`, records the eleven
completed writers without replay credit, and always sets `wholeCasePass:false`.
Private witness files remain historical hash references, not substitute owner
proofs or synthesized evidence.

The returned-right digest uses the observer's original JSON serialization.
Runtime reauthentication checks the canonical stored snapshot digest
`5285e8577151f5f5240c73b08856f8654a5cc397c5ed1d72c55c6ed65510c802` instead of depending on object key insertion order.

## Original remaining body and verification boundary

`completeSamePaOccupiedWalkFromRightFixture` is extracted immediately after the
original `acceptRight` return. Fresh occupied fixtures call it after their same
original writers. The retained entry calls it with authenticated owner values.
It starts with fixture composition and the original initial Play, then executes
only the original first TAKE, held-window/Match/reopen assertions, second TAKE,
lifecycle and original LAN callback through live appeal, closure and scoring.
No prefix, walk, settlement, release, body/model or dispatch acceptance is
reconstructed. Original callback scene, initial official inputs and explicit
observation declaration are unchanged.

The extracted body is byte-identical to the 4,511-byte original at `527ec838`,
with all fifteen expectation calls, SHA-256
`cabfc0599002da8d4a887fb6406df978ae4461c7a6400588f4dcc3681239a591`.
The unchanged original LAN callback remainder still has its existing exact
text equality check. New bounded tests cover both Native read scopes and error
cleanup, plus entry at initial Play without a completed prefix writer.
They replace only expensive evidence/writer boundaries and cannot certify
physical or official outcomes.

Author inspection verified compressed/raw/receipt/terminal hashes, integrity
`ok`, 109 tables, eleven occupied reservations, all expected accepted records,
and absence of occupied initial posture/setup/Play/pitch on a separate immutable
copy. Its bytes remained unchanged. Static extraction/callback equality and
`git diff --check` were also checked. No Native retained admission or long gate
was run during authoring. Capped gate controls are unchanged, and neither a
suffix PASS nor a whole-case PASS is claimed.

## Consolidated qualification

Independent review was CLEAR for the entire eleven-file batch and its final
type-only correction. The first compiler on source tree
`d41654950d2d689300bbafb16236238b363740e3` failed in 30.975 seconds: the
new seam inferred one settlement participant recursively and described an
accepted readonly calibration set with a mutable reader return type. That
failed receipt is preserved; no finite tests ran in the attempt. Explicit
existing settlement-participant and `SamePaCalibrationSet` types corrected
both errors without changing either file's emitted JavaScript.

On final code `fb7d57d423dae92f58b473dabc802c6c6496dbcc`, source tree
`e5380afb413a5afae2bd4880ab47a5474c990f24`, the full compiler passed in
32.717 seconds (peak RSS 2,193,140 KiB). The one selected run passed all eleven
checks in three files in 6.752 seconds, with no skipped case and peak RSS
509,680 KiB. Coverage is exact input/provenance and original-body equality,
entry at initial Play without prefix writers, both required read scopes and
error cleanup. Source, dependency, runtime and control pins remained stable;
no resource guard fired and no child survived. Formal report SHA-256:
`d3a9b6434dea121075fa2da7ac1941e7379d2bc845802d7b4ca90365cfea8d62`.
Actual cp11 owner admission and the remaining original LAN operations are
still pending; these bounded checks are not physical/official outcome proof.
