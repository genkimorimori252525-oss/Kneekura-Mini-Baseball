# 最新の再開入口 — 2026-10-18

現在は **v51（野手の回避と間隔改善版）**。既存ブランチ `jolly/tbd-lad-native-browser-core-2026-10-14`、[Draft PR #380](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/380)で継続。main未マージ。

- [通常試合HTML・共通メーカー・保存方法](../demos/releases/v51/README.md)
- [原因・変更・最終検証・限界](../reports/2026-10-18-v51-fielder-avoidance.md)
- [開発史](../history/README.md) / [原因別事例H23](../history/INCIDENTS.md)
- [元の全要求・計画・受入条件](2026-10-15-mini-baseball/00-START-HERE.md)
- [v50の打者カメラ](../reports/2026-10-18-v50-v27-batter-camera.md) / [v49の守備責任・裁定](../reports/2026-10-18-v49-positional-defense.md) / [v47の中継・旋回](../reports/2026-10-18-v47-relay-rounding.md)

## v51の変更と範囲

目的地を分けるだけでは交差経路を保護できなかったため、全野手の同時刻の位置・速度から身体指令を調整し、その後にグラブを計画する。既存の個人最高速度・加速度・反応と戦術値を守り、保持／捕球・送球の受け手・処理担当を優先して減速／回避する。脅威のない希望指令を保存する。公開11能力／詳細44は維持し、専用能力を増やさない。

連続区間の最小距離と終端からの最大制動を確認し、実frameの身体重なりを新しい15番目の診断にした。ほぼ静止した身体の微小制動相が浮動小数点で消える誤検査も修正。初回7FAIL・通常5球目停止と先行REDを保存し、最終PASSと区別した。

ローカルHost＋共有Coreの通常試合。v49の位置責任、送球・実捕球・再計画、実触塁・離塁・tag証拠、走者の占有再判断を継承する。Native SQLite認証された全体連続世界の完成とは区別する。

v50のlv27打者構図と見逃し固定、実測スイング終端+700ms、既存の打球追尾・身体eye、実測バット、v31以来のUI・間・配球・アニメ・4px/55ms・所持球非表示を保持。MMDへ戻らない。メーカーの旧JSONと20選手の編集・取込も維持する。

## 最新Sourceの検証

31ファイル280テスト・全体型検査PASS。正式9位置20局面×3能力段階は15分類の異常0、アウト13/18/20（旧最小アウト数・単調性の条件は変更なし）。通常HTML320球で規定9回終了、130守備プレー・17,820frameで重なり0、最小中心間距離0.500113m。全発行区間・終端制動の最小表面隙間0.0200226m。実試合JSONのSource一致、1200/390px・カメラ・メーカーを新規検証。

HTML SHA `9a2b4761d87b6c908dd51c969d5425a036870caf1f57b474e1113126b409a54e`。Core SHA `01f25940860caff6f9a92a9d8d11d876d87056ed173d8589374226f7c4eccd8f`、108入力。[保存ZIP](../demos/releases/v51/tested-core-inputs.zip)の110エントリは全byte/CRC/SHAを検証。カメラ比較は同一新Coreを入れたv50参照で行い、旧Coreの試合結果を新Sourceの証拠にしない。[receiptと原FAIL](../reports/2026-10-18-v51-fielder-avoidance.md)を参照。

## 元計画の残件

身体は半径0.24mの平面代理で、余裕0.02m／soft0.35m等は暫定制御値。任意の途中時刻からの一律停止保証、有限候補の大域最適性、身体接触後の反発・転倒は未実装。新計画を証明できなければ未確定の停止を残す。初期の重なりを押し出し修復しない。

Native認証された全体連続世界、返球・再整列・全身／バット反動・落下、公式H/E・残規則、全得能、リード／スライディング、共同走塁・中継最適化、実選手SI・成績分布、最新100試合以上、実機スマートフォン。今回の10–46は成績校正の証明ではない。通常leg開始の離塁factはmotor開始の代理を残し、同tick順序証拠へ流用しない。足の完全接地も未実装。

Charter外部承認不足／HOLDと以前のFAIL/UNKNOWNは保持。会話の作業承認と機械的Charter承認は別。元の全目標はIN_PROGRESS。

## 再生成・検証

```sh
node tools/browser-bridge/build-v51-release.mjs
node tools/browser-bridge/check-v51-ai.mjs
node node_modules/typescript/bin/tsc --noEmit --pretty false
node tools/browser-bridge/check-v51-game.mjs ../../outputs/ばせぼーるlv51_TBD_vs_LAD_野手の回避と間隔改善版.html outputs/new-v51-game-proof
node tools/browser-bridge/check-v51-camera.mjs ../../outputs/ばせぼーるlv51_TBD_vs_LAD_野手の回避と間隔改善版.html outputs/new-v51-camera-proof
node tools/browser-bridge/check-maker-public-abilities.mjs docs/demos/releases/v47/maker.html outputs/new-v51-maker-proof docs/demos/releases/v51/game.html
```

検証先は新ディレクトリを使う。Playwright/Chromeパスは現Windows環境用。配布ZIPはテスト時のraw Sourceを保持する。再buildで改行を変換した場合は新しいSource検証として扱う。Native非公開DBは通常HTMLへ不要であり公開しない。
