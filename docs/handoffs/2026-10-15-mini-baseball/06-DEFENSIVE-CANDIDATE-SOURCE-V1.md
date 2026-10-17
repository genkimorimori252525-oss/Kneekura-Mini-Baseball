# 守備候補・チーム選択・選手別抽出 v1

純計算層と Native Source owner 層を区別する。純計算層の全出力は `nativeAdmission: false`、参照付き出力は `sourceAuthority: opaque_refs_require_native_owner_verification` を維持する。Native owner は元 Source の再認証・再導出を実装し、真正 SQLite コピーへの個人候補 Source 1件の保存・独立再読が通過した。9候補・チーム選択・9人別抽出の真正保存は検証待ちであり、チーム運動の採用・公式裁定はこの変更に含まれない。

## 実装と旧形式の境界

純計算層は `src/host/world/DefensiveCandidateCalculationV1.ts` に置く。既存 `DefensiveExecutionCalculation.ts`、decision store、Same-PA execution、CoreWorld、TeamCoverageExecutionGate の採用条件を変更しない。Native owner 接続は後述の新2モジュールと Root担当の field-action 委譲であり、旧 Source の再保存・hash 変更や schema migration は行わない。

`calculateDefensiveCandidatesV1(input, calibration)` は同じ `generateDefensiveIntentCandidates` の全候補を元の順序・優先度・証拠時刻のまま保持する。選択結果と decision/motor scheduling は既存 `calculateDefensiveExecution` を使用し、既存 JSON の `selected/scheduling` と一致する。新しい情報は別の v1 出力に置くため、既存 Source JSON/hash を変えない。

## 三つの投影契約

1. `createDefensiveCandidateSetProjectionV1`: 個人の元入力、実効 calibration、全候補、旧個人選択、scheduling、登録守備位置と参照束を保持する。参照束は本人 observation、decision model、plan、effective calibration、既知 geometry、各 perceived cue の causal reference。geometry は座標 cue がある場合に必須で、各 cue と参照は元の順序で対応する。
2. `createDefensiveTeamSelectionProjectionV1`: 9人の候補投影を元入力から再計算・比較し、既存 `createTeamCoveragePlan` の DP を使用する。個人の第1候補だけに削減しない。9位置・9選手の一意性と元候補を保ち、球処理役と塁カバーの競合は既存 DP が解決する。
3. `extractDefensiveActorSelectionV1`: チーム選択を再計算・比較し、指定選手の assignment が本人の元候補に属することを確認する。candidate reference、candidate index、candidate、assignment、元の scheduling を返す。個人の旧 selected へフォールバックせず、新しい目標座標を受け取らない。

`TeamCoveragePlan` は assignment の `selectedPriority` を既存の 1e-12 単位へ丸める。候補への所属比較も同じ丸めを用いる。候補集合内の生の `localPriority` と既存計算は変更しない。

## 時刻・因果・改変の検査

- Source 参照は ID/hash の形式と play、revision、`observedAtTick <= availableAtTick <= cut` を検査する。個人の候補参照 cut は `startedAtTick`、observation 参照は本人 perceived observation time に一致させる。各 causal cue 参照はその cue の観測時刻までに利用可能でなければならない。
- 本人 observer と self を一致させる。ball/player memory は元観測が cut 以前、prediction が本人 observation time に一致することを検査する。未来 communication/cue、自己を teammate とする commitment、重複 perceived player、不明 cue、余分な target ingress field を拒否する。
- 既知 geometry と perceived cue は呼出側の元データであり、この計算器は canonical world を読まない。未来の正本 target・外部 assignment・運動結果を入力する API を追加しない。
- 入力は `cloneInert` でコピーし、出力は再帰 freeze する。候補・個人選択・calibration・scheduling・チーム assignment の部分改変は再計算比較で拒否する。重複選手、役割競合を含むチーム改変、元候補にない actor assignment を拒否する。

**参照の認証は行わない。** 同じ opaque ID/hash を掲げて入力と計算結果の両方を作り直した場合、この投影だけで元 Source との相違を検出することはできない。SHA の形式や再計算一致を、Source の実在・本人所有・正式採用の証明にしない。geometry/causal cue の導出そのものも、実データから Native owner が独立に確認する必要がある。

候補の生成 cut と、計算された `decisionTick/movementStartTick` は異なる。未来の scheduling は予定であり、認識完了・実行済み・ball possession・OUT を意味しない。

## Native owner 接続（個人候補1件を検証・チーム契約は検証待ち）

既存 owner で本人 observation、ratings/model、元 plan、独立 effective calibration、原 geometry、実 teammate motion/communication を認証した後、同じ入力から candidate-set v1 Source を登録する。Caller の任意 target は登録しない。現在の support-geometry 導出を使用する場合も、原 receipt と原 geometry・実運動参照から cue を再導出して比較する。

チーム owner は同一 game/play/revision の正式9参加者と各 candidate-set Source の実 ID/hash、登録位置、利用可能時刻、失効・再計画状態を確認する。全候補から既存 DP を計算し、元 candidate-set references と選択内容を別の team-selection v1 Source へ保存する。投影の `nativeAdmission:false` を caller が true に書き換えて採用する方式は不可。

実行 owner は team-selection Source を認証し、各 actor の元候補への所属と scheduling を再抽出する。各 actor の本人観測、能力、実効 motor calibration と実世界の checkpoint を既存経路で確認し、既存 rated motor へ渡す。個人の旧 selected に置き換える方式や、仮説チーム計画だけで Gate を開く方式は不可。実運動と field checkpoint の保存・再読まで検証して初めて Native 採用の証拠になる。

この候補契約のテスト PASS は、完全 Native9回、全9 actor のチーム dispatch、守備役割の正史採用を証明しない。

