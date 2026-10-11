# LAN01 cut0 membership and exact retained boundary

LAN01-R3 ran the corrected finite-hold recipe from the original pre-hold checkpoint. It completed the accepted 60-second hold, initial Play, first occupied TAKE and its retry/readback, emotion genesis, nonempty anchor, second TAKE, and cut0 prefix, all 11 TOTALs, view, and 32 calibrations. It then failed the fixture's positional comparison between dispatch members and enrollment participants, before the third action.

The executed source was public commit `5c5e4b1dbdb039ed70e673b80284c933fd878ee7` (local equivalent `b1a8c797fe1b293663a94d3c259498760c20b190`, source tree `f1543cc585cc2181c40e39a17bb4731f49268f2d`). The failed run lasted 13,379.942 seconds, exited 1 with no resource guard, preserved all nine pin categories, and completed process cleanup. This is failed acceptance evidence, not a whole-case pass.

## Ordering contract

Enrollment orders participants by player key. Dispatch orders members as batter, defensive positions, then occupied runners; continuation and lifecycle preserve that role order. The valid 11-member lists therefore have different positions. The fixture comparison now requires exactly 11 unique identities on each side and compares sorted copies. Missing, extra, duplicate, or substituted participants still fail. Neither accepted sequence is changed.

## Exact cp23 input

The retained input is checkpoint sequence 23, returned owner call 24 (`SamePlateAppearanceLifecycle.acceptCalibrationSet`). The idempotent first-pitch retry did not create a checkpoint, so call and checkpoint numbers differ.

- Gzip: 674,045 bytes; SHA-256 `20eb34335f9256a4237bfebfb1c0736bb9cf05b56d39947785243c2cd7a9f95d`
- Raw database: 10,137,600 bytes; SHA-256 `d0505072f55baf7a073563814e5fd82c643f7b8a8ab39b8d36f096ada5fb79b7`
- Checkpoint receipt: `9ee4d4d324637d4e23a9905b7a18d1bd68a299319978dbd1c659d172c3c822ec`
- Exact schema/row census: 111 tables; `70e6675322b16ef26dbecddb0b76b7036745011233ab24bbd16da94d9123abfe`
- Failed terminal: `3e4e465d0c0ae8c45f2786d8a44518f3eaeeb2a09f201c0bc52c569c19adcdaa`

The entry accepts only these pinned compressed/raw bytes and an exclusive destination. It has no caller-supplied stage, result, participant, or state override, and does not select a latest snapshot. Earlier cp5 and failed cp11 data remain historical provenance only.

Existing owner readers authenticate the original completed walk, activation, actor/body/model lineage, current workload state, occupied enrollment, finite hold, initial Play, both TAKEs, accepted second posture, anchor, and cut0 prefix/TOTAL/view/calibration records. The retained helper verifies the exact original event references and all 11 members before restoring only future fixture closures. It never sources an accepted result directly from snapshot JSON or recreates the completed writers.

The shared post-cut assertion helper rechecks the original actor/lineage comparisons with the corrected membership semantics. The first subsequent writer is the original `lan01:swing:action`. The declared cumulative effort remains 2; the event prefix remains the accepted second TAKE. All 20 original LAN callback assertions, later guard/retry/reopen behavior, and existing production ownership checks are retained. The earlier first-TAKE/retry/readback assertions remain historical evidence and are not counted as a new suffix pass.

`LAN01-R4` reports `lan01_cp23_original_remaining_suffix_result_v1`. A successful suffix would still report `wholeCasePass: false`. Source checks and lightweight seam/input tests cannot establish a genuine cp23 continuation pass; that requires a separately reviewed and released Native run.

## Bounded author verification

The membership regression reproduced the valid-order mismatch before the fix.
It also demonstrated that equal duplicate lists could pass the old positional
comparison. The corrected check rejects duplicates, missing/extra identities,
substitutions, and matching incorrect cardinality on both sides; neither input
array is mutated.

The shared future action/posture/right/launch/advance body remains byte-identical
to the incoming branch: 4,285 bytes, SHA-256
`16e2aff00f455b52abe28034029321788688c7d171d5c693ea4ecfb8fb52caf5`.
A bounded seam test verifies that restoration performs no completed TAKE,
anchor, cut0 or posture writer call, first reaches the original swing action,
and advances its next accepted event to the original cut2.

The selected author run passed all 31 tests in five files with no failed or
skipped case. Report SHA-256:
`3fed46e49bcf39442ca6f3423331965cec537b15c4bb22307e327a7a93690e91`.
Exact cp23 compressed/raw materialization also passed on an exclusive private
copy without opening any Native owner. The original callback body and all 20
assertions remain byte-identical. Full compiler, independent review and genuine
retained execution belong to the subsequent consolidated qualification/run;
these bounded checks claim none of their outcomes.

## Integrated qualification

Independent review of the complete eleven-file batch is CLEAR. It confirmed
exact membership rejection, current owner authentication, accepted history
preservation, the unchanged callback and future-method bodies, and cleanup.
Integrated code `b0dde06093f448089b25ce2acf25f6e44088190a`, source subtree
`c94fec339d66378c03640c6f76d481cdca940ffd`, passed the full compiler in
33.035 seconds and all 31 affected checks across five files in 7.651 seconds,
zero skipped. Source/dependency/runtime/control pins stayed stable, no guard
fired, and no surviving process remained. Formal report SHA-256:
`0b7224a9dfb28bfdcb4b3851d332343d6b33db75dba9b2ecafbdf35e3430a015`.
The exact cp23 Native suffix remains unexecuted at this source checkpoint.
