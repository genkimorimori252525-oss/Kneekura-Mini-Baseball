# INTEGER Source 九人 reproduction driver

`integer-team-driver.ts` は独立した閉 DB から段階実行する診断用 helper。
通常試合、実測 AI、九回、捕球／送球／裁定の完了を意味しない。
旧 retained runner／非等価 observation calibration は起動しない。

## 入力と実行前の確認

physical 担当の O1 → cut15 → single observation calibration の **独立 owner 再読済み**閉 snapshot を使用する。
entry JSON の項目は次のとおり。ref は保存された完全な owner/source/hash/snapshot ref。

```text
databasePath, sourceMapPath, databaseHash, sourceMapHash
rootReference, viewReference, currentPhysicalReference
existingObservationReference, existingCalibrationReference
originalCalibrationViewReference
namespace: 新しい一意な小文字 namespace
sourceScope: "explicit-synthetic-integer-team-reproduction-v1"
```

`originalCalibrationViewReference` は投影を連鎖させない元 nominal/effective observation prior の view。
prepare は元 owner で root／INTEGER／O1／cut15／既存 single calibration／本人 prior を再導出する。
出力 `plan.json`／`prepare-receipt.json` で次を確認してから run を開始する。

- frozen bundle SHA と全 import Source SHA（build の `.manifest.json`）。
- 既存 single calibration の本人を index0、その後は元 `actor.defenderBindings` の順。
- 各本人 observation／decision／locomotion prior の完全 ref と nominal Source。
- field の原時計、observation の明示 seconds-equivalent 投影。decision／locomotion の元 tick domain は UNKNOWN。
  原値を新 synthetic target-tick 宣言へ明示的に引継ぐだけで、1000倍変換や実測反応時間という主張をしない。

全員同じ priority を使用し、本人の観測・能力・candidate から Native が役割を選ぶ。
support geometry は本人の実際の ball perception と既知 first-base geometry のみ。
future actor 座標や index ごとの handler／relay 指定は渡さない。
元の実行済み handler commitment がまだないため base-cover cue は生成せず、未検証として保持する。
先行 O1 は前提履歴。新 O0 は previousObservationReference で連結し、37件に二重計上しない。
前観測の `samplingRequest.view.poseVersion` と eye offset 全3軸を継承し、現在の forward だけ再計算する。
既存観測 chain の pose/eye baseline を新診断名へ置換しない。

## 段階

1. 9人それぞれ current observation calibration → observation → lifecycle adoption、current decision calibration → decision → adoption、candidate → adoption。
2. team → adoption、9 actor → それぞれ adoption。新 metadata は合計37件。
3. owner handle を閉じ、readonly `VACUUM INTO` による閉 DB と全 Source Map を保存。別 process の verify で original owner 再読。
4. 9 actor の実 `movementStartTick` の最大値まで INTEGER の **action/result なし** free advance → adoption。
   途中の実 contact boundary を越えたことにせず、その境界で停止する。
5. 最終 current view に9 locomotion calibration を単件 V1 APIで宣言。
6. INTEGER から MOTOR version の初回 `defender_motion_v1`、9 actor の原 selection refs を全件渡す。
   要求 horizon は全9人の未変換 `maxIntegrationStepTicks` と全 retained primitive end の min 以下。
7. motor → adoption → immutable close。別 process verify は全9元 motor と実 world progress／body displacement を記録する。
   hold 等で静止する actor を動いたことにしない。metadata のみなら body credit は0。

18 sensory/decision＋9 locomotion の最大27校正。入口の既存単件校正は alias を作らず再利用。
各 lifecycle adoption は prefix → 全元参加者 TOTAL set → view を省略しない。
旧32 APIや全 Source／census／TOTAL／current-view 検査は変更しない。

## コマンド

repo root で build（新 bundle path 必須。既存 pin は上書きしない）。

```powershell
node tools/verification/team-coverage/build-integer-team-driver.mjs C:/absolute/new-driver.mjs
node C:/absolute/new-driver.mjs C:/absolute/entry.json C:/absolute/private-output prepare
node C:/absolute/new-driver.mjs C:/absolute/entry.json C:/absolute/private-output run observation-0
node C:/absolute/new-driver.mjs C:/absolute/entry.json C:/absolute/private-output run actor-8
node C:/absolute/new-driver.mjs C:/absolute/entry.json C:/absolute/private-output verify C:/absolute/closed-actors-.../manifest.json
node C:/absolute/new-driver.mjs C:/absolute/entry.json C:/absolute/private-output wait C:/absolute/closed-actors-.../independent-owner-receipt.json
node C:/absolute/new-driver.mjs C:/absolute/entry.json C:/absolute/private-output motor C:/absolute/closed-actors-.../independent-owner-receipt.json
node C:/absolute/new-driver.mjs C:/absolute/entry.json C:/absolute/private-output verify C:/absolute/closed-motor-.../manifest.json
```

run の終端は37個の stage 名から明示指定可能。1 process で複数 stage を順次進め、不要な CLI coldstart を削減する。
writer の内部 preflight／transaction／exact delta／postcommit proof は省略しない。
readonly 準備の共有 memo は同一 immutable read transaction の中だけ。writer をまたぐ proof／statement／結果 cache は追加しない。

## 復旧と停止

Source Map は各 owner admission より前に atomic rename で全 Map を保存する。
既存 Source ID があれば exact compare し不一致を拒否。生存 owner がある間は別 run を拒否する。
各 owner call の開始／完了は一意の `attempt-PID-time.jsonl` に追記し、失敗ログを上書きしない。

再実行では raw 行は位置同定と hash 照合にのみ使う。終端 head/view を original reader で認証し、採用済み行を accept し直さない。
physical commit 後に中断した場合は未実施の prefix／TOTAL／view だけを進める。
部分 TOTAL set は修復せず FAIL。unknown commit を推測して Source を差し替えない。

`STOP_CONTROL` ファイルが private output にあれば、次の新 stage／owner write は起動しない。
処理中 owner を強制 kill せず、その返却を待つ。通常終了は lock を履歴名へ rename して保存する。
異常終了で `ACTIVE_RUN.json` が残った場合のみ、元 PID が不在であることを確認後、明示的な第5引数でその PID を渡して復旧する。
PID 生存／PID 再利用時は拒否する。観察 timeout は restart の根拠にしない。

```powershell
node C:/absolute/new-driver.mjs C:/absolute/entry.json C:/absolute/private-output run actor-8 12345
```

元 DB／Source Map は毎起動・完了時に SHA 不変を検証する。閉 snapshot 以外の active DB/WAL を immutable checkpoint と称しない。
新 Native 実証の範囲は各 stage の原 owner receipt によって判定し、pure ordering/recovery tests や build PASS を Native 九人実行へ格上げしない。

## 実行履歴の境界

- candidate C の最初の新 O0 は pose baseline の改名を原 guard が拒否。採用済み schema／全 table rows は元閉 prefix と完全同一。
  `work/native-integer-team-20261016/failure-observation-0-preservation/manifest.json` が閉 DB／全 Map／拒否 proposal を保全する。
- candidate D は原 pose/eye offset を継承する helper 修正のみ。別 namespace/new Source ID、同じ保全因果 prefix の別コピーを使用。
  旧 C／旧 Source／FAIL 記録を変更しない。原 guard は不変更。
- 原 locomotion の `maxIntegrationStepTicks=10` は TPS1e6 上では10µs。この一系列は Source／clock／ownership の接続証明に限定。
  可視距離の移動、実測反応、能力多様性は未証明。最初9 motor＋独立再読後は同じ37段を反復せず結果を主担当へ渡す。
