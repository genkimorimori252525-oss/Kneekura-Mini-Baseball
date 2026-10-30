# 要求機能の利用状況と次の一手

2026-10-30 JST。全Goalの範囲・受入条件は維持する。「使える」は明示した版・入力・範囲だけを指し、局所PASSを完成版配送へ昇格させない。旧FAIL / TIMEOUT / UNKNOWNは各原記録に保持する。

| 要求機能 | 状態 | 現在使える範囲・根拠 | 完成までの次の具体操作 |
| --- | --- | --- | --- |
| メーカー打撃練習の方向指定／おまかせ | 使える（最新検証版。最終配送は未完） | 最新統合検証版で手動3方向＋おまかせ、本人方針へ復帰、roster保存値不変、連続打席・保存再開を受入。新組合せreceipt `4ff9502360504dac845f4b89cfb43864` PASS56437ms、通常Hostと実Workerの有限全record一致。`DIRECTION-PRACTICE-V149.md` / `REACTIVE-MOTOR-V161.md`、receipt `05c8b960…`。完成3HTMLへは未配送。 | この受入済み統合を作り直さず、通常試合の方向戦術・心理の未完を閉じ、最終同版配送へ組み込む。 |
| 打者心理・配球履歴・独立seed・ニッチロー | 一部できている | region経験を次球へ反映。本人・元打順４seedでAUTO/REACTIVEが12球に届き、振った７球で運動を計画。通常HTML候補には新試合で選べる両軍おまかせを追加し実GUI検証。４接触は速度Xがすべて負で、一般的な方向偏りの解消は未証明。[MATCH-AUTO-DIRECTION-V250.md](MATCH-AUTO-DIRECTION-V250.md)。familyはUNKNOWN。 | GUIと本人データの統合、同投手経験・別投手隔離、独立seed全分母、family認識と方向分布を検証し、完成版に配送する。 |
| キレ○・キレ◎・驚異の切れ味の物理3段階 | 未完成（選択・保存UIは局所利用可） | 3選択／即保存／自動試投／通常復帰／JSON再読は受入済み。元球種を変える低spin / gyro置換recipeの普遍採用は撤回。`AUTO-KIRE-RELEASE-V177.md:64` / `KIRE-BASE-PRESERVING-V180.md`。 | 同期したmaterial姿勢・角速度・相対風速と横力／PV時系列という不足Sourceを解消する。既に不成立とした同じgridやUIを再実装しない。取得できない部分は未解決のまま他機能を完成へ進める。 |
| スライス・フック・バックスピン・トップスピン | 一部できている | BACKSPIN真正Nativeの局所採用あり。TOP選択と無指定が同運動になる不足に対し、元のtarget/anchorと配達済み観測をつなぐ新試行を実装。Native実接触1件でTOP 626.25 rad/s、既存空力Core25msへ接続 `30a0abef`。元DB・既存行・終了pins保持。`SPIN-OBSERVED-AIM-TRIAL-V226.md`。 | 保存済み結果を再生成せず、同本人の2episode/Main実Worker/全replayを受入済み。HOOKは両fair接触でも成分が負で0/2未成立のため、世界XYと接触面の対応を新たに調べ、回転制御を閉じる。4技術、3/4種保有、自然Gold、全弾道・公式終端も未完。 |
| 打球記録・ラインドライブ分類・表示 | 一部できている | 保存された実接触を、手書きJSONなしでMLBの角度参考帯に集計・表示。実ブラウザ・通常Workerの本人打球1件は帯外0/1、保存復元と新セッション分離を確認。参考帯は能力認定でも物理制御でもない。[LINE-DRIVE-REFERENCE-V249.md](LINE-DRIVE-REFERENCE-V249.md)。 | 帯内の実打球、通常試合を含む全producer、記録のcareer統合と本人の求める傾向分類を検証する。 |
| 同Coreの高速再現・診断 | 一部できている | 現WIP・Chrome 156.0.8078.76で固定12球を５経路比較し、接触４・守備４を含め全記録一致。さらにseed 1〜4 × pool 1/2/4の12件は各12球・接触３・守備３を含み、通常HostとWorkerの記録・状態が一致。[FAST-DEBUG-BATCH-CURRENT-WIP.md](FAST-DEBUG-BATCH-CURRENT-WIP.md)。 | 最新採用Coreへ反映し全９回と性能を固定条件で評価、完成３HTMLに組み込む。 |
| 完成版Maker・通常HTML・調整室の検証／配送 | 未完成 | 旧V133の3HTML配送と9回は旧版の証拠。最新の局所UI受入・部分Source公開は最終配送ではない。`docs/verification/swing-envelope-v133/DELIVERY-RESULTS.md`。 | 採用Source対応表を固定し、旧版を保護した新出力先へ3HTMLを同版生成。統合・旧入力・Worker・PC／390px・9回・性能・配送SHAと最新設計GitHub本文を照合する。 |

