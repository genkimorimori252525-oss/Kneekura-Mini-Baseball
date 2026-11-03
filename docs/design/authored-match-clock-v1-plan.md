# Fresh authored SI clock namespace — read-only plan

2026-10-16 / physical_closure。実装・DB変更は未実施。full goal の9人守備、custody/release、throw、runner、rules、official/scoring、描画・実機検証は維持する。本案は、旧 nominal の時計を推定せず、新しい合成宣言から同一本線を始めるための最初の境界である。

## 結論と認証境界

最初は新 owner、DDL、migration を追加しない。新しい authoring manifest を strict compiler に通し、既存 shape の model/calibration Source を新 ID・新 version で生成する。元 owner が Source bytes/hash、Person、current model、view/member、lineage、set、transaction と再読を認証する。writer の accepted Source callback は生成済み厳密 Map のみを読み、宣言と Source の対応表を hash 付きで保全する。各実行段階で元 physical clock が宣言の `1_000_000` TPS と一致することを検査する。

これは fresh run の authoring/実行境界である。既存 model owner は arbitrary な `sourceVersion` の単位意味を解析しない（`SqlitePlayerDecisionModelStore.ts:12,54`）。新 version 文字列だけで、任意の外部 caller に対する汎用単位認証ができたとは主張しない。外部 caller が compiler を迂回して別値を authoritative Source として渡すことまで禁止する場合は、後段で別の versioned schema/guard が必要になる。今回それを新 owner/DDL の前提にはしない。

## 原生成経路と、後段 override だけでは足りない理由

- `OfficialPitchWorkloadFixtures.test-support.ts:34,56,63,75,83,105` が world/season、roster、Person link、pregame、match を元 owner で生成する。career/game/player ID は現在固定。
- `ContinuousPitchFixtures.test-support.ts:18,21,33` が initial world、pitch timing baseline（`*Us`）、release、workload を生成する。
- `PhysicalPlateAppearanceActorFixtures.test-support.ts:12,15` が元 actor と game/initial-world を結ぶ。
- `NativeBattingModelStanceFixtures.test-support.ts:128,139,157,162,183` が batting capability/sensor/prediction/stance を生成する。既存 batting TPS は1e6だが refresh interval の意味は別途新宣言する。
- `SamePlateAppearanceDirectNative.test-support.ts:20,24,39,44,49,59,69,99` が fielding、observation、decision、locomotion nominal、reservation、TOTAL/view、32 calibration を生成する。旧 decision/locomotion fixture はそれぞれ `PlayerDecisionCalibrationFixtures.test-support.ts:5`、`PlayerLocomotionCalibrationFixtures.test-support.ts:6`。
- `SamePlateAppearancePhysicalLifecycleFixture.test-support.ts:35,37` は上記を先に採用した後に continuation を作る。`SamePlateAppearanceLifecycleFixture.test-support.ts:80-81` は effective calibration の override であり、nominal を新時計へ宣言し直す入口ではない。decision の explicit override もない。
- `SamePlateAppearanceTeamCoverageNative.acceptance.ts:27-34` の1e6 observation/500000-step override を、新しい nominal の時計宣言済み証拠として転用しない。

新 namespace は match ID だけでは不十分。同 career/player の baseline owner は既存初期モデルの追加を拒否する（`SqlitePlayerDecisionModelStore.ts:138`、`SqlitePlayerLocomotionModelStore.ts:172`）。新しい独立 DB と namespace 下の career/player/Person-link/model/game/fixture/source IDs を最初の owner adoption 前に決定する。保存済み row/Source/ref を後処理の文字列置換で改名しない。

## 最初に作る最小ファイル

1. `src/integration/native-game/AuthoredMatchClockV1.ts`：新規の純 compiler。`compileAuthoredMatchClockV1(raw)` は検証済み manifest、既存 model 向け値、単位変換 ledger、予定 Source IDs/versions を返す。durable ref、accepted status、body execution は返さない。Source の実 snapshot hash は元 owner 採用後にのみ得る。
2. `src/integration/native-game/AuthoredMatchClockV1.test.ts`：明示的合成 packet、RED/GREEN、既存 validator/Source shape、旧 bytes の回帰。fixture 値はここで明示し、production default は作らない。

