# メーカーの打者判断・投球のキレ・高速検証 Implementation Plan

> **For agentic workers:** `superpowers:executing-plans` または `superpowers:subagent-driven-development` を工程単位で用いる。本人の最新委任とproject指針を優先し、定型的な承認待ち・工程ごとの増員は行わない。

**Goal:** 実Coreに一致する高速検証を先に整え、メーカー/試合の判断・接触・投球変化と打球回転を、既存残件を失わず改善し新版へ届ける。

**Architecture:** 通常Host/既存Worker/Source kernelを共用し、描画の待ち時間だけを検証経路から外す。心理→意図→有限の身体運動→実接触→回転/空力→裁定の因果順を保つ。単球比較、打席の継続、独立seed群は共通入力と別々の試験目的を持つ。

**Tech Stack:** TypeScript、既存Vitest/Node test、同一buildのChrome/Worker、既存SQLite Native Owner、CCG evidence runner。新依存なし。

**Spec:** [判断・要件・根拠](../../agent-decisions/2026-10-27-realism-debug-goal.md)。Task `MB-20261027-REALISM-DEBUG-PLAN`、Workflow `15a72f44966b4def9008983dc87c9a8a`。計画保存/goal登録と実装完了を区別する。

**再開入口（2026-10-28更新）:** 現在の一件と実行済み境界は `../../ai-continuity/CURRENT.md` の同task節とWorkflowの最新receiptを使う。以下の段階計画と工程当時の記述を、完了済作業を最初から繰り返す指示にしない。共通CCG先行整備とV161のREACTIVE観測対応は実行済み。具体的な次操作は再開入口の一件に従う。

**本人指定の先行条件（2026-10-28）:** 野球実装の再開前に、反復防止をCCG利用全agentの共通core・共有Skill・共通入口へ整備して実検証する。個別projectだけの規則で終了しない。既存projectの一括書換え/初期化・Hook ON・認証変更は行わない。この条件が満たされてからV161-R1へ戻る。

## Global Constraints

- World-first causality。Presentation is read-only。Mini/Naturalは同じMatch Core。
- 4px表示/55ms Presentation cadenceは既存表示契約。物理刻みの権限にしない。現Liveの1,000,000 ticks/s・5,000 ticks積分刻みを高速化で変更しない。
- 原PNG/原JSON/原673試技・92,201キー、前版、能力差・個人差・球場差、共有dirty treeを保持。Pooh画像生成禁止。今回画像制作なし。
- 未来の真球種/軌道/接触結果を本人の判断に注入しない。得能名・Gold・SignatureによるexitSpin/exitVelocity/公式結果の直接変更禁止。
- SIGN自動認定・自動命名・文化生成はペナント時。現在はFOUNDATION_ONLY。未承認DRAFT32全体へ拡張しない。
- 未完・旧FAIL/TIMEOUT/BLOCKED/UNKNOWNを保存。旧PASSは同SHA/入力/環境の証拠として参照し、今回のPASSへ改名しない。
- 自動merge/deployなし。大きなAPI/形式/権限変更が必要と判明した場合は具体的影響を別途扱い、通常の小修正では承認を反復しない。

## Review Focus

1. 同じseedで再実行すると同じ結果になることと、次投球で知識/判断が更新されることを取り違えない（Task2）。
2. 二球目を試す際、見送った初球と、打って打席が終了した後を同じ継続にしない。2ストライク後のファウル・四死球・打者交代も通常Hostの状態へ従う（Task2）。
3. 意図の方向と実打球の方向を同一視しない。引張りを試みても逆方向・空振りになり得る（Task3）。
4. 変化量がほぼゼロ、変化方向が反転、基準球が地面へ落ちる場合に「開始時刻」「終盤割合」を捏造しない（Task4）。
5. 高速計算の途中再開、Worker順序変更、設定/Source違い、Chrome/Node差で結果や認証が静かに変わらない（Task1/5）。

## 現状と適用範囲

| 論点 | 確認済み | 本計画で必要な対応 |
| --- | --- | --- |
| メーカー心理 | 比較はcount/beliefなしの単球。明示approachは渡る | 通常Hostを共有した連続打席と、通常方針からの入力生成 |
| 乱数 | 投球/判断/誤差に存在。既定seedは固定 | 独立stream、継続状態、固定再現とseed群の比較 |
| ニッチロー | 2clip・内外条件で偏り再現、中央指示でも流れる | 判断不足と接触幾何/位相を別々に修正 |
| キレ | 変化量/減速の既存観測はある。開始/終盤集中の独立調整は未実証 | 時系列の観測と同release/同target比較、物理の実現可能性を判定 |
| 高速検証 | 描画待ちなしHost/Workerあり。旧Chrome内の限定一致 | 最新Source固定、再現packet/最初の差分/速度測定を統一 |
| cross-runtime | Node↔Chromeで末尾と一部factsの旧FAIL | 正規高速gateは同Chrome。丸めで同値としない |
| SPIN v2/SIGN v1 | 元2計画と範囲は本人確認済み、部分実装あり | Task5の継承表で対象を閉じる。命名は今回対象外 |

## 実施順と検証契約

Task1→Task2→Task3→Task4→Task5→Task6。Task1の測定を使って以後は小さい再現ケースで実装し、終盤に同じ9回試合を毎回繰り返す運用を避ける。依存のない読取監査は限定並行、同じfile/状態を二人が同時編集しない。

