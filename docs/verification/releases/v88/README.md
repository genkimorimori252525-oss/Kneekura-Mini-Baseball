# v88 検証索引

製品のHTML/metadata/sourceの正本は `docs/demos/releases/v88/SHA256.json` と `source-contract.json`。GitHub公開の実照合は `publication.json`。中間候補の試験を最終候補へ昇格しない。

## 根因と修正

旧v87の通常第34球の空振りで、捕手のsecure/公式裁定tickは152034830、実測終端は152057366.6964166。残る22.537msでtipが約0.634m移動する登録済みmotorがあるのに、表示は最終frameのbatのまま1595ms固定されていた。身体アニメーションだけはsceneMsで進行していた。再現原本は `docs/verification/experiments/v88-whiff/v87-whiff-observation.json`。

診断へframesを複製しないmotor descriptorを追加し、既存登録・身長倍率・選択範囲・剛体変換・弾道を正確に再構成する。表示待機だけ実測終端まで進め、表示間隔が短い末尾をまたいでも終端を一度描く。公式playを延ばしたり球のSourceを再計算したりしない。

HRの固定1750msは1500..2000msの安定した抽選へ変更。確信HRは投手のまま見送る。初期案の「過去に守備へ移っていれば必ず守備」は、後から確信HRが判明して投手へ戻った場面と矛盾したため、観測済みの確信HR・投手視点を優先する追加RED→GREENを実施した。

## 最終結果

| 検証 | 結果・証拠 |
|---|---|
| Core | 新helper13件＋既存LivePitch13件、impact関連5件PASS。左右/身長/選択window/全体弧/local弧、同一samplerとの対照、JSON再読、破損/境界拒否、入力非破壊 |
| 型 | 全体 `tsc --noEmit` PASS、receipt `MB-20261021-V88_cbb055c6…` を参照 |
| 表示unit | HR6＋空振り表示2の8件PASS。範囲/複数seedの多様性/再読/逆seek/観測prefix/確信HR優先/第三out/終端clamp/cache |
| 通常40球 | `playback-final/report.json`。v87と各record全体を比較し、追加したbatPlaybackV88診断のみ除いて全物理・裁定・保存frameのJSON hash一致。1200/390幅で同じ結果 |
| 空振り表示 | 同report。第34球の末尾が実測終端へ進む、逆seekで同じpose、身体フォロー終了で消える、保持球は非表示、第三out即bench維持 |
| HR表示 | 同report。第39球の守備観測者を実HTMLで保持し、抽選した1754msの直前/直後・逆seekを確認。確信HRの投手維持と後発確信の優先はunitの制御された観測prefixで確認 |
| 通常完走 | `normal-nine-final/report.json`。9回343球/123守備＋別seed3回54球/23守備、全field complete・fallbackなし。保存・JSON再読・重複拒否・練習で公開成績不変 |
| Maker | `course-regression/report.json`。v87の13図/63形状、保存取消、3役設定と旧データ復帰等を新Coreのメーカーで再確認 |
| 描画 | `presentation-final/report.json`。通常/lab/maker 9case、1200/390・DPR1/2、画質往復/A-B同期/両trialのroster・metrics不変、RAF全layer同期。JS例外・外部通信0 |
| 再生成 | `rebuild.json`。通常/lab/makerとmetadata/input計8ファイルbyte一致 |

現harnessの短時間lab観測は1pairでA/Bとも300msのため、継続的な再生進行量や目標FPS達成の証拠にしない。並列headlessの実提出FPSも実機性能へ一般化しない。v87メーカーの全284入力を今回再試験したとは扱わず、同じUI source/hashと今回の関連実操作を区別する。

## 原FAILと境界

- 旧HR helperで抽選の多様性と投手holdがRED。初期v88でも過去fielder優先の追加試験がRED、観測済み確信HR優先へ修正してGREEN。
- Core新helper未存在のREDを保持。関連試験まとめは長時間の旧match統合試験で120秒timeout。helper26件/impact限定5件と全体TSCを分離してPASS。通常9回は最終HTMLで別途完走した。
- 初回stage検査は研究Markdownの行末空白と末尾空行でFAIL。文章内容を変えず整形して再検査した。
- 最初のbrowser harnessは実UIにない明示fielderボタンを押そうとしてTypeError。実UIのmound→守備自動切替を検査するようharnessを訂正し、元FAILを保持。製品の例外と混同しない。
- 未来の実ボール軌道、得点結果からバットや判断を作り直さない。記録済みの打撃motorだけを再観測する。
- 新ハーフスイング動作やミート由来の停止バフは未実装。Lunaの研究と将来案は別資料であり、製品の完成済み機能ではない。
- 原Charter HOLD、旧FAIL/BLOCKED/UNKNOWN、実機/100試合/Native認証/空力校正/実FPS残件を保持。

## 再実行

```powershell
node tools/browser-bridge/build-playback-v88.mjs
node tools/browser-bridge/build-maker-release-v88.mjs
node node_modules/vitest/vitest.mjs run src/integration/browser/LiveBatPlaybackV88.test.ts tools/browser-bridge/home-run-watch-v88.test.mjs tools/browser-bridge/whiff-follow-through-v88.test.mjs --maxWorkers=2 --minWorkers=1
node node_modules/typescript/bin/tsc --noEmit
node tools/browser-bridge/check-rebuild-v88.mjs
py -3.10 -X utf8 -B tools/browser-bridge/package-playback-v88.py
```

実command/log SHA付きreceiptは `docs/ai-continuity/verification-receipts/MB-20261021-V88-*`。

GitHub公開照合PASS：製品 `f88733d`、PUBLICATION `09509a85`。remote/PR headと189 Source/artifact Git blobsが一致。既存branch/Draft PR #380、main未merge。後続の証跡commitは製品Sourceを変更しない。

継続記録auditは旧CHARTER_UNAPPROVEDのHOLDを返した（CONTINUITY-AUDIT_200298de…）。今回の直接依頼と原Charter全体の承認は区別し、旧HOLD/原証拠を保持する。製品検証PASSとauditのFAILを混同しない。