## 混同しない境界

- SPINは接触前の運動選択から実接触の回転・空力へ作用する。ラインドライブは実打出角等を後から集計する記述であり、回転操作や物理補正ではない。
- キレの3選択UIが存在しても、元球種を保つ物理3段階は未採用。青は「キレ○／キレ◎」、金は「驚異の切れ味」（◎なし）。旧内部ID・保存物理を名称だけで変更しない。
- ニッチローの初球TAKEは初球流し打ちの証拠ではなく、次球1例の改善も一般的な偏り解消ではない。

## 作業順・終了単位

1. **SQL比較は終了。** OLD / NEW各1回は全値と検査維持PASS、改善証拠が無いため不採用・baseline全bytes復旧。SQL-METADATA-COMPARISON-V221.md。追加の内部高速化へ広げない。
2. **現在: 利用者向け機能を優先。** 受入済みのおまかせ・連続練習を再演せず、実打球の記録と参考表示を利用可能にし、残る通常試合の打者判断・4種類の回転の成立に戻る。
3. **SPINの物理経路と記録表示を別々に閉じる。** 各単位を「使えるようになったこと／新たな検証／残ること」で記録し、4技術の物理制御と分類の完成を別判定にする。
4. **キレの不足Source解消を独立して追う。** 同じ不成立条件への再相談・再計算をせず、新たなSourceまたはモデル変更があるときだけ次の判断を行う。他機能の完了をこの枝で停止しない。
5. **最終3HTMLと配送を閉じる。** 最終Source固定後の統合・batch・9回・性能と配布実体を検証する。全受入と配送完了前にGoalを完了扱いしない。

## モデル分担

- **Sol 6.1：全体統合を優先。** 現在の主実行runtimeはTerra 6.1で、Sol 6.1を独立レビューに使用。利用可能なモデルと分担を正確に記録し、Goal全体を管理する。
- **Terra 6.1：実装担当。** 指定modelで起動済み。所有file・受入・変更禁止範囲を明示し、最小差分と関連検証を担当する。
- **Astra：必要な独立判断だけ。** 新しい共有契約・物理モデル・適用権限などの判断点に限定し、決めたい一点・必要根拠・制約・候補を短く渡す。全会話／全ログや、条件が変わらない判断の再配送はしない。

中断時の旧agentはliveでなく、SQL OLD / NEWの既存実行・結果も無いことをFS／processで確認済み。新probe3の既存strict / import / syntax成功は再利用し、productionはbaselineと一致。現記録の工程番号は証拠のlocatorに留め、利用者への進捗は本表を入口にする。

Maker統合単位は受入済み。Chrome156.0.8078.49で1200の有限統合と390の到達・表示を確認した。試験report事前注入の無いV161 baseを使い、既存UIの再実装0。既存QAの再実行はせず、完成版3HTML配送とは判定を分ける。

**最新の利用可能化単位:** [Maker検証HTML](candidate-maker-direction-practice-current-01/maker.html)。HTML SHA36cc176a94e15f61f677a9aa62288bce8da87561b036c1a90f7f8b5b15a41ea1。2Native+1Workbenchの実埋込codeを採用bundleへ全文exact照合、673clips/92201frames、全Source/入力/HTML開始終了pins一致。1200でpreview非消費、TAKE→次球、観測記憶、JSON再開を通常Host対実Workerで検証。390は同じ全試験を繰り返さず初期操作/表示保持に限定。キレは説明文言のみ、記録は未評価→明示import参考/physicsEffectsNONE。完成3HTML・キレ物理・全試合性能は未完。

最新Makerの受入・採用Source・未完の詳細: [MAKER-DIRECTION-PRACTICE-INTEGRATION.md](MAKER-DIRECTION-PRACTICE-INTEGRATION.md)。1200/390のscreenshot-onlyは主担当が目視済み、受入ケース再演0。