**2026-10-27 実行順の改訂:** Task1の機能基盤Aは、最新Coreの12球/4接触・守備で通常1x/finish/描画OFF/毎球復元/実Workerの全record一致、5球後の保存checkpoint→6球目復元一致、取り違え拒否とphase/CPU計測まで実証した。以後のTask2〜5の実装にこの入口を使う。Task1の残りB（複数seed・有界pool/1・2・4枠・9回・性能改善の受入）は未完の独立工程としてTask5と最終Task6の間へ移す。今9回を行ってからCore変更後に撮り直す重複を避けるためであり、要件・旧FAIL・最終受入範囲は削減しない。H/E比較の約20秒は未解消、速度達成の宣言はしない。

### Task1: 同Coreの高速再現・同値検証入口

**Files:** Modify `tools/browser-bridge/audit-fast-match-parity-v120.mjs`、`tools/browser-bridge/background-match-v116.mjs`、`tools/browser-bridge/background-match-v116.js`。必要時のみ `src/integration/browser/LiveBaseballMatchV1.ts` のcontinuation境界。Create `tools/verification/live-debug-case.mjs`、`docs/verification/realism-debug-20261027/fast-parity/`。既存harnessは旧固定manifestでも起動可能に保つ。

**Interfaces:** 検証用CLI `node tools/verification/live-debug-case.mjs --case <case.json> --manifest <manifest.json> --mode <parity|batch|replay> --out <new-dir>`。新 `LiveDebugCaseV1` は検証artifactのみで公開save形式を変更しない。内容は `{version:1,runtime,manifest,configuration,initialContinuation,seed,commands,stop}`、manifestはCore/catalog/clips/physics/設定のSHA、commandsは投球連番と受信tickを保持。PRNGを再生成する現仕様ではseed/連番/stream versionを記録し、将来statefulにする場合だけcursorを保存する。

- [ ] Step1: 既存Host/Workerテストに、同じcaseを通常/finish/描画OFF/独立Workerで実行し全canonical record・state・facts・時計が一致する試験を追加。不一致のfirst pitch/tick/fieldを保存する試験を先にFAILさせる。
- [ ] Step2: 旧harnessのCore SHA固定をmanifest引数へ拡張。現在Sourceを新規検証folderへbundleし、全inputs・Core/catalog/clips/設定・runtimeを固定する。共有distと旧V133を上書きせず、この候補を同Chrome buildの通常/高速/描画OFF/Workerで実行する。V133は旧入力互換の別対照とする。simulation時刻・乱数消費・AI探索予算を変えず描画待ちだけ省く。通常速度との比較は有限prefixを一度実行し、以後は保存ケースを直接再実行する。
- [ ] Step3: 既存1球境界continuationを用い、次球前の状態・設定・Source hashを照合。不一致manifestを拒否する回帰を追加。投球途中snapshotは必要性を測定してから別の小変更とし、最初から再実装しない。
- [ ] Step4: 入力読込/初期化/投球/接触/守備探索/serialize/transfer/保存の時間、球数・sim秒/実秒、p50/p95、peak memoryを測定。cold/warm・runtime・標本数を記録。速さの目標はbaseline測定後に固定し、未達をtimeout延長だけでPASSにしない。
- [ ] Step5: `npx vitest run src/integration/browser/LiveMatchContinuationV116.test.ts src/integration/browser/LiveMatchContextV122.test.ts src/integration/browser/LivePoleScopeV148.test.ts` と `node --test tools/browser-bridge/background-match-v116.test.mjs`。その後、新CLIのparityで実守備を含むprefix→複数seed→9回へ拡張。旧Node FAILは別表へ残す。

**Acceptance:** 同Chromeでfull record一致。statefulな本人知識/疲労/乱数は、同caseのpause/resumeやWorker順序に依存しない。batchは一意uint32 seed/job IDを管理し、既存poolを再利用、まず1/2/4枠の結果/速度を測る。100件投入と100並列を混同せず、通常画面の操作を待たずcaseの診断まで到達する。

### Task2: 単球再現と連続打席、心理・乱数の接続

**Files:** Modify `docs/demos/baseball-maker-ball-comparison-v69.js`、`docs/demos/baseball-maker-swing-execution-v122.js`、`src/integration/browser/MeasuredTrajectoryComparisonWorkbenchV69.ts`、`src/integration/browser/LiveBaseballMatchV1.ts`、`src/integration/browser/LivePitchV1.ts`、`src/core/decision/batting/BatterIntentV122.ts`。Test existing `BatterIntentV122.test.ts`、`BatterApproachPolicyV121.test.ts`、`LivePitchContextV122.test.ts`、`LiveMatchContextV122.test.ts`、`LivePitchCourseV79.test.ts`、`MeasuredTrajectoryComparisonWorkbenchV69.test.ts`。

**Interfaces:** Task1のcase/manifest。連続試験は既存Hostの `issuePitch()` と `captureContinuationV116()` を正本にする。4弾道の比較は同球/同誤差の現契約を維持。方向だけの比較には既存 `directionTrialSeedV79` を再利用し、他streamの独立seedが必要なら明示versionの任意入力に限定、未設定時の旧結果を保つ。

