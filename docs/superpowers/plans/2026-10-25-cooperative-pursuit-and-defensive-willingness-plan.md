# 複数追球・連続dive・守備意欲の改善実装計画

> **For agentic workers:** 実装時は本書とSpecを読み、必要な `superpowers:executing-plans` の機能だけを適用する。主担当が実装し、具体的利益のある調査/レビューのみSolへ限定分担する。全taskで新しいagentを起動する方式は採らない。

**Goal:** 追加の捕球価値を各選手が判断して前後の追球・連続dive・失敗後の捕球を行い、試合状況と既存の個人心理が危険を引き受ける判断へ因果的に作用するようにする。

**Architecture:** V118の個人認識→候補→採否→motorを維持。安全な進路の任意commitment、連続身体clearance、再起込みETAを加える。心理は既存Appraisal/ActiveEmotionを再利用する別段階とし、物理・能力・結果を直接補正しない。

**Tech stack:** 既存TypeScript/Vitest/Node、既存ブラウザharness/単独HTML/Worker。追加依存・新UI基盤・SQLite所有の移植なし。

**Spec:** [複数追球・連続ダイビングと個人の守備意欲](../specs/2026-10-25-cooperative-pursuit-and-defensive-willingness-design.md)。**状態: 計画案、製品実装未着手。** 今回の本人依頼は計画と意見であり、下記checkboxは実装済みを意味しない。

## Global Constraints

- 最新の本人指示、formationは参考/説明できる別解を優先、world-first、read-only Presentation、個人の観測/採否を優先する。
- 最大追球人数、positionでの担当、成功/失敗/OUT、捨て試合を固定する命令を作らない。
- PNG原本・4px表現・既存見た目・絶対能力・個人差・緑得能・信頼・球場・公式ruleを保持する。
- 既存traitの `pursuitCostWeight` への反映は一回。感情が非発火なら感情由来効果は厳密に0。重要度からの直接倍率、走塁risk channel流用は禁止。
- 未受信の進路/他者の私的心理・医療・予定touch・未来の捕球失敗を戦術入力へ渡さない。物理guardが使う実行真値と分離する。
- 初期の心理05は採用済み設計、後続のheadless心理実装は存在、Liveは未接続と区別する。未承認の育成DRAFT全文を根拠へ昇格しない。
- 旧JSONの必須項目、公開能力、共有v1 APIを変更しない。任意のversion付きLive context/projectionで接続する。
- 旧HTML/元JSON/原監査/全FAIL/UNKNOWNを保持。shared reset/clean、無断Source commit/push/merge/deployを行わない。

## Review Focus

1. 先行者の宣言で全員がカバーし、後続捕球の価値が消える。Task 1の対照で固定人数なしを確認する。
2. 前後に分かれても安全guardが拒否、または離隔を緩めて身体が衝突する。Task 2の連続軌道証明とunknown/unsafe対照を必須とする。
3. 再起中に移動/送球したり、再起時間を二度加算する。Task 3で実motorと自己/他者の推定を分けて固定する。
4. 重要度が感情ゲートを迂回し、全員同じ心理/能力になる。Task 4で非発火差0・個人差・既存consumer/traitの互換を確認する。
5. cancel/replay/表示時刻が古い意図・心理・未来結果を再利用する。Task 5でscope/revision/epochと保存/先読みを横断検証する。

## 提案interface一覧

以下は**未実装の提案名**。実装前に既存ownerとの整合を再確認し、同責務の既存関数があれば再利用する。型を追加しただけで機能が接続したとは扱わない。