**追加の利用可能化:** [配球コース経験を反映する新Maker](candidate-maker-observed-region-v222-01/maker.html)。旧版保持。region45の実受理2件を次球prepared priorへ正weightで混合、通常Host/実Workerの全記録・継続・RNG一致、限定旧UI復元を実証。通常2ゲームの実方針と390をr3で追加確認し、r2の通過済み練習再演0。family認識/人間校正/全体性能/完成3HTMLは未完。

SPINの追加根拠: [SPIN-ORIGINAL-MOTOR-EVIDENCE-V224.md](SPIN-ORIGINAL-MOTOR-EVIDENCE-V224.md)。正規Readerで6元plan/releaseを取得し、技術目標差を確認。次球転用・資格への後付けは未実施で、新bindingと観測anchor適用の実証が残る。

元運動の保存単位も受入済み: [SPIN-ORIGINAL-MOTION-BINDING-V225.md](SPIN-ORIGINAL-MOTION-BINDING-V225.md)。元DB非open、コピーの新table2行だけを追加し、旧全行・rowid・schema・head不変とproviderless再読を確認した。Worker異常終了の原因UNKNOWNは保持。現在は観測anchorを用いる新しい試行controlへ進み、通常試合の適用許可と区別する。

新TOP試行の結果は [SPIN-OBSERVED-AIM-TRIAL-V226.md](SPIN-OBSERVED-AIM-TRIAL-V226.md)。その保存済み接触を、新しい正常Readerで再認証して資格評価へ渡せる証拠にした: [SPIN-TRIAL-MOTOR-EVIDENCE-V227.md](SPIN-TRIAL-MOTOR-EVIDENCE-V227.md)。元の4分試行は再演せず、readonly gateは6.625秒。次はaim / domainを含む新資格Sourceとearned consumerの接続であり、1接触だけで習得済みとは扱わない。

閉集合の追加受入: [SPIN-CLOSED-TRIAL-COHORT-V228.md](SPIN-CLOSED-TRIAL-COHORT-V228.md)。正常commitment / resolution全件と共有観測条件を認証し、真正1試行の集合を確認。criterion・資格は作成せず、元接触は再実行していない。適用資格Ownerと通常consumerの接続が次の未完。

適用評価の保存: [SPIN-APPLICATION-EVALUATION-OWNER-V230.md](SPIN-APPLICATION-EVALUATION-OWNER-V230.md)。旧技能と分離したOwnerへ真正1件の不足評価を保存し、接続を閉じた再読を受入。資格は発行せず、診断用project基準と人間・domainの校正を区別する。次は未来情報を使わないprecommit条件と新consumer、真正反復による成立の検証。

計画前条件の追加根拠: [SPIN-PRECOMMIT-DOMAIN-V231.md](SPIN-PRECOMMIT-DOMAIN-V231.md)。正常な過去入力から得た条件と実行後記録の条件・来歴が全値一致。現在判断・新接触の受理は0。次は資格読取の循環を避けるmembership境界と通常consumer。

所属境界の追加受入: [SPIN-CAUSAL-WORLD-MEMBERSHIP-V232.md](SPIN-CAUSAL-WORLD-MEMBERSHIP-V232.md)。World所属の先行認証後に閉範囲内だけを正常再導出し、保存1trial・条件・不足評価が全値一致。新qualified consumer / 真正な資格成立は次の未完。

資格付き経路の実装と不足fallback: [SPIN-QUALIFIED-CONSUMER-EXPERIMENTAL-V233.md](SPIN-QUALIFIED-CONSUMER-EXPERIMENTAL-V233.md)。真正1件では通常fallback・未来資格拒否・旧Core全計算一致を確認。実Producer、真qualified Native受理と保存順序の実Owner検証は未完成・採用保留。正規打球処理と解放を経て独立反復を得る必要がある。

同分岐の守備開始接続: [SPIN-SAME-BRANCH-FIELD-ROOT-V234.md](SPIN-SAME-BRANCH-FIELD-ROOT-V234.md)。実TOP contactから正常field root/cut12へ進み、元データ・caller・終了pinsを保持。飛行・守備判断/移動・公式判定・解放・次独立trialは未完。

製品測定スイングの明示試行: [LIVE-OBSERVED-SPIN-EXPLICIT-TRIAL-V236.md](LIVE-OBSERVED-SPIN-EXPLICIT-TRIAL-V236.md)。配達済み同標本からcontact-depth/clock/XYを最終運動へ反映し、未指定の全recordと2バット標本は旧Sourceと一致。汎用Rの4明示指定で登録差/contactあり。技術名どおり回転・真正資格・本人原JSON/Maker/LiveMatch配線・全飛行/配送は未完。

