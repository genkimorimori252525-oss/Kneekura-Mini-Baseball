# 非デザイン実装の再開: actual field acquisition / custody / throw

更新: 2026-10-04 JST（2026-10-03 UTC）

## 再開範囲と結論

ユーザーの最新指示により、[#259](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/259) の保存済み残計画から非デザイン実装を再開した。この変更は、[直前のチェックポイント](2026-10-04-nonvisual-implementation-checkpoint.md) §5項目2の「新field ownerへのactual acquisition/custody/carried continuation/transfer/throw」を実装する。旧文書の停止記録は当時の記録として保持する。

**全確定計画の完了ではない。** 現段階で実装したのは、元の身体・geometry・accepted motor/modelから実際の確保、保持移動、持替え、release、送球後Worldを導出・保存・再生する境界である。自律controllerがこれらのaccepted Sourceを全試合で生成すること、公式play終了、Career全体の自律進行は別の未完了接続である。

基点: `ad296f7e7e1349bc4b114d95a7ca078a5994eecb`（#259）、Source tree `04126f44922c9184a6be48a3b9412129d3abfe1d`。最新Foundation `44b9f5de7b9d87e649f12f1af78c202f2b5ab44d` / Realism `4f0a60a3818926327b6bf5877ab3dec456a76530` は再開前にremoteを確認した。

## 実装した境界

- Field-aware acquisitionは実行済みの単独glove接触からretentionを再導出する。確保までの実時間と同じ記録tickの競合検査に、actor/ground/wallに加えて元の明示的なbase prismを含める。
- 確保中のbase接触や他の物理境界はinterruptedになる。incoming energy、contact offset、remaining energyを保持し、contactだけから支配・catch・OUTを作らない。
- 実際のsecured momentからcarried motionを再基準化する。持替え中も全field境界を検査し、途中接触ならreleaseを生成しない。
- 送球は元Player/Personに所有されたfielding modelとactive receiverを使い、既存の`throwReadyTick`近似、transfer・launch kernelを再利用する。release後の球もbaseを含むactual field queryで進む。
- 新しいNative field-execution ownerは元field actionをrootとする。元field Sourceを改変せず、contiguous prefix/head、Source/hash/snapshot/mirror、Player/Person/geometry、current workloadを自分のSQLite接続で再導出する。
- Field execution採用後はlower field ownerの新規進行を禁止する。既存field archiveの読取り・同一retryは維持する。新ownerも過去のbounded readと新規writeのcurrentnessを分離し、未来payloadを過去の証明へ再生しない。
- Late WAL変更はactionとheadをrollbackする。旧acquisition/throw/field-motion Core本体は変更していない。

## 検証

クラウド上のNode **26.10.0**、既存lock通りの`npm ci`、書込み可能なprocess-local TMPDIRで実行した。repositoryの依存・workflow・永続設定は変更していない。

- New/related Core: **10 files / 125 tests PASS**（新規23 testsを含む）
- New Native/WAL: **2 files / 18 tests PASS**、201.62秒、exit0
- Typecheck: **PASS**
- Fresh independent review: 現変更にCritical/Important指摘なし。独立Core23 testsと追加Native/WAL5 testsがPASS。Player model/workloadのlate変更、orphan head、future payloadとmetadata、peer変更を確認した
- Legacy Native regression: **4 files / 54 tests PASS**、278.00秒、exit0
- 新Sourceのwhole verify: 未完了。関連gateやreviewをwhole成功に読み替えない
- 基点#259の固定Source whole verify: 別の独立checkoutで実行中。#255–258の各固定Source gateとは別物である

独立scratch検証はrepository外に保持し、通常のwhole suiteやGitへ混入させていない。生成catalog・依存・SQLite・検証logは公開対象に含めない。

## 公開とCI

#259の上にisolated stacked draft PRとして保存する。マージ・main変更・force pushは行わない。

P0 workflowは自宅のself-hosted Windows runnerへ向くため、今回のクラウド作業からdispatchしていない。codex branchへのpushやdraft PRは、そのworkflowの自動起動対象ではない。したがって現変更のCI成功は申告しない。クラウドでのlocal whole結果とGitHub CIを区別する。

## 続く残計画

1. この実装Sourceのwhole/type/旧archive互換検証と公開確認
2. 新field action＋executionの統合prefixから、実際の足/塁履歴・確保区間・first-base race・capture/foul証拠を導出する
3. Venue/legal/dead/out-of-play/interference、on-field call/review
4. whole-play causal timelineとfinal official closure/scoring/legalMatchState/actual-role workload
5. next-pitch/between-play/foul reset、general body/capability/perception/controllers、実際の育成・出場機会、自律Career

未知の接触policyや中断後のreleaseを推測で埋めない。今回のfield capture/throwもplayEnd/officialClosureを生成しない。デザイン/UI/art/Presentationは未接続のままである。