| Owner | 提案する入出力 |
|---|---|
| `LiveFieldPursuitV1.ts` | `buildLivePursuitOptionsV1(context: LivePursuitContextV1): readonly LivePursuitOptionV1[]`。本人の観測・能力・受信情報から、異なる捕球窓/追従/回収を返す。optionはID、既存intent、観測tick、目標点/時刻窓、到達見込み、追加捕球価値、空ける場所のcost、不確実性を持つ |
| `LiveFieldCommitmentV1.ts` | `LiveFieldCommitmentV1` はschemaVersion1、issuer/command/revision、発行/開始/終了tick、採用済みの身体進路区間と撤回条件。`readLiveFieldCommitmentV1(raw)` でinert dataを検証する。共有戦術の決定権は持たない |
| `LiveFieldCoordinationV2.ts` | `createLiveFieldCoordinationV2(options)`。既存の配送時刻lawを再利用する単一の有界queueにlegacy messageとschemaVersion2のenvelopeを受ける。旧v1 reader/APIは変更せず、version2はlegacy intentと任意の検証済み進路予告を包む |
| `LiveAthleticClearanceV1.ts` | `certifyLiveAthleticClearanceV1(input: LiveAthleticClearanceInputV1): LiveAthleticClearanceResultV1`。提案された本人の動作、実行が確定した相手の区間、身体寸法、fence/停止余裕から `safe/unsafe/unknown` と証拠を返す。誰が捕るかは返さない |
| `LivePostActionArrivalV1.ts` | `estimateLivePostActionArrivalV1(input: LivePostActionArrivalInputV1): LivePostActionArrivalEstimateV1`。基準tick、本人/観測由来の身体状態、既知の実行動作、目標と既存motor制限から、actionReady時刻/位置/速度、移動見込み、不確実性を返す。裁定eventを生成しない |
| `LiveDefensiveAppraisalV1.ts` | `appraiseLiveDefensiveEmotionV1(input: LiveDefensiveAppraisalInputV1): LiveDefensiveAppraisalResultV1`。既存重要度/Appraisalと同じ入力束からv1互換のappraisal候補と守備projection sidecarを作る |
| `LiveDefensiveWillingnessV1.ts` | `resolveLiveDefensiveWillingnessV1(input: LiveDefensiveWillingnessInputV1): LiveDefensiveWillingnessV1`。既存緑選好、平常の戦術価値、検証済みの任意感情projection、本人に既知の身体状態/受信方針から、追加追球価値と危険costを返す。能力/保持/成功率は返さない |
| `LiveDefensiveTacticalValueV1.ts` | `deriveLiveDefensiveTacticalValueV1(context: LiveDefensiveTacticalContextV1, policy): LiveDefensiveTacticalValueV1`。Hostのfield play開始前のmatch snapshotからscore/inning/half/outs・既知/不明の残機会・source/tickを受け、戦術価値とAppraisal用localLeverageをversion付きで返す |

新しいoptionは既存の `ball_handler/intercept` 等へ変換し、別の並行戦術engineを作らない。追加の進路候補は本人ごとに前側/後側/回収の最大3系統とし、既存の球の予測精度/時間幅を落とさない。探索上限の棄却もログへ残す。

## Task 0 — 旧版・再現入力・性能の開始前固定

**Files:** 新 `docs/verification/<implementation-task>/baseline.json` / harness / budgets.json。元資料は本計画の検証folder、`defense-multiple-approach-2026-10-25/`、V118のbuild/publish/Source pins。

**Interfaces:** V118 Core・9人の実入力・旧JSON・同時刻Sourceをconsumeし、不変baselineと修正対象のREDケース、開始前の性能予算を後続へ渡す。

- [ ] V118 Core `66e48938...`、Native169、旧3HTML/sidecar9file、原JSON、身体/球場/能力とSourceをhash固定する。新Task IDを使い、旧receiptを再実行証拠にしない。
- [ ] 二遊間の「双方通常追球」「先行失敗/後続保持」「双方失敗」「前後の実dive候補」「交差して危険な候補」、1Bのdive→自力触塁と回復中ETAをRED/観測fixtureとして固定する。
- [ ] 0.01J等の極端な保持介入は境界試験と明記し、自然な失敗頻度の合格に使わない。成功fixtureのために能力や球場を後から隠れて調整しない。
- [ ] 実装前に、同端末・固定5場面で各20反復、旧最遅1場面で各3反復のcold/再利用計測を行い、p50/p95/最大・完走・終了後GC heap・通信/trace量を固定する。並行CPU負荷も記録する。
- [ ] 提案する採用予算は固定場面のp95≤開始前p95×1.25+25ms、最大≤開始前最大×1.25+50ms。これは工学上の予算案で、MLB実測係数ではない。小標本の最遅3回に統計的p95を主張しない。実装開始時に固定し、結果を見て緩めない。

