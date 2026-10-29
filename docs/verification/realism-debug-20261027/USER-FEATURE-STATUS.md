# 要求機能の利用状況と次の一手

2026-10-30 JST。全Goalの範囲・受入条件は維持する。「使える」は明示した版・入力・範囲だけを指し、局所PASSを完成版配送へ昇格させない。旧FAIL / TIMEOUT / UNKNOWNは各原記録に保持する。

| 要求機能 | 状態 | 現在使える範囲・根拠 | 完成までの次の具体操作 |
| --- | --- | --- | --- |
| メーカー打撃練習の方向指定／おまかせ | 使える（最新検証版。最終配送は未完） | 最新統合検証版で手動3方向＋おまかせ、本人方針へ復帰、roster保存値不変、連続打席・保存再開を受入。新組合せreceipt `4ff9502360504dac845f4b89cfb43864` PASS56437ms、通常Hostと実Workerの有限全record一致。`DIRECTION-PRACTICE-V149.md` / `REACTIVE-MOTOR-V161.md`、receipt `05c8b960…`。完成3HTMLへは未配送。 | この受入済み統合を作り直さず、通常試合の方向戦術・心理の未完を閉じ、最終同版配送へ組み込む。 |
| 打者心理・配球履歴・独立seed・ニッチロー | 一部できている | 連続カウント／投球連番、preview非消費、JSON再開、配達済み位置の未分類経験・次球想起、独立13 domain RNG。`CONTINUOUS-PRACTICE-V150.md` / `OBSERVED-BATTING-V151.md` / `INDEPENDENT-RANDOMNESS-V152.md`。初球はTAKEのため初球の実打球方向は未証明。次球のREACTIVE打撃改善は1例に限定。 | 未分類経験からのコース／球種family予測と判断への接続を明示し、初球・次球の意図／誤差／実接触を分離する受入を埋める。既存独立RNG試験は再実行しない。 |
| キレ○・キレ◎・驚異の切れ味の物理3段階 | 未完成（選択・保存UIは局所利用可） | 3選択／即保存／自動試投／通常復帰／JSON再読は受入済み。元球種を変える低spin / gyro置換recipeの普遍採用は撤回。`AUTO-KIRE-RELEASE-V177.md:64` / `KIRE-BASE-PRESERVING-V180.md`。 | 同期したmaterial姿勢・角速度・相対風速と横力／PV時系列という不足Sourceを解消する。既に不成立とした同じgridやUIを再実装しない。取得できない部分は未解決のまま他機能を完成へ進める。 |
| スライス・フック・バックスピン・トップスピン | 一部できている | 資格→運動→実剛体接触→3D回転→空力の経路が存在。BACKSPIN真正Nativeの局所採用あり。通常／Goldのneutral一致は4技術の意図的制御証明ではない。`docs/verification/spin-trial-v124/NATIVE-SPIN-CLAIM-V131.md` / `SPIN-NEUTRAL-GOLD-V193.md`。 | 保存済み資格・接触を再生成せず、未検証の技術選択を伴うNative対照を不足分だけ実行する。4技術、3/4種保有、自然Gold希少性と公式終端の未完を別に記録する。 |
| 打球記録・ラインドライブ分類・表示 | 一部できている | 正常接触収集→明示modelの事後分類→report→Maker読込・純表示。modelなしは未評価。`NATIVE-CONTACT-DISPLAY-V191.md` / `NATIVE-CONTACT-REPORT-CLI-V192.md`。`physicsEffects:NONE`。 | 現在career時計・観測集合identityを正規Ownerへ結び、production分類基準を校正する。全producer人口・同PA複数記録・自然cohortを受入へ追加する。 |
| 同Coreの高速再現・診断 | 一部できている | 同Chromeで通常／描画OFF／実Worker等の12球局所一致。batch CLI準備は完了、実複数seed・pool1/2/4・9回・性能受入は未完。`FAST-DEBUG-RESULTS.md` / `FAST-DEBUG-BATCH-PREPARATION.md`。Native current22 getterのCPU測定は診断であり試合性能ではない。 | SQL比較はOLD11.89秒→NEW24.15秒で改善証拠なし、不採用・元Source全bytes復旧で閉じた。その後はMaker・通常試合の受入ケースへ戻り、固定した最新Coreで不足するbatch／9回／最終性能を検証する。 |
| 完成版Maker・通常HTML・調整室の検証／配送 | 未完成 | 旧V133の3HTML配送と9回は旧版の証拠。最新の局所UI受入・部分Source公開は最終配送ではない。`docs/verification/swing-envelope-v133/DELIVERY-RESULTS.md`。 | 採用Source対応表を固定し、旧版を保護した新出力先へ3HTMLを同版生成。統合・旧入力・Worker・PC／390px・9回・性能・配送SHAと最新設計GitHub本文を照合する。 |

