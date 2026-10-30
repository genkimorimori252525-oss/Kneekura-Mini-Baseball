# 同一 Core の全試合再現と現実性の課題

2026-10-31。通常試合 r6 Native `b664cc5c3b3a9146b1f19107ccd8a30600d3df6bd08e9228693ad8a577d589aa`、Chrome 156.0.8078.76、固定seed `TBD-LAD-2025`、９回・既定ルール、打撃／球種／コース `auto`、走塁 `balanced`、authored SI 設定20名・673 clip。表示のリアルタイム再生を待たず、Main Hostと実Blob Workerを１球ずつ同じcommandで進めた。

477球の全recordとcontinuationが各球lossless一致し、正常Ownerは９回表３アウトで終了（home がリードし９回裏なし）。receipt `ef834df3ad2f4c9498f8571afa6b2a96` PASS、検証全体の経過 `786.766秒`、report SHA-256 `2cd2afb07cb449321e4ee59d58ad88ca420173df9417efc33d90f40e4fa5129c`。479 artifacts約1.034GB、うち477球packetを保存し、終了pin一致。逐次 progress は最終球時点の `RUNNING` のままなので、正式な終了状態は `report.json` と runner receipt で判定する。経過時間はこの固定１試合、Main/Worker両方と詳細記録・保存を含む値であり、他条件の速度やリアルタイム比の主張ではない。

## 再現性と試合内容を区別

結果は **away 33–home 50**。保存477球のread-only監査 `90585d8e5adf49fb8a96a2340a4914dd` PASSでは、155打席、142打数92安打（単打51・二塁打17・三塁打２・本塁打22）、四球13、三振13。scoreの増分は保存された scorer 数と一致し、同一play内の scorer 重複や最終イニング別合計との不一致は見つからなかった。これは記録の内部整合であり、各塁・接触・守備の物理や得点裁定の独立した正しさは証明しない。


追加の保存値分析: 160スイング中157接触・３空振り。見送り317球は called_strike／zone witness hit が88、ball／witness記録なしが229で各球の対応が一致。スイング時のzone witnessは評価されておらず、内外の割合はUNKNOWN。本塁打22件の打球初速中央値は53.43 m/s、単打51件は48.59 m/s。これらは１試合の内部記録で、特定処理が原因だと結論しない。訂正後の保存値分析 `87a9b586231e48f29cd269fbbe53873e`・各球のcall/witness照合 `fe9cfcc21bff42d194fe0c086fc2446f` PASS。見送りwitnessを初回に誤ラベルした `879bad7a85fb4253b91a2e9135c32bc6` も保持。

固定１試合ながら、この得点・安打数は現実性に重大な懸念がある。決定的に同じ結果を再現できたことを、打者心理・投球・接触・守備の現実性の受入に使わない。後続では保存済みrecordから各段階を分解し、原因を根拠なしに決めたり、seed・成功基準を結果に合わせて変更したりしない。原因調査中・GoalはACTIVE。

初回 `bac1181afb8242d0ada1b11ab8d405d7` はWorkerが初球要求まで遅延起動するのに前もってinitを待ち、０球で timeout した FAIL。修正後の今回の結果へ置き換えず保持。旧V133９回の結果は今回へ転用していない。４回転、元球種を保つキレ物理、旧保存の新build互換、完成３HTML配送・性能受入は未完。
