# 実試合への素材・審判・ロビン・走塁の接続計画

2026-11-01。人間が明示した実装依頼。描画担当の制作タスクは引き継がず、制作済み素材を参照して使用する。元realism Goalは本人指定のPAUSEDを維持し、その再開や完了扱いをしない。既存の試遊候補・旧FAIL/UNKNOWN・既存保存・原画像を保護する。

## 試合の動作と使用素材の対応表（実装前・調査中）

| 試合状態・役割 | 使用する素材／根拠 | 採否と現在の接続 | 欠落・取扱い |
|---|---|---|---|
| 右投overhand投球、青、捕手視点 | `accepted-art-v2/catalog.json` の `b2-overhand-v3:1..6` | 本人採用。前回試遊HTMLに6段階の限定接続済み | 手元・接地の正確な一致や他の投球姿勢は未検証 |
| 球審・セット／判定等 | catalog `plate` 24件、hands-on-knees mask付きv2、arms-spread right-arm-fold-v2、overhead-twist leg-reversal-v3、time丸指v2 | 採用状態およびイベント対応を個別確認して接続する | 動画順・時間の根拠がない動作は勝手につなげない。球審歩行A/Bは確認候補 |
| 塁審・safe/out/fair/foul | catalog `base` 5件、front/rear等 | 採用状態と試合イベントの意味を確認する | 動作条件や位置の不足は未対応と記録 |
| 捕手 | catalogのhome/away・肌variant、catcher-layered | 最新の衣装分離を維持 | `ball-left`は800×720のlayered指定。旧全身PNGへ戻さない |
| Robin守備／投手 | `robin-defense-v1/manifest.json` 最新69件 | 56件本人採用、13件は髪/向き修正候補 | 修正候補を黙って旧原画へ戻さない。打者・左投左打・可動rig/衣装maskは未登録 |
| B2/Robin左右真横歩行・走行 | `locomotion-four-directions-v1` 採否記録 | OWNER_REJECTED。旧版を含め使用禁止 | 正面・背面の新素材は候補で、技術PASSだけで採用としない |
| ちんすけ打者 | `b2-afro-regenerated-v1/batting/owner-adoption-2026-10-28.json` | 4姿勢と確信2姿勢を本人採用 | 原画にbatが含まれCore物理batと二重描画しない。gripは未確定 |
| TBD衣装 | `output/b2-defense-motion-probe/tbd-uniform-integration/runtime-adapter.js` | home本人採用、away最終採否未確定 | catcher-layeredを保持。未対応姿勢・away袖の課題を隠さない |
| Pooh打席 | `pooh-parts-v1` の原本WebP/GIF | stance.webp 14×50ms、swing.gif 28×30msを原本で保持。追加生成禁止 | 新スイング・高さ別を作らず、表示時フィルターで丸ドット化 |
| B2サイドスロー投球 | catalog `b2-sidearm-v1:1..6` | 台帳採用、試合未接続 | 利き手・視点・姿勢の意味が一致する場合のみ |
| B2牽制・守備 | 台帳: 牽制9、内野24、外野7 | 台帳採用、実試合への個別接続は未確認 | 投手ライナーは向き訂正の最新版候補があるため旧画像へ戻さず未採用のまま |
| B2打撃 | 台帳: 後方固定の構え、振り出し、高さ別impact/follow | 台帳採用、実batとgripの整合は未確認 | 利き手・方向・高さを合わせ、物理batの二重表示を避ける |
| ロッツォ | `purple-beard-planned` の修正follow | followのみ本人採用、他の構え・守備・走行等は候補あり | 攻撃時半袖。未解決の手・batを隠さない |
| スライディング | 台帳の足／頭からのスライディング | 台帳採用、実試合への個別接続未確認 | 本人の向き・状態条件に合う時だけ表示 |
| その他選手・投手・打者・走者 | 台帳と各フォルダーの最新指示 | 調査中。動作・向き・利き手・衣装で一致する採用素材のみ | 不足方向を別素材で黙って代用しない |

## 実装・軽監査順序と受入条件

