# 守備AI改善計画 — 個人の認識・判断・連携を通常試合へ接続する

> **実装担当へ:** この計画の実装範囲について本人の確認を得た後、`superpowers:executing-plans` を用いて段階ごとに実装・実検証する。主担当が実装し、必要な箇所だけ既存担当へ限定依頼する。担当やレビューを工程ごとに増やさない。

**作成日:** 2026-10-25 JST  
**Task:** `MB-20261025-DEFENSE-IMPROVEMENT-PLAN`  
**状態:** 計画案。今回の依頼は計画作成まで。以下の新しい処理・テスト・HTMLは未実装。  
**Goal:** 各選手が自分の知り得た状況から守備を選び、味方との連携を修正しながら実行する。参考サイトの守備図と異なっても、判断根拠と実際の物理に整合する別解を認める。  
**Architecture:** 現行Live物理・身体・裁定を保持し、その手前の認識、候補評価、連携を段階的に分離する。既存の個人知覚・通信・intent型をLiveへ接続し、中央一括割当は移行中の比較用に限定する。  
**Tech Stack:** 既存TypeScript / Vitest / Native browser Core / 同CoreのV116 Worker。新規依存なし。  
**Spec:** [今回の監査](../../verification/defense-reference-audit-2026-10-25/AUDIT.md)、[承認済み個人守備設計](../specs/2026-09-17-causal-contact-and-individual-defense-design.md) §4・6.3、[時間・知覚設計](../specs/2026-09-17-time-running-catching-perception-umpire-design.md) §6。

## 1. 改善対象と守るもの

| 監査で確認した設計差 | 改善後 | 担当工程 |
|---|---|---|
| R3: 9人の情報源・候補・棄却理由を共通追跡できない | 選手別に「何を知り、何を選び、なぜ変えたか」を時刻付きで説明 | T1 |
| R2: 味方の真の状態と走者の発行済み予定touchが候補評価へ入る | 観測・記憶・受信済み情報から推定。予定された未来の動作を直接読まない | T2・T3 |
| R1: 中央の9人一括割当がmotor目標へ直結する | 各選手が候補を選び、味方の提案を採用・辞退・変更する | T3・T4 |

守備力、肩力、走力、判断・反応、身長と身体、送球準備、ダイビング後の再起、積極／慎重守備、信頼度、チーム方針、球場の形と材質を維持する。公開ランクの集団を変更しても内部性能は変えない。信頼や得能を捕球成功・送球速度・OUTの直接加算へ変換しない。

球・身体・グラブ・ベースの物理が事実を作り、裁定が解釈する所有関係を維持する。PNG、表示格子と既定品質倍率、既存カメラ、画面構成、音声の方向は変更しない。[性能標準](../../performance/PERFORMANCE-STANDARD.md)とそのV84追記、V116の先読み・取消・公開境界を継承する。

参考図は状況を作る資料として用いる。特定の担当、座標、送球順、成功率を正解にしない。一塁手が追球し投手が一塁を埋める連携も、併殺・外野ゴロ・中継も、位置・到達・走者・危険から選ばれることを検証する。図に一致するよう物理や能力を補正しない。無理をした結果のオールセーフなど、人間らしい失敗を一律に不具合扱いしない。

**今回含めないもの:** 新しい研究室UI、全能力・JSON形式の再設計、学習AIの導入、全試合Coreの置換、MLB平均値の新規校正、参考サイト全ページの完全再現、未承認の選手育成ドラフト。メーカーには既存の守備練習・ログ欄を使って反映する。

## 2. 現状の根拠と基準版