## 混同しない境界

- SPINは接触前の運動選択から実接触の回転・空力へ作用する。ラインドライブは実打出角等を後から集計する記述であり、回転操作や物理補正ではない。
- キレの3選択UIが存在しても、元球種を保つ物理3段階は未採用。青は「キレ○／キレ◎」、金は「驚異の切れ味」（◎なし）。旧内部ID・保存物理を名称だけで変更しない。
- ニッチローの初球TAKEは初球流し打ちの証拠ではなく、次球1例の改善も一般的な偏り解消ではない。

## 作業順・終了単位

1. **SQL比較は終了。** OLD / NEW各1回は全値と検査維持PASS、改善証拠が無いため不採用・baseline全bytes復旧。SQL-METADATA-COMPARISON-V221.md。追加の内部高速化へ広げない。
2. **現在: Makerの利用機能へ戻した。** 方向4選択と連続打席／心理の既存Sourceを最新検証版へ統合し、未完の判断経路を小さく実装する。既存局所成功を再演せず、変更箇所と未受入だけを確認する。
3. **SPINの物理経路と記録表示を別々に閉じる。** 各単位を「使えるようになったこと／新たな検証／残ること」で記録し、4技術の物理制御と分類の完成を別判定にする。
4. **キレの不足Source解消を独立して追う。** 同じ不成立条件への再相談・再計算をせず、新たなSourceまたはモデル変更があるときだけ次の判断を行う。他機能の完了をこの枝で停止しない。
5. **最終3HTMLと配送を閉じる。** 最終Source固定後の統合・batch・9回・性能と配布実体を検証する。全受入と配送完了前にGoalを完了扱いしない。

## モデル分担

- **Sol 6.1：主担当。** 現runtime metadataで `gpt-6.1-sol` を確認。全Goal、優先順位、証拠再利用、担当境界、利用者向け結果を統合する。
- **Terra 6.1：実装担当。** 指定modelで起動済み。所有file・受入・変更禁止範囲を明示し、最小差分と関連検証を担当する。
- **Astra：必要な独立判断だけ。** 今回は新SQL比較probeの同一条件・原本／Source境界のレビュー1点。短い依頼と該当Sourceだけを渡し、全会話／全ログは渡さない。変更後patchの新しい論点以外を再相談しない。

中断時の旧agentはliveでなく、SQL OLD / NEWの既存実行・結果も無いことをFS／processで確認済み。新probe3の既存strict / import / syntax成功は再利用し、productionはbaselineと一致。現記録の工程番号は証拠のlocatorに留め、利用者への進捗は本表を入口にする。

現在の最初の完了単位は、最新2Core/4UIを統合した単一Maker検証HTML。Chrome156.0.8078.49で1200の有限統合と390の到達・表示を受入済み。試験report事前注入の無いV161 baseを使い、既存UIの再実装0、builder title1literalだけ変更。新しい有限統合QA1fileを独立reviewしてから実行する。完成版3HTML配送とは判定を分ける。

**最新の利用可能化単位:** [Maker検証HTML](candidate-maker-direction-practice-current-01/maker.html)。HTML SHA36cc176a94e15f61f677a9aa62288bce8da87561b036c1a90f7f8b5b15a41ea1。2Native+1Workbenchの実埋込codeを採用bundleへ全文exact照合、673clips/92201frames、全Source/入力/HTML開始終了pins一致。1200でpreview非消費、TAKE→次球、観測記憶、JSON再開を通常Host対実Workerで検証。390は同じ全試験を繰り返さず初期操作/表示保持に限定。キレは説明文言のみ、記録は未評価→明示import参考/physicsEffectsNONE。完成3HTML・キレ物理・全試合性能は未完。

最新Makerの受入・採用Source・未完の詳細: [MAKER-DIRECTION-PRACTICE-INTEGRATION.md](MAKER-DIRECTION-PRACTICE-INTEGRATION.md)。1200/390のscreenshot-onlyは主担当が目視済み、受入ケース再演0。
