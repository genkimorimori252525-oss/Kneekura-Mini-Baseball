# v81 — 無劣化性能改善版

- [通常試合](game.html)
- [選手メーカー](maker.html)
- [カメラワーク調整室](camera-workbench.html)
- [変更・計測・限界](../../../performance/2026-10-20-v81-lossless-results.md)
- [次版にも継承する性能標準](../../../performance/PERFORMANCE-STANDARD.md)
- [検証索引](../../../verification/releases/v81/README.md)

HTMLは単体保存して開けます。UI・4px画質・PNG原本・物理・裁定・能力/得能・シーズン成績・全673軌道は維持し、重複計算と描画更新を削減しました。v80の所持球常設/方向別候補も含みます。

通常は約18.3ms、投球は約7.3msを目標に、全レイヤーを同じ表示時刻で更新します。実頻度は端末・カメラ・画面更新に依存します。初回起動には検証の追加コストがあり、再試合は検証済み資料を再利用します。

通常144・調整室60・メーカー64場面の同時刻画素一致、9回320球＋別seed82球の全記録一致を確認。実Android/iOSのFPS・熱・電力は未検証。実測校正・100試合分布・Native認証等の元計画は継続します。GitHub保存は既存Draft PR #380へ反映し、mainへマージしません。

実装・HTML保存commit [`1f2155f`](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/1f2155fd4c7241ca627dca53d288f28478c94654)。公開照合98f88599 PASS：134 SourceのGit blob、3HTMLを含むraw9ファイルの全bytes/sizeを照合。恒久規約は指定の設計branchへ文書のみcommit [`a71c017`](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/a71c017d085bb6213a1facfc6eee6aba17723d78)、AI-INDEX/PLAN-REGISTERへ登録済み。後続の公開記録commitは製品Source/HTMLを変えない。