- 基準はローカルV117。Native Core SHA-256は `e46816c49fb954e6dbaa74aba6a8ed38e64a2d76b46655b31b0730547220d331`、160 Source。公開GitHubのHEADだけでは現在の未コミットSourceを再現できないため、実装開始時も全入力・成果物を固定する。
- `LiveFieldPlayV1.ts` の `seenBy` は遅延観測を持ち、最終releaseには観測した受け手を使う防護がある。一方、`roleActor`、役割割当、中継候補、`runnerArrivalSeconds` の一部は真値や発行済み走者計画を使う。認識と実行の境界をここから整理する。
- `LiveFieldRoleAssignmentV1.ts` のposition costは有限の事前傾向であり、担当を禁止する固定命令ではない。ただし中央DPの最終割当を個人の採否なしにmotorへ渡している。
- `PlayerPerceivedWorldState.ts`、`ObservationMemory.ts`、`Communication.ts`、`ExactCommunication.ts`、`DefensiveDecision.ts`、`CausalDebugTrace.ts` は別の既存経路で使われる実装で、単なる型ではない。V117 Nativeへは未統合。旧経路を壊さないLive adapterを作り、重複する認識・通信体系を新設しない。
- 監査の3場面8実行と役割cost4条件は能力・配置・悪送球に応じた変化を支持するが、全戦術の最適性やMLB平均への適合を証明しない。[詳細と未確認事項](../../verification/defense-reference-audit-2026-10-25/perception-and-autonomy.md)を保持する。
- RF送球中止には既存ログ上 `c1_hand_preparation_unreachable` がある。理由欠落という初期所見は訂正済み。実際の身体制約か、準備軌道の保守的な証明で可能な送球を除外したかはUNKNOWNであり、T1で切り分ける。

## 3. 採用する方式と代案

| 方式 | 判断 |
|---|---|
| 中央DPの重みだけ調整する | 小変更だがR1・R2を解消しないため主方針にはしない |
| 全守備・物理を一度に作り直す | 既存の捕球・送球・再起・裁定と性能の検証を失うため採用しない |
| ログ→個人認識→候補評価→連携を接続し、最後に通常経路を切替 | **推奨。** 既存Coreを保持し、変化の原因を工程ごとに追える |

T2・T3では新方式を実行結果へ反映せず比較する「影の計算」を用いる。新方式は旧方式の乱数、cache、command、採点、時計を変えてはならない。T4の受入後に初めて、選手の実動作を新しい判断へ切り替える。切替後は守備結果が変わること自体は目的に含まれ、旧版と全history一致を要求しない。

## 4. 情報と処理の境界

```text
実世界・発生済みイベント
  → 観測と情報到達時刻の検査
  → 選手ごとの記憶・状況推定
  → 個人の候補評価 ← 受信済みの味方の提案
  → 採用／辞退／代案・意図の共有
  → 既存motor・身体・捕球・送球
  → 実世界の接触・保持・触塁
  → 公式裁定
```

| 情報 | 個人判断での扱い |
|---|---|
| 自分の身体状態と能力、球場・塁などの既知形状 | 自分の制御に必要な情報として利用可 |
| 味方の位置・速度、走者の動き、球 | いつ観測したかを持つ推定。見えなければ記憶・不確実性を用いる |
| 味方の能力と連携傾向 | 事前に知る能力推定・練習や信頼の既存入力。隠れた現在状態や公開ランクの逆変換で補完しない |
| 試合開始前のアウト数・走者状況・方針 | 事前に共有された文脈。インプレー中の更新は観測・通知の到達を経る |
| 味方の意図・到達見込み | 受信済みの宣言を利用。期限、信頼、更新を持ち、確実な未来とは扱わない |
| 走者の `.leg.to`、`.leg.motion.touches`、未観測の停止・再判断 | 個人候補評価へ直接渡さない。観測した運動と状況から予測する |
| 真の保持・force・retouch・retired・着地・回復終了 | 実行・裁定は真値を使う。戦術評価には観測済みの認識を使い、両者を別所有にする |

`PlayerPerceivedWorldState<TKnownContext>` のgeneric欄へworld全体を入れるだけでは分離にならない。Live adapterは許可した項目だけ新規構築し、canonical world／Source／走者motionの参照や、それを読めるcallbackを評価器へ渡さない。結果事実を読む診断経路はAI入力と分離する。

共有処理はメッセージの配送・期限管理と宣言された意図の調停に限定する。全員の真値を読む戦術司令塔を、助言という名前で残さない。提案は各人の認識・事前方針・受信情報から生まれ、相手は採否を選べる。衝突回避・可動域などの実行制約は保持するが、戦術を自動的に正解へ修正しない。

## 5. ファイル責務と新設予定の接続点

以下の新設名・関数は**提案**であり、現存APIではない。既存shared型の外部契約は保ち、Live専用の追加を分離する。