この2ファイルのレビュー後、fresh genesis の専用 writer を `tools/verification/authored-clock/` に追加する。原 owner composition を再利用するための test-support factory の入力化が必要なら、上の固定 ID/入力箇所だけを opt-in で共通化し、引数なし経路の JSON bytes を維持する。新 run を旧 helper の後段 override だけで開始しない。Native writer/長時間 fixture は compiler 段階では開始しない。

## Manifest と精度規約

- version `authored_match_si_clock_v1`、namespace、revision、`authority: AUTHORED_SYNTHETIC_NOT_EMPIRICAL`、`units: SI`、`clock.ticksPerSecond: 1000000` を必須にする。この最初の版は他の TPS を拒否する。
- 新 nominal/calibration の version 規約を `authored_si_clock_1000000_v1` とし、sourceId に namespace/role/player/revision を含める。manifest と全生成 Source の SHA 対応を保存し、異なる packet を同じ ID で上書きしない。
- physical root/step の reserved algorithm SourceVersion は既存 v3/INTEGER/MOTOR/Acquisition 定数のまま使う。authoring version を全 Source へ一括代入してアルゴリズム識別子を失わせない。
- 時間の authoring 値は有限長の非指数 decimal **string の秒**を要求する。桁数/文字数を制限してから BigInt 有理数へ変換する。`seconds × TPS` が割り切れない場合は拒否。`Math.round`/ceil/tolerance で compiler が時刻を補完しない。非数・負数・過大値・safe integer overflow・duration=0不可の項目・未知 field・getter/cycle を拒否する。
- technical timing offset のような既存 signed 項目だけ負値を許す。非負 duration、正の integration/refresh interval は別に検査する。`*Us` は単位がマイクロ秒であることを明示し、TPS の別名として推定しない。
- position/velocity/acceleration/spin は m、m/s、m/s²、rad/s の finite number。0..1 ratings は元 adapter の入力であり、秒や SI 能力そのものとは区別する。
- 元 Core の rating interpolation 内の整数丸め（`DefensiveDecisionTiming.ts:49`、`DefenderFirstStepTiming.ts:61`）は変更しない。これは宣言秒→tick の不正確な丸めとは別。実 physical fractional moment は従来の Source kernel と INTEGER checkpoint により進め、compiler が実行時刻を切り上げて飛ばさない。

## 必要 temporal 項目

| 分類 | 新 manifest の秒宣言から生成する項目 | 意味 |
| --- | --- | --- |
| 観測 | attended/peripheral refresh、observation duration（元から秒）、memory TPS。delivery latency は既存 batting sensor の項目 | 更新頻度・感覚遅延・記憶減衰。defender は現在 instantaneous capture 契約で、未実装の独立 sensory delay を捏造しない。decay rate は毎秒のまま |
| 判断 | minimum/maximum decision delay、fixed processing offset | 証拠入手後の判断遅延 |
| 身体開始 | minimum/maximum first-step delay、fixed motor offset | 判断後の身体開始遅延。判断遅延と合算前提を明示 |
| 移動数値 | maximum integration/control segment seconds | 1 owned acceleration segment の上限。身体反応速度ではない |
| transfer | minimum/maximum transfer delay、fixed grip offset | 捕球後持ち替え。旧 fielding 100..300+10 の単位も推定しない |
| communication | propagation/recognition/max-additional recognition delays | 聞こえ/認識。既存の exact physical clock と一致させる |
| batting | motor latency、signed technical offset、sensor delivery、prediction horizon/step、swing precontact/followthrough/各 timing gain | 既存秒項目はそのまま明示、tick 項目は正確変換 |
| pitch | start interval、motion-to-release、followthrough、natural variation、ready/duration `*Us` | 元 baseline/owner の明示マイクロ秒契約を維持 |
| runner | decision/recognition、motor reaction、integration step、safety margin | 元 runner model の TPS と同一。未接続を active と偽装しない |
| coverage | scene/pose valid-from/through、retained role end、intent/target expiration、pending schedules | 原 Source が継続可能な範囲。実運動を伴わない horizon 延長で代用しない |

最初の compiler 出力対象は defender nominal3種＋fielding transfer と、その effective calibration の値でよい。ただし新 genesis を開始する前には batting/pitch/scene を含む active route の全 temporal manifest を埋め、将来の runner/communication は `UNCONNECTED` と明示して、初回使用時に未宣言なら拒否する。省略値を旧 fixture から暗黙補完しない。

