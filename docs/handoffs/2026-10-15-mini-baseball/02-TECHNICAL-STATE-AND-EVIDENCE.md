# 02. 最新コード、ブランチ、試作HTML、実行証拠と未完了ゲート

**観測時点:** 2026-10-15 JST。証拠の所属ブランチ・Source版・実行経路を必ず保持する。実行したテストのPASSを実行していない別ゲートへ外挿しない。

## 1. リポジトリと作業環境

| 項目 | 実証された値・扱い |
|---|---|
| Repo | https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball |
| Default main | 元設計READMEの古い状態。最新実装をmainにあると判断しない |
| 非描画正史統合の親branch | codex/current-nonvisual-owner-integration-2026-10-08、2026-10-15実査HEAD 79f4e01622e98a2a7cfb893fe8e504c334856add |
| **今回のNative/PNG接続＋汎用守備branch** | jolly/tbd-lad-native-browser-core-2026-10-14 |
| 最終ソース保存基準コミット（このhandoff docの追加前） | 150ebb54b08902411d1d573eacaae99b6673c472 |
| Draft PR | #380 / https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/380 / base=codex/current-nonvisual-owner-integration-2026-10-08 / 未マージ |
| PNGブラウザ独立試作branch | jolly/tbd-lad-playable-2026-10-14、SHA 63624318450845827e05fe3d3780eaf5dc464a45 |
| 旧PNG・描画仕様branch | jolly/core-foundation-plan-2026-09-17、SHA 7993518eff216382543abe7636adee7bca277058 |
| COS Win workspace | C:\Users\genki\Downloads\スーパージョリーアジト\Kneekura-Mini-Baseball-Bridge-20261014 |
| 2026-10-15最終確認の未管理ローカルファイル | dist/native-proof-1200px.png、dist/native-proof-390px.png の2つの古い検証画像。**コード未コミットは source commit 150ebb5 で保全済み** |

GitHubのDraft PRや公開作業ブランチはマージ済みでない。基準を動かす前に実際のHEAD、未保存変更、同時作業者、GitHub Actionsを毎回点検。文書更新でできたコミットはこの表のSHAより新しくなるので、現在HEADの確認を優先する。

## 2. ソース仕様の優先順位

1. 最新のユーザー指示（01に全変更履歴あり）。
2. World-first／MiniとNaturalが同じCore／renderer read-only。現役 docs/game-design/05-world-first-live-ball-architecture.md、06-world-first-runtime-contracts.md、07-world-first-adjudication-contracts.md。
3. 既存の物理Source・RuleEngine・acceptedイベント・実機／テスト証拠。
4. docs/game-design/02-rules-ratings-defense.md、09-player-trait-catalog.md（悪球打ち）、09/23系 battery/match cadence設計、元9領域のdocs/project-status/2026-10-09-nonvisual-nine-area-status.md。
5. このhandoffと各コード分野の実装契約（最新ユーザー指示を反映）。
6. 旧HTML、旧v26却下patch、古い未実装提案。**現象の再現には使えるが正本へ昇格しない**。

既存 AGENTS.md は2026-09-20の古いデザイン境界を含む。ユーザーは2026-10-01にPixel Player JSONを保留しPNG継続を確定。最新ユーザー指示が同ファイルの古いDrone-Art/JSON方向より優先される。デザイン実装者以外は独自に新アートやHUDを作らない。

## 3. バージョン史：ここを間違えない