1. 表を最新の各採否記録で補完し、本人採用／候補／没／不明を区別。演技の順序・衣装・対象identityを推測しない。Coreのactor状態と採用素材の能力が一致する箇所から小さく接続。
2. 審判：公式野球規則8.03(a)(b)は球審を捕手の後方、塁審を差し迫った判定に適した位置とする。4人制では本塁と各塁を担当（https://www.mlb.com/glossary/rules/umpire 、 https://content.mlb.com/documents/2/2/4/305750224/2019_Official_Baseball_Rules_FINAL_.pdf ）。構えは打者と捕手の間のslotを参考（https://www.littleleague.org/university/articles/plate-mechanics-explaining-slot/）。左・右打者でslotを入替え、球審目線に打者と捕手を写す。審判座標はpresentationの観測でCore裁定を変更しない。塁審は当初配置とイベント別の追加動作を分け、根拠のない固定距離を公式値と称しない。
3. Robin：指定`RobinPitch.ts`は旧Naturalの球筋上書きで現Coreにはそのまま投入不可。物理的に非現実な波・加速・消失などはメーカー候補から除外し、その理由と旧資産を保持。旧非現実球の試合側全面禁止までは本人指示していない。210km/h直球は変化球でないため無断削除しない。実Coreと共通の球軌道を用いるRobin用の簡易投手メーカーを接続し、球種/調整/通常試合への引渡し・保存互換・実経路を検証。現Coreに対応づけられない球種は未対応として明示。
4. 走塁：既存 `LiveRunnerAdvancePolicyV1.ts` は2アウトの空中打球でtwo_out_advanceを既に扱う。実経路と複数走者で挙動を検証してから不足のみ改修。リード量は盗塁と走塁の高い方の適性を反映し、監督から指定できるようにする。盗塁・牽制・帰塁・投手牽制能力と捕球能力は世界状態/時間・選手能力から決定し、偽の結果だけ追加しない。本人は追加回答で、牽制時の「捕球力」は塁で送球を捕る守備者の能力と明示。走者側は反応・加速・走力などを扱い混同しない。現在の通常経路は盗塁/牽制中の動的走者を未接続。元ルールの無関係な変更はしない。
5. 観客：home/awayと守備攻撃をイベントから区別し、それぞれ自軍のヒットで反応。状態や結果をpresentationが決めない。
6. ラグ：前回warmup1は初回各1回4.14→1.69秒だが球場camera cache miss135–295ms、v8品質切替は非採用。既存receipt・動作中handleを再利用し、測定対象と条件を固定した上で小差分を比較。描画品質・4px grid・55ms cadence・Coreやrecord/continuationを保ち、部分的な改善を全試合へ拡大しない。
7. 実試合の状態遷移、打者/捕手/衣装、手・足・遮蔽、実WorkerとCore、実UI・保存再読込、browser/Worker errorを監視して確認。未対応と候補は完成扱いしない。新規artifact/receiptは一意出力し旧結果を上書きしない。

## 現在の確認済みと注意

元candidate SHA `04dd205b8c0035f4ef20f7394e79beb8287d322696dc80fc5ca9102ef28872b5`。直近の限定試遊・障害・根拠は `2026-11-01-playable-art-stadium-latency.md` とCCG CURRENT。既存sourceは多数dirty/untrackedであり、既存ファイル編集前にbytes完全backup＋SHA、同時作業者の変更を戻さない。読取only監査結果が揃う前に未知の役割を推定しない。

## 追加検証・走塁

- 満塁・2アウトの空中打球を `simulateLiveFieldPlayV1` で1例実行し、3人とも `two_out_advance` と実際の塁離脱を、最初の野手接触または着地より前に確認。専用設定で対象1 testのみを機械的に収集して実行、receipt `PLAYABLE-ART-STADIUM-LATENCY-20261101_a2de59cb32e44acc9817838f35935ae0.json` PASS。固定された単一fieldシナリオであり、通常HTML・他状況・全試合・盗塁・牽制の証明ではない。
- リードは投手の初動時点における塁と走者の重心との距離として扱う（https://www.mlb.com/glossary/statcast/lead-distance ）。MLB記事の11.73 feetという値は単一選手の観測例であり、A～Fの対応や全選手の校正値として使わない（https://www.mlb.com/news/paul-goldschmidts-lead-distance-helps-steals/c-141464286 ）。

