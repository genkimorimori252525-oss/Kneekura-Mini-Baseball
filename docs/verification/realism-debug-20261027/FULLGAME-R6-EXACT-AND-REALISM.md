# 同一 Core の全試合再現と現実性の課題

2026-10-31。通常試合 r6 Native `b664cc5c3b3a9146b1f19107ccd8a30600d3df6bd08e9228693ad8a577d589aa`、Chrome 156.0.8078.76、固定seed `TBD-LAD-2025`、９回・既定ルール、打撃／球種／コース `auto`、走塁 `balanced`、authored SI 設定20名・673 clip。表示のリアルタイム再生を待たず、Main Hostと実Blob Workerを１球ずつ同じcommandで進めた。

477球の全recordとcontinuationが各球lossless一致し、正常Ownerは９回表３アウトで終了（home がリードし９回裏なし）。receipt `ef834df3ad2f4c9498f8571afa6b2a96` PASS、検証全体の経過 `786.766秒`、report SHA-256 `2cd2afb07cb449321e4ee59d58ad88ca420173df9417efc33d90f40e4fa5129c`。479 artifacts約1.034GB、うち477球packetを保存し、終了pin一致。逐次 progress は最終球時点の `RUNNING` のままなので、正式な終了状態は `report.json` と runner receipt で判定する。経過時間はこの固定１試合、Main/Worker両方と詳細記録・保存を含む値であり、他条件の速度やリアルタイム比の主張ではない。

## 再現性と試合内容を区別

結果は **away 33–home 50**。保存477球のread-only監査 `90585d8e5adf49fb8a96a2340a4914dd` PASSでは、155打席、142打数92安打（単打51・二塁打17・三塁打２・本塁打22）、四球13、三振13。scoreの増分は保存された scorer 数と一致し、同一play内の scorer 重複や最終イニング別合計との不一致は見つからなかった。これは記録の内部整合であり、各塁・接触・守備の物理や得点裁定の独立した正しさは証明しない。


追加の保存値分析: 160スイング中157接触・３空振り。見送り317球は called_strike／zone witness hit が88、ball／witness記録なしが229で各球の対応が一致。スイング時のzone witnessは評価されておらず、内外の割合はUNKNOWN。本塁打22件の打球初速中央値は53.43 m/s、単打51件は48.59 m/s。これらは１試合の内部記録で、特定処理が原因だと結論しない。訂正後の保存値分析 `87a9b586231e48f29cd269fbbe53873e`・各球のcall/witness照合 `fe9cfcc21bff42d194fe0c086fc2446f` PASS。見送りwitnessを初回に誤ラベルした `879bad7a85fb4253b91a2e9135c32bc6` も保持。

固定１試合ながら、この得点・安打数は現実性に重大な懸念がある。決定的に同じ結果を再現できたことを、打者心理・投球・接触・守備の現実性の受入に使わない。後続では保存済みrecordから各段階を分解し、原因を根拠なしに決めたり、seed・成功基準を結果に合わせて変更したりしない。原因調査中・GoalはACTIVE。

初回 `bac1181afb8242d0ada1b11ab8d405d7` はWorkerが初球要求まで遅延起動するのに前もってinitを待ち、０球で timeout した FAIL。修正後の今回の結果へ置き換えず保持。旧V133９回の結果は今回へ転用していない。４回転、元球種を保つキレ物理、旧保存の新build互換、完成３HTML配送・性能受入は未完。

## 時間の内訳は先頭12球だけ

全試合結果には工程別時間が記録されていなかった。そこで同じr6・Chrome・保存済みcommandの先頭12球を別途計測し、Main／実Worker相互と元保存のrecord・continuationは全てexact。receipt `1d5d52abd6464721a1a9fbadf8832ee5` PASS、経過63.686秒、report SHA-256 `22a417dd902c6948187e8c4254867528f93d2386342ac106fd4236d137b92fde`、13 artifactsとendpinsを照合。Main issue合計33.611秒（最大１球21.419秒）、Worker待機合計5.634秒、page往復40.756秒はMain/Worker/符号化/転送を含む。計測範囲は重複し、計測自体の負荷も含むので単純合算せず、12球だけの値を全試合速度や改善率へ拡張しない。遅かった球の処理内容は別途調査する。

計測手順の旧checker SHA `1929d3f1…` は、保存コピーのhashが一致せず元bytesを特定できなかった。旧Source全文の保全は UNKNOWN として保持し、復元・逆変換の成功を主張しない。新checkerは新hashの独立reviewと実測を行った。

## 保存済み６球目のCPU観測

先頭12球で遅かった６球目を、５球目の保存continuationと同じ設定・commandから、同じr6とChrome 156.0.8078.76のMain Hostで１球だけ再現した。元の６球目record・continuationとlossless一致、入力および出力pin一致、receipt `1d7d76019e844332a83b02732cbddf6a` PASS、report SHA-256 `e7d67430ce1443ebb73b2a4a5bd5527b23c4fed12225c5a73f88a467d46eb405`。CDP CPU profiler付きissue時間21.102秒、runner全体47.125秒、14,364 samples。Workerや全試合の計測ではなく、計測負荷を含む。

保存profileのleaf samplesでは `calculateOwnedBaseballFlightDerivativesV120` の一つのnodeが2,327 samples（16.20%）、garbage collectorが1,242（8.65%）。同名nodeは複数あり、node別値を関数全体の割合としない。保存された呼び出しstackのうち、飛行微分の2,830 samplesは `planLiveThrowActionV103` → `planLiveThrowV1` → `memoizeLiveThrowPhysicalV113` 等の経路で観測された。sample countは統計的なCPU観測で、厳密な処理時間、原因の断定、改善率ではない。今回、性能修正は行っていない。利用上限によりこのcheckerの独立モデルreviewは未実施であり、主担当が入力pin・exact条件・既存fixtureを確認した。

## 先頭12球の打撃観測

同一r6／Chrome 156.0.8078.76・Main Hostを使い、元記録に固定された先頭12球について、乱数traceのみのbaselineと打撃観測ありの各variantを比較した。各球で旧Main record／continuationとlossless一致、両variantのrecord／continuationおよび対象 `DeterministicRng` の累積trace一致。receipt `0aab08049339400bb51df35fd68ae1b8` PASS、104.500秒、report SHA-256 `a714fc01d0f9545e89a940eeb77209d3d99e9648cc6d099450b2110a644cb915`、24 artifacts・endpinsを照合。traceは12球時点で生成115・draw97件。旧Worker recordとは保存値を照合したもので、今回Workerを再実行した証拠ではない。旧未保存drawや他の乱数源の完全一致はUNKNOWN。

12球は８見送り・４live ball接触で、この範囲に空振りはない。４接触のいずれも探索でhitし接触resolverが結果を返した。判定時刻は12球ともreleaseから0.14秒で、既存予測を取得した。予測値は接触時の実値ではなく、予測の平面と実接触深度も一致しないため、両時刻の差を到達予測誤差としては使わない。探索のgapは評価sampleの最小だけで、未評価区間の連続最短距離はUNKNOWN。12球・４接触だけでは全試合の高接触率の原因や人間の予測精度の校正を決められない。観測した値を選択や物理に戻す変更は行っていない。

実行前Astra reviewはconfig／protocol／codec pinと失敗時snapshot不足を指摘し、Terra修正後の再reviewで限定実行可。修正checkerのfixture／構文検査はagent報告のPASSで、receiptは未保存。合成変換の初回FAIL `94a116c059534b448daa79f00059a997` は保持。
