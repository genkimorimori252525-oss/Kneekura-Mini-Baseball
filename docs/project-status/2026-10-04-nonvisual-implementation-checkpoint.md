# 非デザイン実装の進捗・残計画 — 2026-10-04

> 続報: 最新のユーザー指示により非デザイン実装を再開した。[field acquisition/custody/throwの再開記録](2026-10-04-field-execution-continuation.md)を参照。この文書の停止・検証記録は当時の状態として保持する。

## この時点の結論

ユーザーの「ここらでよか。実装したものと残計画との進捗など整備してGithubに上げて」という指示により、新しい機能の実装を停止し、実装済みの変更を保存・公開する。**最新の確定済み計画全体は未完了**。今回は未公開の5段を draft stacked PR として公開する。全体検証の未完了を残した公開チェックポイントであり、merge可能・ゲーム全体完成・現在のCI合格を意味しない。

デザイン、UI、art、Presentationへの接続は行っていない。削除・容量整理もユーザーの指示で停止している。

この文書は2026-10-04の状態をまとめる。過去の個別進捗文書にある「whole gateが実行中」「公開前にwhole成功を待つ」という記述については、以下の現状と今回の公開指示を優先する。過去の検証記録自体は変更しない。

## 1. 最新の確定計画と適用範囲

公開前に `git ls-remote` で次のremote branchが同一SHAであることを再確認した。

| 計画の正本 | 確認済みSHA | 用途 |
|---|---|---|
| `jolly/core-foundation-plan-2026-09-17` | `44b9f5de7b9d87e649f12f1af78c202f2b5ab44d` | 最新のCanonical設計・文書Status |
| `jolly/core-realism-2026-09-18` | `4f0a60a3818926327b6bf5877ab3dec456a76530` | World-first実装契約05/06/07とroadmap03 |

Foundationの [`00-current-design-handoff.md`](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/44b9f5de7b9d87e649f12f1af78c202f2b5ab44d/docs/game-design/00-current-design-handoff.md) は2026-10-01更新。ファイル名ではなく現在Statusと後継Canonical文書を優先する。

- 32/34/35/38/41/42/50/51は `-DRAFT` がファイル名に残っていてもCanonical。52はCanonical supplement。11–16/18–20/26/31のFreeze監査も完了している。
- Manager39/40/43/45/46/47は旧計画で、後継49を使う。44は検証資料であり追加の実装計画ではない。
- Pixel Player JSON/v1/v2はARCHIVED / ON HOLD。再開対象に含めない。採用PNG方式も今回の非デザイン実装範囲には接続しない。
- 古いhandoff、古い設計SHA、過去の「未実装」ヘッダーだけから残作業を新規生成しない。再開時も現在Status、実装コード、個別検証を照合する。

## 2. 既存の実装と公開位置

過去の基盤P0–P9の完了記録は、その基盤の検証結果である。現在の確定済み計画全体の完了とは区別する。[基盤のmaster progress](../superpowers/plans/2026-09-18-core-realism-master-progress.md) と個別の `docs/project-status/` を参照する。

Roster・decision attribution・Club lifecycle・catalog・psychology/trait・competition/season・manager/scouting/development・regional/national・workload/health等には既存のCore部品とNativeの採用・保存境界がある。これらを未実装として作り直さない。一方、部品やaccepted Sourceの採用機能の存在は、実際の試合結果から自律的にCareer全体が進むことの証明ではない。残る接続は§5に記録する。

直近の公開済みWorld打球stackは次の順序である。いずれもmergeしていない。