- [ ] Step1: 再計算は状態不変、初球TAKE→次球はcount/観測/投球連番が進む、打席終了後は別打者へ移る、2strike foulではstrikeが増えない試験を追加し、欠けた連続経路をREDで固定。
- [ ] Step2: 保存方針/本人特性→一球Intentの共通入力を通常Hostと共有。強制SWING比較では振る/見送る判断を固定していることを保存し、本人の意思による通常試験も用意する。旧データの個性を全員同じprofileへ置換しない。
- [ ] Step3: `pitch seed`、判断stream、実行誤差streamの派生規則・消費位置をcaseへ記録。方向だけを変えた対比較でpitch Source/誤差が不変、誤差だけを変えた対比較でIntentが不変を検証。
- [ ] Step4: 事前固定した一意seed群で全候補を正重み/ゼロ重みと比較し、二項/多項分布の期待範囲と標本数を記録。単に三方向が1回ずつ出れば正しいとせず、全員均等分布や毎球方向交代を強制しない。
- [ ] Step5: 上記6既存test fileを限定実行し、Task1の同caseでメーカー/通常Hostの同値を確認。初球/2球目を個人方針・count・既着観測の違いで比較し、未来情報を入れない。
- [ ] 初球固定仮説の専用受入: 「ニッチローの初球は流しへ固定され、2球目以降だけ引張を候補にする」という本人の疑いを独立した未決として検証する。初球/第2球で、保存方針・count・配達済み観測・投球連番・各乱数keyを記録し、同じ条件を通常HostとMakerで比較する。方向Intent/抽選候補/実行誤差/接触結果を分け、単球seed+1と連続打席を混同しない。固定規則の有無は未確認で、打ち損じの差だけを方向判断の証拠にしない。

**Acceptance:** 固定全状態+seedは完全再現。次球は通常試合と同じ状態更新。表示の再生回数で乱数を進めない。方針だけで通常操作でき、詳細入力は任意。新規調整値を旧JSONへ暗黙保存しない。

**2026-10-27本人追加:** 打撃練習の方向は「おまかせ（打者に任せる）／引っ張る／中央／流す」を選べること。おまかせは保存本人approachを優先し、旧5方向配分も保持する。両方未設定の選手にも共通の本人判断経路を接続し、保存pull角へ固定するだけの動作をおまかせと呼ばない。手動指示は当該試打のcopyへ適用し、保存された本人方針/元JSONを変更しない。手動→おまかせで元の方針へ戻り、固定seedで再現でき、4弾道間は同じ判断を用いる。打球方向の成功を強制する設定にはしない。

**原仕様との照合:** DIR原文のREACTIVEは方向未指定の観測対応で、CENTER既定や均等3方向の抽選ではない。本人approach/旧方向配分が両方ない場合は、当該練習の実行指示として明示REACTIVEを共有Decision層から生成し、未設定理由をtraceする。未観測の性格・確率配分をダミー本人profileとして保存しない。旧入力の省略挙動は保持し、新しいおまかせ指定から明示的に入る。元フォーム方向から打点・時刻へ対応する処理と、内外角に応じて引張/流しを選ぶ戦術AIの完成は区別する。方向の運動変換の未完はTask3で閉じる。

**2026-10-27 V149/V150工程結果:** 方向4選択と非保存/本人復帰は共有Decision＋Makerへ実装し、関連36件/PC390/JSON/旧省略入力互換を確認。続いて通常V116 Host共用のpreview/accept＋実Worker連続練習を実装。関連14件/全型、Chrome1200/390の各6球・PA終了/次打者・通常Host全record一致、実JSON再開と拒否/設定raceを確認した。詳細 `docs/verification/realism-debug-20261027/DIRECTION-PRACTICE-V149.md` / `CONTINUOUS-PRACTICE-V150.md`。Task2は未完。本人観測からのfamily Evidence producerは既存Sourceに見つからず、位置confidenceを球種reliabilityへ転用せず次に設計・接続する。Makerの知識学習/疲労は未接続表示。既存カウントの継続を心理学習完成へ昇格しない。通常方針/独立stream分布/接触幾何と後続Taskを保持する。

**2026-10-27 V151工程結果:** 上記V149/V150時点で未確認だったproducerを、別の明示V151位置観測/未分類経験Sourceとして実装した。真velocity/spin/実空力/未来crossingを打者予測から除外し、配達済みの位置だけを使う。生の予測を受理後だけ記憶し、次球priorへ渡す。73件/全型、PC390/JSON再開/方向4選択と旧省略入力互換、固定16接触・late補正と2接触/2守備の通常Host/実Worker全record一致を確認。詳細 `docs/verification/realism-debug-20261027/OBSERVED-BATTING-V151.md`。未分類経験を球種family×region推定/人の校正完了へ読み替えない。Task2の独立stream/seed群・通常方針・分類/校正、Task3の方向幾何と後続全scopeは未完で継続する。

**2026-10-27 V152工程結果:** 独立13domain/keyの任意policyを通常Live/Host/実守備/走塁とMakerへ接続。MATCHから投球連番のPLAY rootを派生し、command単球介入とcontinuation bindingを保存。旧省略入力は旧V148の2球fullrecord一致。最終70件/全型、PC1200/390実Worker/JSON、方向と誤差の独立介入、事前固定2,048一意seed分布、16実接触/late補正と2接触2守備の通常Host/実Worker全record一致を確認。詳細 `docs/verification/realism-debug-20261027/INDEPENDENT-RANDOMNESS-V152.md`。Task2の抽選独立性は進んだが、球種family×region/人の校正・通常方向戦術/心理は未完。次は `DIRECTION-MOTOR-NEXT.md` の既存監査を使い、V151主観予測と自clipから名目登録を評価し、V152誤差を後適用するTask3。実球未来/真spin/late補正を候補採点へ混ぜない。性能B/9回と後続全scopeは保持、step-007/全goal ACTIVE。

### Task3: 狙いを実接触へ変換する方向制御

**Files:** Modify `src/integration/browser/LivePitchV1.ts` と、実際の所有箇所に限る `src/core/sim/pitching/CourseAwareSwingKinematicsV1.ts`、`src/core/world/psychology/batting/BattingMotorPlanV1.ts`。Test `src/integration/browser/PostGoalNichiroSprayV122.test.ts`、`LivePitchCourseV79.test.ts`。診断入口 `tools/verification/post-goal-maker-spray-v122.mjs` をTask1のcaseへ接続。