`ActualLocomotion.ts:53,67,70-75` は max step と retained role end の小さい方を上限に1 segmentを作る。`DefenderMotion.ts:276-287` は step ごとに速度・ブレーキ・方向を再計算するため、この値は計算/control resolution にも影響する。大きくして継続判断や role coverage を省略してよい値ではない。Air RK4 step と body control step も別宣言とする。

## 明示的合成 fixture 値案（Root レビュー前、未採用）

本人/NPB/MLB/NLB/KBO の実測として扱わず、全9名同値の generic authoring reference とする。旧20..100等から1000倍した値ではない。

| 項目 | 秒 | 1e6 tick 出力 |
| --- | --- | --- |
| observation attended/peripheral | `0.020` / `0.080` | 20000 / 80000 |
| decision min/max/fixed | `0.120` / `0.280` / `0.010` | 120000 / 280000 / 10000 |
| first-step min/max/fixed | `0.030` / `0.090` / `0.005` | 30000 / 90000 / 5000 |
| body maximum integration/control step | `0.002` | 2000 |
| transfer min/max/fixed | `0.080` / `0.220` / `0.010` | 80000 / 220000 / 10000 |

0.5 rating の構成検査では判断0.210秒＋first-step0.065秒＝0.275秒。その間も球は元 Source kernel で進み、途中 contact を先に処理する。数値/control step 0.002秒は精度確認用の候補で、実測の筋反応値ではない。1/2/4ms 比較は数値安定性の試験として別途行い、計測済み本人 calibration の代わりにしない。非 temporal SI 値/ratings の packet も明示必須で、既存 published synthetic reference を採用する場合は個別に原値・版を記録する。

## 再利用する元 validator と owner 境界

- compiler：`createPlayerObservationCalibration`、`createPlayerDecisionCalibration`、`createPlayerLocomotionCalibration`、batting 各 values validator、`samePaFieldThrowValuesInput`。model outer shape は現 owner と同じ type を使い、private validator を公開する変更は不要。
- Source shape 検査：`samePaDispatchSourceInput` と `samePaLifecycleCalibrationInput`。unit の仮 context/ref は structural 検査と明示し、Native authentication に計上しない。
- Native：Person/roster/pregame→initial world→actor/body/materialization→fielding/model→enrollment/empty prefix/TOTAL/view→action/32set→physical event/lifecycle→single current calibration→observation/decision/candidate/team/9actor→due wait/INTEGER→MOTOR→Acquisition を既存 owners で結ぶ。新 Source は元 lineage と current member/ref の全 hash を使用し、compiler は durable hash を捏造しない。
- `ExecutedFieldObservation.ts:39-40` は effective TPS と physical TPS を一致検査する。`SamePlateAppearancePhysicalFieldActionFromSqlite.ts:130` は nominal/effective clock 変更に明示 projection を要求する。新 nominal/effective は最初から1e6なので旧 projection を流用しない。
- `ActualLocomotion.ts:29-35` は exact integer moment、self/decision clock、identity を検査し、`SamePlateAppearancePhysicalFieldMotor.ts:26-27` は全 role curve の時計/coverage を検査する。`SamePlateAppearanceBallPhysics.ts:24-25` は air/ground/root TPS 一致を検査する。
- decision/locomotion/transfer の Source には独立 TPS field がないため、fresh writer の生成 Map と manifest 対応・physical TPS assert が本案の拘束点。ここを既存 owner の汎用単位検査と取り違えない。

## RED/GREEN と旧 bytes

1. RED：unknown field/time未宣言、NaN/Infinity・非文字列秒・指数・負値・非整数 tick（例 `0.0000001`）・過大 decimal/overflow・反転範囲・重複 player/model ID・不正 TPS・getter/cycle を拒否する。
2. GREEN：上記明示 packet の全 tick 値と既存 validator を確認。秒/ledger/Source shape を照合し、全9名の入力順・identity を保持する。能力の差を選手 index で捏造しない。
3. 分離検証：integration step だけを変えても宣言された decision/first-step scheduling は同一。reaction 値だけを変えた場合は scheduling にのみ対応する差を持ち、Source ball initial/basis/profile は不変。
4. 境界検証：compile 後の caller mutation、manifest hash/Source ID/route/player/clock 差替を writer の生成 Map が拒否する。raw SourceVersion だけの外部 caller を認証したとは主張しない。
5. 旧 `dispatchCalibrationValues()`/旧 Source の canonical JSON hash を固定比較し、初期2ファイル追加が旧 path に影響しないことを確認。将来 factory を入力化する場合は引数なしの全元 Source/header bytes を比較する。
6. 関連小テストと全体 TSC 後、Root が値/namespace/writer 境界を確認してから新独立 Native genesis を採用する。旧 closed DB/Map は SHA・全 schema/全 old row bytes 比較で保持し、Native cut15/旧 tickdomain UNKNOWN を書換えない。初回9motor10µs proof はその限定証拠のまま保存する。