守備の最初の観測/判断: [SPIN-SAME-BRANCH-FIRST-DEFENDER-V235.md](SPIN-SAME-BRANCH-FIRST-DEFENDER-V235.md)。同実打球→cut15・ball検出/ball_handlerの正常Owner受理と保全PASS。一方、decision/locomotionの元clockが未記録で時間整合HOLD。65/32ticksを65/32msとみなして補正しない。9人motor/公式判定/解放/次独立trialは未完。

本人の試行配送: [MAKER-OBSERVED-SPIN-COMMAND-V237.md](MAKER-OBSERVED-SPIN-COMMAND-V237.md)。正常importした本人L/obp-23_5の同第2球で、無指定+固定4probeの全contact/Main実Worker全record・continuation一致。BACK/HOOKは逆方向、TOP/SLICEは要求成分正。旧全体FAILを保持して未完UIだけtail検証、30px入力を44B styleで修正し390px全340pxを実画像受入。raw試行は通常心理/方向計画を置換し得るため通常能力採用HOLD、次はnormal plan XY合成/delta0不変。4技術/資格/最終3HTMLは未完成。

通常planを保つ合成: [NORMAL-PLAN-SPIN-COMPOSITION-V238.md](NORMAL-PLAN-SPIN-COMPOSITION-V238.md)。本人L/実clipのnormal対zeroが全record・continuation/実pose・clock/RNG/lateと一致。4非zeroは実XY差/Z0を保持し全contact、BACK/SLICEは逆方向、TOP/HOOKは要求成分正（baselineにも成分あり、技術成功ではない）。同Chrome実Worker受入済・4技術/習得/Gold/配送未完成。次は固定motor選択→独立practice評価で、数値入力の診断だけを増やさない。

固定スイング選択・記録・再開: [FIXED-MOTOR-PRACTICE-OWNER-V239.md](FIXED-MOTOR-PRACTICE-OWNER-V239.md)。本人4事前固定組を実ChromeWorker/正常Ownerで確認、全NO_TARGETも消さずBACK/SLICE未成立、TOP第2接触、HOOK初球接触後別打者で中断HOLD。局所保存replayはNative/実施歴/獲得ではない。次は明示振る意思と同本人episode反復、必要試行数を下げない。

受理打球のlocal記録/参考分類: [LOCAL-CONTACT-REFERENCE-REPORT-V240.md](LOCAL-CONTACT-REFERENCE-REPORT-V240.md)。TOP/HOOK実contactを1回ずつ収集し、明示TEST_ONLY[0,45)で38.697度一致/-33.901度不一致を保存・再分類。localSaved自己申告/日数未評価/physicsNONE、通常match全producer/career/productionmodelは未完。直接tool単体testのreceipt不足はUNKNOWN保持、帳尻再演0。

同本人反復・意思指定の追加受入: [PRACTICE-INTENT-EPISODES-V241-V242.md](PRACTICE-INTENT-EPISODES-V241-V242.md)。SWINGと方向AUTOを別に固定し、同本人2回とも正常PA終了→次回→保存再開→通常AUTO復帰をMain/実Workerで全値比較。HOOKの物理成立は0/2として残し、反復機能の動作成功と区別した。旧未解決と完成3HTMLの未配送を維持。

接触面を使う回転試行: [CONTACT-FRAME-SPIN-V244.md](CONTACT-FRAME-SPIN-V244.md)。本人HOOKは実Browserで2回中1回が要求方向の実spin、もう1回は候補なしで通常打撃。全分母で基準未達、残る3技術と物理成立を引き続き検証する。

実Browser固定2回の追加結果: バックスピン1/2、トップスピン1/2。接触・回転の実値と失敗を [CONTACT-FRAME-SPIN-V244.md](CONTACT-FRAME-SPIN-V244.md) に記録。スライスは同本人・同clipの固定2回で診断基準2/2。いずれも習得やGoal達成ではない。

誤差幅を用いた固定9点の回転選択も実験したが、同じ8slotの変位・実接触・打球処理は前方式と完全一致し、追加探索が発生した。既定採用せず [ROBUST-SPIN-V248-RESULTS.md](ROBUST-SPIN-V248-RESULTS.md) に証拠を残す。