| 版 | 実装/問題 | 成立していないこと |
|---|---|---|
| v16 | 高品質で採用されたPNG/B1原画、グリッド、視点の重要な描画基準 | 単独の正式9回物理エンジンではない |
| v17 | 単独で球ごとにプレイできるブラウザ試作、独立ゲームエンジン | 正式Native Sourceなし |
| v18 | TBD vs 2025 LAD仮fixture。通常PNG、球位置倍密度、旧ブラウザ9回完走 | Native接続なし、能力200〜250の校正なし |
| v19 | 俯瞰赤走者名、外野名、打者視線→走者視線、フォロースルー、ファウル2/5秒スキップ | 先行Native計算なし |
| v20 | 見逃し球追尾、脅威に基づく送球先、次球から指示反映、タイムライン撤去 | 守備はブラウザの近似で本格連携未実装 |
| v21 | 偽エンタイトル2B、先着セーフ、壁跳ね返り、フライ捕球の混同を部分修正。バット27.5ms | やはり描画と判定の未完多数 |
| v22 | ブラウザ100固定seed・26,025球・1,495,567矛盾チェックPASS、14の改ざん検出PASS。BB走者描画と実着地を整理 | **旧ブラウザ専用**の部分不変条件 |
| v23 | 追加300 + 100 = **400試合／85,254球**旧ブラウザ整合性チェックPASS。捕手球表示、守備初期位置、回転拡大、制球/配球案、ベンチ演出を変更。ユーザーが見逃し追尾は「今のままで満足」と最終承認 | 実Coreの混合プレー9回未接続。後に球拡大HUDと遠近球・スピン、アウト後ベンチ切替等の不備を指摘 |
| v24 | v23 PNG内で**実Native投球・公式ピッチイベントの独立observer**を実行するPreview。旧9回とはゲーム状態を混合しない | 全打球・野手・公式裁定は未接続 |
| v25 | 実Aero RK4投球・剛体スイング／衝突を既存PNG画面上の別モードで観測。オフライン単体HTML。左上回転拡大HUD/最小球の問題は残存 | 主ゲームは旧v23エンジン |
| v26 | 球視認性と一塁走者のGO二塁→一塁専用枝を試した | **ユーザーが場面別併殺パッチを設計方針として拒否。参照/原因調査用にのみ保管。製品へ移植禁止** |
| v27 | 表示専用で左上回転拡大HUD削除、遠距離球を連続光学倍率。球サイズを最小1pxで固定しない。B1/旧試合計算不変。PC/スマホ幅PASS | 汎用守備AIと実Core9回の完成ではない |
| **v28** | **現時点最新の実際に遊べる提示HTML描画候補**。投手視点を奥行きで球面表示、球面上の縫い目／角速度の視覚化、俯瞰の**打球だけ**更に小さく。左上HUDなし。PC幅1200/スマホ幅390検証PASS | 元の旧v23エンジンとNative observerのモード分離は続く。実Coreの本物の母集団能力/多人数併殺/9回混合試合には到達していない。Userがv28描画を目で正式承認したとの証拠はない |

### v23・v25・v27・v28 のSHAと引き継ぎ対象

| ファイル | SHA-256 |
|---|---|
| ばせぼーるlv16.html | 554081cc8668d6ee82318d16bede3b451f1e5fee94137a0784cff88c189c0c22 |
| ばせぼーるlv23_TBD_vs_LAD_物理描画再監査.html | d2fe73e920e3910984bac26271e36521c4d7821438215295241bbcc3eaf9d3f4 |
| v25-native-aero/ばせぼーるlv25_TBD_vs_LAD_正式Core空力接続.html | 5aa2d7dc14fccc052a8b85291a6425e105afd84f176c9fa804e36a2481dbdff8 |
| v26-work/ばせぼーるlv26_TBD_vs_LAD_球視認性とフォースプレー.html（**採用禁止の特例**） | 386873aa53bd9e66508f73e456681fc1890fb76247b016059fc6a1250f2cf5f5 |
| v27-work/ばせぼーるlv27_TBD_vs_LAD_描画視認性先行版.html | c613574b377afd19060d89100c1bd7c1fa693efd42361c77ed7ab21943670f1f |
| v28-work/ばせぼーるlv28_TBD_vs_LAD_物理回転と遠近修正版.html | e2f378f53044bf40e54c135a4b5b6350f49c2a215446c47fd66bc03657e86a21 |
| 2026-10-15ユーザー提供の木製バット画像 | 986ff3c4267d54b695cd63631eb0d6f1d61f6f7f6c6bdc870907b5a6b35f6416 |

実物HTMLと画像・再生成スクリプトはこの会話で配布されたローカルartifact側に存在し、v28全量は2026-10-15のGitHubソースコミットにはまだ格納されていない。次のAIは**添付されるhandoff archiveを使って同じファイルを再展開**し、ユーザー自身の任意のコピーにあると決めつけない。将来の置換UIを勝手に描き起こさず、source付き旧PNGをrendererの基礎にする。