## 実装記録（Root単独）

純compilerと18件の試験を実装。全9名のPerson・fielding・observation・decision・locomotionは実Native ownerで登録し、新接続・author callback禁止で再読できた。18PASS receipt37f2f20045f846d88d60920b35b6ec11、全体TSC466408225f31445d9c533624ddcea935。初回Native試験のworld-season不整合 e03af587...は元clubのseason指定へ試験だけ修正、guard変更なし。outputs/verification-authored-clock-models-v1へ閉DB/SourceMap/manifest保存。各4modeltable9行、DBfd80d100.../Mapc9cb51c7...。同process新接続の再読であり、別process証明・body/scene/game実行ではない。生成物nativeReady=falseを保持する。次は実登録identityと全active temporal domainsを結ぶfresh Native bootstrap。旧unit不明driverはRoot意図のSTOP_CONTROLでcandidate0 TOTAL後に閉保存し、9bodyは未証明のまま。

## 継続する9人の身体制御（Root単独）

`SourceDefensiveControlV1` は同一Source球と全actor曲線を既存motor kernelで進める。9名の既発行判断を保持し、各人のcontrol刻み・first-step・最早review時刻を分けた。rendererの任意時刻で区切ってもcontrol刻みを再開始しない。観測を勝手に更新せず、review_dueで停止し、現在時刻で利用可能な9名の新planを要求する。経路は外部perception/decisionの入力だけで、未来の球の真値はtarget計算に使わない。非守備actorもcollision queryから省かない。

元bat-contact rootと最大256件のprior actionsから開始cutを再構築し、保存cursor・新しい位置・旧contact証明の注入を受けない。各advanceは実接触で全bodyと球を同時停止。ground後は同じprivate sessionで継続可能。moving-glove候補はcursor=null/carrier=nullで止まり、保持・アウトを付与しない。1呼出256advanceでwork_limitを返し、同じsessionで継続する。

`SourceBattedFieldMotorMotionV1` のfinite replayを同じlive kernelのadapterへ変更。旧256action上限・旧型・SourceVersion・保存rows・受入ownerは変更していない。live側は全actor frame履歴を保持しない。失敗後の半更新状態は再利用を拒否する。

新規14試験は合成SI/geometry。既存Host5files28PASS(a2de678cf0f84223ab54a4e982be40d9)、Core旧動作と同じreplay/証明、9人差分加速、top-speed、first-step、任意中断、review更新、ground反発・元Source一致、moving glove終端を確認した。初回TSC FAIL8b8f439a...は未使用test import、境界試験FAIL817a50a0...は0.6秒を上昇中とした誤った期待であり、import削除と接地直後/指定時刻Source照合へtestだけ修正。原FAILを保存。

Native ownerからのplan認証・durable span保存/独立再読、モデルと全active domainのfresh bootstrap、capture/transfer/release/throw/runner/official、実測batの通常試合採用は引き続き未接続。nativeAdmission=false/official=null。14試験をNative9人受入や9回完走として数えない。

## Host continuous-control Source V1

追加SourceVersion `same_pa_field_step_aero_ground_control_v1` とaction `defender_control_v1` をNativeの既存field-action readerへ接続。旧INTEGER cutから開始し、元9人のteam selection/判断・locomotionモデル・Person body・effective calibrationを既存経路で読み直す。各selectionは元観測のobservationCalibrationReferenceも指定し、その観測が実際に使ったref/view/lineage、nominal observationモデル、fieldingモデルhash、physical TPSを照合する。planのdecisionSourceIdは元actor-selection Sourceの実IDであり、合成IDへ置換しない。

観測されたtargetは元sample.observedAt＋元attentionに対応するrefresh intervalで期限を作る。refresh_not_dueも元sampleの期限を保持し、未検出から無限の再試行workを生成しない。期限超過はSourceを拒否し、細かな制御tickで観測・判断を再発行しない。初回以後のfree checkpoint/metadataは元bat-contact rootと全prior actionから同じCore sessionを再構築して検証する。旧MOTOR/ACQUISITIONのSourceVersionと受入guardは維持した。