## Task 1 — 追加の捕球価値と前後の捕球窓

**Files:** 新 `src/core/sim/fielding/LiveFieldPursuitV1.ts` とtest。既存 `LiveFieldDecisionV1.ts/.test.ts`、`LiveFieldPlayV1.ts`、`LiveFieldDecisionTraceV1.ts/.test.ts`。

**Interfaces:** 既存個人認識・自分の状態・届いた宣言をconsumeし、上記 `LivePursuitOptionV1` と、本人の候補/採否/棄却理由をTask 2へ渡す。

- [ ] RED `keeps_following_interception_after_a_teammate_claim`。味方宣言の有無だけで追球optionが消えないこと、前後の異なる窓が残ることを確認する。
- [ ] RED `does_not_send_all_observers_to_the_same_cover` / `can_keep_a_far_player_in_useful_support`。同じ宣言を受けた9人が本人の距離/能力/必要性で異なる案を持て、無意味な全員追球/全員カバーを避ける。固定人数はassertしない。
- [ ] 競合costを、早い味方がいるだけの罰から、本人が知る異なる捕球窓と先行失敗時の追加価値・空ける損失へ改める。味方の到着/捕球を確定未来にしない。
- [ ] 同じ経路がまだ有用なら継続し、方向変化/失敗の知覚/通信撤回は再計画triggerにする。毎tickの交互交代、宣言での全員yieldを作らない。
- [ ] GREEN: 新unitと既存decision/perception/coordination/trace試験。trace ON/OFF、再生frame頻度、列挙順でphysical結果・乱数消費が変わらない。判断説明に追加価値・不確実性・空ける損失を残す。

## Task 2 — 採用済み進路と連続身体clearance

**Files:** 新 `LiveFieldCommitmentV1.ts/.test.ts`、`LiveFieldCoordinationV2.ts/.test.ts`、`LiveAthleticClearanceV1.ts/.test.ts`。既存 `LiveFieldCoordinationV1.ts/.test.ts` は互換確認の参照、`LiveFieldPlayV1.ts`、`LiveFielderAvoidanceV1.ts/.test.ts`、`LiveFielderAthleticV115.ts/.test.ts` の必要箇所を変更。

**Interfaces:** Task 1の本人option、届いた進路予告/本人採否をconsume。実行層には個別に採用されたcommandだけを渡し、安全な実動作と拒否/撤回理由をTask 3以降へ渡す。

- [ ] RED `allows_two_adopted_nonintersecting_dive_corridors` と `rejects_crossing_swept_bodies_even_with_high_willingness`。手前/奥や横に分かれた動作は連続時間の安全を証明できれば両方許可し、同一点への身体交差は拒否する。球への腕reachだけで身体全体の安全を代用しない。
- [ ] RED `keeps_unknown_peer_future_conservative_without_freezing_everyone`。未来が未確定ならunknownとして通常追球/別窓を本人が選べる。最大速さの円を機械的に縮めてsafeへ変更しない。
- [ ] 新envelope/adapterで任意の `commitment` を運び、inert allowlist/ID/revision/有効tickを検証する。旧v1 readerへ新fieldを追加しない。`legacy_v1_replay_is_identical` / `unsupported_envelope_version_is_rejected` / `v2_adapter_accepts_legacy_with_same_timing` をRED→GREENにする。commitment不在はunknown。受信/採用前の予告で戦術やmotorを上書きしない。
- [ ] safety層で、独立に提案/採用された複数の身体軌道を同時検証する。身体長、腕/脚、飛び込み、着地・滑走・再起、停止余裕を含む。未確定の他者進路を真値の未来として作らない。
- [ ] 既存のfoot/hip/shoulder/head/gloveと身体寸法から保守的なcapsule/掃引体を作り、既存の区間境界・連続曲線のbounds/細分化を再利用する。未知の手足形状は明示した保守境界を使い、標本点の最小距離だけでsafeを証明しない。新しい人体査定項目や描画品質低下を導入しない。
- [ ] tactical側へ返すのは本人の実行可否と利用可能な代案だけ。詳細な他者の未観測command/真の失敗未来は診断専用とする。拒否を理由に中央の正解担当へ差し替えない。
- [ ] safe証拠を検証対象の全command ID/revision・開始身体状態・world revision・開始tick/有効区間に束縛し、同tickの実commitで原子的に再検証する。`peer_revision_or_withdrawal_invalidates_old_clearance` / `later_commands_avoid_already_airborne_committed_path` を固定する。意図採用/予告だけでは物理commit済みとしない。
- [ ] RED→GREEN: 予告未達/辞退/失効/取り消し、同tickの競合、catch後の認識遅延、airborne中の継続を確認。近接/正面衝突/fence/異なる身長・dive幅でも全連続制約を維持し、ゼロ時刻loop・永久待機なし。
- [ ] 実際の先行保持失敗→球の反発→後続の新しい認識→後続dive保持、および双方失敗を成立させるfixtureを保存する。成功例未成立のまま「連続dive実装完了」としない。

