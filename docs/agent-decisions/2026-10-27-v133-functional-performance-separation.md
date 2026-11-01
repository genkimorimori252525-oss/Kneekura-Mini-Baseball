# V133: 9回の機能確認と時間枠の未達を分ける

日時: 2026-10-27 JST。対象: Mini Baseball V133配送gate。根拠: 本人の継続実装指示、能力/個人/球場/物理/裁定/前版の保護、2026-10-23の日常判断の記録方針。GitHub PR380が同じrepo・branch・HEADでopenであることをAPI再確認済み。公開更新は既存の判断記録commentへまとめる。Source commit/push/merge/deployの許可へ拡張しない。

## 観測と判断

元V124と同じcontrol scriptの180秒実行`dad126d5487249cfa0aa994ecc662cc5`はexit124、248球/48守備までで未完了。元9回の入力、259球/50守備、全守備complete、原能力/物理を変えて通すことはしない。元FAILと途中report/progressは`verification/swing-envelope-v133/nine-control-final/`へ保持する。

同じ最終守備入力を、凍結V124と新V133の実bundleの同じ関数でold/current/current/oldの順に実行した。`ad3279e55e5141fda671d37988b32588`は4件のJSON full-record完全一致。wallは約4.38/7.15/6.92/7.07秒。旧新版を問わず重い実行を観測したが、1入力4回で環境・GC・JITの原因割合や一般速度差を断定しない。物理関数/乱数/判定を差し替える診断ではない。

主担当判断: **機能確認だけの別枠300秒**を設け、同じcontrol script・同じSource・同じassertionで1回実行する。新folder`nine-functional-final/`に保存する。入力変更・Source変更による改善を装わず、180秒の性能枠に通ったことにも扱わない。この再実行は時間延長による機能確認であり、Sourceを修正した性能改善ではないことを明記する。厳密な前後の機能/保存互換を確認せず配送する代案、および重い守備の省略・数値品質/物理の削減は採らない。

## 検証・影響・復旧

最終gateは原673試技/92,201キー、Core43件、Live/メーカー95件、型、PC1200/390、実Worker1球、V124旧入力5球の完全一致、同controlの9回完走を別々に検証する。300秒枠のPASSは性能PASS・目標FPS達成・100試合同時校正の証拠ではない。機能完走できなければ配送保留を維持する。全goalは他残件を含むためACTIVE。

既存V124以下のHTML、原JSON、原FAIL、Nativeの90秒枠は変更しない。復旧は保存済み旧HTMLを開く。最終結果は`verification/swing-envelope-v133/DELIVERY-RESULTS.md`へ追記する。私的入力や原ログ全文を公開GitHubへ投稿しない。