重要な有効期限修正：Coreのactor曲線は全modelの元coverageまで仮に延ばさず、次の最早body-control tickまで有効にした。以後の制御tickでは実位置/速度から次の曲線を発行する。Hostのwork_limitは未完了horizonを受入結果にせず、短い明示horizonを要求する。新controlは旧actor producer/censusの対応箇所にも追加し、消費時刻には区間末尾でなくmotor.startAtを使う。

11files101PASS edcbcbd532c0427db02d22c1b58b3f8a、wholeTSC704e6dca7c764cefbdf175873dc43557。新6HostケースはSQLite model/owner readerをmockしており、実Native admission/TOTAL/別process再読の証明ではない。最初のTSC ab03ce15...はtest-supportのdecisionReferenceがneverだったこととtest callbackのnarrowingでFAIL、testの型だけ修正して保存した。

未接続：新版capture consumerと、吸収中に2msのactor曲線を更新する仕組み。旧ACQUISITIONに新control候補を渡すことは引き続き拒否する。新controlは一つの既発行teamを期限まで保持する段階で、期限後の新観測を既発行intentと分離するreview/renewal consumerは未実装。現legacyのlatest-observation/latest-decision fenceを弱めて、処理中の判断や遅延を消してはならない。fresh SI Native genesis/body/scene、controller producer domain/TOTALと新Sourceの実受入、実測batを含む通常試合・正式9回は引き続き未検証。

## Fresh Native match genesis（実DB）

`AuthoredNativeMatchV1` は2つの明示clock manifestから18人のnominalモデルを生成し、同じcareer/namespaceの新規DBに、2club/roster→18Person/fielding/observation/decision/locomotion→正式fixture/pregame bindings/初期Match/初期World→投手2人のrelease geometry→身体19件→scene assembly→初回physical batter actorを実Native ownerで登録する。既存DBはopen(wx)で拒否し、ID変換・保存行の差替え・既定物理値・結果イベントを入れない。全body/pose/reach/rating/game値はcallerが明示する。nativeInitialWorldReady=trueだがnativeLiveExecution=false/nativeMatchReady=false/officialResult=null。

Native fixtureはhome9/away9の18人、active scene10人/50primitives、投手2人と打者用の別materializationを含む19件。基準body/pose/releaseは既存公開synthetic fixtureと同じ宣言値、時刻は本compilerの1e6ticks。90ft diamondを明示。実NLB/MLB本人の計測値ではなく、MMDも使わない。旧固定IDの二つのTAKEから始めるfixtureは呼ばない。

実Native21試験PASS bccd8b17597044ba9c2139114bafe5de、全体TSC df7b225f29d24208bba29c01e13fe987。新processの元owner再読PASS968895e15d244546b8fba9739d4121f5（0.641s）。31tablesの全schema/全logical rows不変、初期World/actor/18models/19bodies/scene一致。model/body parameter作者callbackは使わない。pregameの必須game authorityは元game scopeをread-pinsに固定し、保存Native season/fixture/Personと照合する。gameDayを改変したpinは拒否、guardは変更しない。

閉DB outputs/verification-authored-native-genesis-v1/genesis.sqlite SHA9ebc9c9fae9df52cd938fb27cc405f324d1d1ce971b8be903d01fa89f1e74570。元DBは不変。別processはprivate copyを使用し、Native constructorのWAL/header byte変更とlogical row不変を区別した。worker bundle cc318efc19f7da348b1721bf6c5a8cd67f6834de1d5d053212acc4f25f791ea6/760inputs、build/reopen reportを収録。

初回Native testFAIL820ee77...は再読時のpregame game authority不足。新しいread helperに元scopeとNative読取を渡して修正し、元ownerを弱めていない。初回TSC d685cda...未使用test変数、次bcc8310...fresh actorの型がactivation actor unionを含んだ点は修正し原FAILを保持。最初のBody/World-only PASS61868ca...、actor追加後PASS e39709fb...も保持。

次はこのactor/scene/modelsを、明示workload/投球・打撃model・初回reservation/dispatchへ接続する。measured batを共有Coreへ実接続し、継続する9守備/保持/送球/走者/裁定を動かす。単に旧TAKE fixtureをID差替えで呼ばない。初期World/静的body registrationを9人の運動・打球処理や正式9回成功として数えない。