## 走塁Core共有契約の独立レビュー

Astraによる限定レビュー（2026-11-01、source読取のみ）はversion付きopt-inの独立アクションとcontinuationを推奨。既存 `issuePitch` は牽制でもpitchCountや2秒の時刻を進めてしまうため、その中へ投球なし牽制を押し込まない。論理的占有塁と位置/速度・route/controller・反応待ち・帰塁義務・接触履歴、ball保持・受球者の運動/捕球を同一絶対tick cutで継続。actionOrdinalとpitchCount、牽制乱数domainを分ける。旧versionはopt-in無しで変えず、未対応versionを黙って旧形式化しない。

初めの実装単位は一走者のリード→投球→打球contact cut→field継続を、非ゼロ速度・反応待ちを含む分割/非分割実行で一致させる。その後、投球なし牽制、非接触投球後の捕手送球、複数走者を追加。離塁距離はmax(走塁,盗塁)を意図/目標に作用させ、瞬間移動しない。監督指示、投手動作、塁受球者の捕球、走者の反応/加減速は各別。観測prefixの未来独立、保存再開・Worker一致、牽制のみではpitchCount/カウント不変、実facts由来の単一裁定を検証する。レビューは実装・実証ではない。

## 描画遅延の局所候補（非採用）

`work/stadium-trig-cache-03804b22f6b048e89f38bc5000e139ea/` は球場投影の三角関数をcache missごとに事前計算する局所差分。元HTMLへ逆変換bytes一致。Chrome 156 headless・固定seed・静止した初期試合の5視点を各2回比較し、10場面のcanvas/actor depth/field/keyすべて一致、page/Worker監視窓のエラー0（teardown配信race UNKNOWN）。receipt `e8a53ea6cf184f08b30038f679757780`。球場cache miss各10回の中央値は旧164.1ms、新155.6ms、最大旧264.4ms、新268.8ms。各1系列で環境ノイズ・順序効果があり改善を証明できず、55msにも達していないため非採用。試合全体の性能を推論しない。

## 本人による素材対応の明示（2026-11-01）

ナッパにB2捕手素材を汎用モデルとして適用してよいか尋ねたところ、本人は「うん。ごめん。ちんすけ（アフロ）とロッツォ（紫）とロビンしか専用描画モーションはないんだ。」と回答。ナッパを含め、これら専用モデルを持つ選手以外にはB2を汎用モデルとして使用できる。各素材の採用/候補・没方向・最新衣装/レイヤー・意味が合わない動作の代用禁止はそのまま。Pooh原本WebP/GIFと生成禁止も引き続き維持する。

## 現時点の追加成果と未解決（2026-11-01）

- 球審カメラ: `work/umpire-camera-20261101/run-0c5df8e739a24abfbb87121cb3980273/candidate.html`。左右打者で球審位置・捕手・打者を観測、初球Core record/continuationは元版一致。位置は試作値。審判姿勢は重なりが大きいため未採用、塁審待機素材未確定。
- Robinメーカー: `work/robin-breaking-20261101/run-af0b03baebd1416b83bb6930021deb8f/candidate.html`。現Coreの通常物理6球種・速度/回転・試投・snapshot保存読込・roster接続。指定された非物理の旧変化球はメーカーで扱わず旧sourceを変更しない。固定seed同一条件の初球 `e68d20ea31df400b9a19429ebb205733`、2球目 `dbe1dfd43dda47e6890fa2a61d13a334` で試投と実WorkerのSource一致、後者は試投中pitchCount不変。疲労構成は明示未対応、全球種・全試合は未検証。初速pin誤記・Source条件違い等の旧FAILはEVIDENCE_INDEXに保持。
- Robin高球速: 実Workerに捕手が接触するが保持load 191.016J > capacity 159.172J、反発球は物理Coreで生成済み。通常Matchはそのlive-ball successorを扱わず停止（`fcd88139b495448a8c10633dcaea1387`, `5790cf09e10d4d129d0ea55dc76057e6`）。自由球0.1秒だけ継続 `6c0ac203c38242a4a9560a4320cc5805`、再捕球/走者/裁定/保存を含む試合継続はHOLD。
- 走塁: 作業copy opt-inで投球中・contact・fieldへ同planを渡し、contact前の実離塁factを占有走者に限定し保存、実Host固定seedの一塁走者で非ゼロ速度連続と離塁1件を確認 `d41afb5b8cf243eeaf46b0e916f34ba9`。実ブラウザーWorker/正式保存/atomic commit/盗塁・牽制/複数走者やルール全般は未完成。過去FAILを削除しない。
- アウェー客: 候補の実Core記録frame注入でhit確定後にsector 55–59のみ変更。実連続再生/実home試合、4pxとhit瞬間のcache miss負荷は未確認。候補を製品へ無検証統合しない。

