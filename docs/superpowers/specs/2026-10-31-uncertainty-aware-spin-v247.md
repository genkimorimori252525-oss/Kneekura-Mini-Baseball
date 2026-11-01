# 事前に分かる運動誤差幅を考慮する回転試行

2026-10-31 JST / MB-20261027-REALISM-DEBUG-PLAN。SLICE同一投球では三次予測で位置誤差43.989→3.188mmに改善した一方、通常bat配置と実接触面が変化し、実slice +197.464→−101.619 rad/sとなった。未知spin0／V153投影／運動誤差の単独寄与は未確定。実際の誤差drawや未来結果から同球の候補を選び直さず、事前に選手に与えられた誤差幅と配達済み予測だけを用いる新しい明示実験を試す。旧V244/defaultと全Goalの受入は維持。

## 事前固定する候補評価

- 既存V243で凍結したnormal frameと有限25候補を使い、名目条件の元の要求正成分・改善の最低条件を満たす候補だけを候補とする。候補deltaはscenarioを通じて固定、正常normalも各候補も同じscenarioで比較する。未達/未解決候補を勝手に成功へ換算しない。
- 誤差4軸はtiming・aim x/y/z。実行経路のmode/zone/course/認識倍率と z×0.3 を含む**事前に決まる**各標準偏差を使う。実draw、未来球、実contact/spin/判定は入力禁止。rosterの値は作者のゲーム設定であり人間の測定値とは称しない。
- scenarioは9点で固定: 中心重み1/3、各軸の±√6σに各1/12。各軸の平均0・分散σ²となる有限点の近似であり、成功確率・分布全域の保証ではない。軸間の同時ずれは網羅しない。weights/順序/数は技術・seed・結果で変えない。
- 各scenarioを既存normalと同じreference再生成・latency・speed/acceleration制約、同Source接触探索とwood応答で予測する。接触不能、要求方向不成立、改善不足は失敗として同じ分母に残す。未確定や計算予算不足はMISSに変えずUNRESOLVEDと記録、途中までの得点で選ばない。
- 既存基準に基づく成功scenarioの重みを第一順位、重み付き方向成分・改善を後順位、同値なら小さい変位norm→固定ordinal。少数の極端なspinで多数のMISSを相殺しない。候補なしは理由付きNO_TARGET、未確定はUNRESOLVEDと区別し通常fallbackする。これは有限scenario上の評価でありNative/earned資格ではない。
- 同一normal/scenarioの予測を候補間で一度だけ共有し、25×scenario×contact探索回数を正確に記録する。評価上限は事前固定し、予算超過は選択を保留。最初は純粋planner/実Core adapterとして実装し、UIへ能力を捏造して表示しない。

## 検証と残り

固定scenarioの平均/分散/重み、実drawを変えても選択不変、同じscenarioに対するnormal/trial比較、missing/逆符号/MISS/UNRESOLVEDと全分母、同点の決定性、物理速度・加速度上限/原held/clockを検証。0標準偏差のケースは同じ物理条件の再評価と明示する。Runtime負荷は同じfixture・同じ全検査で計測し、部分評価の省略で高速化を主張しない。

実Source・実球との比較は別単位。同本人固定2回/別の事前宣言ケース/4技術すべての実接触・回転・空力を評価し、旧失敗と2/2の条件を残す。有限scenarioでの結果を自然な習得・全誤差への保証・Gold・最終配送に昇格しない。

## 実行と予測で共有する境界

既存V243登録だけではLiveの開始時刻・latency clamp・preparation・rate saturationの元入力が足りず、startTick±誤差の近似を実運動と称せない。Sol read-only調査の最小共有単位はLivePitchのlate補正前の実行再構築: 名目arrival＋technical offset＋渡されたtiming誤差、referenceElapsedSecondsによる逆clock、decision/latency/preparation clamp、元frame/回転/normal中心＋固定δ＋渡されたaim誤差、既存reference生成とsaturation、held/回復/contact tick・速度加速度証明の更新。新integration側純粋helperを実側とscenario側で共用する。

helperの名目recipeにはorigin/tps/decisionTick/名目arrival、technical offset、latency、選択済rate/ramp、元frames/provenance、bat寸法、名目sweetSpotT、選択済normal rotation/center、contact Source tick、world-held envelope、impact trajectory、既存speed/acceleration limits、start-mode flagsを含める。実sampleは別引数。recipeへ実際のdesiredContactTime/実start/rate/aimError、乱数値/seed、actual kernel/contact/未来結果を入れない。plannerには事前σから固定生成したscenarioと名目sweetSpotTだけを渡し、実側だけ実drawを後渡し。乱数sweetSpotのばらつきはこの9点では未包含と診断する。

実打撃では後続のlate観測と既存実行制約を従来どおり適用する。最初cutoffのscenario予測へ後の観測を先に渡さず、late作用まで予測保証したとしない。初期の明示実験で特定domainしか適用できない場合は理由付き未評価とし、他domainを永久除外せず全Goalの未完として残す。default分岐は旧算術のまま保持し、同一入力のzero/fullrecord/clock/RNGの比較と逆差分証拠を要求する。

## 既存Live／反復練習への明示接続

旧V239／V244の保存形式を変更せず、新 `live_robust_contact_frame_motor_v248` と `live_observed_robust_contact_frame_trial_v248` をV242 episode限定で厳密dispatchする。新motorは旧V244のsubject/clip/domain/technique/threshold/provenance/trainingに加え `finite_sigma_v247` policyと事前budgetを持つ。最大call数は候補25＋9×（normal1＋候補25）=259、最大gap標本予約は259×既存per-search上限4096であり、事例の成功に合わせた緩和値ではない。未校正diagnostic・earned/native false。

Host/Liveは未指定の旧literal分岐とrecord/JSON/RNG/clockを保持。新trialだけ同じnormal registration・caller認証なしの明示practiceからV247を呼ぶ。実行で使うtiming/aimのσは既存 `timingStdSeconds`／`aimStdMeters` とmode/zone/course/認識の事前に得た倍率から導出し、aim zは既存の0.3倍率。実random sampleやactual sweetSpotTはplannerへ渡さない。normalとcandidateには同じscenario、選択deltaは最初に固定しactual executionのrate saturationで再選択しない。

新診断は名目recipe／σ／各scenarioの未解決・不成立・予算・未校正・lateとsweetSpot variationの未包含を保持する。NO_TARGETは通常動作へ戻りその結果を記録するが、UNRESOLVEDは成功/MISSに変換せず同じ機会を未確定として保持する。既存V242 Ownerのcapture/replay／全分母に明示的に通し、未来実contactが見えてからの採否変更を禁止。UI既定化や得能認定の前に同Source/Main実Workerの連続ケースと実spin/空力を検証する。