| ファイル | 責務／予定interface |
|---|---|
| 新 `src/core/sim/fielding/LiveFieldDecisionTraceV1.ts` | 既存 `CausalDebugTraceEntry` を用い、decision IDで観測・候補・採否・command・中止・結果を結合する。書込みは診断専用sink |
| 新 `src/core/sim/fielding/LiveFieldPerceptionV1.ts` | `buildLiveFieldPerceivedStateV1(input)`。既存 `buildPlayerPerceivedWorldState` と記憶・時計を接続し、許可項目と情報源を限定 |
| 新 `src/core/sim/fielding/LiveFieldDecisionV1.ts` | `evaluateLiveFieldDecisionV1(context)`。既存 `DefensiveIntent` を使い、本人の推定から到達・危険・送球・回復時間を比較。intentと棄却理由を返す純関数 |
| 新 `src/core/sim/fielding/LiveFieldCoordinationV1.ts` | 既存communication型へLive payloadを接続。issue／受信／期限／撤回を扱う。選手本人の採否を保持し、motor目標を決めない |
| 既存 `LiveFieldPlayV1.ts` | 真の実行と観測生成の所有者。比較経路を追加後、個人intent→既存motorへの橋渡しを局所置換 |
| 既存 `LiveFieldForecastV1.ts` / `LiveRelayPlanV1.ts` / `LiveFieldRoleAssignmentV1.ts` | 予測・候補cost・時刻計算を再利用。呼出し元を知覚入力へ移す。中央DPは移行中の比較用で、最終戦術の決定権を外す |
| 既存 `LiveFieldPlayDiagnosticsV1.ts` | 既存telemetryと新traceの読取・日本語説明。物理不能、計画棄却、受信待ち、実行中止を区別 |
| 既存 `src/integration/browser/LiveFieldInputV95.ts` / `FieldPracticeWorkbenchV98.ts` / `LiveBaseballMatchV1.ts` | 共通mapper、能力・trait・信頼・球場入力、通常と練習の同Core接続。保存JSONは変えない |

新モジュールごとに同folderの `.test.ts` を置く。共有の `src/core/sim/perception/*`、`DefensiveDecision.ts`、`src/core/validation/CausalDebugTrace.ts` はまず再利用し、互換拡張が必要なら既存利用側の試験も追加する。SQLite等の別Native所有契約を持つ `ActualDefensiveDecisionLiveWork.ts` をbrowserへ直接持ち込まない。

## 6. 実装工程

### T1 — 判断を追跡し、送球中止のUNKNOWNを切り分ける

**Files:** 新 `LiveFieldDecisionTraceV1.ts` とtest、既存 `LiveFieldPlayV1.ts` / `LiveFieldRoleAssignmentV1.ts` / `LiveFieldPlayDiagnosticsV1.ts` とtest。C1切分けは `LiveHandPreparationV1.test.ts` / `LiveFieldRelayMotionV1.test.ts`。  
**Consumes:** 現行telemetry、候補評価時に既に計算した値、既存CausalDebugTrace。  
**Produces:** 読取専用trace、固定入力・SHA・差分、C1の診断報告。

- [ ] RED: trace ON/OFFでframes・facts・ruleFacts・end・乱数消費が完全一致し、9人の判断へ根拠が結び付く試験を先に作る。
- [ ] 選手ID、decision ID、観測／利用可能時刻、情報源、候補、cost内訳、棄却理由、提案採否、command IDを記録。保持だけの選手にも理由を残す。過去の診断を削除しない。
- [ ] 現行の真値入力は「個人認識へ未分離」と表示し、観測済みと偽装しない。中央割当のtask／actor costと失われるmetadataを診断経路へ保存する。戻り値や選択順の既存契約を変えない。
- [ ] 常時全frame記録は避ける。既定OFF、上限付き、同じ判断を集約し、欠落数と切詰めを明示。診断用の全候補評価は必要時だけ行い実経路と分離する。
- [ ] RF中止時の身体・肩・グラブ・目標・時刻・制約を固定し、現在の準備候補と独立した可否境界を比較する。可能なら同じ制約を満たす連続軌道を示す。「候補が見つからない」を物理不能の証明へ読み替えない。
- [ ] GREEN: trace有無の完全一致、ID対応、時刻順序、上限試験を通す。C1は原因特定または残るUNKNOWNと再現入力を明示。届く範囲や接触判定を緩めて送球を成立させない。

