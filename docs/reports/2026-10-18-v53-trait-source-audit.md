# v53 得能の接続監査（作業中）

## 確認した正本

GitHub APIで `jolly/core-foundation-plan-2026-09-17` の `63ccf99e29dba0488278f52db39747c68e07b545` にある [canonical09](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/63ccf99e29dba0488278f52db39747c68e07b545/docs/game-design/09-player-trait-catalog.md) を確認した。2026-10-14の人間指示反映が最新である。現在の `TraitFamilies.ts` が参照する旧seedの09 §7.2を悪球打ちの正本へ戻さない。

§5.2.1の悪球打ちは窮屈なコースでも意図した軌道・面・タイミングを維持する技術で、選球・認識・悪球を振る傾向とは独立。自動的なchase増加／弱い打球の罰則を持つBLUE_RED tradeoffという旧案は撤回済み。物理的に届かない球や見逃しに接触成功ボーナスを足さない。

## 今回の実装

`LiveTraitProfilesV1` はローカル作成用の保有設定であり、Native習得履歴やmasteryの認証ではない。悪球打ちの保有ONは既存 `physical.badBallControl` または旧 `workbenchPlayer.traits.badBallControl` の一方だけを使う。OFFは実行値0、復元用sourceは保持。付け直しても技術の二重倍率を加えない。未査定の旧JSONは元の数値を維持し、値の大小から保有を推定しない。NLB10名の初期保有は既存の人間指定を明示し、個別の技術値を維持する。MLB側を数値閾値で自動保有／非保有にしない。

公開能力から独立した悪球打ち数値を外し、公開10項目・詳細44項目と得能欄に分離する。青特以外の色を一律の能力倍率として実装しない。同familyの青／赤／金は一つの有効状態で、重複加算しない。緑特は嗜好・判断であり、受理した監督の明示指示を上書きしない。

## 定義済みと実行済みの区別

`TraitFamilies.ts` の13 graded・7 learned・7 greenは明示subsetである。別にSourceTraitFamilies8やtwoStrikeのRED系がある。列挙やLifecycle管理だけでは、通常HTMLのHostに効果が接続されたことにならない。

| 群 | 現在の通常試合のowner | 状態 |
|---|---|---|
| 悪球打ち | LivePitchV1の窮屈な体勢による狙い誤差、Workbench実行 | 今回保有編集と接続 |
| 走塁判断・積極性 | LiveRunnerAdvancePolicyV1、reaction/safety margin | 数値と監督指示は実働。family state接続とは別 |
| 守備積極性 | LiveFieldHandlerSelectionV1 pursuitCostWeight | 数値は実働。family state接続とは別 |
| 送球精度 | LiveThrowDirectionV1 standardDeviationRadians | 数値は実働。段階の作成方針は未接続 |
| 球質・打球・強肩等のdescriptor | 速度、回転、軌道、誤差等の実Source | 同じSourceを表示し、ラベルから再補正しない |
| plate aggression | swingDecision threshold/aggressionWeight | 既存数値は実働。緑特state編集は未接続 |
| swing/pitch preference | contact/power motor、auto球種選択 | 個人の既定嗜好と監督指示の調停が必要 |
| 対左右・内外高低・対球種技術 | 左右geometryやaim motorは存在 | 条件別の技術Sourceが必要。全体aimの代用では定義が変わる |
| バント・カット・二ストライク技術 | bat contact／twoStrike入力束は存在 | 独立した調整SourceとHost count接続が不足 |
| quick／盗塁／牽制／slide | Coreのtimeline断片が存在 | 通常Hostは打球接触後の走者から開始、統合未実装 |
| 疲労・回復・故障抵抗 | workload／rehabのCore断片 | 通常Host状態と故障発生等の元ownerが不足 |
| pressure／立直り／心理・関係 | world心理・emotionのCore断片 | 通常Host executionへ未統合。試合結果buffで代用しない |
| blocking／framing／PH readiness | 捕球保持やcalled-strikeの別処理は存在 | 専用技術／準備状態ownerが不足 |

全得能への拡張範囲は人間へ確認中。「通常試合で実働できる得能＋残り未対応明示」と「不足する元システムも含めて全実装」を無断で同一扱いしない。REJECT済みの勝運・帳尻等を復活させない。元の全計画はIN_PROGRESSのまま保持する。
