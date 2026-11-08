# V117 一塁方向打球の調査判断

2026-10-25 JST、Task MB-20261025-V117。本人の「能力かAIか知りたい」「固定手順でなく状況から最善策を選ぶ」「GitHubに未記載なら記載」に対応。

原53球/凍結V116の再現と因果対照により、当該一塁手の反応+判断約.595秒、予測最小lateness約.343秒が既存試行上限.25秒を超えてライトへ担当を渡し、自身は一塁coverを選ぶことを確認。能力設定だけを速くした別入力は1B捕球/併殺を実成立。試行上限だけを.35/.4にした別入力は試行しても捕球せず、能力を変えない閾値緩和を解決策とはしない。

別入力で1B→2B送球、自分の一塁touch、1B→P送球/P一塁controlを比較し、固定3-1プログラムの追加をせず状況別選択が実行されることを検証。元場面を必ずアウトへ補正しない。今回の製品不具合・カバー欠落は未確認のため、Source/HTML/本人JSONは変更せず原因報告を成果とする。将来のnearAttempt判断の改善余地と、設計全体の未完成を別記した。

GitHubで思想は既に明記済み（現行PR380の02-rules-ratings-defense L214–249、個人守備仕様L368–374、設計branch側にも存在）。新設計の重複追加は不要。本人の記録方針に従い、判断と公開可能な根拠だけ既存PRへ集約する。私的JSON/生ログ/個人pathを投稿せず、Source push/merge/deployなし。詳細docs/verification/releases/v117/RESULTS.mdとdesign-audit.md。

復旧: 製品挙動変更なし。旧V116/元JSON/過去FAIL/他chat作業を保存。継続する場合はこの原証拠を起点とし、一律reactionや捕球成功の補正へ置換しない。


## 追加の直接人間指示による実装への拡張

上記「製品変更なし」は初期診断時点の判断。その後本人が、慎重以外は近い際どい球を試し、何でも追わず、内野diveも使うよう直接指示したため、同Taskで5Sourceの近接試行/明示CAUTIOUS伝達へ拡張した。初期判断を最終完了と解釈しない。

旧.25秒枠を保持し、接近中/h<=2/到達可能な高さ/近いroute6m/遅れ.55秒（個人costで調整）を満たす非慎重候補だけ追加。前方が試す価値と後方pickupを比較し1名を選ぶ。投手や一塁手の固定手順、能力/物理の加算、捕球保証は作らない。慎重greenは既存なので重複追加せず、base costと独立に所有を渡す。effectScale0は無効。内野dive/ordinary/近接味方の3対照は既存athleticのままPASS。

Source/HTML実装・最終検証・中断/再開はdocs/verification/releases/v117/RESULTS.md、計画追記、AMENDMENTへ保存。52file365tests、型、本人raw近接/慎重/遠方、両幅通常/練習/調整室/旧JSON/編集/先読み/旧重入力がPASS。9回と配置の結果は完了後追記。再起動の中断分だけ再実行し、全3244 captured inputs不変を確認した。


## 最終配置・公開記録

最終9回 `6df6c9e2fd2a4553a37ead80337db285` は398球/102守備/16半回で完走。publish `13e2afd9ee4f48cb857d931a06e894c5` で3HTML+6付属fileを別名配置した。final readback `58a16663f24743f196823e6383da2451` は全3244 captured inputs、9配置file、9回Core、元JSONと公開判断本文を再照合PASS。

設計思想の所在と今回の判断は [既存PR380](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/380#issuecomment-6387685545) へ同期済み。公開repo/正しいbranch/HEADを実確認し、私的入力・生ログ・個人pathは投稿していない。Source/HTMLのpush等なし。今回必須残件なし。
