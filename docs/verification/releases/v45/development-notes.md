# v45 開発中に検出して修正した問題

以下は公開前の試作observerに対する直接Node試験・読取りレビューでの記録。専用machine receiptを持つ旧版再実行とは扱わない。最終Sourceの対応する回帰試験は `check-continuous-batter-view.mjs` に保存した。

1. **急変診断の対象がpitchだけだった。** 初期のfixtureは途中でbattedへ移り、`observed abrupt velocity change produces later surprise` がFAIL。実打球の急方向変化も有限追尾で再取得するため、可視測定の速度innovationを投球以外にも適用した。投球だけの遅い変化と、直前の遅球に続く速球の専用試験も後で追加した。
2. **12msの位置補間でeyeが飛んだ。** 初期試験は8ms SourceだけでPASSしていたが、守備の55msサンプルを使うと、54.999→55msでeye.zが−.95→−.606、0.344m移動した。既知の身体速度から最大55msだけ予測し、それを一つの連続eye位置／速度が追従する設計へ変更。不規則な55/46/55/55/26ms等のサンプルで境界±.001msを検査した。
3. **cacheが可視prefix上限を区別しなかった。** sceneMsが同じでも、最初のSourceだけを許したfresh queryはyaw約.122624、高い上限で計算後に低い上限へ戻すと約.533611になった。上限変更時は両方で不変の区間だけを残し再計算。high→low→highをfresh recordと完全一致させる試験を追加した。

旧v44の実カメラ境界の段差は、最終 `continuous-view-check.json` の `oldBoundaryJumps` に別途保存。上記の試作問題が旧v44で発生していたという記録ではない。