| PR | 実装済みの境界 | そのSourceで確認したlocal whole検証 |
|---|---|---|
| [#248](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/248) | actual batted World continuationのNative接続 | 582 files / 3,596 tests PASS |
| [#249](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/249) | actual acquisitionの採用・保存 | 575 files / 3,615 tests PASS |
| [#250](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/250) | actual motionと継続 | 578 files / 3,665 tests PASS |
| [#251](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/251) | later acquisitionとcarried execution | 591 files / 3,724 tests PASS |
| [#252](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/252) | actual Player transferとWorld throw | 586 files / 3,750 tests PASS |
| [#253](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/253) | explicit fixture geometryとsecured base contact | 593 files / 3,832 tests PASS |
| [#254](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/254) | actual batter-runner base touch | 596 files / 3,876 tests PASS |

テスト数の増減は各branchのファイル構成・Sourceに依存する。合計や割合に換算しない。#254のheadは `9384fadb8b80dd073649b5a1ee7e44ba9e394b74`、今回のstackの親branchは `codex/batted-world-runner-contact-2026-10-03`。

## 3. 今回公開する5段

公開順序は **#254 → B → D → C → Race → Field**。各PRのbaseは直前のbranch。履歴のreset、amend、force push、mainへの書込み、PR mergeは行わない。

| 段 | branch | 実装commit | PR |
|---|---|---|---|
| B | `codex/batted-world-base-touch-history-2026-10-03` | `c4bcce4364e55330df14666f2b2b7bc5b4c0d1e2` | [#255](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/255) draft |
| D | `codex/batted-world-first-base-rule-2026-10-03` | `98f307f8a859857ef5286b7bda1455eab435db35` | [#256](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/256) draft |
| C | `codex/bounded-original-pitch-evidence-2026-10-03` | `a6a6ffd305920a4d246b83b07f147f7916303a56` | [#257](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/257) draft |
| Race | `codex/batted-world-first-base-race-2026-10-03` | `2c07fe7df62d65515bdb4b16a3b5fd01c15d2e61` | [#258](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/258) draft |
| Field | `codex/batted-world-ball-base-rules-2026-10-04` | `821a6fb61a703f904049e8953b8704c83c58ee09` | [#259](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/259) draft |

Fieldの実装Source treeは `04126f44922c9184a6be48a3b9412129d3abfe1d`。後続の資料だけのcommitはこのtreeを変更しない。各PRのhead SHAとbase branchは公開後にGitHubで確認する。最新統合資料は [#259のbranch](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/codex/batted-world-ball-base-rules-2026-10-04/docs/project-status/2026-10-04-nonvisual-implementation-checkpoint.md) にある。

### B: whole-prefixの足・塁・確保履歴

実際のfoot/base contact episode、離脱・再接触、actor clock/rebase、全motion/execution/capture/throw prefixからの履歴を所有する。確保中の区間と両足接触を交差させ、release/interruption以降の支配接触を作らない。Native `base_touch_history` はPlayer/Person/fixture/geometry/Source/head/hash/mirrorを再導出する。接触だけから得点・占有・OUT/SAFE・playEndを作らない。

### D: actual first-base rule

実行済み打球のground/fielder-touch/catchの順序とsecured/interrupted momentを既存ルールへ接続する。Native `first_base_rule` は全実行prefixと全active defenderの確保・足履歴を読み、成立したcatchを優先し、実際のfair groundだけをground raceへ渡す。未解決のsurface/legal/custodyをpendingで保存する。

### C: original pitchの有向読取り

元physical pitch Sourceまでのpayloadを再生し、将来部分はmetadataの完全な整数sequence/head検証に限定する。将来の打球・pitchを過去の証明へ読み込む循環を防ぐ。過去のhash/読取りと新規書込みのcurrentnessを分離し、fractional revisionや壊れたoriginal proofは拒否する。whole-play timelineへの打球接続は未完了。

### Race: true elapsed first-base race

元contactから共通actual horizonまでのbatterと全active defenderのcanonical履歴を使う。同じ記録tick内の実際の異なるmomentを区別し、必要な接触・支配が成立すれば先行OUT/SAFEを判定する。将来接触がないことを捏造で埋めない。Native `first_base_race` は既存prefixを再導出し、legacy `first_base_rule` の保存形・既存tick公開APIを保持する。exact tieや曖昧な同時支配は未解決。

### Field: actual ball/base contactとterritory

- 明示的に校正されたoriented base prismと球のface/edge/corner/tangent接触を連続時刻で求める。塁の厚み・materialを推測しない。
- 新しいfield経路でactor/surface/ground/baseを実際のelapsed momentで扱い、bag rebound後は直前の採用済み状態から進める。legacy経路を保持する。
- Nativeはzero-horizonの元bat contactだけをrootとし、既に進行した旧flight/Worldを巻き戻さない。geometry/actionのimmutable ownership、両方向の旧owner競合排除、WAL rollback、current-write/歴史読取りを検証する。
- 採用済みfirst/third bag contact、actual post-ground gate crossing、physical rolling stopをNativeのbounded prefixからterritoryへ接続する。gate到着だけをpassageにせず、horizonだけをsettling/playEndにしない。
- exact coincident bag/wall、停止後のresting append、actual stopの浮動小数演算、hidden Source/head/calibration ownerについてreviewで見つかった問題を修正した。Source結果注入や未来forecastからの判定は許可しない。
- この新field ownerにはacquisition/custody/transfer/throwがまだ接続されていない。carried contactのreleaseや未確定legal結果を自動生成しない。

## 4. 検証状況

| 段 | 関連する最終検証 | whole検証の現状 |
|---|---|---|
| B | Core117、Native6 files / 56 tests PASS。review scratch13 PASS。comment修正後のdeterminism/controlled-base12 PASS、typecheck PASS | 修正前wholeは3,961 PASS / 1 FAIL。コメントの `window.` をlexical guardが検出したためコメントのみ修正。再起動で旧再検証は中断。再開wholeは04:19 JSTにexit1で終了:602/603 files、3,945/3,962 tests PASS、`Worker exited unexpectedly` が1件。14 Source hash不一致0。残り17 testsの完了証拠なし。原因調査・再検証待ち |
| D | Core43、Native6 files / 70 tests PASS、typecheck PASS。review5 PASS | 再起動により中断。terminal receiptなし。再実行待ち |
| C | post-fix Native4 files / 35 tests PASS、typecheck PASS。review19 PASS | 再起動により中断。terminal receiptなし。再実行待ち |
| Race | Core8 files / 87 tests、Native6 files / 70 tests PASS、typecheck PASS。review6 PASS、旧archive snapshot/hash等価を確認 | 再起動により中断。terminal receiptなし。再実行待ち |
| Field | 最終typecheck PASS、Core12 files / 131 tests PASS。未使用test変数除去後の最終Native4 files / 54 tests PASS、341.50秒、exit0、19 Source hash不一致0 | 未実行。最終commitのSource固定後に必要 |

Fieldのfresh readonly reviewは1P1/3P2を指摘し、当初 `Not ready` とした。全4件にtracked/direct regressionのRED→GREENを実施した。reviewerによる大規模whole/archive検証は実施されていないため、review通過をwhole成功の代用にしない。

関連gateのSource固定をhashで確認している。Bのコメント修正前のsource treeと現commitのtreeは異なるため、旧whole結果を現commitの成功とは扱わない。現在のwhole結果は上表のterminal statusによる。

Bの再開wholeは3,733.08秒で終了した。記録されたworker異常の原因はこのチェックポイントでは特定していない。テストのassertion失敗が表示されていないことを成功へ読み替えず、exit1と未完了17 testsを保持する。新しいfeature実装やwhole再実行は今回の公開作業では開始しない。

CIについて、この引継ぎで保持しているP0 Core成功run [`37055766746`](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/actions/runs/37055766746) は **#247のSHAの証明だけ**。#248以降や今回の5段のCI成功として転用しない。CI用TEMP設定proposalは未適用。未承認のworkflow設定変更は行っていない。

ローカルの詳細log/Source hash/terminal receiptは各checkoutの `.superpowers/sdd/` に保存している。scratch DB、依存関係、生成catalog、検証logをGitへstageしない。GitHubにはコード・test・実行計画・この進捗資料を公開する。

最終Field検証は2026-10-04 04:09–04:15 JSTに実行した。再現コマンドは次のとおり。WindowsのNative fixtureは有効な書込み可能TEMP/TMPを必要とする。今回のTEMP/TMPは `K:/CodexTemp/kneekura-field-native-20261004`。

```powershell
npm run typecheck
npm test -- src/core/rules/BallWorldFieldTerritory.test.ts src/core/rules/BallWorldGroundGatePassage.test.ts src/core/rules/BallWorldBattedRuleEvidence.test.ts src/core/rules/BallWorldBattedRuleChronology.test.ts src/core/sim/ball/BallWorldBaseBoundary.test.ts src/core/sim/ball/BallWorldFieldContinuation.test.ts src/core/sim/ball/BattedWorldFieldMotion.test.ts src/core/sim/ball/BallWorldContinuation.test.ts src/core/sim/ball/BattedWorldMotion.test.ts src/core/sim/collision/AcceleratedSphereContact.test.ts src/core/rules/FairFoulBaseGatePassageRule.test.ts src/core/rules/FairFoulSettledBallRule.test.ts --maxWorkers=1 --minWorkers=1
npm test -- src/host/world/SqliteBattedWorldFieldStore.test.ts src/host/world/BattedWorldFieldWal.test.ts src/host/world/SqliteBattedWorldMotionStore.test.ts src/host/world/SqliteBattedWorldExecutionStore.test.ts --maxWorkers=1 --minWorkers=1
```

`npm run verify` は全体検証の再実行コマンド。各branchのexact SHA/Source hashとterminal exitを保存して実行する。これは未完了の再開作業であり、上記の関連gate結果だけで完了扱いしない。

## 5. 残る確定済み非デザイン計画

以下は既存の部品を捨てて再実装する一覧ではなく、完了証明が残る接続・実行範囲である。テスト数・文書数から総進捗率は算出しない。

| 優先順 | 残る範囲 | 完了に必要な証拠 |
|---|---|---|
| 1 | 今回stackの検証・統合 | 各固定Sourceのterminal whole/type結果、archived Source再生互換、現SHAでのCI。draft公開はこのgateを省略しない |
| 2 | 新field ownerのactual acquisition/custody/carried continuation/transfer/throw | 元geometry/Player/Personから実際の接触・確保・中断・releaseを採用し、旧ownerとの二重authorityなしで再開・再生・rollbackするNative証拠 |
| 3 | 新field経路の足/塁履歴・first-base race統合、capture/foul/retention/juggle | 新しい実行prefixのactual rule facts。未到来接触、glove支配、catchやOUT/SAFEの注入なし |
| 4 | Venue surface/legal/dead/out-of-play/interference、on-field call/review | 原因となる物理事象とversioned policy、正しいルール解釈とofficial decisionの分離。未解決事象をfair/liveと仮定しない |
| 5 | whole-play original causal timeline、final OfficialPlayClosure/scoring/legalMatchState/actual-role workload | pitch→bat→field→player→判定→公式結果の有向prefix、actual playEnd/watermarkとexactly-once採用。pitch-only証明やhorizonをplayEndへ置換しない |
| 6 | next-pitch/between-play/foul reset・再開 | 実際の終端・移動・疲労・recoveryを次playへ引き継ぐ保存/再開。無根拠の位置・状態resetなし |
| 7 | General Player body/capability/generation/locomotion/perception/controllers | 身体・能力からactual motor/actionを生成。手/slide/player-player/player-surface等の必要接触。実際の身体が未所有のpre-pitch runnerに架空経路を与えない |
| 8 | General batter/role能力、生成・育成・実際の練習/出場機会 | 実際の身体/実行/workload/健康/学習の因果接続。synthetic test motorやaccepted caller Sourceをproduction生成器とみなさない |
| 9 | 確定済みClub/competition/roster/scouting/manager/team関係・mood/trait/popularity/star/developmentの自律Career実行 | 既存Core/Native ownerをactual Match結果と実際のseason/eventへ接続。lower-tierを含む必要試合・statistics・economy・opportunityの生成、長期reopen/replay/人口・校正・性能検証。未校正contentの推測なし |

文書の一部には既に完成した部品がある。再開時はこの一覧と個別statusを起点に最新コードを確認し、完了済みのownerを重複実装しない。追加の新規案やFuture Reference poolは、この一覧を理由に自動承認しない。

## 6. 再開手順・公開条件

1. GitHubの各draft head/base、最新Foundation/Realism SHA、この資料を確認する。古いplanやarchived visual案へ戻らない。
2. Bの再開wholeのworker異常を元log/terminal receiptで確認し、原因調査・再検証する。D/C/Raceの中断logを成功扱いせず、必要なwholeを別log/receiptで再実行する。Fieldも固定Sourceでwholeを実施する。
3. 失敗は再現した原因だけを小差分で修正し、変更後Sourceの必要gateを取り直す。未完了gateのままdraftをready/mergeへ昇格しない。
4. 次の機能依存はField acquisition/custody/transfer/throw。§5の順に、最新確定契約の範囲で実装・Native接続・検証を進める。full goalは未完了のまま再開する。

今回の公開後はユーザーによる次の再開指示を待つ。デザイン接続・merge・削除・未承認設定変更を開始する指示にはならない。