## 捕手の保持失敗後の世界モデル: 限定独立review

Astraは静止actorを既存観測の復元ではなく投球前にversion・座標・collider・速度・時間範囲を宣言する新Core物理モデルとしてなら導入可能と判断。過去Robin結果に合わせた推測状態の後付けは禁止。既存capturing gloveの運動やbatを静止で上書きせず、捕手bodyは既存physical authority `(0,.8,-1.2)` を初期候補として保つ。release→接触cutで新colliderとの先行接触を連続探索し、一致しなければ新モデルで投球から再計算する。

初期scopeは空塁・balls 0–2・strikes 0–1・非打撃接触・zone判定済みを明示検査。ball/glove/colliders/contact履歴/打撃・zone証拠を同一absolute tickで引き継ぎ、再接触の離脱証明、各候補の最早接触、保持が続いてsecureTickへ到達した事実、custodyを要求。未対応の競合・欠損・未確保はHOLD。closureは次投球に移れる限定内部状態であり公式dead ballとは区別。count適用は1回だけ。旧保存や既存経路はopt-in無しで不変。これらは設計判断であり実装/検証済みではない。

## ロビン旧球種の試合内使用（本人回答）

2026-11-01、波状・ジグザグ・加速・消失等の非現実的な旧球をメーカーから除外する一方、ロビンとの試合では使うか尋ねたところ、本人は「試合では原作どおり使う」と明示。`RobinPitch.ts` の旧11球種を原本保存し、旧挙動をロビン専用試合の選択可能な計算へ接続する。画面だけの差し替えではなく描画・投球の球・バット接触/裁定が同一球筋を参照、表示消失と球の物理存在は区別し、乱数・時刻・セーブ再開・Workerの再現性を保つ。通常の投手メーカー/実在物理球へ混入しない。旧軌道と現Core solverの差・未対応は明示し、旧Goalを再開したと扱わない。

## Robin原作軌道と実Coreの共有契約（独立review）

Astraは旧PitchPath点列をversion付きRobin専用canonical区分線形Sourceにし、通常Coreのcontact/zone/frames/replayへ同じinstanceを通す案を推奨。原作波式を解析関数として再評価したり表示のみ差し替えたりしない。旧base pathもpinし、現Core着地点への旧変形だけでは旧投球全体互換と称しない。JSON descriptorへID/version・originTick/ticksPerSecond・旧dt/点列・spin/orientation・hiddenAfterT・有限有効期間・生成元hash・確定sampleを保持。

旧BatContactは点列を線形補間し範囲外clamp、速度は `(P(t)-P(t-dt))/dt` の後退差分。区間位置微分・衝突探索speed boundと互換接触応答速度は別々に保持し、各旧dt境界で探索cellを分割、角の前後速度を区別する。旧理論式の変化時刻を新たに入れて補間を変えない。旧reference上の範囲外clampと実Coreの有限有効期間を区別し、期限外・未知version/ID・接触未解決をHOLD。

hiddenAfterTは可視性/打者光学観測を止めるがball・bat/glove接触・zoneの物理存在は継続。初接触で旧強制軌道を終え、同じmoment・速度・spin/orientationを通常free-ball successorへ渡す。捕手予測に未来真値を漏らさない。固定球でもbase/boost/angle/zigzagPhaseの4drawを消費し、Robin専用domainとsampleを保存し再生/再開で再抽選しない。旧angleDegが未使用なら効果を追加しない。

