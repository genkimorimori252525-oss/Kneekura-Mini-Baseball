# V190: 同じNative DBの別試合・別日から分類まで

2026-10-29 JST / MB-20261027-REALISM-DEBUG-PLAN Task5 SPIN-03。本人の既存Goal・実装再開指示の範囲で、V189の不足判定に続き、同一Native DBの独立した複数PA/複数日を既存分類器へ接続した。production modelの校正や実画面の完成には読み替えない。

新factoryは、同じ正式Core calendarのday10/11に生成された別gameIdの試合を登録する。各gameのinitial world・actor・pitch・outing IDだけを任意入力で分け、同じ選手・intake・body/calibration・正式career起点を共有する。3test-supportの末尾入力として追加し、従来の既定IDは維持した。V187のcalendar生成を再利用し、既定のday11ケースも維持する。

workloadは正規Ownerのinitializeが返す履歴再生後のcurrent revisionを使い、0へresetしない。この接触fixtureはbatted pendingであり、正式closureまで行わないため、実際の両headは0のままである。未精算の接触から課金activityを合成せず、calendar日数から物理tickや回復量も作らない。前game完了・連続ペナント・revision>0状態の再開・通常AI/自然cohortの証明ではない。

復旧はtest-supportの任意入力と新fixture/probeを戻す範囲で可能。production API・保存形式・依存・原物理計算・既存DB・本人入力は変更しない。

## 検証

- 新Native integration: RED `0a33d9e1c7fe497891abec97147e539f` FAIL13375msで、2nd gameが固定initial-world IDと衝突することを確認。constructor失敗時の既存connection残留によりTemp cleanupのEPERMも発生し、原FAILを保存した。任意identityの一貫伝播後、`91a2ff9f2ee9493da7096dc983de82ee` PASS8359ms。別gameId・同選手、2正式日付、別episode、真正Source/collector/classifier/projectionを確認した。
- 最終型: `a2a9130f354c438fad3b13cc9a652797` PASS9735ms。既存private incremental cacheを使用。
- 実Node最終: 新out02 `61717ce19127436c8da9fc8d04c503da` PASS1875ms。Native正式2試合の実contactを自動captureし、2032-02-28/29・career日424/425、2receipt/2episode、evidenceSpan1日、classifier READYを確認。原contactのvelocity/spin6値とfloat64 bitHash、正式game/play、原Source、最新inventory一致を照合した。
- 明示synthetic model（10°以上30°未満、割合.6）で実測角度は両方0°、fraction0となり、projectionは正しくABSENTへ解決した。ラベルを出すために閾値や接触を変えない。このmodelは校正値・production defaultではない。
- compiled read2回の全record一致・deep freeze/detach、caller q1/transaction・schema・total_changes不変、close後DB全files一致、Source870入力のload/終了SHA・bundle/helper/harness pin一致を確認した。私的DB・bundle・raw reportは外部非公開。
- 初回compiled `c613431f83cd43ca93bc44cdb683841b` FAIL2077msは、分類bindingのCore検証済みTraitTimeがday/season/sequence順であるのに、原Sourceのseason/day/sequence順との同表現比較を要求したもの。新out02は既存Core validatorが作る期待表現へ厳密比較し、別途の原Source/原contact/6値bit比較は維持した。Coreの表現や物理値を変更せず、原FAIL/DB/bundleを保存した。

独立の静的reviewで追加の具体的欠陥なし。旧成功unit/全League/キレgrid/設定監査は再実行していない。

## 未完

production校正・実表示consumer・現在career時計・同PA複数記録identity・全producer人口は引き続き未完。ラインドライブの名札だけを変えた実飛行全record対照、回転技術との分離、他SPIN/SIGN今回基盤・キレ・通常試合・同版HTML配送も全Goalの残件として保持する。