### v28の詳細な実装検査と限界

ローカル v28-work/build_v28.py はv27 HTMLのSHAを固定し、元の独立ゲーム計算とB1マスクをバイト保持してPresentationのみ差し替える。v28-work/test_v28_browser.py を2026-10-15に再実行して以下を実測:

- Chromium 1200×860 と 390×844 の両方で **PASS**、pageErrors 0、network requests 0。
- 同一球の投手視点距離別画面上径: **69/35/25/20px**（固定直径の貼付ではない）。
- 異なるspin reference 400/2400 rpmを球材表現に使い、spin sourceの描画を比較。
- Native別observerの参照球回転は **637.02rpm**、イベントは TakenPitchPlateCrossed と PitchAdjudicated。これをティカオの実RPＭと主張しない。
- 独立ブラウザゲームエンジンJS span 50,045 bytes: SHA 8b2261847469f842cdc9a7b7f4e0bf647d299e07e1e14972e6043006de17420f。B1 PNGマスク span 869,578 bytes: SHA dfd2c4bc4c807a6f3b547dcb4f0413e8b548294df4eab4ef25f72438f3198f51。v27から変更なし。
- **重要な不足**：v28の旧ブラウザ試合モードの縫い目は未校正の旧姿勢表現を含む。v28の Native spinProof は採用済み samplesからの近似積分によるProof。GitHub側ではこれを受けて別途 NativeSpinOrientationObserver（元RK4の時間変化spin）、NativeAerodynamicObserver.spinFrames の厳密な描画契約を追加済み。v28の完成HTMLへその最新版spinFramesを改めて接続する仕事が残る。

## 4. Native Coreの広域9領域

ソース状況は docs/project-status/2026-10-09-nonvisual-nine-area-status.md（2026-10-14更新）を参照。完了率の分母はないため％を作らない。

1. 物理履歴・原本archive・immutable store・retry/reopen → original 40-piece fresh 証拠あり。大規模長期試合性能は未完。
2. 球の取得・保持・持替え・送球・受球 → source・IFN suffix 証拠あり。LAN本来の終端までの統合が未完。
3. 走塁・ベース触塁・field rule・live appeal → 入力本体／接触・記録あり。LAN実合成未完。
4. 球場／dead ball／公式裁定 → 採用済み幾何のルール解釈は進む。屋根、フェンス上端、妨害、award、野球場ごとの例外未承認。
5. 試合終了・公式記録・得点・能力統計・workload・決済 → K/BBや個別suffix実証あり。全混合打球9回は未完。
6. ファウル・同打席次球 → FR01 freshで真正SWING/contact/foul/reset/TAKE証明あり。全変種は未実証。
7. 身体controller／recovery／反応 → Source移動は実装、個別試験成功。最新長い複合経路は未完。
8. 練習・育成・能力履歴 → 実反復／受理assessment保存はある。自律的査定・係数校正・外部生成は未完成。
9. Career/league/roster/economy → calendar/competition/contract等の基盤実装あり。1シーズン以上に渡る実試合・自動CPU判断・長期人口性能は未完。

### Source別の過去の厳密なPASS（現在HEADの総合証明ではない）

- 40-piece fresh: 64 original assertions、4578.339秒 PASS。
- Fresh actual first-base Positive: 50 original assertions、906.119秒 PASS。
- IFN retained suffix: 9307.868秒 PASS（前半が失敗した履歴と同一全体PASSではない）。
- FR01 fresh foul reset: 7511.742秒 PASS。
- National retained37: 12438.205秒 PASS。
- PL retained readback: 16表再確認、137.094秒 PASS。
- LAN01元複合経路は catch/custody/transfer/throw/appeal trial/物理boundary/journal import まで真正受理。残り original rights、結果確定、次打席、再読等**journal 4 + terminal 17操作**。別ケースのPASSを足してLAN01成功と言わない。

## 5. 今回の新規実装：何が存在してどこまで動くか

### Nativeからブラウザへ（実装済みコード）