テスト: 11球種の旧点列・補間/後退差分/4draw、全dt節点前後・屈曲/加速/plate後/不可視区間の最早接触、contact→successor、分割/JSON保存/Worker/replay、opt-in無し旧経路。同reviewは読取のみで現時点では未接続。

### 線形Sourceの探索上界と精度

`findFirstSourceContactV94` はcell両端のgapとball/collider速度上限・時間幅・position丸め上界で接触無しを棄却する。Astraは旧dt全区間でcell分割し、初期は全点列に共通する `S=max_i sum_axis(abs(P[i+1]-P[i]))/dt` を各演算の外向き丸めで上界にする案を推奨。旧後退差分速度を探索上界へ使わない。旧式 `t/dt` の境界丸めで隣区間が選ばれ得るため、区間局所上界は隣接/誤差帯の証明なしに使わない。補間/区間選択の一評価誤差をEとしpositionRoundingBoundに少なくとも2E、証明不能なsubnormal/overflow等はHOLD。Math.hypotまたは最終nextUp一回のみで丸め安全性を証明しない。

Source上界を満たしても、現contact探索側の速度加算・時間積・gap計算の丸めまで厳密に証明されたわけではない。厳密保証にはRobin opt-inで棄却閾値の上向き丸め・gap誤差区間・未解決の伝播が必要。未知条件や予算枯渇をclearへ変換せず、通常球の既存経路を無断変更しない。この見解は設計reviewで実装/実証ではない。

### Robin補間の限定誤差上界（独立review追加）

origin=0のelapsed-seconds位置評価、|各座標|≤1000m、1e-6≤dt≤1秒、長さ≤100秒、有限期間と現演算順を固定した範囲では、二進64bit点/dtを実数に解釈した厳密区分線形Fとの誤差を各座標<0.000481m、3次元L1 E<0.001443m、2E<0.002886mと抑えられ、0.01mは保守的。除算誤差<2e-8、節点積と減算の合算<1e-13秒、比の誤差<2e-7、最大座標差2000による誤差<0.0004m、隣segment選択の追加<0.00008m、座標演算<1e-9mの緩い包絡を使用。旧位置 `raw-i` と現位置の両者を共通Fに対して評価する。

任意の巨大originSecondsやtick→秒再構成では節点潰れや量子化誤差があるため上界を流用せずHOLDまたは別途証明する。Core側gap/閾値丸め・hit判定・無隙間coverageは別の未証明事項で、Source上界だけで接触探索全体の厳密性を主張しない。数値域外/overflow等はfail closed。Astraの読取reviewであり実試合への接続証拠ではない。

### Robin旧軌道と移動バットの非接触上界（独立review）

Astraは現在の端点差による候補が時計変換・外向き丸め・実バット半径の包含を証明しないと判断。限定版は固定identity姿勢/linear grip、optional C1/motor/aim/impact/envelope禁止、dt=1/240・sourceClock=240・originTick=0・playbackRate=1、0–100秒・frame≤10000・grip成分≤100m・L≤3m・半径≤1m、実形状が宣言capsuleに収まる契約を必要とする。

同時計ずれを避ける粗い証明として、全grip keyの各軸範囲を共有し、各軸を `L + batRadius + 1e-10m` 拡張、各旧球区間の両端範囲を `ballRadius + .000481m` 拡張する。加減算ごとnextDown/nextUp、有限/overflow検査、strict分離で全区間が離れる場合のみ当該batとのEXCLUDED。接線/重なりはUNRESOLVED。元球誤差域の前提、バットcapsule包含、identity演算、subnormal等も検証する。整数μsへ旧dt境界を丸めない。全世界の安全を証明するものではない。

実HeldToMeasured bridge gripはcubic Hermiteで、端点だけでは包めない。制御点凸包とde Casteljauの区間演算・全到達分岐を包む必要があり、一般回転/quaternion正規化・tip軸長誤差は未証明。一般版・未保証形状はHOLD。reviewは読取のみ。

### Held→bridge→measured 限定boundの再review