### T2 — 選手ごとの情報境界を作る

**Files:** 新 `LiveFieldPerceptionV1.ts` とtest、既存 `LiveFieldPlayV1.ts`。必要な既存perception testを再利用。  
**Consumes:** 許可した観測snapshot、記憶、受信済み情報、自分の状態、事前文脈。  
**Produces:** 既存 `PlayerPerceivedWorldState` に準じたLive用認識と、推定の根拠。

- [ ] RED: 同じ観測・受信履歴で、隠れた走者目標・予定touch・味方の未来移動を変えても、情報到達前の認識と判断入力が一致する試験を作る。
- [ ] Live秒時計と既存整数tickの変換を `ExactEventTime` / `ExactCommunication` へ合わせる。同tickのsequenceを物理的な先着の根拠にしない。
- [ ] 球だけでなく味方・走者へ観測時刻と記憶を接続する。未観測時に `history[0]` などの真値で穴埋めしない。情報がないことも候補判断へ渡す。
- [ ] 忘却や認識誤差の係数を無条件に新規導入しない。既存の反応・判断・連携遅延との責務を照合し、二重に遅延を加算しない。
- [ ] GREEN: 非漏洩・時刻・旧利用側の試験、影の計算ON/OFFで旧実結果と乱数が一致。実際の捕球・OUT判定は引き続き真の世界で行う。

### T3 — 個人の候補評価を影の計算で検証する

**Files:** 新 `LiveFieldDecisionV1.ts` とtest、既存forecast／relay／role costの利用箇所。  
**Consumes:** T2の認識、自分の内部能力・身体・回復状態、事前方針、受信済み提案。  
**Produces:** 本人のintent、送球／追球／カバー等の候補、見込み時刻・危険・棄却理由。

- [ ] RED: 入力にcanonical worldや走者motionを含めない純関数試験と、能力・信頼・慎重さを一つずつ変える対照試験を作る。
- [ ] 追球・捕球試行・塁カバー・中継・バックアップ・保持、送球先・力込め・早い軽送球を、同じ知覚由来の到達予測で比較する。既存の身体制約、グラブトス、再起、準備時間を落とさない。
- [ ] `runnerArrivalSeconds` の予定touch参照を戦術用の推定で置き換える。味方の到達も最後の観測と本人の宣言から推定し、受球・二つ目の送球は実保持後に再判断する。
- [ ] position costは事前の役割習熟・方針として内訳を明示し、距離や本人の判断を無視した禁止にしない。高肩力・積極性でも常時全力や常時送球には固定しない。
- [ ] GREEN: 少なくとも監査の3場面と悪送球の影計算を説明でき、旧実行への副作用がない。実結果を見てから候補costを逆算しない。評価器が到達を見込んでも捕球成功は保証しない。

### T4 — 通信・意図の採否を通して9人の実動作へ接続する

**Files:** 新 `LiveFieldCoordinationV1.ts` とtest、既存 `LiveFieldPlayV1.ts` とtest。  
**Consumes:** 各人が発行した提案・intent、受信条件、信頼、個人判断。  
**Produces:** 本人が採用したmotor commandと、撤回・再判断の履歴。

- [ ] RED: 提案の到達前／後、欠落、辞退、受け手の遅れ、重複宣言、期限切れ、役割の揺り戻し、捕球失敗後の再判断を試験にする。
- [ ] 呼びかけに発行・受信・期限・改訂IDを持たせる。未到達の意図を全員が知る共有表は禁止。配送処理は本人の判断を上書きしない。
- [ ] 役割継続の短い保留・再評価条件を持たせ、毎tickの担当交代を避ける。ただし新しい悪送球・走者進塁・担当辞退には期限前でも反応できるようにする。
- [ ] 本人の採用intentだけをmotorへ渡す。中央DPとhandler選出から直接motorへ入る全経路を列挙して外し、助言の形に残る真値経路も検査する。既存の衝突回避・身体制約・最終release guardを保持する。
- [ ] 新方式は守備play単位で一括切替する。未完成の新認識と旧中央決定を混ぜた状態を通常試合へ出さない。新しい判断のブレが必要な場合は `SeedRoot.streamRng` の用途別streamを使い、traceや候補列挙順で乱数を消費させない。
- [ ] GREEN: 同一seed・入力・方式で再現、隠れた情報に非依存、実移動・実保持・実触塁で結果が成立。連携失敗は許容するが、意図の更新不能・永久待機・反復振動を不具合として分離する。

