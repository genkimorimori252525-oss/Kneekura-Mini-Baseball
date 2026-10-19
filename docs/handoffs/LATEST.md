# 最新の再開入口 — 2026-10-20

最新の作成・検証済み成果物は **通常試合v77／調整室v77／メーカーv77**。GitHub公開はまだ未実行。既存branch `jolly/tbd-lad-native-browser-core-2026-10-14`、[Draft PR #380](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/380)で継続し、mainへマージしない。

- [HTML・独立得能・投手調整の操作](../demos/releases/v77/README.md)
- [変更・原因・検証・限界](../reports/2026-10-20-v77-independent-traits-and-pitcher-lab.md)
- [検証索引・原FAIL](../verification/releases/v77/README.md)
- [歴史とH51](../history/INCIDENTS.md)
- [元の全要求・計画](2026-10-15-mini-baseball/00-START-HERE.md)

得能を版付きprofile v2へ分離し、一般physicalと公開能力を変えず実行時に一回だけ反映。送球・green・悪球打ちと既存6技術を継承し、内角攻め・高低打撃・投手打球反応を追加して17系統。旧v1は読込だけで変換しない。旧送球は基礎の復元を推測せず現在SIを維持し、旧greenは保存baselineを明示移行する。悪球打ちの詳細編集も得能sourceへ接続済み。

メーカーに投手調整と全体の人間／AIモードを追加。球種別の実球速・回転、左右・リリース位置、作者モデルの投球動作を設定し、同じCore／通常rendererで試投する。頭部倍率の二重適用は修正済み。設定は試合用JSONへ保存し、通常HTMLでは新しい試合から適用する。

110件・58件の関連テスト、TypeScript、最終メーカー1200／390幅、旧条件6球Source exact、通常HTML296球・103接触／守備継続全完了の9回を検証。Native120／Maker87／union127入力。配布2b2596b5 PASS、初期20人・673実測打撃記録・119項目catalog・旧233凍結物を保持。v76のボール表示・既存カメラ／バット／AIを継承する。最終SHA・receiptは上記索引で確認する。

残る技術・心理・疲労／故障・牽制／盗塁・緩急／準備・身体ブロック／こぼれ球・100試合分布・実機・Native認証連続world等はCURRENTと原全計画から継続。今回の高得点9回を現実分布の校正済みとは扱わない。ユーザー編集AGENTS.md、原CharterHOLD、旧FAIL／UNKNOWNを保持する。

[持球野手の自力踏塁の確認](../verification/2026-10-20-held-base-control/README.md)はv73／v76の既存機能を実証した記録。通常設定での選択頻度の妥当性まで確認したものではない。
