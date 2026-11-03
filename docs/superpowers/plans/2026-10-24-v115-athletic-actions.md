# V115 身体動作 Implementation Plan

**Goal:** 本人が選択した実到達/摩擦方式で4動作と走塁2FAIL修正をmaker/通常へ接続する。

**Architecture:** 既存Curve/Source/公式fact/read-only描画を維持。有限phaseと身体proxyを追加し予測/実行/判定/表示で共用。optional設定で旧JSONを保護する。

**Tech Stack:** TypeScript/Vitest、既存Canvas/PNG、Node24/Chrome。依存追加なし。

**Spec:** docs/design/2026-10-24-v115-athletic-actions.md。

## Tasks

- [x] 走塁未証明返球: `LiveDefenseControlEstimateV95.ts`/同test/`LiveRunnerObservationReviewV95.test.ts`。C1 maskのRED→修正→GREEN、安全thirdと未証明homeを区別。既存Sol1名の所有。
- [x] 滑り込み: 新`running/LiveRunnerSlideV115.ts`/testと`LiveRunnerMotionV1.ts`の後方互換through終端。approach/slide/touch/recoveryの連続曲線、先行接触点、摩擦、1塁feet拒否。
- [x] 守備動作: 新`fielding/LiveFielderAthleticV115.ts`/test。jump/dive plan/sample/phase boundaries、姿勢/着地/再起を定義。
- [x] 統合: `LiveFieldPlayV1.ts`。観測選択、拘束motor、実reach/retention/着地control、slide/tag/touchへ接続。能力/seed/球場/回避を保持。
- [x] Authoring: `LiveBaseballMatchV1.ts`とroster/compiler/validationへoptional内部設定、メーカー入力/保存取消/旧JSONを接続。
- [x] Presentation: 既存練習/rendererにSource姿勢・視点と確認条件を接続。元PNG/4px/V112layoutを保持。
- [x] 検証: 関連tests/型、元2case/重入力/9回、Chrome両幅/編集/JSON/Source姿勢。旧成果物を保護し、V115の3HTMLを別名生成してsource/Core/hash照合。
- [x] 記録: RESULTS/decision/CURRENT/AMENDMENTS/親CCG receipts、PR380公開可能要約。

## Review Focus

空中に地上brakeを使わない。再起前に即送球しない。判定だけを先行させず実手足をtouch/tagへ使う。1塁feet禁止/head/走り抜け、塁保持/離塁の実事実。旧JSON/公開rank分離/V113性能。未証明C1を確実な守備不在と扱わず、合法な安全進塁も一律禁止しない。
