# 初期守備視線モデルと正常観測 V214

2026-10-29 / `MB-20261027-REALISM-DEBUG-PLAN`。明示した初期視線モデルを通常の守備観測Ownerへ接続した。実Native検証は20分の上限で中断したため、9人分の完了は未証明。全goalは進行中。

## 実装

新しい `SamePaInitialDefenderObservationViewV214` は、正常bodyの身長・body origin・primitive offset、投球前の守備位置、home geometryから9人の初期viewを作る。眼高は既存モデルと同じ身長の0.92倍、向きは既存Coreと同じ `atan2` → `sin` / `cos`。homeと位置が一致する場合も既存Coreの規則を使う。注意対象のball指定は意図であり、真のball位置や検出結果を入力にしない。

authorityは `EXPLICIT_UNCALIBRATED_GAME_NOMINAL_INITIAL_VIEW`、`empiricallyCalibrated:false`、`INITIAL_VIEW_ONLY`。保存された実視線の復元、継続する視線制御、校正済み実測モデルを主張しない。実行前にモデルを固定し、検出・非検出のどちらも有効な結果とする。

検証入口はV212の正常cut13・field step7・World2を継承し、初回の `previousObservationReference:null` を確認して1人ずつ通常のphysical Ownerへ観測を受理する。各観測後に通常prefix、TOTAL10、view、次の対象者の投影calibration1件を受理する。正常scoped APIを使い、元の未投影calibrationと現在の観測step参照を維持する。Core・Owner guard・通常APIの変更は0。

## 実測結果と復旧境界

実receipt `b3f2f4007f484cfcba38bf8b6233d5a4` は **FAIL**、exit124、1200014ms。開始前に外側1200秒・実case1185秒を設定した。Root handle35686は終了し、保存PID34520と直接の子プロセスも存在しないことを確認した。

保存checkpointは5人目のcut18とscoped calibrationまで、次のstageは6人目の観測受理後・lifecycle前だった。stageは処理進捗の下限なので、最終DBのpartial phaseや完了数をこの情報だけで確定しない。終了時の全pin照合も未完のまま保持する。

9人完了時の予定値であるcurrent22、126追記、physical ordinal7→16の9 CAS、World2不変、DDL0、11保存DBの保全は、このrunの達成値として報告しない。`performancePass`・全route・継続gaze・AI・公式終端・full continuation・全RNGの証明も未達成。

次は別のV216読取inventoryで、failed DBと全artifactを固定し、新しい所有backup上の正常readerからphysical・prefix・TOTAL・view・calibrationの実状態を認証する。その結果から未完処理だけを継続する。完了済み観測や状態受理を再実行せず、元FAIL・DB・終了pinのUNKNOWNを保持する。

## 検証

- 最終strict: `98b5a707` PASS9437ms。
- pure / clock / import: `af715e8c` PASS9187ms、14 passed・Native actual1 skipped。
- 既存19 Source / entry不変: `ecb7006b` PASS109ms。
- driver構文: `da44b9ba6141409e8f150266ef593b55` PASS62ms。
- 公開verifier構文: `af4174bc532b4d00a3f91c789de9aa64` PASS46ms。
- model・entry・wrapperは独立review済み。driverはauthor以外のRootが全行を読んで確認した。

初期RED `e95a9719`、型FAIL `84bcf5d3`、同点位置の仕様整合RED `6a8a9f1c` と中間検証は原記録に保持した。同点位置の修正はNative開始前のSource不整合を根拠とし、検出結果への調整ではない。

Source SHA-256:

| file | SHA-256 |
| --- | --- |
| `SamePaInitialDefenderObservationViewV214.ts` | `39f5a60e134b43a3b673ef38a2909d45a87c8d26eb4acffebee255201ccbdb49` |
| pure test | `134b321090b3eb996498da815a4020513c98eb289d99bc5c7c45760f15192a8e` |
| Native entry | `811302dc649b8b137e7dc96dd8eaed632b9ae9a5b2e1d871b0841522287a0446` |
| Native wrapper | `c7c15fb99ffb14ea7d6803030bc6baa2818ac588116d4263eda3a275647d0939` |
| driver | `4ae8c60bfb0d9963c0958f149067dc741175074935db9a799d4cc5be6e8303b3` |

private DB・raw・bundle・manifest・checkpointは公開しない。Sourceのpin取得と、そのSourceを実行した証明は区別する。
