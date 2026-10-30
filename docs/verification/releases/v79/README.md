# v79 実検証索引

2026-10-20。対象は内部63コース・公開9区分・5方向・ローカル試合成績・シーズン保存・練習・締め。[相談用仕様](../../../design-consultation/course-season-v79.md)と[承認範囲](../../../plans/2026-10-20-v79-course63-and-spray-review.md)を参照する。

この索引のCore結果は実行済みreceiptに基づく。通常HTML／メーカー／配布物の最終ブラウザ確認は主担当が追記する。各試験集合は重複するため、件数を合算しない。

## Coreと保存契約

| 検証 | 結果と証拠 |
|---|---|
| 実9回完走と記録JSON往復 | [CORE-FINAL receipt](../../../ai-continuity/verification-receipts/MB-20261020-V79-SEASON-CORE-FINAL_692aa9a557b0486e9d67481000794010.json)／[log](../../../ai-continuity/verification-receipts/MB-20261020-V79-SEASON-CORE-FINAL_692aa9a557b0486e9d67481000794010.log)：2ファイル17試験PASS、93.031秒。seed2468、133投球、80打席、確定74・確認中6、安打29。game JSON換算208290 bytes。 |
| 記録・シーズンの最終追加確認 | [SERIALIZATION-FINAL receipt](../../../ai-continuity/verification-receipts/MB-20261020-V79-SEASON-SERIALIZATION-FINAL_3703a6a0290242e68136a7454355ef43.json)／[log](../../../ai-continuity/verification-receipts/MB-20261020-V79-SEASON-SERIALIZATION-FINAL_3703a6a0290242e68136a7454355ef43.log)：16試験PASS、完走1試験を除外。162個の小gameのJSON往復・集計、0/1/10/100/1000 AB、練習分離・上限、締め再実行拒否、外側／範囲外／欠損、閾値、通常単打とpendingを確認。 |
| 全体TypeScript | [TYPE-FINAL2 receipt](../../../ai-continuity/verification-receipts/MB-20261020-V79-SEASON-TYPE-FINAL2_da75fc51d45c4e6bb89aeed6b3e84a90.json)：`node node_modules/typescript/bin/tsc --noEmit --pretty false` PASS、42.296秒。 |

完走確認後、正本JSONの厳密検証・オブジェクトのキー順に依存しない比較・無接触打球のground-rule award判定を追加し、最終追加試験と型検査を実行した。これらの追加後に物理計算を再実行した結果とは区別する。実133球のgame JSONファイルは単体試験では保存しておらず、coverage数値は上記logに残る。

## 原FAILと修正理由

- [SCORING-RED](../../../ai-continuity/verification-receipts/MB-20261020-V79-SEASON-SCORING-RED_c34b6196873b49779c767e71ea702e06.json)：記録API実装前の失敗。
- [STORE-RED](../../../ai-continuity/verification-receipts/MB-20261020-V79-SEASON-STORE-RED_f6649ada6ba34d85ac5d72599eb00d01.json)：シーズンAPI実装前の失敗。
- [CORE-GREEN原FAIL](../../../ai-continuity/verification-receipts/MB-20261020-V79-SEASON-CORE-GREEN_df20fbe1e572468eaa4fb902baf29a2d.json)：完走後のmatch stateが最終outs=3を持つ一方、新しいローカルvalidatorが進行中のouts<=2だけを許していた。`gameOver`のafter stateだけouts=3を許し、進行中stateとNative validatorは維持した。修正後の完走はCORE-FINALに記録。

原FAILは削除せず、後のPASSで上書きしない。既存Charterの未承認状態・過去のHOLD／UNKNOWNも本検証から承認済みへ変換しない。

## 最終HTML統合

