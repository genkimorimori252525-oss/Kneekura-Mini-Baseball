# V191: 実測レポートの純表示と名称変更の対照

2026-10-29 JST / MB-20261027-REALISM-DEBUG-PLAN Task5 SPIN-03。本人のラインドライブ計画・実装再開指示に基づき、Native分類結果から小さな表示用reportを生成し、メーカーの読み取り専用欄へ接続した。能力値・技能Source・物理入力・選手JSONへは流さない。

## 実装と判断

`ContactDescriptorReportV191`はcreate/read/表示名変更の3 APIを持つ。scope/source・観測時点・件数・判定結果・不足理由・model参照を保持し、raw観測全件を複製しない。固定schemaと対象scopeを検証し、出力はdeep frozen/detached。`physicsEffects=NONE`、`modelAuthority=EXPLICIT_CALLER_MODEL`、`modelCalibration=UNCONFIRMED`を固定する。判定基準のproduction校正をこのAPIが保証することはない。

メーカーV94のsetterループ外に「保存された試合の打球傾向」を追加した。対象career/playerと通算日の観測時点、件数、校正前の参考判定または未評価理由を表示する。JSONファイル読込・表示を閉じる操作とset/get APIを持つ。編集・練習の選手と自動同一視せず、report自身の対象情報を表示する。通常の選手保存stateとSource exportへreportを混ぜない。

既存builderは任意の`--contact-report=PATH`で、同じVM realmのvalidatorを通したreportをJSON注入する。`<`をescapeし、UIはtextContentを使う。指定がない従来buildも維持する。表示の新version追加で、既存の選手形式・Native保存形式・依存は変更しない。復旧は新reportと表示接続を外す範囲で可能で、原DB・既存観測receiptを削除しない。

## 検証

- Pure report: module欠落RED `fae3c2ab`→`782b59d3fe55422b9b53922411d53d84` PASS36件。モデルなし、不足、PRESENT/ABSENT、scope/source不整合、不正値、名称だけの変更、8,000観測から小片だけの生成を確認した。
- 最終型: `9eb100a0ae894efd95e1d523c87a0c08` PASS6421ms。private incremental cacheを使用した。
- Native: `8416c0e5d29241c0b3000dfcb496dadc` PASS2063ms。真正2接触のV189結果→実report→実表示名変更と、normal Original/current continuous aero-ground flightの正規2読取を接続した。表示名以外のreport全factsと、接触・飛行の全契約recordが厳密一致。原6float64 bits・seed・physics・caller q1/transaction/savepoint/authorizer・catalog・DB全files・872 Source load/終了SHAとbundle/helper/harness pinも一致した。
- Native flightの検索horizonは2秒だが、保存契約は初期ballと最初のground incomingの2state。最初の接地は開始から0.554638秒。全飛行終端・停止までの実証は未完であり、この範囲を密な2秒trajectoryと呼ばない。
- Chrome最終: 新out08 `2deeb706b7b14e7da7d1fe7ffb0e7e80` PASS14391ms、Chrome156.0.8078.49、1200px/390px。report注入・実ファイル読込・閉じる・モデル未設定/未集計の未評価・別scope拒否と保持・別career同IDの誤join防止・viewport内表示を確認した。画面も目視確認した。
- 同Chromeの実Core Workbenchは実接触を持ち、bat192/pitch59/flight801 frameを保持する。表示名変更後に同じ既存simulateを再実行し、原physics全field・選手state・Source exportが厳密一致した。QA専用HTMLにprivate resultのstructuredClone読取と既存simulate呼出だけを注入し、Coreを変更しなかった。JSONの数値丸めによる比較は使わない。
- Browser Coreは198inputs、SHA `b023e61ccd97101059f21ccc56613e4a25101ab3e4ee96852c300bba39a8a266`。builder/表示module/UI/barrel/harnessの開始終了SHA、Native report SHA、全bundle inputのpost-build hash、HTML/Core/build metadataを照合した。bundle manifestの契約は既存の`post_build_file_sha_under_frozen_source_contract`であり、Nativeのload時pinとは区別する。

## 検出・修正した事項

初回browser `3b6d6243`は既定の古rendererが既存whole-arc gateを満たさず停止した。既存V133通常rendererのmetadataと実SHAを確認して明示入力し、条件は緩めなかった。このiframeは保存済みの参照用で、上記physical対照は新buildのmain Workbench Coreに限定する。通常試合とメーカーの最終同版配送は別の未完項目。

次の`c6df68c6`はQAの不存在tab selectorによる停止。初期UI PASS `83b2a4b8`後、独立reviewで別careerに同じplayerIdがあるとMaker catalog名を借用する誤joinを検出し、新fixture `3e91000c` FAIL8140msで再現した。report自身のIDだけを表示するよう修正し、`d558ac99` PASS14953ms。Native権限を持たないUI fixtureの試験と明記し、Native認定へ昇格しない。

`3017d7ee`はactual contact/flight必須とpin追加後、`32a8a79c`は実行環境のpersonal pathを固定しないharnessへ変更後の各PASS。未集計を世界の接触不存在と混同しない文言とケースを加えた最終Sourceが上記out08である。全FAIL・中間PASS・私的DB/bundle/raw/screenshotは保持する。独立reviewの最終追加欠陥なし。

## 公開範囲と未完

今回のSource公開は新report module/test・Native fixture/entry/probe・browser QAと設計結果に限定する。既存の共有barrel/build-makerとignoredのメーカーUIには先行する未公開作業が混在するため、今回のcommitへ全体を取り込まない。これらの採用済みローカル差分はQAとSource pinを持ち、最終同版配送時のSource同期へ残す。私的artifact・本人入力・共有CURRENT履歴は非公開。

通常利用するNative DBからのreport生成入口は、fixtureの明示試験modelから独立させて次に整備する。production model校正・現在career時計・全producer人口・同PA複数記録identity・自然cohortは未完。SPIN/SIGN今回基盤・キレ・通常試合・同版3HTML配送など全Goalの他残件も維持する。