**Interfaces:** Task2から到着したIntent/本人の主観予測/制御可能時間を使い、既存Motor Targetを更新する。出力は既存の実バット時系列のみ。Contact solverの出力変更や、真球道を使う最適化を追加しない。

- [ ] Step1: 本人JSONのSHA `e0123a572d66bf6bd5fa92af6c9ffbe6fe47fbcf27d00135c9441bf95927b3ce`、entry `1-b0`、clip `obp-23_5` を固定。予定キーと最初の実接触の法線・表面速度・位相の差を保存する回帰と、実行可能な対照条件での方向Intent順序の試験を作る。
- [ ] Step2: 観測から得た接触予測と有限の身体制約の範囲で姿勢/位相を制御し、予定キーの芯速度方向だけに合わせている経路を修正。異なる左右/内外角/準備時間でも同じ変換を使う。
- [ ] Step3: 判断固定/誤差固定/独立seed群の3比較で修正の寄与を分離。Intentと運動が動くこと、未達・空振り・逆方向の失敗を保存することを確認。内角なら必ず引張りという結果補正は禁止。
- [ ] Step4: 限定テストとTask1同Chromeケースで検証。元clipの軌道・キー・SHA、未設定旧入力を比較し、新Source適用範囲を記録。

**Acceptance:** 合法な対照条件でPULL/CENTER/OPPOSITEの指示が合理的に異なる運動を作り、元の流し偏りの原因と改善幅を数値で示す。狙いどおりの全成功や中央0度への強制は要求しない。

**2026-10-27 V153工程結果:** 凍結V151主観p/v/aと自己clip/物性から有限yawのsurface登録を選び、名目planとV152実行誤差を分離。固定held/C1 bridge・利用可能時間の測定key window・slowing-only実行制限を通常Host/Makerへ接続。最終61件/全型、元選手72対比較の絶対方向誤差中央値19.0933→6.2636度、16実接触/lateと2接触2守備の通常Host/実Worker全record一致、PC390/JSON/旧入力互換と全Source/原JSON整合を確認。公開matrixは48条件実行、別4groupの準備回復証明は未解決。詳細 `docs/verification/realism-debug-20261027/OBSERVED-DIRECTION-MOTOR-V153.md`。この運用予測を人体校正/Native権限へ昇格しない。既資格SPIN motorは今回未適用、人体到達/通常戦術・観測分類/校正と後続scopeを保持。次は公開obp-190_7の証明値を区間別に分け、補完時間の未校正・証明の保守性・実装不整合を切分け、候補計画コストも同caseで診断。Task1性能B/9回と全goal/step-007はACTIVE。

**2026-10-28 V161限定工程結果:** 共通CCG整備後、明示AUTO/REACTIVEを既存の主観接触/有限運動へ接続。仮角度/3方向抽選を使わず固定held→arcのendpoint転送costを最小化し、名目と実行誤差を分けた。core既存14＋新5、最終新5/統合16/全型4a7d0947、同Chrome本人26比較817916a3、PC1200/390の10casesと旧省略2球full-record05c8b960、最終整合82a29fda PASS。同じ自然第2球は旧後方foul146.86度から新live_ball/左打者引張側30.15度へ変化し、初球/TAKE全recordと次球のSource/観測/乱数/誤差等12対照は厳密一致9cca9408。初球は見送りで打球方向未実証、全分布/心理/人体の完成ではない。限定Maker candidate-maker-reactive-v161-01（HTMLf10fc2a3、Native212/7e65f1ca、WB189/d62b8880）、詳細 `docs/verification/realism-debug-20261027/REACTIVE-MOTOR-V161.md`。V154/人体/通常戦術/分類校正・SPIN/Native/旧残件/性能B/9回/配送・キレ3選択/最終GitHub照合は未完、全goal ACTIVE。

### Task4: キレ・変化量・ブレーキと投球比較

**Files:** Modify `src/integration/browser/PitcherWorkbenchV77.ts`、`LivePitchV1.ts`、実入口`docs/demos/baseball-maker-pitcher-v92.js`（計画時のv78想定を実ファイルへ訂正）。Read/reuse `PitchQualityV121.ts`、`PitchMovementV92.ts`、`src/core/sim/ball/BaseballAerodynamics.ts`、`BaseballSeamForceV1.ts`。Create `src/integration/browser/PitchBreakTiming.ts`、`PitchBreakWorkbenchV155.ts`、`PitchReleaseComparisonV155.ts` と対応試験。既存pitch品質/workbench/movement試験も使用。共有空力の変更は実現可能性の証拠が必要な場合にだけ別差分へ分ける。

**Interfaces:** `observePitchBreakTiming(input: { actual: readonly TimedPitchState[]; baseline: readonly TimedPitchState[]; planeZ: number; comparisonBasis: string; groundEvents?: {actual:readonly number[];baseline:readonly number[]} }): PitchBreakTimingObservation`。新型はこのmoduleが所有するread-only観測型。既存samplerからt/位置/速度を取り、Sourceや実球へ書き戻さない。標本間bounceの実反例に対応し、実kernelが持つ区間内のground履歴も渡す。比較基底・単位・採用閾値と観測versionを出力へ固定する。