### T5 — 場面・能力・球場・性能を横断して検証する

**Files:** 新4モジュールのtest、既存 `LiveFieldPlayV1.test.ts` / `LiveFieldPlayDiagnosticsV1.test.ts` / `LiveRelayPlanV1.test.ts` / `LiveFieldRelayMotionV1.test.ts` / `LiveRunnerAirborneIntegrationV53.test.ts` / `LiveRunnerMotionV1.test.ts`、監査用harnessの新版。  
**Consumes:** T1〜T4、既存fixture・保護した旧入力、同条件の旧版比較。  
**Produces:** 因果・互換・性能の証拠と既知の限界。

- [ ] 下表を同じ打球の一変数対照で検証する。期待は特定選手の成功ではなく、知覚→判断→実行→事実の整合と変更理由。
- [ ] T1のC1が実装上の誤棄却と判明した場合だけ、再現するREDを先に作り `LiveHandPreparationV1.ts` 等の原因箇所を局所修正する。身体・速度・接触の制約は維持。未特定なら推測修正せず、その送球の合理性は未判定と残す。
- [ ] 既存typecheck、対象unit、browser統合を実行。最終候補では9回完走・全守備complete・再現seedを確認し、中断・失敗・UNKNOWNを保存する。
- [ ] 影の計算を通常運用で二重実行しない。候補・通信・cache・ログを有界にし、観測版・個人・方針・能力・球場を失効keyへ含める。値の丸めで別状態を同一視しない。
- [ ] 同一端末・入力・試行順で初回／再利用、生成p50・p95・最大、1球／1守備、heap・通信数・trace量、main heartbeatを計測する。合否の性能予算は実装開始時の複数回基準計測から先に固定し、結果を見て緩めない。全端末無待ちやFPS倍増を今回の保証にしない。

| 必須場面 | 確認点 |
|---|---|
| 一塁手が塁から離れるゴロ／同配置で投手だけ遅い | 追球とカバーの個人採否、早いfeed、実保持と触塁。3–1固定禁止 |
| 4–6–3、6–4–3、5–4–3 | 受け手が途中／到達済み、優しい早い球／強い球、グラブトス、信頼と慎重さ、二つ目の再判断 |
| RFゴロ、LF飛球＋3塁走者、長打の中継 | 肩・距離・走者・球場による送球／保持／中継の理由。外野ゴロ禁止や強制は禁止 |
| 悪送球、ワンバウンド、捕球失敗、走者停止・再進塁 | 見た時点以降の再判断、回収役、走者の実進塁、プレー終了の妥当性 |
| 際どい内野球、dive／jumpと着地・再起 | 慎重／積極と個人能力による選択、回復遅れが実送球と進塁予測へ反映 |
| 能力・個人・球場の一変数差 | 内部の絶対能力保持、公開集団の変更で物理不変、traitや信頼に結果ボーナスなし |
| 新試合・指示変更・半回・第3アウト・取消 | stale intent／通信／Worker結果の再利用なし、完了不能なし |

### T6 — メーカーと通常HTMLへ同一Coreを反映する

**Files:** 既存 `LiveFieldInputV95.ts` / `FieldPracticeWorkbenchV98.ts` / `LiveBaseballMatchV1.ts` とtest、`tools/browser-bridge/build-maker.mjs`、V117 builderを参考にする別名の次版builder。Worker helperは変更必要性を検証してから対象化する。  
**Consumes:** 全ゲート通過の同じCore・入力catalog・検証証拠。  
**Produces:** 別名の通常HTML・メーカー・調整室、Source pin、仕様と判断記録。

