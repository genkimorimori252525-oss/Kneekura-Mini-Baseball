# v81 — 最新版の無劣化性能改善・採否と測定

原計画commit34fc254の移植を人間が承認し、v79通常/調整室とv80メーカーを基準に実装した。旧lv76最適化HTMLの原本は手元に見つからず、文書の実験を現行コードへ再評価して適用した。旧実験の数値を最新版の実測として流用していない。

## 採用した変更

カメラ三角関数の共通化、地面の4px射線再利用、深度キーの数値化、同一背景1枚の厳密cache、名前DOMの再利用、frame探索の二分探索を採用。全673軌道のdecoder・厳密検証・選択・順序を維持し、immutable入力に限り検証済み内部cloneを再利用する。

通常・調整室・メーカーの全レイヤーを同じ表示時刻で更新する。球だけ22msだった経路を廃止し、通常約18.3ms・自由投球約7.3msを目標とする。画質/物理/判定は維持。PNG・673軌道資料・初期20人・17得能・コース/シーズン・方向タブを維持した。

## 同一性

- 通常144、調整室60、メーカー64の停止時刻場面で、旧版とRGBA・Source結果・表示状態が一致。通常は打者/捕手/投手/走者/守備/俯瞰の6実視点を含む。各試験はPC1200pxと390px、DPR1。
- 9回320球と別seed3回82球の全record JSONをブラウザ内でhash化し、順序付きhash列が一致。最終matchと球数も一致、全守備complete、fallbackなし。
- 成績の一度だけの保存、未完試合の保護、JSON往復、練習/締め、未保存入力、全24球種候補×左右、独立17得能、多方向投球図の回帰PASS。
- 配布検査は134 Source入力、通常と調整室内HTML、メーカー両adapterの同renderer、v79/v80凍結ファイルを照合。[証拠索引](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/1f2155fd4c7241ca627dca53d288f28478c94654/docs/verification/releases/v81/README.md)を参照。

## 計測値と限界

Windowsのheadless Chrome、2D acceleration無効。有限の単回区間で、実スマホや画面の走査FPSではない。[機械用集計](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/1f2155fd4c7241ca627dca53d288f28478c94654/docs/verification/releases/v81/performance-summary.json)と原reportを併記する。

|1200pxでの処理中央値|v79|v81|
|---|---:|---:|
|捕手・異なる時刻へのseek|12.20ms|2.75ms|
|打者・異なる時刻へのseek|12.50ms|11.20ms|
|打者・同じ時刻の再描画|12.60ms|2.95ms|
|俯瞰・異なる時刻へのseek|11.50ms|2.10ms|

動くカメラでは背景cacheの効果が小さい。全画面のRAF内描画提出は準備区間約19.2→56.3回/秒、投球区間約20.3→44.7回/秒。旧版にあった球だけのRAFが新版では0で、各全描画は球・バットも同じ提出に含む。60FPSの全場面達成とは扱わない。

初回起動は追加のimmutable証明により増える。独立した全試合harnessの参考値は1630→2115ms、再試合の中央値533→214ms。メーカーの別試験は3026→4865msで、iframe所有copyのfreeze等も初回に必要。起動を高速化したとは主張しない。次の改善候補は、検証を減らさず初回証明を遅延/idle化する方式である。

GC後heapの同条件参考値はPC193→127MB、390px175→127MB。ただしブラウザheapはGC/保持参照/計測時点に依存し、一般的なメモリ削減率や実機値として保証しない。全試合生成wallは9回98.0→79.9秒、別seed3回20.3→16.9秒で、描画と同時負荷込み。Coreの物理演算単体の高速化とは異なる。

## 採用しなかったもの・残す課題

12軌道だけへの間引きは全フォーム選択・過去履歴・破損検出を損なうため不採用。初回の全グラフ検査やwarm時のProxy検査を削らない。RGBAスタンプ/大型Path一括化/Worker/GPU/分割配信は未採用。動くカメラの地面描画、試合履歴等の追加DOM更新、合成のさらなる省略は候補のまま。Canvas resetの意味や外部のフォント変更を失う省略は行わない。

原FAIL：基準試験の存在しない守備ボタン、coldcache追加試験のRED、CSSOMの同値表現/0サイズ、混在改行marker、短縮戦optionの誤仮定、旧Core hashを要求した移植試験のguardを保持。製品の画素差を許容したわけではなく、修正後の正本を索引で区別する。

恒久契約は[PERFORMANCE-STANDARD](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/1f2155fd4c7241ca627dca53d288f28478c94654/docs/performance/PERFORMANCE-STANDARD.md)。実機、100試合校正、Native公式認証、元の全計画、Charter独立承認HOLDは別の未完である。

配布provenanceの補足：既存65入力はGitの自動改行変換によりindexがLF、検証済みworking copyがCRLFだった。検証後のSourceを書き換えず、今回のcommitには検証時のバイト列をそのまま保存する。差は改行のみであることを機械照合した。134入力のindex/working copy/配布pinを完全一致させるためで、ロジックの変更ではない。

実装・HTMLの固定commit: `1f2155fd4c7241ca627dca53d288f28478c94654`。設計branchへの反映は文書のみ。