- src/integration/browser/NativePitchObserverAdapter.ts: 実Core PitchAgainstBatterを呼び、canonical物理軌跡・カウント・イベントとMiniのrender sampleを同じ時刻で観測。打球後は偽OUTを付けず停止。
- src/integration/browser/NativeAerodynamicObserver.ts: **実RK4 Aero/剛体接触**のAccepted sourceから read-only spin/球/バット観測。最新は spinFrames 出力も追加し、源のrelease orientation有無、時間可変のspin履歴、衝突tickの遮断を保持。イベントと公式結果を生成しない。
- src/presentation/mini/NativeSpinOrientationObserver.ts: 実AeroのangularVelocityWorldRadPerSecondを格子区間ごとに積分し、Quaternion姿勢・露光中の回転量・alias警告・高頻度表示tickを出す。原releaseOrientation不明なら中立表示位相と明記。
- src/presentation/mini/OpticalBaseballGlyph.ts: 表示だけの球拡大と俯瞰・縫い目判定。衝突半径を変えない。v28の投手/打球別光学倍率は別HTML内で先行実装されている。
- src/integration/browser/NativeAerodynamicReferenceFixture.ts: 40m/s等の**比較用物理入力**。可変世界角速度/基準位相を指定できるが、ティカオの実能力プロフィールではない。
- src/integration/browser/NativeAerodynamicSession.ts: 1打席の厳密な命令境界。球の真のcontactで live_ball が未解決なら進行停止。
- src/integration/browser/NativeImmutableReplayLedger.ts: 固定seed/Source/physical sample＋immutable hash-chain JSON DTO、再実行元source検証、改ざん検出。**正式な発行元署名ではない**。IndexedDB保存層はまだない。
- tools/browser-bridge/build-native.mjs / check-native.mjs / build-demo.mjs: 実CoreソースからNodeなしIIFEを構築・実行検査。Node SQLite保存モジュールをブラウザへ移植したこととは別。

### 9人守備AIとNative実行境界

- src/core/sim/fielding/DefensiveDecision.ts: per-player perceived cue、覚知／作戦から ball_handler/base_cover/relay/backup/deep_coverage/hold候補を生成。
- src/core/sim/fielding/TeamCoveragePlan.ts, TeamCoverageReplan.ts: **9人の一意役割／担当塁の衝突回避／再計画**。Native本番へ完全接続済みではない。
- src/core/sim/fielding/ThrowPlan.ts: 失点・アウト・次塁リスクの**提供候補**評価。実源裏付けのない候補確率を勝手に生成しない。
- src/core/sim/fielding/GeneralDefensivePlaySearch.ts（今回追加）: 現実のball custody、9人の身体位置・速さ上限、受理済みForceObligation状態、走者到達下限、知能/反応時間、1〜4塁×受け手を有限先読みして2B→1B、本塁→1B等の**仮想行動候補**を導出。結果は hypothetical_only。将来のOUTを決めない。フライOUT／インフィールドフライ／未知Forceは fail-closed。
- src/core/sim/fielding/GeneralTeamTacticalCoordinator.ts（今回追加）: 9人のaccepted候補ソース、TeamCoveragePlan/Replan、上記探索結果を保持した読取り専用の協調ハンドオフ。**strategicSelection は pending_evidence で ThrowPlanの評価を待つ**。単に最大アウト数の候補を正本採用しない。
- src/integration/native-game/TeamCoverageExecutionGate.ts（今回追加）: Native Hostの現行対応 ball_handler/hold 以外を無条件に受理しない。9人計画に未対応 roleが混ざれば**部分採用せずblocked**。物理身体・公式OUTの結果は常に null。
- **本番Hostの未解決接続**: src/host/world/SqliteActualDefensiveDecisionStore.ts の source決定は ball_handler/holdのみ。SamePlateAppearancePhysicalFieldActionFromSqlite.ts も他roleを拒否。src/core/sim/plateAppearance/GroundBallProductionOutcomeCoordinator.ts は pre-pitchランナーや一塁以外の送球でunsupportedを返す。これらをスキップ／通し成功と偽装しない。
- 走者には RunnerDecision.ts や BatterRunnerWorldTimeline.ts があるが、実ownerによる強制進塁/タッチアップ知識と走者モーターを全混合プレーに接続する必要がある。

