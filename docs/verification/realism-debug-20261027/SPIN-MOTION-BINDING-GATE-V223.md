# TOPSPIN選択と実運動の接続不足

2026-10-30 JST。保存済み資格・元接触を再利用して、TOPSPINを選んだ場合に技術別の運動が作られるかを確認した。**資格は正規再認証できたが、TOPSPINと無指定の運動計画・commitmentは一致した。** 重い新接触や練習の再生成は開始しない。

## 実証した範囲

実receipt `f74e5e2f7db84e6ab20c63df1b10b7bf` PASS7391ms。現行の正常Readerで同Actor、BACKSPIN / TOPSPINの真正資格2件、各資格の元3接触（計6件）、元input / repertoireを同snapshotで再認証した。元DBとbaselineは開かず、FS pin後の新paired copyだけをreadonly / query_onlyで読んだ。全rowid / schema / heads / data、caller / authorizer、Source / bundle / retained artifactsの開始終了pinsを保持した。

同じ正規input / spin contextから行ったpureなTOP仮定では、TOPSPINと正しいqualification referenceが選択されfallbackはnullだった。無指定側はNO_TARGET。しかしfull plan motionとcommitmentがstrict equalのため、gateは正常に `UNAVAILABLE / NO_MOTOR_DISTINCTION` を返した。TOPのNative受理や成功制御の証拠にはしない。

2資格のmotorProfileRefsはともに `explicit-test-course/v1`、元6contactのmotorBindingV133は全て無し。repertoireも1 profileでsampledProfilesは無い。元練習の成功motion自体は正常DTOから露出せず、`MOTION_EVIDENCE_NOT_EXPOSED`とした。raw SQLから読んだplanを正常DTOと偽装して補っていない。

元V193のsuffix TIMEOUT `f7d6a03c90074cd48a7addc2f0988ef4` とendpins UNKNOWNは保持する。newNativeWrites / regeneratedContactsは0、nativeTopAdmissionProven / performancePassはfalse。

## Sourceと検証

新3 tests `246a5276`、focused strict `af7cbc2d`、構文 `97504d06` PASS。未実装RED `5a70cd26`とtest union narrowingの型FAIL `4b02147e`を保存した。Solの独立静的reviewは、純比較とNative採用の分離・正常lookup・readonly・Source例外・未決の保持を確認した。

| Source | SHA-256 |
| --- | --- |
| entry | `2b34234add67110f8f95df76089ea6fab1e1599db6ad8bcdfb06b3d5f9247bbb` |
| test | `8a8bdc15dc7e09139cd779612d413eb500413a1eea6bf7ce61a41c7b6e838b39` |
| driver | `9aa23ef148fe1b8354c9441523d70db6d95e59324d841f96ac54ffb3cb2c2bc4` |

旧recovery792 Sourceの791は一致。唯一Lifecycle Readerの旧`94f241…`→現`f6b46a…`は、既存V202 identity batchの実比較・後続V220の実receiptとmanifest pinを列挙して限定再認証した。旧bundleは実行せず旧artifactのまま保持する。他DB / 全条件の包括互換や、workspace pinsの一括例外を作っていない。

## 次の利用機能へ進める境界

元`command.plan`にはTOP / BACKの技術別目標差が保存されているが、旧contact DTO → mastery motorProfileRefs → consumerの間で目標の通路が無い。V133 measured bindingはsampledProfiles用であり、course目標を後付けする型ではない。

次は旧DTO / mastery hashを変えない別versionのread-only motor evidenceを導入し、元plan / delivery / model / repertoire / equipment / 実装family / 時刻・座標を正規再認証する。新Owner sidecarを設ける場合も、同setupの適用域とclock移替えを明示し、未補正の事前anchorが原本に結び付くときだけ相対変換を認める。実contactからの逆算、技術名から新しい±.02を補うこと、任意の次球へ一般化することは禁止。

4技術共通の契約を目指すが、BACK / TOPの証拠をSLICE / HOOKへ転用しない。適用域や事前anchorが無ければ不足を明示し、新しい条件のpracticeが本当に必要か判断する。過去と同じ練習を理由なく再実行しない。全SPIN4・自然Gold・球種認識・最終配送は未完として保持する。