## Task 3 — 再起後の到達予測と自力触塁/送球の比較

**Files:** 新 `LivePostActionArrivalV1.ts/.test.ts`。既存 `LiveReceiverArrivalV106.ts/.test.ts`、`LiveRelayPlanV1.ts/.test.ts`、`LiveDefenseControlEstimateV95.ts/.test.ts`、`LiveFieldPlayV1.ts` と関連test。

**Interfaces:** 実行中の本人動作、または観測/届いたcommitmentから分かる他者動作と既存motor lawをconsumeし、actionReady境界以降のETAを守備/中継/走者判断へ渡す。真のbase/control/event schedulerへは渡さない。

- [ ] RED `carry_eta_cannot_precede_required_recovery`。元1B fixtureの予想到達1.335650秒が実再起1.394412秒より早い状態を捕捉する。
- [ ] RED `chooses_carry_or_feed_with_the_same_post_action_timing`。同じ球で回復時間、投手の移動、走者速度を一つずつ変更し、自力/他者受球/後続送球の比較へ同じ待ち依存が反映されることを確認する。投手coverを強制しない。
- [ ] 自分は既知の曲線から回復後の位置/速度を取り、他人は観測/予告に基づく推定と不確実性を使う。反応/再起/姿勢/持ち替え/力込めの並行と直列を明示し、既存回復項目を二度足さない。
- [ ] absolute ready tickを単一ownerから返す。次の数値は待ち依存のunit fixtureであり、選手の実測値/本番定数ではない。基準2.0秒、recoveryReady2.8、recognitionReady2.6、transferReady2.7。carry開始はmax=2.8、移動0.5秒なら3.3。transfer後charge0.3秒が必要ならchargeReady3.0、他制約を含めたreleaseReadyはmaxで求める。身体profileが「chargeは再起後」と指定する別fixtureならmax(2.7,2.8)+0.3=3.1にする。
- [ ] `no_action_matches_previous_eta` / `parallel_wait_uses_max_not_sum` / `carry_relay_runner_do_not_add_recovery_twice` / `observation_age_is_subtracted_once` をRED→GREENにする。例: 観測1.0秒で回復残0.8秒ならready1.8、現在1.3秒で残0.5とし、別helperで再度ageを引かない。
- [ ] GREEN: 自力の実保持/実足の接地と塁接触、正当なOUT/SAFE、中継の各実受球・二つ目の再判断、走者側の実進塁を照合。回復待ちで球/身体が瞬間移動せず、描画頻度で裁定が変わらない。

## Task 4 — 試合状況・個人Appraisal・感情ゲートからの守備意欲

**Files:** 新 `src/core/world/psychology/fielding/LiveDefensiveAppraisalV1.ts/.test.ts` と `src/core/sim/fielding/LiveDefensiveWillingnessV1.ts/.test.ts`、`src/integration/browser/LiveDefensiveTacticalValueV1.ts/.test.ts`。既存 `EmotionTypes.ts` / `EmotionGate.ts` / `appraisal/SourceAppraisal.ts` / `appraisal/MatchImportance.ts` / `fielding/EmotionDefenseReplan.ts` はまず再利用し、互換testを維持する。

**Interfaces:** 大会/順位ownerのversion付き重要度入力、本人の性格/経験、公開された局面、本人に既知の身体状態/受信済み方針から任意のLive contextを作る。出力は個人の候補価値/costとgate済みprojection。新しい恒久能力/傷害結果は生成しない。