- 通常HTML／調整室：[GAME-FINAL-BROWSER receipt](../../../ai-continuity/verification-receipts/MB-20261020-V79-GAME-FINAL-BROWSER_9a5ed678929a48c7930b0b16519c39e9.json)、[report](game-final/game-check.json)。182.500秒、320投球／127打球・守備処理で9回完走、全守備完了、fallbackなし。確定111打席・確認中17打席・H53。開始終了のHTML／metadata／Source pins一致。v78初期6球の全history exact。投球0件・完走後再生終了前の保存先保護、完走の一度だけの登録、重複拒否、練習、締め、JSON復元を確認。
- 完走正本：[game JSON](game-final/finished-local-game.json)、[season JSON](game-final/finished-season.json)。Core単体の133球例とは別の実行。9回完走例の得点・安打数は現実校正済みの成績分布を意味しない。
- PC1200／390pxの通常成績帳の配色・overflow、labの同roster session replay exact、labの成績記録停止を確認。[画像](game-final/normal-390.png)。
- 最終メーカーの記録・操作・投手4図・17得能の証拠は、下の追記で最終artifact hashに一致する結果を示す。

## 残る制限

- `local_physical_scoring_v79_1`はローカル方針。H/E/FC・犠打飛の判断不足は`pending`／`null`で保持し、0安打へ変換せず学習から除外する。
- `local_course_learning_v79_1`の係数・上限と打撃動作への効果は作者設定。133投球の完走例や162個の小game保存試験は、100試合の現実校正を代替しない。
- `nativeAdmission:false`。Native公式career historyや認証育成episodeへ登録しておらず、既存の認証・validatorを緩めていない。
- 元計画の守備・走塁・裁定・実測物理の未完項目は維持する。

## 最終メーカーと配布照合

- [メーカーguard最終](course-maker-guard-final/report.json)／[receipt](../../../ai-continuity/verification-receipts/MB-20261020-V79-MAKER-GUARD-FINAL-BROWSER_6c414d9124c54ce58cc035bdb678c39d.json)：1200/390px、実320球の再読と全セルH/AB/HR/pending/色、方向5区分、重複拒否、JSON/端末/全体JSON、dirty保存・全体import・能力専用import、1秒help、キーボード、同条件の物理試打。
- [投手4図最終](pitch-views-guard-final/pitch-views-check.json)／[receipt](../../../ai-continuity/verification-receipts/MB-20261020-V79-PITCH-VIEWS-GUARD-FINAL_530f228661444b4aa04184902e4bc89e.json)：PC390×直球/カーブ、Source不変、元UI/CSS・673資料一致。
- [独立17得能回帰](traits-guard-final/traits-check.json)／[receipt](../../../ai-continuity/verification-receipts/MB-20261020-V79-TRAITS-GUARD-FINAL_18fd2b25c10e436ea4ec7788ecd868c0.json)：基礎SIと公開能力の不変を維持。
- [全体型検査](../../../ai-continuity/verification-receipts/MB-20261020-V79-INTEGRATED-TYPE_ea4f6337e1fb463f9891e558b0f65f1f.json)：PASS。以後の変更はブラウザJS/CSS・文書のみ。
- [配布照合](release-check.json)／[receipt](../../../ai-continuity/verification-receipts/MB-20261020-V79-PACKAGE_08012e47e4654325b81218b85c0b3621.json)：Native126/Maker93、union133 source pins。旧254凍結ファイル不変。3HTML、埋込Core、helper、metadata、同じrendererを照合。通常4b508918／lab8f3020b5／maker16d277f0。

初回maker `course-maker/report.json` の試打失敗は明示レパートリーなしでowned pitchIdを渡した接続漏れ。後続hover試験のFAILは自動scrollがpointer timerを消した検査手順で、scroll安定後に検証した。旧reportと失敗receipt/logは保持している。レビューでは能力専用importの未保存guard漏れも再現し、最終checkerへ回帰を追加した。

CCG audit `669d3435` は元Charterの独立承認不足1件でFAIL、旧handoff警告193件を保持。製品試験とは別の未承認状態で、承認を自動生成しない。staging `06def4b7` は明示allowlist・全stage blob byte一致・credential pattern 0・whitespace 0を確認。

## GitHub保存

製品 `6b7e1eff4281784847bff1e457f0cd302e7dd911` を既存作業branch／Open Draft PR #380へ保存。[publication.json](publication.json) と [PUBLICATION receipt](../../../ai-continuity/verification-receipts/MB-20261020-V79-PUBLICATION_b77b9377c99e4d458970b2d8608d0687.json) がremote/PR head・3HTML Git blob/size・raw9ファイルを照合。main未マージ。後続commitは公開記録のみ。
