# 非デザイン継続: Playerの観測calibration所有層

> 続報: [旧release境界の互換性補正](2026-10-04-release-custody-compatibility-continuation.md)。本観測modelの公開は [PR264](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/264)、[実装commit](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/de36ce08c310ab382fe25328dc27d4c143354ba1)。

更新: 2026-10-04 JST（2026-10-03 UTC）

[PR263](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/263) / [実装commit](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/e2f635daded52326404bcda09935057639591c72) のscheduled transferに続き、実際の知覚→個人判断→motor commandへ接続するための観測calibrationを所有する。

## 追加したもの

- Core `PlayerObservationCalibration`: existing perceptionのrefresh、FOV/距離/相対速度、quality weights/duration、検出閾値/誤差、memory decayと、独立した `perceptionAbility` を明示的に検証・freezeする
- Native `SqlitePlayerObservationModelStore`: accepted Sourceがoriginal Player/Person linkと既存fielding-model Sourceをpinし、accept/read/retry/reopen/day selection/transaction前後に自分のDBから再導出する
- 既存fielding baselineを唯一のdefensive-ratings authorityとして使う。`situationalAwareness` からperceptionAbilityを推定しない
- Career/Playerごとに一つのversion-pinned immutable baselineを持つ。新しい値による上書き、隠れたlatest lookup、未来日のモデル採用を拒否する
- 元Person/fielding Sourceの再hashを伴う差替え、mirror/orphan/duplicate scope、callbackやWAL trigger中の改変を検出する。失敗時に一部のSourceだけを残さない
- 不足値・余分なfield・accessor・非有限値・weight合計overflowをfail closedで拒否する。本番の数値やfallback defaultsを追加しない

## 検証

- CoreとNativeのREDをmissing implementationで確認後に実装
- Core/perception初期100 tests、Native/WAL初期41 testsがPASS
- 最終isolated focused gate: **15 files / 178 tests PASS**、typecheck / diff check PASS
- Fresh independent review: Critical/Important findingなし。新規3 suitesを独立再実行し **102 tests PASS**
- Scheduled-transfer stackへ統合後: **14 files / 170 tests PASS**、5.97秒。追加で既存fielding-model WAL **8 tests PASS**、1.16秒。Typecheck / staged diff check PASS
- 新しい累積Sourceのwhole成功はまだ申告しない。先行PR262の固定wholeと混同せず、後続の最終累積Sourceを別に検証する

## 次の接続

1. 実際のfield prefixに結び付くview/attention Sourceとobservation receipt。視線を速度や真のball方向から勝手に決めない
2. perceived stateだけを使う個人decisionと、情報/判断/first-stepの遅延・消費証拠
3. 全actor/primitiveの既存motor所有を維持した一つのbounded実行区間。未指定actorを無言で停止させない
4. 実際のcontact/retentionを使うreach/catch/throw、完全なplay registry、official closure、next-play、developmentと自律Career

これはcalibrationの入力契約と永続化であり、実測した本番値の導出や、視線・観測・判断・autonomous controllerの完成ではない。Sequential learning/developmentは元baselineを上書きせず、検証された別の履歴へ接続する。デザイン/UI/art/Presentationは未接続。

[全体の残計画](2026-10-04-nonvisual-implementation-checkpoint.md) と [scheduled throwの検証・既存legacy境界課題](2026-10-04-scheduled-field-throw-continuation.md) も参照する。
