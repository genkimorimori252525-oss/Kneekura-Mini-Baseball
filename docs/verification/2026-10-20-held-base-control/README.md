# 持球野手の踏塁アウト — 既存機能の確認

人間の質問：ボールを持つ野手が、自分でベースを踏んでアウトにする処理はあるか。

**実装・通常HTMLへの接続とも存在する。製品変更は行っていない。**

- `LiveFieldPlayV1.ts:717–720`：持球移動と送球の所要時間を比較し、`carry_to_base` を選択。
- 同 `1180–1186`：持球野手の平面座標とベースの接触半径0.28mの交差を連続時間で検出。
- 同 `1060–1069`、`1395`：`controlled_base_contact` を記録。有効なフォース義務やアピールに対応。
- `LiveBaseballMatchV1.ts:221–226`：通常試合が同じ物理守備を実行し、事実を裁定へ渡す。
- `PlayableMatchRulesV1.ts:191–193`：送球の有無を条件にせず、有効なフォースへの踏塁を `base_control` アウトにする。

非フォース走者はベースを踏むだけではアウトにせず、原則として走者へのタッチが必要。ベース到達時には既に走者が先着していたりフォースが解消していれば、このアウトは成立しない。

## 実行証拠

| 検証 | 結果 |
|---|---|
| [関連Coreテスト](../../ai-continuity/verification-receipts/MB-20261020-BASE-TOUCH-UNIT-AUDIT_4f16e959f2404c73bb9c8eec5e928c88.json) | 2ファイル13件PASS、10.780秒。持球三塁踏み、先着競争、裁定一致、中継/持球選択 |
| [通常設定の実HTML](../../ai-continuity/verification-receipts/MB-20261020-HELD-BASE-BROWSER_024f77ceb6b84c7eba9d5c0b14da51bb.json) | v73/v76それぞれ48球、45.750秒。各3件の踏塁アウトを確認。いずれも送球を受けた場面で、自ら運ぶ場面は未観測 |
| [検証用能力の実HTML](../../ai-continuity/verification-receipts/MB-20261020-HELD-BASE-FIXTURE-BROWSER_9bd3df2115ee4cf68083bab7e1fa27a1.json) | v73/v76とも初球で持球移動アウト、10.702秒。通常のJSON読込→新規試合→次の一球の経路を使用 |

[通常設定の生記録](browser-check.json) · [検証用能力の生記録](fixture-browser-check.json)

検証用能力では、先攻側の走速を1m/s、守備側の送球速度を0.5m/sにした一時JSONを、独立ブラウザへ読み込んだ。持球移動が合理的に有利な条件を作ったもので、初期選手・保存されたJSON・通常HTMLは変更していない。

両版の初球で二塁手メルセデス（`1-b1`）が記録の経過時刻1.564019秒に捕球し、4.369441秒に一塁を踏み、大谷翔平（`0-b0`）がアウト。途中の `throw_release` は0件で、全プレーの送球も0件。`carry_to_base` から同じ野手の `controlled_base_contact`、正式な `base_control` 裁定まで一致した。捕球時から踏塁までの所要時間は約2.805秒。

最初のブラウザprobe [83ee3d21](../../ai-continuity/verification-receipts/MB-20261020-HELD-BASE-BROWSER_83ee3d21b6d744e1a6ce99ee81a96ade.json) はcommand自体PASSだが、QAが `record.field` と誤って参照し、正しい `record.play.field` を読んでいなかったため、機能の証拠として採用しない。[原出力](before-play-path-fix.json)を保存し、正しい経路と観測成立assertへ修正して再実行した。製品不具合ではない。

今回確認したのは機能の存在と接続。通常設定での選択頻度、全プレーでの最適判断、全フォース/併殺の網羅、100試合分布、実機は確認済みとはしない。原の全計画・旧FAIL/UNKNOWN・CharterHOLDを継続する。
