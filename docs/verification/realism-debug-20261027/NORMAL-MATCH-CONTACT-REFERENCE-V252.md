# 通常試合の受理打球・参考角度帯表示

2026-10-31。通常試合で実際に受理したcontactだけを、試合中に打者別でローカル記録する。打球角度の参考帯は [MLBの一般目安](https://www.mlb.com/glossary/statcast/launch-angle) 10〜25°、25°はフライとの重複境界を別表示。分類には丸め前角度を使い、分母はファウル・バントを含むこの記録の全接触。公式打球比率や得能・選手の能力判定ではなく、回転・弾道・空力の操作もしない。

正規Workerの受理後、Hostとゲームの一致を確認し、試合全体の投球ordinalと打者IDで集計。画面は正規の選手名を表示し、内部識別はIDのまま。再訪時は重複追加せず、新試合で記録を消去する。収集エラーは表示し、受理済みの試合状態を巻き戻さない。

## 実証範囲

固定seed `TBD-LAD-2025`・Chrome 156.0.8078.76の実Workerで12球を受理し、接触４・非接触８・４打者を確認。全接触の独立計算角度とDOM・打者別分母が一致し、１件が参考帯内、３件が帯外。再訪による重複なし、新試合reset、390px画面、旧summaryの主要キー構造を確認。人工的なconflict検査では受理済み履歴・表示を維持しエラーを表示した。receipt `9c9b823706384dc2b6ead87185950f6f` PASS、43.610秒、report SHA-256 `a9d4947c1959143ca148c25219e0ac2828a56f02e1b2b9f488a5d9b1f1784841`。

初回 `1f1e984a760b46a99b98f96431d2eff5` FAIL は候補HTMLのscriptとsectionのID重複で390確認前に停止。修正後 `e3cfe40f04ed43e6b9efa449bbe4caad` PASS。さらに利用者が識別できる選手名の表示を追加し、上記最終候補を新たに検証した。旧失敗と途中PASSは保持。

候補 `work/normal-contact-v252-game-03/game.html` SHA-256 `87b9ba8361ea1150b9ad037c66554dadfb67afba71219b2c4621929abb2854b6` はWIPを含む検証版で、完成３HTMLの配送ではない。現行の試合記録は正規continuationを含まないため、保存後の再開・career統合は未対応。MainとWorkerの全record完全一致、実際の未受理prefetch・旧Host遅延race、Worker runtime bytes直接採取、実contactちょうど25°はこの試験では未証明。synthetic conflictを実Worker由来と数えない。