- [ ] RED `inactive_emotion_has_exactly_zero_fielding_effect` / `high_importance_is_not_a_direct_attempt_multiplier`。局面等を固定して、非発火の内部感情値/重要度由来圧力だけを変えても個人判断とphysical結果は一致する。
- [ ] RED `same_event_can_motivate_frighten_or_leave_a_player_calm` / `green_trait_is_applied_once`。既存安定性/経験/性格だけを一変数で変え、別感情または平静が残り、緑得能の二重乗算がないことを確認する。
- [ ] 平常の戦術価値には点差/回/アウト/走者/残機会を用いる。大会重要度や順位争いは既存 `deriveMatchImportance`→`appraiseEmotion`→`evaluateEmotion` に渡す。「大差」「国際大会」等から直接の全員倍率を作らない。
- [ ] Hostのfield play開始前snapshotから任意の `LiveDefensiveTacticalContextV1` をmapperへ渡す。`deriveLiveDefensiveTacticalValueV1` が別versionのpolicyでlocalLeverageを導き、既存 `ImportanceInput` にscore/inningを混入しない。`post_play_score_is_not_available_before_the_fact` / `unknown_extra_inning_horizon_is_not_fabricated` / `legacy_absent_context_is_not_connected` を固定する。残機会はrule上分かる範囲とunknownを区別する。
- [ ] 新wrapperは同じAppraisal入力束から候補別の守備risk projectionを導き、正規化した追加寄与も候補の `behavioralImpact` 比較へ含める。その後に既存gateへ渡す。元v1の6channel/API/保存は維持し、wrapper/model versionを分ける。`runningRiskDelta` の使い回しは禁止。
- [ ] projection sidecarはscope、appraisal/candidate/source snapshot ID、model version、emotion revision、有効tickで束縛する。既存 `WITHOUT_EMOTION → SINGLE_EMOTION_GATE_APPLIED` の所有/重複適用防止を保持し、選ばれた一つだけを使う。解除後の残留効果0、同じeventの二重Appraisalなし。
- [ ] RED `fielding_impact_can_select_a_different_single_emotion`。旧6channelではA、追加守備寄与込みではBが最大のfixtureでBだけを採用する。`neutral_sidecar_is_v1_identical` / `augmented_checkpoint_replay_recomputes_sidecar_and_selection` / `tampered_or_stale_sidecar_is_rejected` を固定する。ID一致だけで信用せず、同じsource/modelから寄与とsidecarを再計算して照合する。
- [ ] 旧JSONで未接続なら `NOT_CONNECTED` / 追加効果なしとし、平静を確認したとは記録しない。接続済みsourceの欠損/失効/不整合は既存API同様に更新を拒否し、直前stateと診断を保全する。`missing_connected_source_does_not_clear_active_emotion` を固定する。無効な新判断を生成/完了扱いせず、誤ったneutral化や有効期限の延長で隠さない。
- [ ] 通常ロースターへ架空の心理査定を埋めず、閾値・初期値・係数はモデル校正前に本番既定値としない。怪我の発生器・診断・治療/出場可否ownerは置換しない。
- [ ] GREEN: 大差の通常試合、同じ点差の個人的重要度差、終盤接戦、ポストシーズン/国際大会/敗退危険、恐怖/やる気/平静、既知の回復中状態を対照。高意欲でも届かない/衝突するdiveは成立せず、低意欲でも必要な通常守備と回収は残る。

## Task 5 — 共通Host・記録・メーカー・HTMLと段階的採用

**Files:** 既存 `src/integration/browser/LiveBaseballMatchV1.ts/.test.ts`、`LiveFieldInputV95.ts/.test.ts`、`FieldPracticeWorkbenchV98.ts/.test.ts`、必要なworkbench-index、既存守備ログ、別名build/publish/check入口。心理の表示は承認済みWork契約だけをconsumeする。

**Interfaces:** Tasks 1–3の同CoreとTask 4の任意Live contextを通常/練習へ供給。記録はseed/input/モデル/状態・actor/観測/command/心理revisionを保持する。Presentationは一つの有効な感情種類と時刻を読むだけ。

