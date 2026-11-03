# 成功だけを選別しない回転試行集合

2026-10-30 JST。保存済みの真正TOP試行を、観測条件と閉じた試行集合として正規Readerで再認証した。資格・新しいOwner / tableはまだ作成していない。

## 実装

`SpinAimQualificationV228.ts`はproject宣言のdomain・criterion・cohortを検証し、試行集合と固定World範囲を照合するpure評価。明示criterionを必須とし、旧MODEL_VERIFIEDを継承しない。minTrials>=2は1件を資格にしないための下限で、既定値2ではない。成功・未接触・未解決・未分類・重複・conflictを区別する。

`NativeSpinTrialCohortInventoryV228.ts`は、全commitment / resolutionを正常physical fullref Readerへ通した後にcapabilityを分類する。metadataのSource鏡像整合だけではcalculationの偽装を排除できないため、raw Source capで先に除外しない。正常World eventとprefix、最も早いeligible trial、固定範囲の全memberとhashを認証する。正常な範囲外future追加では失効せず、範囲内の差異・欠落はHOLD。

投球ごとに変わるcapture / delivery / calibration等のfullrefsは各trialのprovenanceへ保存する。共有domainは正常Reader由来のmethod、nominal / effective sensor・prediction値のIEEE lossless hash、clock / latencyを用いる。個別IDs、絶対tick、RNG draw、観測sample値を共有domainに含めない。

`readNativeSpinTrialDomainV228`は成功やspinを見ず、正常原本から実行条件を得る。`readNativeSpinTrialCohortSnapshotV228`はcriterion不要の読取入口で、資格評価と同じcensusを共有する。Source版のcriterion必須条件は維持する。

## 検証と実結果

- 新9テスト `84d308ec`、Snapshot seam `352dbec3`、最終型検査 `1316853e`、driver構文 `337167ab` PASS。empty Native snapshot以外の主要negative / future許容はOwner stubの検査。
- Sol独立レビューで、per-pitch calibration fullrefを共有domainに含めるP1を発見。別投球でgroupが一致不能になるため、provenanceと共有条件へ分離した。P1修正とSnapshot抽出は、それぞれ実SHA照合の独立レビューでReady。
- 実readonly `e594878fc1004bdebc5b085032f88977` PASS / 22,250ms。commandは `node tools/verification/check-native-spin-trial-cohort-v228.mjs work/native-spin-trial-cohort-v228-01`。
- 正常domain、全対象census、World prefixを再認証。first / end / current World revisionは2 / 2 / 2。対象は真正CONTACT 1件で、全fullrefs・観測来歴・保存directional spin `626.2489333765586` rad/sが一致した。
- criterion作成・資格発行は0。原V226 DBと保持済み8 DBは開かず全files不変。所有コピーの全row / rowid / schema / head / data、caller transaction / query_only / savepoint / authorizer、Source / bundle / artifact終了pinsを保持。新write / contact / practiceは0、4分の元接触試行は再実行していない。

log SHA `792300fb8a9c5f559a7dfdd9a01cab89dd70fc95de103061b133f227578c3f11`、report SHA `29dbdb738b1764336fc7e9a83b5fe4681d5059c4ddd6442f2f0415bdc3168809`。private結果は `work/native-spin-trial-cohort-v228-01/`。22.25秒はこの正常再認証だけの時間で、試合性能ではない。

## 残ること・保持する失敗

次は旧Mastery / V225を変えず、project基準によるmotor適用資格を保存するOwner / table1つと新consumer。根拠未確定の基準は補作せず、1TOPを合格へ付け替えない。真正な未接触・反復・範囲外future追加は今回の実DBでは未検証。4技術、通常AI、Gold、全試合と最終配送は未完。

Rootは最初のP1修正を完了済み担当への通知だけで済ませ、新turnを開始していなかった。「修正中」という記録を訂正し、明示的なfollowup_taskと担当開始応答・Source更新を確認して修正した。旧履歴は保持。共通CCG手順は作業依頼を常にturn開始可能なAPIへ統一した。

初期Source cap隠蔽・object key順のRED、P1のRED→修正、静的型FAILを保持。`2ed7d86e / e0ceee7b`はVitest worker設定衝突でRED未成立。`1f051560`のNodeアクセス違反は原因UNKNOWN、後の型検査PASSを原因解消としない。旧FAIL / TIMEOUT / UNKNOWNも解消していない。
