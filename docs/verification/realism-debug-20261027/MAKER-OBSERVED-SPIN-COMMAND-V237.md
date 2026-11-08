# 本人の一球SPIN試行をHost・メーカー・Workerへ配送

2026-10-30 JST。optionalな一球の明示試行を、通常Host、単球比較、連続練習へ接続した。**本人の実接触とMain／実Worker一致は確認したが、4技術の成立・習得・通常能力への採用・完成3HTML配送は未完。**

## 変更と利用範囲

Hostは現在打者とsubject IDをsimulate前に照合し、requestを一球のcommandとして保存する。選手の保存能力や継続configurationへ習得値を加えない。Practiceの厳密allowlistは当該keyだけを追加。preview非消費、保存再開、unknown key拒否、旧省略recordを保持した。

メーカーは正常rosterの本人・左右・保存clipとSHAから試行を構成し、単球比較と連続練習へ渡す。詳細欄は未校正の診断用であり、数値を指定するだけで技術を習得するUIではない。最終的な通常能力の操作としては未採用。

7 tests `806b8f1347ca4bc3895f0df2ce4e2bcd` PASS13,375ms、strict `c90e6669691948cda25180c9db39db87` PASS2,562ms。Node worker thread比較は実browser Workerと区別した。private baselineがないcheckoutでは互換比較1件を明示skipし、通常6件はそのbaselineに依存しない。

SolのHost／Practice独立レビュー、RootのUIレビューと既存4Sourceへの実逆patchで、開始worktree全bytesへの復元を確認した。comparisonのGit親と開始worktreeは異なり、Practice CoreはGit親に存在しない既存Sourceだったため別々に保存した。他者の既存差分を消していない。

## 本人JSONの実経路

原JSON 59,857B／SHA `e0123a572d66bf6bd5fa92af6c9ffbe6fe47fbcf27d00135c9441bf95927b3ce`を正常Maker import、validate／materialize、roster経由で使用した。実対象は`1-b0 / L / obp-23_5`。トップ階層のpreview用`obp-103_5`で代用せず、673 clips／92,201 framesを維持した。

Chrome `156.0.8078.49`、同Native／Workbench／実Worker codeと時間刻みで検証。初球を通常warmupとして一度だけ進め、その直後のfull captureを共通にして第2球を無指定と4つの固定XY probeで比較した。同一投球の分岐対照であり、独立した資格4試行ではない。seed探索や成功用の再調整は行っていない。

| 明示名 | LIVE_WORLD delta（m） | 実接触 | 局所回転basisの観測 |
| --- | --- | --- | --- |
| 無指定 | なし | あり | 基準 |
| BACKSPIN | x=0, y=+0.01 | あり | 要求とは逆方向 |
| TOPSPIN | x=0, y=-0.01 | あり | 要求方向の成分が正 |
| SLICE | x=+0.01, y=0 | あり | 要求方向の成分が正 |
| HOOK | x=-0.01, y=0 | あり | 要求とは逆方向 |

深度差は0とし、本人の正常contact planeを使用した。全5ケースでMain対実browser Workerの全record／continuation、preview非消費、同capture restoreが一致した。4試行はAPPLIED、earned=falseで、spinは全て無指定と異なった。接触exit velocity／spinから通常のoutgoing moment／fieldへ渡ることを記録した。全飛行・全裁定の受入には拡大しない。回転分類は観測であり、結果の回転を補正する処理ではない。

## FAILと残りだけの検証

最初の実run `adfdd374ba9f40698011636807622ed6`は**FAIL**107,219msのまま保持する。5ケース完了後、比較UIの`getInput()`がpitch自体を返すのに検証側が`.pitch`を参照し、105行で失敗した。page errors／外部requestsは0、Source／HTML／原JSON終了pinは一致。

log SHA `371d4a8cc40bd45d5ee6e3122998118d21c24401d579784f5189cd81cc8a4650`、report SHA `407c09e4157fdfa645195dc8976e418e7425e661ca9df7d8d976db3b6782648d`。元checker全文と5ケース／request／captureを保存。旧receiptはケース個別hashを含まないため、後から取得したhashは「現時点の固定値」であり元run時のhash証明ではない。

形の誤読だけを修正し、未完部分のtail `adaae87828714795836550e3c4336a40` PASS14,608ms。連続練習5ケースを再演せず、正常import／保存capture restoreから比較UI4弾道・request配送・preview非消費・roster／pins・幅を検証した。旧FAILをPASSへ変換していない。

tailのbounds検査は通ったが、Root実画像で390pxの入力幅が304／30／304／30pxと判明し、可読性は受入を保留した。新欄だけを1列にする44Bのstyleを追加。他のHTML全bytesと両Core bundleが同一であることを証明した。

可読性だけの `6ca728fe0bd24a44ae4053b01cb243b5` PASS6,844ms。投球・比較計算は再演0。1200pxで全入力1,126px、390pxで全入力340px、ラベル横書きとSource／HTML／原JSON終了pinsを確認。Rootは両スクリーンショットを目視し、入力値とラベルが読めることを確認した。

readability log SHA `4c9f9c879663b743785e46e6cb5a515655578cab540a458ff5c898210c0d36b5`、report SHA `acb0e96a325e663ea9b7237b1e72501d7aa58c3773196bd4bce44519fe351689`。tail log SHA `431e1974e91db17b6057d9b6c187173f8bbd2d3e7b604a51790000aff1c78373`。

現candidate-03 HTML SHA `5cff8ed91285ed78e1130200409bd713a9965fbcd0b61c779cc492553b29c6b7`、Native `01f748b90e6418273f6c1ff73a433923b4cad0f30de13418ca20755757d82fdb`、Workbench `157eacbc6e6bfb8d31e20934cff8662a3ec6a972c5465ad7532bc67c0ff41056`。旧Workbenchとの互換を仮定せず新stampで受入した。候補・full case・原JSONはprivate workに保持し、最終版配送とは扱わない。

## 通常能力への採用保留と次の一手

実Sourceのraw-aim試行は、XY差分だけでなく通常のnominal位置、心理priorを含む時刻、late correctionも変更し得る。観測した差をXYだけの効果とは断定できない。Astraの新actual根拠レビューは、明示試行限定Readyを維持しつつ通常能力への採用をHOLDとした。

次は通常planを保つversion付きXY合成。差分0で通常運動／clock／RNG／late correctionを一致させ、方向指示・AUTO・心理prior／認知biasを保持する。深度・時刻は変更せず、誤差は一度だけ、合成後の速度・latency制約を維持する。4技術の通常適用、資格・自然Gold、Native時計HOLD、全弾道／裁定、最新3HTML／性能／配送は残る。
