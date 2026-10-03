# 非デザイン継続: original pitchから実field履歴までの所有接続

> 最新続報: [actual transferの途中保存とrelease handoff](2026-10-04-scheduled-field-throw-continuation.md)。以下の未接続一覧はこのhistory checkpoint時点の記録として保持する。

更新: 2026-10-04 JST（2026-10-03 UTC）

[PR261](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/261) の上に、未解決truthの判定契約、continuing-contact修正、bounded whole-play physical historyを累積した。元の[残計画](2026-10-04-nonvisual-implementation-checkpoint.md)は継続中。デザイン/UI/art/Presentationは接続していない。

## 今回の実装

### 元投球とactual fieldの一つの履歴

- Core `CanonicalWholePlayHistory` は元の `CanonicalPlateAppearanceTimeline` のserialized bytesをそのまま保持する。実際のfield motion、acquisition、carried motion、transfer、release/throwと、owner付きSource参照を追加のenvelopeに収める
- incoming contactとadopted response、secure/releaseは同じ物理時刻でも別のraw stateとして残す。速度・spinを一つへ潰さない。整数tickの一致を実時刻の一致へ読み替えない
- Native `whole_play_history` はcallerから履歴や時刻を受け取らず、original physical-pitch dependencyとfield/executionのbounded prefixを再導出する。scope、Player、cursor、original bat contactとの整合を確認する
- Observationは物理時間や仕事を追加せず、以前のwhole-history payloadを再帰的に入れない。同名のSource文字列でもfield/actionとexecutionのownerを区別する
- 履歴に未知のfuture payloadを取り込まない。future metadataの壊れ、original pitch/Person/geometryの改変、own Source/head/mirrorの改変は拒否する。fresh writeでlate WAL mutationが発生すればrow/headをともにrollbackする
- 実際のincoming horizonと次のresponse cursorを区別する。`end` は常に `unestablished`。静止・確保・一塁判定・observationだけでPlayEndを生成しない

### 継続接触の修正

PR261後の独立probeで、zero-restitutionのbagへの同時刻継続接触がNativeへ正しく採用された後、base-touch/race observerがvelocity/spin差を理由に拒否する不具合を再現した。

- raw bag companionはそのraw incoming momentに対して先に検証する
- 同じ位置・identity・point/normalでの実response後の速度/spinは、最初のrule-frame momentへ投影できる
- `continuing: true` は重複除去で落とさず単調に保持し、`physical_contact_pending` を維持する
- 別位置・origin・identity・geometryの不一致は引き続き拒否する。元のraw snapshot/hashを変更しない

### 未解決truthとofficial call

[詳細](2026-10-04-unresolved-adjudication-continuation.md)。Exact simultaneity / insufficient evidenceをrulingなしで保持し、それを根拠とする別のOnFieldCall/ReviewDecisionを扱える。callなしの未解決truthからofficial closureを作らない。従来のresolved JSON・SQLite schema・competition policyは変更していない。

## 確認した検証

Node26.10.0 / Vitest2.1.9、既存lock、cloud-local TMPDIR、one worker。

- 継続接触: 5 REDを確認後5 GREEN。関連回帰 **19 files / 253 tests PASS**、577.26秒
- Whole-history Core: **5 files / 73 tests PASS**、新規25 testsを含む
- Whole-history Native: **4 tests PASS**、46.80秒。capture→throw、reopen/retry、観測追加の中立性、same-time persistent raw statesを確認
- Whole-history Native WAL/currentness: **7 tests PASS**、62.63秒
- 未解決truth: **20 files / 142 tests PASS**。統合後35 focused testsを再実行してPASS
- Fresh independent cumulative review: Critical/Important findingなし。**41 tests PASS**、別の4 probesもPASS（ground→rolling-stop→rest、failed-retention rebound、receiver再確保、加速中のcarried release）
- 最終累積Sourceのfocused再実行: **4 files / 41 tests PASS**、166.07秒、exit0
- 最終Typecheck / diff check: PASS

これらはfocused coverageであり、新しい累積Sourceのwhole成功を意味しない。修正済み最終Sourceを固定した独立checkoutで一つの `npm run verify` を実行し、terminal resultをPRへ追記する。

## 先行する固定Sourceのwhole結果

- [PR259](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/259) / `ad296f7e7e1349bc4b114d95a7ca078a5994eecb`: `npm run verify` exit0、typecheckと **620 files / 4,157 tests PASS**、81分9.642秒。全1,624 tracked hashes一致
- [PR260](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/260) / published `55cacd18dc2f709bd058f0e74dfd55ed0ef57cbb` と同じfull/src treeのlocal `943d18cbfaaec0d2cfd269a12f46642d41c5ffcf`: `npm run verify` exit0、typecheckと **623 files / 4,198 tests PASS**、85分12.031秒。全tracked hashes一致
- PR261の旧Source wholeは継続接触の不具合発見後に意図的に中止（exit130）。成功扱いしない。修正済み累積Sourceのwholeへ統合し、旧Sourceを再実行しない
- #255–258の個別固定Sourceの未完了gateを、後続Sourceの結果で成功扱いしない

## 残る非デザイン接続

1. 実際のpending physical/intent/information/decision work、actor disposition、live rule windows、generated/consumed event watermarkに基づくNative ActionFrontier/PlayEnd。履歴だけから閉じない
2. その確定したphysical endと別のcall/reviewを既存official closure、scoring、legal Match、actual-role workloadへ接続
3. 版付きvenue/legal/dead/out-of-play/interference policyと実際の証拠。単なるwall接触をexit/awardにしない。bunt依存foul適用では元のintent証明を用い、swingから非buntを推定しない
4. 実移動/recoveryによるnext-pitch、between-play、foul reset
5. 一般body/capability/perception/controller、実際の練習/出場機会、既存Club/competitionを使う自律Careerとperformance/calibration

Accepted caller Sourceやsynthetic motorのテストは、自律的な本番生成・全試合・Career完成の証拠ではない。既存ownerを作り直さず、確定契約と実際の証拠が揃った接続を進める。

## 公開とCI

PR261上の新しいstacked Draft PRとして公開する。GitHub APIで作ったcommitはローカルとmetadataが異なるため、全tree/src treeの一致をfetch/diffで確認する。確認済み公開commitとこの文書へのリンクはPR本文へ記録する。新しいSourceのwhole結果やCI成功を先取りしない。自宅/self-hosted CI、workflow/config/lock、merge/force pushは実行しない。