- [ ] RED: 旧JSONの読み込み/編集/保存取消/再読、既存感情v1 replay、感情contextなし、neutral projection、体格/能力/信頼/球場一変数でデータの恒久書換えがないことを確認する。
- [ ] RED `display_cohort_change_cannot_change_willingness_or_physics`。公開能力の比較集団だけを変更して、同じ実大会状況/心理/能力/seedの判断と実結果が完全一致することを確認する。表示ランクを本人の心理入力へ逆流させない。
- [ ] 任意Live contextの厳密version validationを追加する。内部の検証切替を通常ユーザーへ大量の技術設定として露出しない。通常と練習を同じmapper/判断/物理へ接続する。
- [ ] ログへ「前側/後側の捕球窓」「追加関与の価値」「危険/unknown」「採否/撤回」「再起後ETA」「戦術と感情の各寄与」「入力欠損」を日本語で出す。全trace上限2048/通信保持256を維持し、現在表示時刻より先の情報を出さない。
- [ ] RED→GREEN: 同seed再現、描画OFF/seek/各視点のread-only、Workerと直接Coreの同値、新試合/指示/能力/身体状態/心理revision変更時のepoch破棄とfrontier再開。途中取消から古い候補/心理を再利用しない。
- [ ] Task 0予算に対し同じ試行順・端末で計測する。通常運用でshadow二重実行なし。cache keyは正確な観測/身体/commitment/能力/球場/方針/心理revision/model IDを含み、丸めで別入力を同一視しない。残存heapは開始前値+64MiB以内を予算案とし、peak未測定なら区別する。
- [ ] 共通Coreの最終候補で9回完走・全守備complete、1倍速16球のqueue underflow0/最大12/warmup4、main heartbeat<1秒を確認する。9回で全動作が出なくても専用fixtureの証拠を別に保持する。頻度と勝敗を特定OUT数へ合わせない。
- [ ] 第一段階は3HTMLを別名配置し、旧V118と元JSONをhash保全する。心理は本人入力の出典/校正と、感情マーク・効果の同時発火/解除、Workの表示handoffが揃うまで通常有効化しない。その場合は心理未接続と明示して第一段階だけを完了扱いにする。

## 実行する検証コマンド（将来）

既存Node/Pythonを使い、task IDと実command/log SHAを保存する。未作成のtest/entryは実装時のRED用であり、現在PASSとは扱わない。

```powershell
npm run typecheck
npm test -- src/core/sim/fielding/LiveFieldPursuitV1.test.ts src/core/sim/fielding/LiveAthleticClearanceV1.test.ts src/core/sim/fielding/LivePostActionArrivalV1.test.ts
npm test -- src/core/sim/fielding/LiveFieldDecisionV1.test.ts src/core/sim/fielding/LiveFieldCoordinationV1.test.ts src/core/sim/fielding/LiveFieldPlayV1.test.ts src/core/sim/fielding/LiveFielderAvoidanceV1.test.ts
npm test -- src/core/world/psychology src/core/sim/fielding/LiveDefensiveWillingnessV1.test.ts src/integration/browser/LiveFieldInputV95.test.ts src/integration/browser/FieldPracticeWorkbenchV98.test.ts
node --test tools/browser-bridge/background-match-v116.test.mjs
```

9回/旧JSON/背景/1倍速/画面は既存harnessへ新しい成果物folder・証拠folder・version prefixを渡す。固定V118 builder/publishを別版のまま上書き再利用しない。

## 完了・復旧と今すぐの結論

完了を二段階で記録する。第一段階は複数追球・実連続dive・安全・再起予測と3HTMLまで。第二段階は既存感情ゲートからのLive接続と表示/記録/校正まで。どちらも参考図の担当再現やOUT数だけで合格にしない。

失敗時は新候補/安全adapter/心理bridgeをそれぞれ版付きで切り離し、固定V118と元JSONへ戻せる状態を保持する。共有差分を一括で戻さない。現在の計画作成では製品Source/能力/物理/HTMLを変更しない。

主担当の推奨: 先に心理OFFで複数追球と連続diveを自然にし、その後に「何を守りたい/どこまで挑みたいか」という個人Appraisalを接続する。大差だから全員消極的、重要大会だから全員無謀、という逆のパターン化を避ける。
