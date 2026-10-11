# Terminal proof phase recovery checkpoint (2026-10-10)

The preservation history below has since been recovered and centrally qualified in published commit `d4a17d490cba76cac4e8427503ee9ec726e7b758`; see [the final qualification](#recovered-central-qualification).

This separate branch preserves a reviewed three-file change while local filesystem operations are stalled. The qualified integration branch and PR374 remain at `d4cd8067346d8ad1aa5eed9d1ccaa695d39ce791`. This preservation commit is separate from the unresolved local Git commit.

## Change

Adjudication and closure now own the existing immutable physical-proof scope across each pure read phase. Prewrite derivation, postwrite authentication, public reads and official validation use separate snapshots; INSERT/UPDATE, triggers, accepted callbacks and independent retries stay outside earlier proofs. Completed closure retries authenticate again after the accepted-Source callback, rejecting a receipt whose original evidence changed during that callback. Domain rules, Source shapes, CAS and genuine scenario assertions are unchanged.

## Evidence and remaining validation

- The author ran the three affected finite test files on Node26.10.0 with a 512MiB heap and a 35-second external cap: **26 cases passed in 5.19seconds**.
- Independent whole-batch review was **CLEAR**.
- These tests use real SQLite transaction/archive/retry boundaries with explicit seams for expensive physical evidence. They do not establish genuine physical acceptance or elapsed-time speedup.
- **Full compiler and final central verification have not run for this change.** They remain required after the filesystem recovers. The earlier qualified results retain their separate source attribution.
- The running National and IFR continuations retain their fixed older source and independent results; this branch supplies no new whole-scenario completion credit.

The exact final file bytes were recovered from retained review diffs and the known GitHub baseline, then matched to the frozen SHA256 values in memory without additional filesystem reads:

| File under src/host/world | SHA256 |
| --- | --- |
| SqliteActualLiveAdjudicationStore.ts | acb380baf4f20139c284e50d09ba8f505acf8e795fd053126ebc2d043d42495b |
| SqliteActualLivePlayClosureStore.ts | 40f3ce08d5ffd966648a95a3166aecf9347103eab0f9599808bdd755d886e250 |
| ActualAdjudicationClosureReadPair.test.ts | da61607c5062a4e3210724b2d94b5fff8a2f3d9ab2cf8704c5bd88d1f5503b6a |

Only source, tests and this explanation are preserved here. Private databases, WALs, logs and controls are excluded. No merge, deployment, home-PC CI or new game-model decision is part of this checkpoint.

## Recovered central qualification

At 12:56 UTC the executor responded again, but the former scratch checkout, shared Git directory and private checkpoints were absent. A fresh clone recovered this exact three-file checkpoint and verified all hashes above. Node 26.10.0, the original lockfile dependencies and the generated catalog were restored. No missing private database or interrupted commit was inferred to have completed.

The first full compiler run failed at the closure validator's connection type: the existing official guard exposes `Pick<DatabaseSync, 'prepare'>`, while the local proof helper required the full Native type. The correction retains that public type and checks `instanceof DatabaseSync` before using transaction methods. The real official writer supplies its Native connection; unexpected connections reject. Independent review of this correction was clear.

Final tested code is `3f45955f486df0f89a3bcbba4388fb9cabbb20c0`, src tree `728b6e36cee03cc0667904b6ada2ea7661d5b427`:

- Full TypeScript, including the original long entries: **PASS, 32.506 seconds**, peak RSS 2,172,136 KiB.
- The three affected finite files: **26/26 PASS, 7.351 seconds**, peak RSS 533,028 KiB. The formal report SHA256 is `2417e7fc8d94ecabcea4ce069b760ef5d2493973473e0bcf1d2ea76ecacbdd9c`.
- Source, dependency, runtime and control snapshots stayed identical. No child processes survived. The known generated Vitest results cache is excluded only at its specific output path; test caching is disabled.

The initial compiler failure remains separate from the successful final run. These finite transaction/retry checks still do not establish the long genuine scenarios or an elapsed-time speedup.

## Fresh Native continuation and private snapshot recovery

The original National and same-PA foul-reset entries are running on the fixed published commit `d4a17d490cba76cac4e8427503ee9ec726e7b758`, src tree `728b6e36cee03cc0667904b6ada2ea7661d5b427`, with Node 26.10.0. Their original callbacks and assertions remain intact. Each has a 14,400-second outer limit; the National run started at 13:35:08 UTC and the foul-reset run at 13:44:32 UTC. Neither has a whole-scenario result at this checkpoint.

National completed the original foul terminal and participation, then committed the next actor's genuine pitch, flight, world contact, fielder touch and response. At 14:17:49 UTC, `national-live:episode-binding` returned and its consistent SQLite snapshot was saved before the subsequent live runtime operation. These are committed stage boundaries, not the original tail's 37-assertion completion.

For a recovered private copy at that exact binding frontier:

1. Restore the same published source and original lockfile/runtime. Verify the private snapshot's retained checksum and SQLite integrity before use; keep the archive unchanged and decompress to a writable working copy.
2. Use `continueRetainedNationalBattedFoulBindingTail(path, progress)` from [NationalBattedFoulRetainedBindingTail.test-support.ts](../../src/host/world/NationalBattedFoulRetainedBindingTail.test-support.ts). The function authenticates the saved binding, actor, Match origin and foul lineage through the existing owners, then continues the original field/runtime and official/statistics/Career tail.
3. Keep the ordinary continuation's original assertions. A successful continuation does not turn an interrupted fresh run into a whole fresh-case PASS. Do not delete accepted rows or present an arbitrary later checkpoint as this frontier. The separate statistics-only entry requires its own explicit original-boundary evidence.

The foul-reset entry currently has no intermediate-snapshot resume mode. Its committed snapshots must not be described as automatically resumable. Snapshot data, private paths, logs and environment controls are not published here.

## Fresh first-base proposal scope

The running original National case spent about 740.5 seconds between real-motor adoption and the next quantizer acceptance. Inspection found that the fresh fixture's pure field/execution prefix construction lacked the outer immutable scope already used by its retained branch. Nested motor/decision reads therefore ended their individual snapshots before the parent could reuse the completed National original proof.

The one-site correction wraps only those fresh fields/executions reads in the existing `withBattedVenueLegalReadSnapshot`. Retained reconstruction, source values, read order and assertions are unchanged. Current known-work discovery, kinematics, accepted callbacks and writes remain outside that phase; independent acceptance and retry still authenticate separately.

Independent review was **CLEAR**. The corrected src tree is `5ceb4ceece5e8c43b31382b7d4f42d7f09b9ba40`; the changed fixture file SHA256 is `132eb86573523042e010989c092e108e00b40fea309365ddf186e7520ce70812`. Full compiler passed in **36.146 seconds**, and the two existing snapshot/traversal regression files passed **31/31 cases in 28.000 seconds**. Source, dependency, runtime and control pins were stable, no resource guard fired and no child survived. Formal finite report SHA256: `7f5a58f650cfba334782a5ba293b2f2c6f232c82d2781cd6465149a412aa8371`.

Those checks verify the compiler and existing proof-scope isolation/invalidation behavior; they do not execute the whole genuine fixture or measure an elapsed-time improvement. Both running Native cases keep their original fixed `d4a17d49` source. No long case was restarted for this correction.

## FR01 original fresh scenario completed

The original `SamePlateAppearanceFoulResetIntegration.test.ts` single case **passed in full** on fixed published `d4a17d490cba76cac4e8427503ee9ec726e7b758`, src `728b6e36cee03cc0667904b6ada2ea7661d5b427`. It completed actual swing/contact, untouched rolling-stop foul, official closure, controller retirement/reset, the fourth ordinary TAKE, conservation checks, exact retries and Native reopen. The original callback and helper assertions were preserved; no result was assembled from partial runs.

The case took **7,505.785 seconds** and its supervisor completed in **7,511.742 seconds**, exit 0. Peak aggregate RSS was **802,312 KiB**. No guard fired, all source/dependency/runtime/control/evidence pins matched, the parent was reaped and no process remained. Formal Vitest report SHA256: `685407d61b0958a6df6b451725ee0cd8b97619fcda2db31be4daf9cea56a29e7`; terminal receipt SHA256: `dce4776a44475cf2eb626772f263b15daa81edd0cd4b9bb27f1342ee74138a50`. The final consistent snapshot is retained privately; the later outcome/reset/launch retries made no writes.

This closes the original FR01 representative, including its full fourth-pitch and retry/reopen suffix. It does not establish occupied PL01, live appeal, National's full original tail or a whole game/season. The later fresh first-base fixture correction was not used by this fixed-source run. PL01 started in the released verification slot at 15:52:14 UTC under the same qualified original source and unchanged shared controls, with a 14,400-second outer cap. National subsequently returned the explicit failure described below; no third long Native lane was added.


## National fresh failure and preserved adjudication frontier

The original fresh National case returned **FAILED** after **9,184.775 seconds** on fixed published `d4a17d490cba76cac4e8427503ee9ec726e7b758`, src `728b6e36cee03cc0667904b6ada2ea7661d5b427`. Real adjudication committed after the complete physical-end and operative-call prefix. The next closure enqueue raised `deriveOfficialPlayResult is not a function` before making a change. The original whole case and its 37-assertion tail are unfinished.

All eight source/dependency/runtime/control/evidence pin classes remained stable. Exit was 1, no resource guard fired, peak aggregate RSS was 1,366,624 KiB, the parent was reaped and no process remained. Formal report SHA256: `0217ba503cbc5e4decde56fba4a5b0c08074182691566cb67569e7ddaaa88aac`; terminal receipt SHA256: `90aaed6b9f49f38658928300b780d1376fc85d51ee6cbe122cb14a8c96f699f6`.

A bounded import-only comparison reproduced the failure without a database or physical prefix: the original fixture import graph exposes the function normally; adding the persistence observer freezes an uninitialized cyclic re-export through an object spread. This is a verification observer namespace defect; the production re-export exists. The correction must preserve live exports and wrap only the observed owner constructors/factories. No game behavior or production import is changed to bypass it.

The final adjudication snapshot passed integrity, schema, original-rowid census and content/hash checks. Its 101 tables and 267 rows differ from the preceding physical-end snapshot only by the adjudication table and one original row. Closure and later statistics remain absent. The ordinary `continueRetainedNationalBattedFoulBindingTail` entry supports this contiguous official prefix and keeps every original tail assertion, including the missing-scoring assertion. Resume uses a new private writable copy, authenticates the retained original owners and continues the missing suffix. This structural audit is not a successful execution; the failed fresh result remains failed. Private data, paths and monitoring controls are excluded from this publication.

The corrected observer passed six bounded checks across the National fresh/retained, IFN and LAN import graphs plus namespace and real-owner mechanics (report span 25.013 seconds). A separate affected SQLite rollback check passed in 0.291 seconds, preserving exact return/throw identity, actual rollback, unchanged retry and one snapshot per committed change. These are observer checks, not genuine play assertions. Product source, the failed fresh receipt and the active PL01 source/controls were untouched; no full compiler or long prefix was repeated for this private correction.


## Settlement reservation assertion proof scope

A ten-participant settlement performs four separate reservation assertions per participant, around accepted callbacks and actual writes. Inside one assertion, the preparation claim census, enrollment roots and participant members reconstructed the same completed terminal settlement independently. The correction gives that single assertion an existing physical/lifecycle read phase and reuses only its completed historical settlement proof, keyed by assertion identity, the full reference and proof mode.

The admission savepoint is validated before child read savepoints are opened. Each subsequent assertion refreshes the transaction marker and owns a new phase. Raw claim discovery and exact enrollment, career, player and activity comparisons remain; no proof crosses a callback, write, participant, independent retry or reopen. The structural regression observed two terminal reconstructions per assertion before the change and one after, with all forty independent assertions preserved. This is a reconstruction-count result, not an elapsed-time speedup measurement.

Independent review of the complete three-file change was **CLEAR**. Tested code is `a995c589f19c405e2f922ad361f9264856376f78`, src tree `7e90c1ace30d36e8a0e0c87261e0c258ece6d910`:

- Full TypeScript: **PASS, 32.636 seconds**, peak aggregate RSS 2,184,268 KiB.
- One consolidated batch of the terminal settlement, continuation phase, reservation guard, dispatch guard and physical traversal files: **80/80 PASS, 167.844 seconds**, peak aggregate RSS 711,572 KiB. Formal report SHA256: `f69fe3bdbbddfcd8f580e5ba61a6455f9eecfe5c18115de3fc96e861e07f6598`.
- All source, dependency, runtime and control pins remained stable, no resource guard fired and no child process remained. An initial preflight stopped before running compiler/tests because the separate checkout lacked its ignored generated catalog; the exact existing catalog was restored before this successful run.

Terminal/actor proofs are explicitly mocked in the structural settlement fixture; workload, CAS, raw reservation and transaction boundaries use real SQLite owners. The actual PL01/IFN/LAN settlement paths remain the genuine qualification. A separate proposed scoring wrapper was not adopted because its bounded closure/sidecar comparison did not reduce real field or execution-history derivations. No further cache layer was added.

## National retained official and scoring progress

The ordinary adjudication-frontier continuation **completed all 37 original tail
assertions** in one passing `NAT-R184` case on fixed published
`d4a17d490cba76cac4e8427503ee9ec726e7b758`, src
`728b6e36cee03cc0667904b6ada2ea7661d5b427`. It started at 16:27:19 UTC and the
last reopened aggregate returned at 19:54:36 UTC. Closure and official application,
participation/call-up adoption, the actual missing-scoring assertion, official
scoring, individual statistics, both National exposures, ordinary retries and
all original close/reopen checks completed. Match reached revision 2, play 9 and
two outs. The final eligibility fact was a genuine additional commit; the latest
returned checkpoint is 14, correcting the earlier partial-progress reference to
checkpoint 13.

The case took **12,431.697 seconds**; the enclosing controlled execution took
**12,438.205 seconds**, exit 0, peak aggregate RSS 1,076,040 KiB. All seven pin
groups stayed stable, no guard fired, process enumeration completed and no child
remained. All 35 observed owner calls returned: 33 normally and two expected
no-write rejections for changed duplicate participation and repeated exposure
consumption. The final database has 113 tables with a matching preserved census.

- Formal report SHA256: `aeaf660680c64c6a3e15dc6b8e9ed99ea102da4425f4c365bf0b6a4a250b132c`.
- Terminal receipt SHA256: `8d4cd74edf13fa17abb95a042811dac619826b202b6d63a9000df0baea267bf6`.

This closes the original retained 37-assertion tail. The prior fresh execution
remains **FAILED at 9,184.775 seconds**; the three fresh-entry assertions were
not rerun. Prefix and suffix evidence are not relabeled as a fresh whole-case
PASS. Later production performance changes were not used by this fixed-source
continuation. Whole game/season and the other original representative paths
remain separate open work.

## PL01 frozen-boundary continuation qualification

The [PL01 retained suffix](2026-10-10-pl01-retained-terminal-suffix.md) now reuses the original terminal and occupied-next-pitch assertion bodies from the exact audited six-TAKE/frozen-plan boundary. The complete test-support batch passed independent review, full compiler and five focused input/import checks. No production owner changed. Its retained prefix and continued suffix remain separately attributed; actual execution status follows below.


## PL01 original cap and remaining-suffix release

The original PL01 case on fixed `d4a17d49` / src `728b6e36` returned **FAILED**
at its **14,400.167-second wall cap**, exit -15. Its five rollback points, genuine
six-TAKE terminal walk, endpoint and ten-participant settlement freeze completed.
Settlement call 181 did not return; official completion, release, occupied next
pitch and subsequent retry/reopen assertions remain unproved. No final Vitest
report exists. All pins stayed stable, the parent and descendants were reaped,
and no process remained. Peak aggregate RSS was 712,644 KiB. Terminal receipt
SHA256: `01284ad6d5a6532aa9297c529e958de556feb4d95167bd92ace8447b47a70be3`.
The last returned consistent boundary is the audited frozen-plan checkpoint 173.
Unreturned settlement work receives no completion credit.

After actual terminal and cleanup confirmation, the original IFN case started
at **19:52:56 UTC** on qualified `35c05066` / src `7e90c1ac`. After National
finished, the exact checkpoint-173 PL01 suffix started at **19:56:02 UTC** on
qualified `d6dfd095` / src `023b3d8b`. Both retain their fixed source, original
assertions and existing four-hour maximum; at most two long Native lanes run.
The PL01 suffix authenticates the retained owners and executes the missing
settlement/transition/release/reopen/occupied-next-pitch body without regenerating
the six-TAKE prefix. It still reports `wholeCasePass: false`; neither new run has
a completion result at this publication. LAN remains held for a subsequent lane.

## Ordinary workload reservation release proof scope

PL01の保持suffix（固定公開 `d6dfd095` / src `023b3d8b`）で、元10人決済が20:16:54に実返却した。同じfrozen plan入力を使う旧sourceでは決済が残り約194分の上限まで未返却だったが、今回の決済は1,154.082秒で完了した。成功同士の対応する時間比は算出しない。その後、元公式transition・release、close/reopenと決済retryのassertionを通過し、occupied次打者のmodel受理まで進んだ。新打者workload baseline初期化は20:35:04に開始し、本保存時点では未返却で、元suffix全体も未完である。

この待機操作に限定したコード確認で、通常のNative予約assertionがsettlement activity admissionを持たず、既存の読み取りphaseへ入らないことを確認した。各歴史recordが同じenrollmentの完了releaseを再構築していた。実行中の内部stackや経過時間の内訳を測った結果ではない。

`SamePlateAppearanceSettlementAdmission.ts` の既存assertion wrapperを通常のNative transactionにも適用し、1回の確認内だけで完了release原本をenrollment別に再利用する。raw archive/census、career/player/activityの判定は毎回行う。受理callbackやDMLを跨がず、初期化にある4回の独立確認、transactionの再認証、retry、finally cleanupを保つ。matching admissionのsavepoint検査は子phaseの作成前に行う。非Native/minimal Dbとtransaction外の既存挙動は維持した。

一括reviewはCLEAR。固定src `e5f3ed76710da25007774d59ba7ce661614f39b1` で全compilerが31.794秒、関連71件／6 filesが183.415秒でPASSした。対象はTerminalSettlement、ContinuationReadPhase、ReservationGuard、DispatchClaimGuard、EnrollmentClaimReuse、SqlitePlayerWorkloadRecoveryStore。全source/dependency/runtime/control pinは不変で、guardと残存processはない。正式結果SHA256は `0ffb1843d19b5c98788b2bf79bd82ef47e467cd6099036f771fb64deaec5dc1a`。

限定回帰では、同じ確認内でのrelease復元4回→1回、各initialize確認内2回→1回を確認し、異なるscope・欠けたenrollment・callback mutation・retryの新鮮さ・cleanupを検査した。原本terminal proofを一部structural fixtureで扱う回帰であり、この新sourceのgenuine経過時間や全体完了を認定するものではない。実行中IFNは固定 `35c05066` / src `7e90c1ac`、PL suffixは固定 `d6dfd095` / src `023b3d8b` を維持する。待機中LANへの新source適用は、元のcallback・geometry・assertion・制限とsource pinを保持した差分確認後に行う。

## Original IFN and PL suffix wall limits

Both fixed runs reached their original wall limits. These are terminal FAILED results, not interrupted unknowns or partial PASS results. The source, dependency, control and evidence pins remained stable, process enumeration completed without errors, the parents/descendants were reaped and no process survived. Neither produced a final Vitest report.

- **IFN01 original fresh case:** fixed public `35c050668106d5d564e7419892db953040b37af2`, src `7e90c1ace30d36e8a0e0c87261e0c258ece6d910`; 14,400.211 seconds, exit −15, wall guard, peak RSS 896,572 KiB. Original catch-response:6 and cut31 prefix/TOTAL returned and committed. Cut31 view was the final unreturned operation. Last consistent checkpoint was 273, immediately after TOTAL. Terminal receipt SHA256 `b8cdc7f1717a1f9ee0e630e19c4f4adc8e7aa512a0887565de633adab7126ff5`. No later response, motor, closure, scoring or next-actor completion is inferred.
- **PL01 exact-cp173 retained suffix:** fixed public `d6dfd095dd6c59fd195484394d1be21e0705dfdc`, src `023b3d8bb7027b08257036ccd2375ced6cfff9b2`; 14,400.115 seconds, exit −15, wall guard, peak RSS 658,860 KiB. The actual ten-participant settlement, official transition, release and original terminal reopen/idempotence section completed. Next actor/body/batting/runner model acceptances were committed. New-batter workload initialization never returned during the remaining run, so checkpoint 8 remains the last consistent boundary and occupied-next-pitch completion is unproved. Terminal receipt SHA256 `302b1ef635ee78dff0c9f73515df36252dedf3d89db7f646a75e0e64cb913211`. The earlier original PL wall failure remains separate; `wholeCasePass:false` is preserved.

The ordinary-claim correction qualified above was absent from both fixed runs. Their outcomes are not new-source elapsed comparisons. The current source keeps the four independent workload assertions and uses bounded proof reuse to address the observed repeated release reconstruction.

The exact-boundary [IFN checkpoint273](2026-10-11-ifn01-original-retained-suffix.md) and [PL checkpoint8](2026-10-11-pl01-cp8-occupied-suffix.md) continuations were integrated and reviewed as one 22-file test-support batch, source tree `912c0a98573ab8d90307fc83d1a8f0670ea92464`. Full compiler passed in 31.088 seconds and all nine focused input/import checks passed in 5.844 seconds. All input pins stayed stable, with no guard or survivors; formal report SHA256 `478f5f2ba86a0d6dca9b42e40bb36f8dbf87d04ede6cb67e336cd898d0771376`. The entries authenticate stored original owners and run only the unperformed operations/assertions on fresh private copies. Shared original assertion bodies/order are preserved. No completed pitch/field/response prefix, terminal settlement or completed reopen section is regenerated. Genuine owner admission and suffix completion remain unexecuted; no arbitrary-checkpoint recovery or combined fresh PASS is claimed.

After actual IFN termination and cleanup, the original **LAN01** case started at **2026-10-10 23:54:14 UTC** on fixed public `d47512d8517f3ac5c502b8e6af9b543cc58a84c6` / src `e5f3ed76710da25007774d59ba7ce661614f39b1`. Its source/control delta was independently CLEAR; the original callback, all 24 entry assertions, all 149 original support expressions, its short-diamond geometry and 41 observed owners were retained. Seven PL-only shared-helper expressions are static additions, not runtime credit. One justified import-graph check passed in 6.228 seconds, with no Native case/owner execution. The real LAN case keeps the original four-hour maximum and original assertions, has no result yet, and became the sole long Native lane after PL ended. Finished FR01 and National results retain their prior fixed-source attribution.

## Remaining-entry failures and one correction batch

The first remaining-only entries on fixed public `fd0846a5` exposed two concrete failures, both with complete cleanup and stable pins:

- PL cp8: 334.506 seconds, exit 1, no guard. New-batter initialization rejected a dispatch claim, with no committed owner change or new checkpoint. Terminal SHA256 `2a1c9076ea427f48e8a843c8526e974a56385262020479457229d1a13b6c8b39`. The intended baseline correlation was accidentally a self-comparison because an inner SQL alias shadowed an outer alias. The minimal correction gives the outer baseline its own alias; active and malformed claims remain refused.
- IFN cp273: 5.621 seconds, exit 1, no guard. The recovery context incorrectly expected all database workload heads to equal the ten enrolled participants; the original fixture also has an independent away pitcher. Terminal SHA256 `aa9c753ff394494143a5e4b9d20e118db9ae5411be7b728c9a1303320ad3fb61`. The corrected entry authenticates exactly ten enrolled participants and the independent original Person/baseline/workload chain separately, preserving all eleven heads in the unchanged final comparison. This failure occurred before observed mutating owner calls or new checkpoints, after authenticating owner reads.

Both corrections were assembled and reviewed together. Full compiler passed in 30.576 seconds. The selected Node 26 batch passed nine checks and exposed one invalid added DO15 test expectation for a deliberately moved baseline. After correcting only that expectation to preserve the existing rejection, DO15 alone passed in 16.712 seconds. Production and IFN code were unchanged by that last test-only delta. The failed first report remains failed; nine unchanged passes plus the corrected case provide the final selected coverage. No unrelated suite or compiler was repeated. Exact source/report attribution is in the [IFN correction record](2026-10-11-ifn01-original-retained-suffix.md#consolidated-correction-qualification).

Original cp8/cp273 archives and both failed attempts are preserved. Corrected genuine retries remain pending. LAN remains on its prior fixed `d47512d8` source and has reached the original walk settlement; an expected pre-settlement release rejection is not a case failure. Its whole result is not yet available.


## Fresh enrollment claims and exact PL/LAN continuation batch

The corrected PL cp8 attempt on fixed `e6de9bb39dda0df4412824f450189d65f8148a5d` / src `9945219b1e94a0fda85cb2923194f5b77657c45e` returned the new-batter baseline at 2026-10-11 00:55:44 UTC and saved exact checkpoint1. Its next eleven-participant enrollment failed before committing, because fresh exclusion called a historical reader that demanded a complete target enrollment before its initial and intermediate INSERTs. The terminal result remains **FAILED**, 659.251 seconds, exit1, no guard, peak RSS633,400KiB, stable pins and complete cleanup. Terminal SHA256 `c4a5ebbb69970ee54cc72843724501c8cfd8ffbfd8b2d19d530687e68efeb1e0`.

The original LAN run on fixed `d47512d8517f3ac5c502b8e6af9b543cc58a84c6` / src `e5f3ed76710da25007774d59ba7ce661614f39b1` also reached an actual terminal **FAILED**, 4,558.949 seconds, exit1, no guard, peak RSS706,092KiB. Its ordinary walk, ten-person settlement, official transition, release and original terminal replay completed, followed by next actor/body/batting/runner model acceptances. Call189 for the new-batter baseline rejected the known old correlated-claim defect without committing. Exact checkpoint181 follows the returned runner-model owner. All pins remained stable; the parent and descendants were reaped with no survivors. Terminal SHA256 `ff7cbe25e65b15471c176768963969969f52e663d717440879afb948427752ec`; formal failed test report SHA256 `07e133c05e0174108bdca576ffeb5df8e0b6db14a437b1e4548ca434ca42fc9c`.

The cohesive production correction separates the new target's immutable scope from complete historical ownership. Fresh exclusion can run before its root exists and between legitimate owned member writes; every existing dispatch/continuation claim still authenticates its complete original root, members and slot. Raw scope checks apply to both connected guard families. Historical readers, active/malformed rejection, mutation boundaries and retries retain their existing proof requirements. The regression reaches new occupied enrollment, exact retry, eleven-member prefix/TOTAL/view and historical readback, and rejects moved/raw references and missing owner/member proofs.

The same batch advances [PL to exact cp1](2026-10-11-pl01-cp1-enrollment-suffix.md) and adds [LAN exact cp181](2026-10-11-lan01-cp181-original-suffix.md). Both authenticate stored owners and execute only original remaining operations/assertions; they preserve prior failures and `wholeCasePass:false`. No completed walk prefix, settlement, release or actor/model acceptance is regenerated. PL also preserves its newly committed baseline. LAN's original short geometry and unperformed callback statements are unchanged.

Independent review of all27 changed files was CLEAR at source tree `3dcc76c69323fdd3461d4af7ec7f61bafe646e2a`. One full compiler passed in32.590 seconds, peak RSS2,192,556KiB. One consolidated selected run passed24 checks across7 files in64.617 seconds, peak RSS693,340KiB;41 unrelated cases were unselected. The coverage includes the occupied enrollment regression, baseline/DO15 and compact dispatch/continuation guards, exact PL/LAN input/provenance and entry imports. All source/dependency/runtime/control pins stayed stable, no guard fired and no child survived. Formal report SHA256 `f19b678ce374dc0de12884d2acf3bea3894b7a72e38061d34228477a137701ae`. These checks establish the implementation and retained entry wiring, not a genuine whole-scenario PASS.

Corrected IFN started at2026-10-11 01:03:06 UTC on fixed `e6de9bb3` / src `9945219b`, using exact cp273. It passed the old workload-head context boundary and returned the existing TOTAL owner read; its remaining genuine result is still pending. The new PL/LAN entries have not been released at this publication. Prior observer graph checks may be reused only with their fixed-source attribution and reviewed final import/owner delta; the current plain entry imports passed in the consolidated batch.


## Typed batter-plan claims and exact IFN cp10 batch

The corrected IFN remaining run on fixed `e6de9bb39dda0df4412824f450189d65f8148a5d` / src `9945219b1e94a0fda85cb2923194f5b77657c45e` ended **FAILED**, 3,022.982 seconds (case 3,017.315 seconds), exit 1 and no resource guard. It committed cut31 view/calibrations, original catch-response:7, all cut32 prefix/TOTAL/view/calibrations, runner/recovery models and the original batter swing-exit state. Opening the following BatterRunPlan store rejected a missing-original claim before any plan acceptance. Final checkpoint 10 follows returned owner call 11, swing-exit state. All nine pin groups stayed stable, process enumeration completed without errors and no parent/descendant survived. Terminal SHA256 `87c18a6b42499b0e7376918d7cbed880d469259cc8b0866596dff0f1ce788a2f`; formal failed report SHA256 `2c348f9b57894c4eb0d0845f53aded85f89117592b5967c22219f8ad2df3f141`. The prior cp273 failure and fresh wall failure remain separately attributed.

The missing-original query matched only a dependent reference's sourceId. Exact checkpoint 10 contains two original throw checkpoints whose planReference belongs to `pa_physical_v1_field_steps`, not the batter-plan owner. Those legitimate foreign references falsely prevented first table creation. All three existing dependent branches now match the expected owner and Source identity in the same raw reference object. Duplicate-aware raw enumeration, genuine missing-owner refusal, moved identity/hash/scope authentication and descendant conservation remain intact. The already typed lifecycle/occupied-runner guards are unchanged. Independent review found the nearby physical, throw, catch and admitted-work plan readers already validate their typed owners; no new model or broader claim framework was added.

The same 11-file batch advances [IFN to exact cp10](2026-10-11-ifn01-cp10-batter-plan-suffix.md), authenticates its original accepted owners and enters the first unperformed plan open/accept. Completed cuts/responses/model/exit-state writers are skipped. Both extracted original tails and the shared geometry statements are unchanged. Related lifecycle recovery facts use the existing exact set reader within one immutable scope; no proof survives a write or independent retry. Historical 35c cp273, completed e6 cp10 and new remaining work stay separate, with `wholeCasePass:false`.

Whole-batch review was CLEAR. The first compiler exposed an overly broad recovered-calibration union and remains a failed receipt; no finite tests ran in that attempt. The minimal correction explicitly refuses a throw calibration in this exact historical context of 32 dispatch routes, preserving authenticated Sources without casts or replacements. On final source tree `3a3fd7e273694796e4db7e3971ceb021215533f7`, the required compiler rerun passed in 31.202 seconds (peak RSS 2,193,588 KiB), followed by all 45 selected cases across 7 files in 8.167 seconds (peak RSS 613,980 KiB). All source/dependency/runtime/control pins stayed stable, no guard fired and no process survived. Formal report SHA256 `df948cef24386356c5acf0155cb5b8c2c9fefc0453f4cd5feec9e960cb0b06ec`. The checks cover the typed-claim family, original input/provenance, the no-prefix-replay seam and plain entry import. No additional broad suite or observer smoke was required.

The new IFN remaining run is held for an actual slot. Two already-running original continuations remain on fixed `4d452cea` / src `3dcc76c6`: PL started 01:33:42 UTC and committed the original eleven-participant enrollment at 02:06:13 and occupied prefix at 02:12:16; LAN started 01:59:39 and committed its original new-batter baseline at 02:05:35. Their remaining original operations and complete suffix results are still unproved. Active source/controls were not modified for this newer batch, and none of the completed prefixes was regenerated.

## Dispatch proof lifetime and continued original execution

PL's original occupied dispatch action returned and committed at 2026-10-11 03:00:01 UTC, after entering at 02:41:44. It followed the accepted occupied TOTAL, view and runner hold. LAN also committed its original enrollment, prefix, TOTAL, view and runner hold; its dispatch action began at 03:11:41. Both runs remain on fixed `4d452cea` / src `3dcc76c6`, with no complete suffix result yet.

A bounded source inspection of that dispatch operation found repeated authentication of the same immutable claim census: enrollment's inner continuation phase ended before the enclosing dispatch proof called the fresh-enrollment guard again. The owned dispatch query-only proof now enters the existing continuation read phase inside its existing physical traversal. No cache, key, admission exemption or new public owner was added. Each guard still runs; its completed census can be reused only within that one proof. DML/DDL, post-effect proof, COMMIT, authority callbacks and independent retries retain their existing separate scopes, signature/savepoint checks and cleanup. Borrowed historical dispatch reads are unchanged. This addresses a demonstrated structural duplicate; elapsed improvement has not been measured.

Independent review was CLEAR at code `ae95cce48b194485dadff1b96f255a2650b6cc25`, src `25eda7eba860f766be6c6c3cdd99fa2d57ecc921`. The compiler passed in 35.416 seconds. The first 27-case selection reached its 180.053-second wall cap without a final case report and remains FAILED. The affected selection was narrowed to six existing dispatch cases covering acceptance/read, calibration retry, current-work refusal, forced commit, unexpected mutation and raw claims, plus eleven existing proof/claim/pitch lifetime cases. These 17 checks across four files passed in 78.338 seconds; ten other collected cases were unselected. The ten unselected cases were DO01/03/05/07/08/09/10/13/14/16. They receive no PASS credit from this attempt; their broader pending-input, parser, prerequisite, model/Person and claim-variant coverage was excluded from this narrowly required regression, rather than declared completed by the capped run. The reviewer confirmed that the selected acceptance/retry, fresh-work refusal, forced commit, unexpected mutation, raw-claim, phase-expiry, schema, cycle and reference checks cover the unchanged two-line phase-boundary delta. The already successful compiler was reused. Both attempts retained stable source/dependency/runtime/control pins and complete process cleanup. Final report SHA256 `032d0577d88e278dbf17b08df4fb92b1322a9bd18a1c324479139fb409b4d646`. No new scenario or long performance gate was introduced.

The remaining original gates stay IFN/PL/LAN suffixes, original full Positive and the forty-piece archive. Historical nine-inning physical play (`PR241`, code `9d2b0458`), domestic season recovery (`PR234`, `ac8fba88`) and population preservation (`PR235`, `e8e663c6`) retain their source-attributed completed evidence; the corresponding test blobs are unchanged. Repeating those completed fixtures would not prove a full original live-field game/season composition. No additional sixteen-file rerun is required for this dispatch change, and no fresh whole-current PASS is claimed.
