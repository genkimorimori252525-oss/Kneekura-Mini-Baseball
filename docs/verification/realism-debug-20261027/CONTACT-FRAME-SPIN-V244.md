# 接触面を使う回転の試行

2026-10-30 JST / MB-20261027-REALISM-DEBUG-PLAN。Goal ACTIVE。

配達済みの球の予測と元バット運動から接触面を見積もり、事前固定された有限候補を既存の接触・摩擦Coreで予測する。候補が見つかった場合に限り、選択した接線方向の運動を通常のスイングへ適用する。旧XY方式と無指定時は保持。入射spinは予測上の0仮定であり、本人の観測値でも習得資格でもない。

本人1-b0／左／obp-23_5、HOOK、固定seed20261102/20261103、2回、SWING／方向AUTO、必要成功率100%を事前固定した新Chrome156.0.8078.76検証 fd58bde5 FAIL254.843s。両回フェアで通常打席が終了、Main／実BlobWorkerの全記録とcapture、保存再開、終了後通常投球と再開は一致、11artifactと入力・終了pinsを確認した。

1回目は実接触のHOOK成分がnormal −55.027455→trial +233.499229 rad/sで、当該診断基準に成功。2回目は予測25候補すべての要求方向成分が負でNO_TARGET、通常打撃へ戻りフェア接触。最良の予測は−205.306660 rad/sであり実測ではない。全2回中成功1回、UNAVAILABLE／CRITERION_NOT_MET。候補なしの接触も実recordとして残し、技術成功には数えない。閾値変更・seed探索・未来実球からの再選択はしていない。4技術・習得・Gold・配送は未完。

実行時に速度制限が働いた場合も事前選択した変位を保持し、名目rateと実行rateを区別する。名目予測の適合を実行条件の証明には昇格しない。旧Sourceにおける保存本人同球Node contact991fc8f3 PASSは1機会で、今回の2回に別の成功を加算しない。

検証上の履歴: 初回d44b4ee5はChrome更新49→76による実練習前の版不一致FAIL。旧checker ca68429bは2回目にbrowser/pageが閉じ、report保存後のidle owned Nodeを明示終了したFAIL。原因は不明。新checkerは記録の完全比較をBrowser内へ移し大きなgraphの往復を減らして全検査を完走したが、条件付きの1回であり試合全体性能の改善とは扱わない。FAIL/TIMEOUT/UNKNOWNを消さない。

390px画面で英字reasonの右はみ出しが発見され、理由を日本語、nullを未評価へ修正。UI seam 953c4561 PASS。保存sidecar表示専用Chrome390pxはa95f441c PASS、横はみ出しなし。既存3HTML最終配送とは別。

## 事前固定した他技術の結果

- TOPSPIN seed20261031/32: 082b77f3 FAIL409.812s。両回とも実接触・フェア、Main／Worker全記録・再開／通常tailは一致。1回目はnormal +521.876→actual −649.814 rad/sで要求と逆、2回目は−280.990→+20.533で基準成功。全分母1/2の未成立。11artifactとreceipt/logの実SHA照合済み。
- BACKSPIN seed20261030/31: 1e7fe54d FAIL460.765s。1回目はnormal −77.503→actual +266.033 rad/sで基準成功、2回目の評価球は未接触。その後打席を通常どおり終了し、Main／Worker全記録・再開／通常tailは一致。全分母1/2の未成立。13artifactとreceipt/logの実SHA照合済み。

いずれも固定入力・元の成功条件であり、成功seed探索や結果補正は行っていない。スライスは別固定組で実行した。複数technique間で重なるseedを使ったため、異なる技術間の機会を独立試行として合算しない。

- SLICE seed20261101/02: c1c9a058 PASS198.514s。両回PLANNED・実接触・フェアで通常PA終了。要求方向成分はnormal 81.925→actual 197.464、normal 55.027→actual 223.700 rad/s。2/2が事前固定した未校正の診断条件を満たした。Main／実Worker全記録・保存再開・通常tailも一致し、11artifact／開始終了pins／receipt/logを照合。Chrome390px画像も目視確認。これは本人1clipの局所診断であり、Native資格・自然習得・Goldではない。

## 保存済み結果からの原因切り分け

同じseed20261031のTOP試行では、実接触時点における配達済みforecastの予測位置と実球位置が約41.9mm異なる。実入射spinは0ではなく、時間・狙い誤差、接触法線も予測と異なるため、単一原因への帰属はできない。

TOPのnormalとtrialの生exitSpinベクトル差は約11.44 rad/s。一方、打球方向の違いによって飛行座標系が大きく変わり、各打球の実際の飛行基準で評価するTOP成分は+521.876→−649.814 rad/sとなった。同じnormal軸への投影は521.876→522.467であり、これは原因診断用で現行の成立判定を変更しない。正しい飛行基準での未達を保持する。

選択された1候補の予測contact tick／normal／ball center／衝撃量／予測exit velocity・spin等をV244診断へ追加。plannerに存在しないslipベクトルや入射速度は捏造せず、25候補に原framesを重複保存しない。予測は配達済み情報由来、actual未来や実結果を同球の選択へ戻さない。保存済本人HOOKの新diagnostic＋Owner全再生3ce1e649 PASS、NO_TARGET通常物理と旧V238回帰も維持。4技術の上記Browser結果はdiagnostic追加前のLivePitch af98dd63であり、新SourceのBrowser結果へ付け替えない。

GitHubに載せるのは本単位の明示対象だけ。V244のBrowser検証時の作業bench bundle Source依存211件のうち、73件は当時のHEAD 3596e62で未追跡（新Sourceを含む）であり、部分公開を完全な再現環境や最終配送とは扱わない。無関係な作業ファイルを一括stageしない。

## 保存済みTOP一投の詳細診断

同Chrome156.0.8078.76・同Coreで保存済みTOP第1球のnormal/trialを各1回再計算した3d8579a6 PASS19.030s。normal record全文、trial recordのselectedPrediction追加以外、両continuationは完全一致。予測接触tick 1512281.0225におけるforecast位置と実球位置は約42.2mm、実接触tick 1511330では約41.9mm異なった。予測と実接触では法線・接線相対速度も異なり、入力spin0仮定、時刻、位置・姿勢差の単一原因は未確定。選択への未来実球入力はない。旧4技術結果に新たな独立試行を加算しない。計測19.030秒はこの一球の二つの診断armと準備等の時間であり、試合全体の性能値ではない。

新しい3検証scriptで端末固有の入力パス文字列を環境変数 `MAKER_PLAYER_JSON_PATH` へ変更。未指定時は出力先を作る前に停止する。最新Sourceから固有パス文字列を外したが、過去コミット4637913には当時の文字列が残る。Git履歴の強制書換えは行っていない。入力JSON本文・実case・生成HTMLは公開していない。