実装接続の候補は既存 `pa_physical_v1_field_steps` の別 action kind として追加する方式である。既存 schema の ALTER、旧 receipt の再保存は行わない。個人 candidate action は元の `defender_decision_v1` step の参照だけを受け取り、その owner が保存した本人 observation、priorities、supportGeometry、calibration reference、nominal model を再読する。新しい任意 cue/target/数値 calibration を request に置かない。team action は9 candidate step refs、actor action は team step ref と member のみを受け取る。

候補 Source parser は `SamePlateAppearanceDefensiveCandidateSourceV1.ts`、readonly SQLite rederivation は `SamePlateAppearanceDefensiveTeamFromSqliteV1.ts` に実装した。Root担当が既存 field-action union/parser/result union/derive switch/noAdvance へ薄い3case委譲を追加した。既存 selected-only step は残し、新計算がその旧選択と scheduling に一致することを再検証する。Native Source の真正保存・独立 reopen は個人候補1件で通過した。team/actor Source は9人 fixture を待つ段階で、完了を主張しない。actor motor 接続はこの3 Source の保存・再読検証後の別工程である。

Native helper は readonly transaction/query_only を要求し、Source・snapshot hash を含む field-operation reference を元 DB owner で再認証する。root/previous と新 Source の current/historical view も再読する。9人の元 decision は異なる lifecycle view を持てるため、元 calibration は decision 当時の historical view に束縛し、新 current view へ付け替えない。本人の最新 decision/observation、同 lineage/game/play/pitch/root、同 evaluationTick と exact originTick/elapsedSeconds を要求する。元 decision 以降は承認対象の sensory/decision/new3 metadata に限り、field/timeline/evaluationTick の byte 不変を要求する。catch/throw/実運動を越えた再使用は拒否する。

各結果は `movementAdmission:false` を保持し、候補計算内の `nativeAdmission:false` も維持する。team Source は元候補から DP を再計算し、actor Source は team 選択を再計算して所属候補を抽出する。旧個人 selected は原計算の整合性検査にのみ使い、チーム選択を旧 selected へ戻す fallback はない。Rootが管理する census 等の consumer 安全性は別途検証中で、未確認 guard を一括緩和しない。

## 検証

`DefensiveCandidateCalculationV1.test.ts`: 全6役割を含む元候補一致、旧 selected/scheduling JSON 一致、実効閾値、9人 DP と actor member 抽出、候補・target・時刻・選択の改変拒否、未来参照・本人観測違反・geometry 欠如・重複選手・役割競合の拒否を検証する。原 fixture は controlled pure data で、実 SQLite Native Source とは主張しない。

実行済み: 新7件、既存個人計算4件、TeamCoveragePlan8件、DefensiveDecision13件の合計4ファイル32件 PASS（8.906秒）。全体 TypeScript 検査 PASS（26.141秒）。機械実行証拠:

- `docs/ai-continuity/verification-receipts/MB-20261015-DEFENSIVE-CANDIDATES_85711da5a1c24197bcc3174b86879daf.json`
- `docs/ai-continuity/verification-receipts/MB-20261015-DEFENSIVE-CANDIDATES_f82ae67d2cc64d26b9e6d98322af86c3.json`

新 Native parser の3件（参照だけの3契約、caller target/calibration等の拒否、readonly transaction外の拒否）と既存個人計算4件・pure candidate7件の計14件 PASS（9.468秒）。全体 TypeScript PASS（29.282秒）。これは Native 3 Source の保存・reopen・9身体運動の証明ではない。

- `docs/ai-continuity/verification-receipts/MB-20261015-DEFENSIVE-NATIVE-SOURCE_a5802a134a224da9b22a24218b3768fc.json`
- `docs/ai-continuity/verification-receipts/MB-20261015-DEFENSIVE-NATIVE-SOURCE_2ee5f32b42b64080aa87cc510e6c2f5a.json`

真正試験は `work/native-team-dispatch/accepted-one-decision-checkpoint` の固定 capture の別コピーを用いた。元 current view cut15 と元 defender-decision-0 の Source/snapshot references を original owner で独立再読した後、新 candidate Source を owner admission し、新しく開いた store で再読した。field/timeline/evaluationTick は保存前と byte 一致した。`work/native-defensive-source-one-proof-v2/source-progress.json` に Source `a311e28d...` / snapshot `e2499a56...` と `movementAdmission:false` を保持する。直後 lifecycle prefix/totals/view 更新も完了した。`single-candidate-proof.json` と、metadata memo 撤去後の production 最新 bundle による `production-owner-reopen.json` を保存した。後者は candidate Source/snapshot references と新 current view の再読一致、読前後 DB SHA `f2ec6fc3...` 不変を確認する。9身体運動・team Source・actor Source の PASS ではない。fixture の role priorities と身体配置は synthetic で、校正された自律守備戦術の証拠にはしない。

初回は nominal model の完全 ratings を narrow timing input に渡したため、余分な field を拒否して保存前に FAIL となった。`work/native-defensive-source-one-proof/source-owner-failure.json` と旧 bundle を保持し、Native helper が元モデルから `situationalAwareness/firstStep` を明示的に投影する2行修正を行った。元モデルの全 hash 認証、perception/cue guards、旧 Source JSON/hash は変更していない。回帰を含む3ファイル15件 PASS（9.187秒）、全体 TypeScript PASS（28.546秒）。

- `docs/ai-continuity/verification-receipts/MB-20261015-DEFENSIVE-NATIVE-SOURCE-RATINGS-FINAL_0380f8a56b314af083ace3d56c362a1f.json`
- `docs/ai-continuity/verification-receipts/MB-20261015-DEFENSIVE-NATIVE-SOURCE-RATINGS-TYPECHECK_2ef5c17ab35d4009b8538737e37a7238.json`


