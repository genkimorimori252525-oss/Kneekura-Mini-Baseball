# 最新の再開入口 — 2026-10-18

現在は **v49（守備責任と走塁裁定修正版）**。既存ブランチ `jolly/tbd-lad-native-browser-core-2026-10-14`、[Draft PR #380](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/380)で継続。main未マージ。

- [通常試合HTML・共通メーカー・保存方法](../demos/releases/v49/README.md)
- [原因・変更・検証・限界](../reports/2026-10-18-v49-positional-defense.md)
- [開発史](../history/README.md) / [原因別事例H21](../history/INCIDENTS.md)
- [元の全要求・計画・受入条件](2026-10-15-mini-baseball/00-START-HERE.md)
- [v48打者視点](../reports/2026-10-18-v48-batter-braking.md) / [v47多段中継・旋回](../reports/2026-10-18-v47-relay-rounding.md)

## 現在の範囲

ローカルHost＋共有Coreの通常試合。正式守備位置をカバー・中継・バックアップへ渡し、自由球／保持／送球で仕事を分ける。送球線の支援点を固定し、必要のない選手は自分の定位置を維持する。主処理者は捕球可能時刻優先。反応・移動・腕・積極性などの個人値は継承し、チーム名による結果補正はない。

走者と守備者の触塁範囲を統一し、force消滅と走塁motor停止を分離した。退場で占有が変われば再判断してから終了する。捕手の非forceタッチ追走が塁へ戻る往復も修正。実通過塁の脱出→重なったグラブのtagは、同tickの因果証拠を限定的に受理する。証拠なしの競争は未確定を維持する。

v48打者視点・v31以来のUIと間・配球・アニメ・4px/55ms・所持球非表示・OpenBiomechanics実測スイングを保持。MMDへ戻らない。公開11／詳細44の共通メーカーと旧JSONを継承。試合JSON保存には最終走者・守備フレーム・診断と終了条件も含む。

## 最終検証

29ファイル250テストと全体型検査PASS。正式9位置20局面×3能力段階は14分類の異常0（outs13/18/20）。通常HTML320球、9回表三アウト・ホームリードで規定終了。例外なし／旧結果fallback=false。カメラ1200/390px、12球の同一Source再現、メーカー20選手／公開11／詳細44・旧JSON・最新試合取込を確認。[最終receipt・原FAIL・実行範囲](../reports/2026-10-18-v49-positional-defense.md)を参照。

Core SHA `e0677928d7641513228fb78782a8afcceb5e4890fddbd99ac93c05f271da2e6c`、107入力。HTML SHA `b4903f219e81c0efa77c560b7961afb8eafaa85843be90fc9460a2db9a23428a`。[入力・compiled bundle保存ZIP](../demos/releases/v49/tested-core-inputs.zip)は109エントリの全byte/CRC/SHAを検証した。過去Sourceの9回を新Sourceの証拠にしない。

## 元計画の残件

Native SQLite認証された全体連続世界、返球・再整列・全身／バット反動・落下、公式H/E・残規則、全得能、リード／スライディング、共同走塁・中継最適化、野手間の衝突回避、実選手SI・成績分布、最新100試合以上、実機スマートフォン。今回の10–46という試合は成績校正の証明ではない。足の接触は位置と領域による代理モデル。通常leg開始の離塁factはmotor開始の代理を残し、今回の同tick順序証拠へ使用しない。

Charter外部承認不足／HOLDと以前のFAIL/UNKNOWNは保持。会話の作業承認と機械的Charter承認は別。元の全目標はIN_PROGRESS。

## 再生成・検証

```sh
node tools/browser-bridge/build-v49-release.mjs
node tools/browser-bridge/check-v49-ai.mjs
node node_modules/typescript/bin/tsc --noEmit --pretty false
node tools/browser-bridge/check-v49-game.mjs ../../outputs/ばせぼーるlv49_TBD_vs_LAD_守備責任と走塁裁定修正版.html outputs/new-v49-game-proof
node tools/browser-bridge/check-v47-continuous-view.mjs ../../outputs/ばせぼーるlv49_TBD_vs_LAD_守備責任と走塁裁定修正版.html outputs/new-v49-camera-proof
```

検証先は新ディレクトリを使う。カメラcheckerのv47名は共有された検査名で、比較対象は現在Sourceの自己再現。Core入力の全SHAも照合する。Playwright/Chromeパスは現Windows環境用。Native非公開DBは通常HTMLへ不要であり公開しない。