変更された `held-bridge-candidate.ts` と `outward-cubic.ts` に対するAstra read-only review: 過小包絡の明白な欠陥はなし、ただし限定昇格は未完。4段de Casteljauの区間演算/境界合併、半径の逐次上向き丸めとstrict分離は適切。昇格条件は、制御点成分≤100・u∈[0,1]の3段mixの各絶対丸め≤1e-13/計≤3e-13を含む実評価誤差≤1e-10mを導出、identity正規化/zero/+Y・bridge w=1をruntimeで固定、bridge/measuredのu範囲とendpoint hold/finite lease/昇順safe-integer keyの一般幅を検証すること。

返却controls/boxの `v*seconds/3` と実motion `v*(seconds/3)` は演算順が異なり、現fullBox判定自体の欠陥ではないが、返却値を実制御点の証拠と呼ばない。phase境界前後・1tick幅・±100/符号混在・接線・ほぼゼロ余裕で裁定対象fullBoxそのものを検査。これらを閉じても当該identity bat/capsuleと旧球の限定EXCLUDEDだけであり、他collider・一般回転・全matchは未証明。

### Type4固定域のSource誤差上界（追加独立review）

Astra read-only review: |各座標|≤20m、.004≤dt≤.005秒、duration≤1秒、points≤256、origin=0 elapsed、binary64最近接・現演算順の限定で、点/dtを実数視した厳密区分線形Fに対し、各座標誤差<5e-11m、3D L1 E<1.5e-10m、2E<3e-10m。1e-8mは保守的。根拠: raw除算<1e-13、node積<3e-16秒、減算含む<1e-15秒、補間係数<1e-12、係数誤差<4e-11m、隣segment選択<8e-12m、座標演算<1e-12m。既存実sampleは |coord|≤16.64、dt=1/240、duration≈.696、168点。ただし入力guardの実装が必要。

末端で `floor(t/dt)` が最後のpoint indexへ丸まり `atNode=false` の場合、`segments[index]` が範囲外となる可能性を別途排除する。巨大origin/tick逆変換は別証明。gap・探索閾値・hit・coverageは未証明であり、Source上界だけで判定品質を証明しない。新boundの固定Type4実験は別receiptで行い、従来.01/.0029やHOLDは保持。

## 最新版の成立条件と球場検証の訂正（2026-11-01）

本人は試合が始まらないと指摘し、旧Robin全11球と直球で実試合が進むものだけを最新版とし、全球場・先発選択と既存品質を維持し、途中の仮候補を最新版扱いしないよう要求した。

`work/stadium-selector-20261101/pitch-check.cjs` および `work/stadium-selector-all-20261101/check-fixed.cjs` は `matchPreview.inspect().generatedPitches` と `matchPreview.inspect().match` を参照していた。これは旧プレビューstateであり、実試合の `liveMatchPlayback.inspect()` / Worker record・historyではない。先に報告した「実Workerの1球成功・切替後match不変」は証拠不足として撤回する。レポートは原本を保持し、テストPASSを新たな意味で包装しない。球場描画の選択差は観測済みだが、実試合進行・同値は未知。

独立browserの本来操作では、実Workerは `live pitch: 有限候補で実行可能な準備・回復を確認できません...` を返し、実history/受理球0であることを観測した（`work/playability-20261101/events-real.jsonl`、seed未記録で再現条件UNKNOWN、正式receipt未確認）。有限候補の不足と物理的に不可能な姿勢のどちらかは未特定。sourceや制約を根拠なく緩めず、seed/command/詳細sidecarを保存した別診断で修正する。

## 初球finite準備失敗の改善設計（独立review）

本人の実試合開始不能に対し、固定fixtureでは準備動作65–70m/sがsweet-spot上限40を超え、既存 `ObservedDirectionRegistrationV153` は身体制約と予測接触成功を同時要求するため「打てる計画なし」と「身体動作不能」が同じnullとなっている。実測clip標本速度28–36m/sだけでは初期stanceからの連続接続を証明しない。Astraは、(1)既存成功経路/乱数は維持、(2)失敗時のみ同じ観測・意図から接触成功を要求しない身体指令をversion付きで選択、(3)投球前に固定・保存されたheld姿勢/速度からC1連続軌道を作り明示能力の範囲へ時間伸長、(4)予定接触時刻を超えても再照準せずその実軌道をbatSample/物理接触へ渡し、intentと実offerを別にして野球判定へ接続、を推奨。未来球筋を事前姿勢へ利用したり、nullを無条件take/strikeに変換しない。