### Genuine 9回／live playのNative source実証

- src/integration/native-game/PhysicalGameSmoke.ts と .test.ts: **9イニング／178物理投球／58公式打席／四球4・三振54／押し出し1／公式1-0**。SQLiteを閉じて開き直し、58 closureとscoring receiptとHash・FK/Integrityが一致。原本由来だが**K/BBのみ**で実打球を含まない。
- src/integration/native-game/PhysicalLivePlaySmoke.ts と .test.ts（追加のpartial）: 既知SHAの物理一塁ゴロOUT fixtureに基づく**本物の打球終了**と adjudication official_ready まで達成。最新の追加テストでは小さな整合性ケース1 PASS、厳密full acceptance 1 SKIP。オプトインの通しはpolicy無指定で公式pendingに到達した失敗、policy設定後は340秒上限でclosure/scoring未完のまま中断。公式得点・Match state反映済みと言わない。
- docs/project-status/2026-10-09-nonvisual-nine-area-status.md の LAN01は別の元複合プレー。actual read performanceや元stage再開契約を維持し、重い元wholeを無闇に再走しない。

## 6. 2026-10-15に実行した新規の bounded 検証

所有者Windowsワークスペース上で:

- node tools/catalog/compile-catalog.mjs: **234 identities、1170 seed値、21 leagues、148 directed rowsを検証PASS**。
- repo全体 node_modules/.bin/tsc.cmd --noEmit --pretty false: **exit 0**。
- 汎用守備、チーム役割、公式Force、光学球、物理spin、Aero Source、immutable replay、Native受理境界、PhysicalLivePlaySmokeの限定Vitest: **11ファイル、88件PASS、1件SKIP（長時間Native実ゴロ公式closure）**。単独の新規汎用守備13件、チームCoordinator14件、Native受入ゲート6件、spin12件等を含む。
- v28-work/test_v28_browser.py: デスクトップ1200・スマホ幅390 **両方PASS、通信0、JS例外0**。継続する旧v23試合計算コードとB1画像SHA一致。実手機能ではない。
- 以前のv25のtrue native Chromium等もPASSだが、最新版v28の通常9回Native mixed playテストの代わりではない。

## 7. 未完／未承認と呼ぶべきもの

1. 真のTBD/LAD本人絶対能力200〜250、現行母集団の公開評価、ティカオ制球97とミット精度、3主導型バッテリー性格AI、ロサンゼルス2025の実能力の正本登録。
2. 真のNative bat/ball contact後の転がり・バウンド・材質・自由球→確保→返球→各塁→審判・公式結果・成績まで**一つのライブプレー**で完走し、9回の多様な打球を記録すること。LAN01残工程。
3. Hostで nine-player accepted TeamCoveragePlan を採用・動かし、base_cover/relay/backup/deep_coverage、2段以上の送球を自身のsourceとmotorに結びつけること。現在の検索AIは**仮説のみ**。
4. RunnerDecisionの明示ForceKnowledge／動作sourceと、本当に進塁・帰塁する走者履歴をGameまで接続すること。
5. 捕手/野手の secured custodyを前提にすべてのカメラで白球を消す、ゴロの実バウンド、即座の退場・ベンチ走行、自然なバット握り・スイートスポット、実ファウル方向分布、投手→守備視点の最新版全UI実装。**ユーザーの直近追加要求で、v28までに完成していないものを計画へ引き継ぐ**。
6. v28の新しい光学カメラと、NativeSpinOrientationObserver.spinFramesを本番PNG画面へ正確に統合。旧v23の独立エンジンの縫い目・人工スイングは「正式の物理spin」と呼ばない。
7. PC/Android/iOS単体オフライン保存・リプレイ／衝突防止、スマホ実機性能・fps/熱／画質設定、同時接続authority。Chromium390px合格だけでは全く足りない。
8. 球場roof/wall上端・dead/award・妨害、Career calendar/市場/assessmentの未承認policyを勝手に確定しない。ドラフト状態の roster-development仕様は別途レビューが必要。

**一つでも未解決の実物理・公式裁定があるとき、ゲームを進めるために仮の結果や旧v23 outcomeをNativeレシートへ挿入してはならない。**