- [x] Step1: 一定横加速度、同じ最終変位で力の時間分布だけ異なる分析用fixture、ゼロ変化、符号反転、地面到達の試験を作る。分析用fixtureを実際のフォーク再現の証明にしない。
- [x] Step2: 同release/同初速度の基準に対する軌道差を全時系列で保存。終点変位、終点方向への射影変位の10/50/90%到達時刻、終盤20%区間の変位増分、横/鉛直加速度の曲線を観測。閾値は表示指標の規約で物理定数ではない。終点が微小/非単調ならpercent時刻はUNCLASSIFIEDとし、raw曲線を残す。
- [x] Step3: 同時間での比較と同z断面での比較を明示。無回転+元空力の既存基準、空気なし重力のみ基準、直線接線との差を混ぜない。重力込みの総落下も別記録。基準球が接地する場合は仮想空中基準/適用不能を明記する。
- [x] Step4: 同じ目標へ狙い補正する通常試投と、基準球の投げ出し位置/初速度を固定した比較を既存様式に追加。狙い、補正した角度、到達点、球速/飛行時間、飛行中の減速を保存・再読する。変化量1/7の終点が似た原因をこの対比較で示す。
- [ ] Step5: 既存回転軸/有効回転/縫い目姿勢/速度依存係数/回転減衰から「同程度の変化量・異なる終盤集中」が実現可能か探索し、Sourceと許容差を記録。成立しない場合はモデル不足をUNKNOWNとして対象化し、任意の時間に力をON/OFFして完成扱いにしない。実測/一次資料で支持された時系列モデルだけを明示versionで追加する。
- [x] Step6: `npx vitest run src/integration/browser/PitchQualityV121.test.ts src/integration/browser/PitcherWorkbenchV77.test.ts src/integration/browser/PitchMovementV92.test.ts src/integration/browser/PitchBreakTiming.test.ts`、Task1の同Chrome試投・保存再読を実行。
- [ ] Step7（2026-10-28本人追加）: メーカーのキレを「キレ○／キレ◎／脅威の切れ味◎」から選ぶだけで適用できるようにする。通常の利用で回転軸・材料位相・係数の手入力を要求しない。詳細入力は調整用として保持し、選択直後の試投と保存/再読/通常試合まで同じ効果を接続する。下記の選択契約と受入を満たすまで未完とする。

**Acceptance:** 本人の「いつから、短時間にどれだけ変化するか」が軌道・時間・距離で比較可能。変化量/キレ/減速/狙い補正は別。物理上独立でない項目を無条件に独立調整可能と表示しない。得能がある場合も真の投球技能/Sourceの要約とし、タグから曲げない。6秒/1秒・70cmは説明例で、実試投へ固定しない。

**キレ3選択の契約（本人指定・未実装）:**

- 表記は本人の指定どおり「キレ○」「キレ◎」「脅威の切れ味◎」。既存の通常/未適用状態へ戻せる。選ぶ操作で現在の球へ適用し、低水準値の転記や別の適用ボタンを通常手順にしない。
- 各選択を、共有Coreが使うversion付き投球技能/実入力の設定へ変換する。名札だけの変更や計算後の軌道/打者反応/打球結果の補正で代用しない。選択名と元の物理入力・適用versionを保存し、読み直して同じSourceを再構成する。詳細を手編集した場合は適用状態を正確に表示する。
- 既存在庫 `live-trait-availability-v77.json` の `breaking_ball_quality` はUNSUPPORTEDであり、従来aliasは「キレ○/驚異の切れ味」。この在庫との対応と3段階の実技能Sourceを実装し、本人の今回の表示指定を採用する。既存在庫の名称やstatusだけを変更して対応済みとしない。既存ID/旧保存の扱いはversionを明示し、旧aliasも履歴に保持する。
- 段階差は本人定義の「変化の始まり・短い終盤区間への集中」で実証する。回転量/変化量の倍率を増やしただけでキレ上昇と表示しない。現在のモデルで3段階に十分な差が出ない部分は、モデル/入力の不足として実装課題に残し、選択UIだけで完成扱いにしない。手入力を利用者へ戻して解決しない。
- 球種・球速・狙い・変化量とキレの指定を区別する。選択前後の軌道を重ね、変化開始/終盤集中/実変化量/到達時間を簡潔に示す。副次的に変化量や減速が変わる場合は併記し、独立制御や実測校正の未確認部分を隠さない。
- 受入は3選択それぞれの即時適用、通常へ復帰、PC/390px、同Chromeの通常/描画OFF/実Worker、選手保存/JSON再読/通常試合の実Source一致、旧入力互換。名前だけを変え同じ実入力にした対照では物理不変を確認する。既存の低水準比較/原入力/旧FAILは保持する。

**設計理由:** V159の位相入力や時間分布観測の接続は開発者の検証入口として機能したが、本人が求める「選ぶだけで使える」メーカー操作を満たしていなかった。これをStep7として追加し、実装・最終配送・最新設計GitHub照合の対象に含める。

**2026-10-27 V155限定工程結果:** 実Sourceの共通時刻3基準・同z断面・force/gravity・減速・名目投げ出しの観測を接続。通常同targetとPV固定の反実仮想を分離し、保存入力対で現在版の同一結果を再構成する。ground境界が全標本間に隠れる実反例も既存kernel履歴で未分類へ修正した。関連45件/全型、同Chrome156のNative/Workbench/実Workerの全6.76MB完全一致、PC1200/390の保存ファイル読込/旧版/異版/無効入力/設定保持/比較/可読性を確認。最新候補 `docs/verification/realism-debug-20261027/candidate-maker-pitch-break-v155-04/maker.html`、詳細 `PITCH-BREAK-OBSERVATION-V155.md`。公開curve1/7は通常着点差1.843cmだが、仰角.797→3.250度、固定PVなら46.265cm差。late20比.351584/.351658で、量の強化を遅いキレと呼べない。**Step5は未完**。固定PV・spin軸2×材料位相2×seam無効/保存値×減衰なし/保存値の事前固定16条件を正規Sourceで比較し、同程度の変化量の時間形状差を調べる。成立しない範囲をUNKNOWNのまま残し、任意の時刻で力をON/OFFしない。Task2分類/人的校正/通常戦術、V154証明/人体/再構築性能、SPIN/Native/旧残件、性能B/9回/同版配送とSIGN延期を維持し、全goal/step-007 ACTIVE。