現入力では加速度能力が任意で一部未設定。実測clip差分を選手能力上限と誤称せず、必要なら根拠と範囲を明示した運用modelまたは追加データを使い、証明不能はHOLD。旧成功ケースのexact・全Robin球/左右打者・未来独立・位置/速度連続・能力上限・部分motionのcontact/offer・保存再開/Workerを必要に応じ検証。reviewはread-only、実装・受理の証拠ではない。

## 本人の実試合受入に対するCore同等精度の独立review

2026-11-01の本人指示は全Robin球で実試合を進め既存品質を失わないこと。Astraは、既存normal Core自体が `findMovingSphereContactTime`、通常の二次方程式・EPSILON 1e-12・Math.sqrtとExactEventTimeのroot-noise許容を用いることから、Robinだけに浮動小数全実数の新たな厳密証明を要求し全HOLDする根拠は既存契約/本人指示にないと判断。既存Coreと同等の数値semanticsを使う限定実装を進める。数学的完全保証は主張しない。

条件: 実際のRobin canonical linear segmentと実actor静止/linear区間、位置・速度一致、全bat/glove/body/ground/zoneと同tick競合を無隙間で探索。1/240秒/1e6 tickの非整数区間にceil/floorで隙間を作らず局所連続時間でrootを評価し元時刻から量子化。最初の接触のincomingから既存応答し旧強制軌道を失効、実ball・actor・material・保持/生球/continuationを引継ぐ。有限・実ゲーム値域/既存契約を境界で検査、unsupportedはHOLD。旧normal経路は変えない。既存receipt `1a9d212222ad4900b4b6d517b1550eae` は別Sourceの局所診断なので採用実証ではない。境界/接線/初期重なり/移動相手/非整数境界/同tick、旧通常回帰、11球の実Worker進行と次球を検証。

### 既存審判モデルを保つfinite失敗fallback（独立review）

Astraは、通常Coreが現状 `swingOffered` を観測後intentから決め、捕手保持後にその値で空振り/zoneを決めることを確認。既存の成功経路/乱数を完全維持し、従来はfinite探索全滅で未成立だったcaseだけ、同じ観測cutoff・clip・intent/誤差から選んだ実batを過去held位置/速度へC1連続接続し、指定40m/s等を守ってtime-dilationし、同一released ballとの物理接触を探索したうえで、未接触時には既存intent-based審判モデルを明示versionで維持する案は、既存Core相当の限定品質に条件付きで整合すると判断。身体offerが実測で証明されたと誤称しない。

未指定加速度は `UNSPECIFIED_NOT_ASSERTED` であり能力内の保証に含めない。指定済み上限は必須。観測前のheldへ未来依存referenceの平行移動をかけない。過去boundary/速度不一致、接触探索・応答・捕手保持失敗の後継未接続はHOLD。新しい身体offer規則を全経路に必須として勝手に厳格化しない。既存成功record/events/RNG exact、未来変更prefix不変、連続性/明示上限、実contact/未接触/未解決、Worker/保存再開、原作11球の試合進行を検証する。新fixture/作業copyだけの研究であり、実試合受理は未了。

### Type2 nextUp witnessの独立review

Astraは既存Coreと同じ数値semanticsのnextUp witness自体を条件付きで採用可能と判断し、`d1b5b42652ad4ebeaad29b002f6d17c8` のType2→次球/replayは1 fixtureに限ると確認。ただしrootとwitnessの間のbat/glove/actor候補、およびrootより後だが同tickの競合を再確認しておらず、nextUpがlinear segment末端を越える場合と次segmentの同tick候補を落とす危険がある。witnessは元segment内・同tick条件とし競合再評価、範囲外/未決はHOLD。接線でoverlap witnessが得られない場合をclearにしない。initialContactのgap/rounding/speedは実witnessと該当区間の値にし、既存離脱/再接触を維持。微小正gap/間の別contact/次segment同tick/tick跨ぎ/接線のfocused testが必要。

加えてPitch catcher bodyとfield ready位置の不一致による瞬間移動が別に発見され、Type2の上記成功は修正前fixtureであり正式採用できない。元receipt保持。