- [ ] 既存守備練習の選択選手・リアルタイム編集・保存取消・人間／AIモードから同じ認識・判断・Coreを使う。既存ログへ日本語で「見た状況／選んだ行動／他案をやめた理由」を出す。新layoutは作らない。
- [ ] 旧JSONを原本維持で読み込み、能力・得能・信頼・球場の編集と再読を確認。新しい公開能力や必須JSON項目は増やさない。実験用の新旧切替は内部検証用で、通常ユーザーへ技術設定を増やさない。
- [ ] V116 Workerでは方式・設定の同一性を確認し、変更時にepoch／未消費queueを破棄して確定frontierから再開。未来の判断・結果・ログを消費前に公開しない。初回warmup4球・bounded queue12の契約を維持する。
- [ ] 新Coreの同じrecordに対して表示ON/OFF・seek・各視点のread-only性と同時刻画素を確認。意図したAIの動作変更と描画劣化を混同しない。
- [ ] 同じ3成果物で既存browser受入・先読みdirect Core対照・9回・旧入力を確認してから別名配置する。旧V117、元JSON、能力設定、全失敗証拠を保持し、公開判断は既存PRへ集約する。commit／push／merge／deployは別の指示の範囲とする。

## 7. 実行コマンドと証拠の分離

repo rootで、新設したtestを含む対象を明記して実行する。各実行は `evidence_runner.py --project . --task <実装Task> --timeout <秒> -- <command>` で保存する。前工程のreceiptを新工程の実行証明として再包装しない。

```powershell
npm run typecheck
npm test -- src/core/sim/perception src/core/validation/CausalDebugTrace.test.ts
npm test -- src/core/sim/fielding/LiveFieldDecisionTraceV1.test.ts src/core/sim/fielding/LiveFieldPerceptionV1.test.ts src/core/sim/fielding/LiveFieldDecisionV1.test.ts src/core/sim/fielding/LiveFieldCoordinationV1.test.ts
npm test -- src/core/sim/fielding src/core/sim/running src/integration/browser/LiveFieldInputV95.test.ts src/integration/browser/FieldPracticeWorkbenchV98.test.ts
node --test tools/browser-bridge/background-match-v116.test.mjs
```

上記の新4testはまだ存在せず、実装時のRED→GREEN用コマンド。既存browser harnessの `check-background-v116.mjs` / `check-live-buffer-v116.mjs` はHTML folder・証拠folder・prefixを引数に取る。V117専用のbuild／publishは版名とpinが固定されるため、そのまま次版を配置せず、読取って別名の次版入口へ継承する。

記録先は実装時の `docs/verification/` 配下へ工程別に設け、入力・Source pin・command・receipt・結果・限界を保存する。製品の成功、物理の整合、戦術的な妥当性、性能を別々に評価する。参考図と異なるという理由だけでFAILにしない。

## 8. Review Focus — 重点5項目

| 失敗しやすい点 | 所有工程／必須検査 |
|---|---|
| 真値がgeneric欄・helper・callbackから混入 | T2・T3。非漏洩対照、入力型・import・呼出し経路の監査 |
| 中央命令が助言に偽装される／役割が振動する | T4。motorへ至る全入口、採否・期限・撤回・情報到達前後 |
| 失策・走者変更・回復を観測せず判断する | T3〜T5。悪送球／停止／再進塁／dive再起の一変数対照 |
| 能力・trait・信頼・球場差が消える／直接結果補正になる | T3・T5。内部能力固定と個人差対照、実接触・保持・触塁 |
| 診断や二重計算で生成遅延・未来漏洩・旧データ破損 | T1・T5・T6。ON/OFF同値、bounded資源、Worker取消、旧JSON、9回 |

## 9. 切替・復旧と完了条件

T1〜T3は旧動作を既定にして比較する。T4以降の切替はplay開始時に固定し、途中で方式を変更しない。検証用の旧経路は版付きfixtureとして保持し、最終の通常実行で旧DPと新判断を二重に走らせない。問題時は新機能だけを未採用にし、固定したV117成果物と元JSONへ戻せるようにする。共有workspaceの一括reset、他担当の差分巻戻し、元JSONの上書きは行わない。

完了には、R1〜R3の境界・ログを通る実試合、能力・個人・球場・ミスの対照、同seed再現、9回完走、メーカー保存取消、Worker境界、同じ新Coreの3成果物まで必要。C1が未特定ならその場面の合理性は未確認と明記し、修正済みと主張しない。全選手・全seed・全球場の最善性、MLB頻度への校正は今回の合格から推定しない。

本書は**改善計画の成果物**。製品変更の完了報告ではない。実装開始前に本人の範囲確認を受け、この計画と固定した基準版から継続する。