**2026-10-28 V156探索結果:** 上の固定16条件を正規Sourceで160区間/640区間/物理半stepの3run実行。主基底を全球共通Tref/同じ重力基準とし、同z量/方向も併記した。各120対のうち近量・方向40対、p50/Tref最大差.001186/late20最大差.001292で、事前screen.05の候補0。一般不可能とはしない。29件/全型、同Chrome Main/実Workerの全52.9MB完全一致・JSON再計算・元Source descriptorと元入力での再Kernel厳密一致、全pin/原JSON保全を確認。元nominal5000とlab共通1083の微小な数値差は別profileの差としてexact=false/raw実値を保持し、tolでPASSにしない。最新game候補はV155のまま。詳細 `docs/verification/realism-debug-20261027/PITCH-BREAK-FEASIBILITY-V156.md`。**Step5の物理キレ再現は未実証**。一次資料調査で低spin50rpmの平均CL(材料位相)が取得候補になったため、先にBorg/Morrissey2014の原図/座標/誤差を確認し、total-liftの二重計上と適用範囲を整理する。次の実作業は `docs/agent-decisions/2026-10-28-pitch-break-empirical-data-v157.md`。64低spin/gyro/位相の追加比較は実行前の別protocolへ固定し、未校正重みから都合のよい球を選んで完成にしない。全他残件/全goal ACTIVE。

**2026-10-28 V157取得/QA結果:** AJP Fig.4/6のgray自動読取は黒線との混同が残り物理入力不採用、候補01を保持。色付きthesis Fig.3-24を原図から確認し、lift532/625・lateral479/625点の一意読取、残りは欠損/曖昧nullで保存した。右軸はF_L/W_BでCLではないと訂正、左lbf→Nのみ換算。平均/FFT処理・lateral DC/図batch・周期位相と飛行時間・q基底の未確定を保持。6合成試験44b18d12、別担当の原図のみ8特徴・全1250点再計算・Core/Maker/原JSON保全0fabac4a PASS。詳細 `docs/verification/realism-debug-20261027/EMPIRICAL-PHASE-DATA-V157.md`。game Source/最新V155候補は不変、modelUse/Native採用false。Step5は未完。次は `docs/agent-decisions/2026-10-28-pitch-break-phase-model-boundaries-v157.md` の固定64条件比較と測定profile入力契約を進め、全横力置換/診断・RK2経路/q伝播/有限勾配bound/Native初期phase保存の具体設計へ接続する。初球固定仮説の専用受入も上記Task2へ明示した。元2計画の逐条対応表はTask5 Step1未完のままで網羅完了としない。全他残件/全goal ACTIVE。

**2026-10-28 V158実Source比較:** 事前固定64条件×160/640観測・半物理stepを実行。各2016対中58分類/6非単調、両基底で絶対2cmかつ相対5%/方向5度以内46対、10cm以上42対、時間差screenの候補1対が全3runで一致した。候補の共通量11.783/12.295cm、p50/Tref差.106494・late20差.133697。同Chrome156.0.8078.48で192caseの全195MBをMain/実Worker/保存入力再計算に厳密一致（697cf672）、関連31件a0ef140d/全型d1f960eb/全pin・元JSON整合d3c1c7af PASS。最大1case1.36MBの有界transport、実時間再生待ちなし。詳細 `docs/verification/realism-debug-20261027/LOW-SPIN-TIME-SHAPE-V158.md`。これは既存モデル内の有限な時間形状差で、真の無力期間/人体知覚/実測校正/70cmの証拠ではない。回転量と材料位相の同時変更を一因子へ帰属しない。game Source/最新V155候補は不変。次は固定した2候補を通常nominal5000tickで追試し、authoring spin/axis/material・利き手/field変換・保存入力・固定PV比較を実経路で閉じる。lab1083tickと旧nominalの完全一致を仮定しない。測定profile入力契約の未取得値/原図q/DCはUNKNOWN保持。Step5と全他残件/全goalは未完で継続する。

**2026-10-28 V159通常入力とUI接続:** 元2候補を通常5000tickで追試、V78保存spin/q/seam→実Sourceと共通161状態の厳密一致を確認。lab1083との差はrawで保持。Aのmax-horizon差はfull descriptor exact=falseのまま、他全field/max式/共通prefixを検証。read-only phase/共通時計比較2API、未編集raw q/-q保持、回転軸まわりの位相操作、同PV/Tref/重力基準の時間分布表示と入力再計算をMakerへ接続。旧V155 shape/力学/schemaは維持。関連36件＋最終新9件/全型539633aa、2Core×Main/実Worker/JSONの全21MB/48capture c2063b1a、PC1200/390/保存/拒否99df94f4、方向4選択・旧省略2球97361588、全整合92647cd0 PASS。限定候補 `docs/verification/realism-debug-20261027/candidate-maker-time-shape-v159-01/maker.html`（HTML493aba72、Native212/f3cc74fc、WB189/c6288bc8）、詳細 `docs/verification/realism-debug-20261027/PITCH-MAKER-TIME-SHAPE-V159.md`。比較元Aを狙い補正したPVでは量が変わり、元V158の近量5%条件と同じではない。実測校正/Native認証へ昇格しない。次はTask2初球固定仮説の実連続Host/Maker検証。本人追加の最新設計GitHub本文反映はTask6 Step6へ明示、全他残件/全goal ACTIVE。

