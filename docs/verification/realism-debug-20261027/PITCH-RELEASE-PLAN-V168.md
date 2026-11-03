# V167候補判定 / V168名目release接続

Task `MB-20261027-REALISM-DEBUG-PLAN` / 全goal継続。3選択UI・自動profile生成・実技能認定は未完。

## 実装

`LivePitchReleasePlanV168.ts` と `LivePitchV1.ts` に、選択したV78球の基礎値を保持したまま1球の名目spin/qを渡すoptional経路を追加した。球ID・元speed/spin/q/seamの一致を確認し、球速/物性/空力係数は変更しない。名目値→既存の投球逆算→再現誤差→workload→同じSourceの順で実行する。`qualityState`は識別/診断だけで、物理倍率を持たない。null/省略は旧経路と追加診断なし。呼出元/保存snapshot/authoring履歴は不変。

これは開発側のauthor-plan seamであり、利用者へspin/q入力を要求するUIではない。planには実技能認定権限がなく、Sourceの診断も `skillAdmission:false` を明示する。

## 検証済み

- helper RED `6376bd9e` →新7件PASS `177f71b7`。有限値/上限/unit q・非identity q/-q保持、元入力/履歴不変、stale基礎値/球ID/unknownfield拒否。
- 実Owner RED `db4b1333` の名目Source未反映/誤差順/別球plan不拒否を実装で修正。最終新5件＋既存実行/位相/比較4filesの計24件PASS `4fa88b0a818f41d09e9027292048d723`（18.391秒）。明示V78物理入力controlと新planのSource厳密一致、再現誤差は計画後、null復帰、名前だけの物理/結果不変を確認。
- 全型 `0dfb373c545b44b3b8478e745c90b868` PASS28.406秒。Source追加による型検証で、済みの40/64/56条件の再計算は行っていない。
- 独立読取レビューで実反例なし。現版のnull/省略比較だけでは旧binary同値を証明しないという限定を採用し、下記のChrome受入へ進める。

launcherのworkers設定FAIL `ef16c280`、test import誤り `3e8c0d49`、function identityを比較したdb4b内の2誤期待、own-undefined fixtureのFAIL `60060942`も原receiptを保持。testは唯一の関数sampleBatAtTickを明示分離し、全serial dataと全frameの実sampleを比較する形へ修正した。丸めや物理差の無視は行わない。

## V167候補判定

`p90`増加を必須にする旧V165 gateは保持し、新V167ではp10増加・p90-p10短縮・late20増加を別条件とする。既存分類/量/方向/隣接時間差screenは維持。新11件PASS `1ce890eb`。保存56件/1540対/27720組/near311からmodelCandidate0、`e3c50e451c9848fa9212ecdfb8cd81a6` PASS686ms、新flight0。全判定は `kire-skill-candidate-v167-01/`。旧publicのSource不一致は `UNKNOWN_SOURCE_MISMATCH`、generic helperのbaselineは `NOT_EVALUATED`。候補不成立を3技能完成へ昇格しない。

## 同Chromeの受入

新Coreを `candidate-release-plan-native-v168-01`（213 inputs、entry b2aeef0d481dc930f7869b0e5ded016c49707ad75e527835e94f07bbc3999709）と `candidate-release-plan-workbench-v168-01`（190 inputs、entry a1398483a39711be84cb57db0289672947df5b9769c3dcf8fb6c89e7498c3712）へ別生成、`d0e62567` PASS。旧候補/共有dist/本人JSONは編集していない。

新validator `check-release-plan-v168.mjs` で同Chrome156.0.8078.48の8capture×6経路=48record、84項目を確認。`release-plan-v168-02/report.json`、`7bcb8edbab66429c93db3e7054e617f6` PASS16.703秒。新Coreの2target×Main/実Worker/JSON全serial、予定値と直接V78control、null復帰、IDだけ変更、stale拒否が成立した。旧V161は保存bundle/manifest bytesで認証して実際に実行し、同じ省略入力1fixtureの旧/新全record・関数一覧・161Source sampleを厳密一致。旧Sourceをcurrent pinと称していない。

Workbenchの保存inputへnullを明示した1field差はfull exact=falseのまま保持し、Live出力/残余全fieldの厳密同値と分けた。qualityState変更による保存input/診断のID差も保持した。値の丸めや広い除外は行っていない。

初回 `release-plan-v168-01` はcac890f9 FAIL7.046秒。新harnessがSource sampleのキー順を作り替えていたため原保存sampleとのstrict比較で失敗した。旧/新省略入力の全serial一致は初回でも成立したが、初回全体をPASSへ変更しない。schema検証を保持したまま実Coreの返値をそのまま保存する修正だけを行い、観測実装変更を理由に別out02で再実行した。production Source/ビルドは再変更していない。

## 次の一件と未完

3入力不成立のV166通常studyは引き続き未実行。通常試合/選手JSON/選択UI/全球種の受入は本検証で代替しない。3選択へ実入力を自動供給するprofile生成が次工程。従来の追加56条件はgyro30度固定だったため、次の計測前には未調査の軸方向と材料位相の組を限定し、既存データの再利用/新規件数/全gateを事前固定する。spin/q以外の係数や任意timerを加えない。

基準無指定と各設定の比較は必要だが、「全設定が未指定baselineより必ず改善する」は確認できた本人指示ではなく、追加の必須条件にしない。未指定は元入力の復元であり最弱段階へ置換しない。3設定間の量/時間形状と、基準からの副作用をそれぞれ報告する。約56cmの基準と約12cmの候補を、全球種の3技能へ一般適用したと表示しない。