**一次資料と限界:** [NASA: Lift of a Baseball](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/lift-of-a-baseball/) は回転・流速・縫い目と空力、[Nathan et al.](https://arxiv.org/abs/physics/0605041) は回転球の空力測定を支える。これらだけから任意の遅い変化開始を実証したとはしない。時間分布によるキレ観測は今回の設計提案。

**2026-10-28 V164 3入力候補:** V162固定40/厳密3段階0、V163局所位相/候補0を保持。固定中/強の量条件不成立を入口で見落としたため、V164では既存Bへ中を変更してanchor事前検査を追加した。通常19件は全件再利用し、候補5件のdense/半stepだけ10件を新規実行。3条件共通で弱(.04/30/-5)/中(.1/30/270)/強(.02/30/0)が量最大差4.9888%以内、p50/late20の順序を維持。188cf834 PASS4.233秒、全型841a1b81/新9件a1bcdb8d。モデル内の相対入力であり、無技能比の改善・全球種/実測校正・3選択UIは未完。次はV165で通常保存/狙い補正/比較を確認する。詳細 `docs/verification/realism-debug-20261027/KIRE-THREE-INPUTS-V164.md`。完了済みの物理探索/共通CCG/V161を再実行しない。

**V164保存record追記:** p10が弱181.516ms/中158.491ms/強200.677msと逆転したため、p50/p90順の3入力を本人定義の変化初期順へ昇格しない。次はV165で保存56件だけを早期順まで診断し、新規飛行を計算しない。通常authoring/狙い補正確認はV166の別harnessを準備し、入力確定後に行う。

**V165判定（最新）:** 保存56条件/27720組を新飛行0で診断し、近量方向311組・旧primary候補3組に対し、p10/p50/p90順も満たす候補0。fb5920e1 PASS718ms。V164候補を3技能へ採用しない。V166通常authoring harnessは準備済みだが適格入力がないためChrome未実行、不要な試投を開始しない。次は既存空力Sourceの入力をrelease制御/球の物性/環境に分け、技能入力の有効域と未測定境界を固定する。既存範囲を自動拡張した総当たりや、量閾値/名前/時刻補正による成立化は行わない。UIには既存catalog/select/null復帰を使えるが、breaking_ball_qualityの実state/consumerは未定義であり、数値effectScale欄を出さず3選択で実Sourceへ通す接続が必要。

**Source適用域の固定:** `simulateLivePitchV1()` がrelease owner、`LivePitchAuthoringV78.ts`が名目spin/qの供給元。既存spin再現誤差は一様倍率で、キレ技能/手指動作→名目spin/qや軸/姿勢精度は未接続。空力の開始時刻入力は存在せず、mass/air/seam係数の技能別変更へ置換しない。次はこの既存owner内の最小接続案を具体化し、3表示・数値手入力なし・null復帰・旧省略互換・基準無技能と球別適用域を先に対応する。未測定値と既存56件の範囲外はUNKNOWNのまま。詳細は上のV164/V165結果文書。

### Task5: SPIN v2/SIGN基盤と継承残件

**Files:** 継承計画 `docs/verification/traits-spin-continuation-v123/PLAN.md`、`IMPLEMENTATION-SCOPE.json`、`LIVE-POLE-SEAM-V148-RESULTS.md`、`SPIN16-17-OWNER-AUDIT.md`、`docs/verification/swing-remainder-v122/RESULTS.md`。実装所有者は既存 `SpinControlMasteryV123.ts`、`SpinMotorQualificationV123.ts`、`SpinMotorPlanV123.ts`、`LiveSpinControlV123.ts`、`SignatureContextEvidenceV123.ts` と該当Native/Live Owner。Task1のcase/manifestを実Native認証と混同しない。

| 継承項目 | 本goalでの扱い/受入 |
| --- | --- |
| SPIN-01〜39 | 元表を保持し、既存receiptと最新適用Sourceを対応。SLICE/HOOK/BACKSPIN/TOPSPINの独立資格、未習得不使用、2種以上Gold、3/4種の実採用・実接触・再読を不足分だけ検証 |
| Gold希少性 | 既存の自然長期/習得率・再現性未検証を継承。作者の合成100/300年をNative自然習得の証明にしない。名前の抽選/人数上限を作らない |
| ラインドライブ | 全打者の実打球分布のDescriptor。回転傾向と意図的技能を分け、名札の結果Buffなし |
| SIGN-01〜38 | 原表の基盤部分=Source分離/独立証拠/公式context/不変ID・時刻/二重効果なし/表示契約だけを対応。認定・名付け・文化生成・認知/命名の長期Soakは明示DEFERRED_TO_PENNANT |
| SWG/BAT/DIR・旧Task5 | 準備/振抜き既存PASSを保持。途中中止/offered-at、Condition/疲労/Emotion、Native pre-release、監督trust/Soft、本人の観測分類/捕手学習の未完をOwner別に接続。未校正係数で完了を偽装しない |
| pole/fence/custody | V148の同円形fence window、wall/pole制約、held→release/near-zero cut、Native moving/custody/legalの不足を継承。既存球場で実接触/継続/保存再読。研究物理を公式HRへ昇格しない |
| 外部確認 | NPB採用規則/実球場寸法材質はUNKNOWN保持。影響する公式採用だけに局所化し、メーカー・心理・高速検証全体を止めない |
| 旧別課題 | 100試合校正/全runtime互換/別性能未達の原課題を保持。今回の最終受入へ無制限に混入しない |

- [ ] Step1: 原表の各要件へ `既存証拠/現在の適用性/不足する実経路/担当Task/延期理由` を記録する。未読をNOT_RUNへ書き換えず、まず既存証拠を参照。取得したremote SIGN冒頭のscopeとローカル固定原文の差を履歴として残す。
- [ ] Step2: 不足する実装ごとに最小の失敗caseをTask1へ保存→既存Ownerで修正→限定Core/Native受入→再読非消費/旧schema互換を確認。準備・初球資格等の成功fixtureを一から再作成しない。
- [ ] Step3: SPIN使用/不使用・未習得・複数技能・左右鏡映・動作不能を、実バット→接触→3D回転→空力へ通す。Gold label変更だけの対比較で物理結果不変を確認。
- [ ] Step4: 一つの制限された公式採用UNKNOWNを全goalのblocked理由にしない。未接続/不成立は受入表に残し、その枝の具体的な次手順と並行可能Taskを保存。

### Task6: 同版配送・最終受入

**Files:** 最新の生成入口は `tools/browser-bridge/prepare-release-v133.py` と `verify-envelope-release-v133.mjs` を参照し、新版専用入口/出力先を作る。`dist/native-match-core-browser.js.inputs.json` のSource pinを実buildと照合し、旧V133を上書きしない。通常HTML・メーカー・調整室・Workerは同じSource版を使用。

- [ ] Step1: 全対象表をPASS/FAIL/NOT_RUN/NOT_CONNECTED/UNKNOWN/DEFERREDで再照合し、原証拠へのリンク・適用SHAを保存。資料・synthetic fixtureだけのPASSを本番実装のPASSにしない。
- [ ] Step2: `npm run typecheck`、変更対象の限定Vitest/Node検証、Task1の同Chrome同値・保存再読・複数seed統合を実行する。広い検証を繰り返すのは新差分/失敗がある場合だけ。
- [ ] Step3: 新版候補3HTMLを別名生成し、PC/390px・実Worker・Maker JSON roundtrip・9回完走・旧入力互換を確認。9回は高速経路でcanonical検証し、通常画面は視覚/操作/接続を必要prefixで確認。
- [ ] Step4: 正確性/接続/速度/表示を別々に報告する。旧193.421秒/259球/50守備、180秒未達を保持し、計算区間と表示区間の新実測を比較。速くなったと主張するには同条件のbefore/afterが必要。
- [ ] Step5: 全scope対象の実装・実検証・配送と、下記最新設計本文のGitHub反映照合が揃った時だけgoal complete。未完でturnを終える場合はexact next case/command・artifact SHA・残件をCURRENT/Workflowへ保存。
- [ ] Step6（2026-10-28本人追加）: 最終実装と整合した最新設計本文を既存対象GitHub repoへ反映し、branch/ref/file本文を再取得してローカル採用設計と内容/SHAを照合する。進捗commentやローカル保存だけでは代替しない。公開前の私的payload/認証情報/不要な個人情報を除外し、共有dirty tree全体の無差別commit・force push・merge/deployへ拡張しない。原指示は `docs/ai-continuity/AMENDMENTS/2026-10-28-latest-design-github-completion.md`。この項目は未完。

## 作業運用と次手順

- **2026-10-28 反復防止改訂:** V160自然連続診断は実行済（26比較一致、receipt f2b74d33）。再開入口に未実行として残した不整合を修正する。CURRENT本文を完了証拠/現在一件/次の具体的操作へ更新してからWorkflowとcheckpointを揃える。新しいreceiptが入口より後なら、再実行の前に整合する。同じ成功試験を開き直すのは関係Source/入力/runtime変更・新失敗・本人の明示再検証がある時だけで、理由を実行前に記録する。既存pending handleを再利用し、説明/tool出力は新差分へ限定する。過去の本文/原証拠は保持し、新たな台帳/Hook/設定は増やさない。当時の次手順V161-R1（`../../verification/realism-debug-20261027/FIRST-PITCH-INTENT-V160.md`）は実装/限定検証済み。現在の一件はCURRENT本文と対応する最新WorkflowのnextActionを正本とし、この履歴から再起動しない。強制swing案は不正commandでFAIL17bbe1ea、合法APIで同一球の判断だけを変えられないため撤回。新しい診断権限やダミー本人profileを加えて成立させない。
- 初回Task1のharness・manifest読取と最小case化は実行済み履歴として参照する。再開時はCURRENT/Workflowの現在一件から進める。各検証はそのmanifestを使い、古い固定harnessを最新distへ無修正で走らせない。
- 1変更=1仮説=1最小caseを原則とし、壁時計待ち・巨大logの読み直し・同じ成功試験の反復を減らす。profilerで重いphaseを特定してから最適化する。
- Source/設定/seed/command/runtimeと正規データをhash固定。counterfactualは分析専用、実選手/実球へ逆流させない。traceは決定点と失敗前後を保存し、必要な全記録の検証能力は保持する。
- CURRENTは新入口と直近の次手順だけを短く保ち、過去の履歴・原受入表はリンクで保持。重要milestoneはCCG checkpoint/実command receipt、Workflowは工程状態を記録。重複要約を増やさない。
- この計画の作成段階はコード未変更。計画/Source参照整合を確認した記録を残す。計画の自己レビューで人間要求・適用scope・受入条件を対応させ、実装開始のための定型的な再承認は求めない。
