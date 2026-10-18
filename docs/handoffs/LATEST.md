# 最新の再開入口 — 2026-10-18

現在は **v47（中継とベース旋回版）**。既存ブランチ `jolly/tbd-lad-native-browser-core-2026-10-14`、[Draft PR #380](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/380)で継続。main未マージ。

- [通常試合HTML・メーカー・保存方法](../demos/releases/v47/README.md)
- [変更・原因・検証・限界](../reports/2026-10-18-v47-relay-rounding.md)
- [開発史](../history/README.md) / [原因別事例H19](../history/INCIDENTS.md)
- [元の全要求・実装計画・受入条件](2026-10-15-mini-baseball/00-START-HERE.md)
- [v45連続打者視点](../reports/2026-10-18-v45-continuous-batter-view.md)

## 現在の範囲

ローカルHost＋共有Coreの通常試合。B1/4px/55ms、v31以来のUI・間・配球・アニメ、所持球非表示、v45連続打者視点を維持。OpenBiomechanics実測研究軌道を使い、MMDへ戻らない。

v46のタッチアップ・追加進塁・実タッグ・守備分担を継承。v47は直送・保持・運搬と比較する最大2中継者の経路探索を追加し、実受球ごとに新しい持ち替えと送球を発行する。走者は塁中心を通る連続経路と速度で旋回し、安全でない先の塁へは停止する。公開11項目を保ち、詳細44項目に旋回半径／横方向加速度を含める。旧JSONを受け付ける。

最新Core bundle SHA `a470058b7fe0c95c5119fd1376bfa5a91ffc82f9767d95e4cae3daf369ea6a1d`、107入力。HTML SHA `81cdc7c402f2a8461ef07cac8d6d541cf304208fe97f23ba9bc02915ba880747`。配布内`tested-core-inputs.zip`に検証した作業ファイルとcompiled bundleのbyteを保存。以前のSourceによる9回証拠を流用しない。

## 新しく確認したこと

213テスト／24ファイルと全体型検査PASS。20場面×3能力構成は診断異常0。Chrome1200/390pxの視点・UI、20選手メーカー、旧JSON・詳細編集・保存・通常試合への反映を最終Sourceで確認。通常HTMLは292球で9回表終了時のホームリードによる規定試合を完了し、旧結果フォールバックなし。[最終receipt・実行範囲](../reports/2026-10-18-v47-relay-rounding.md)を参照。

判断係数は暫定。実成績や実機スマートフォンを校正した主張ではない。

## 残るもの・再開時の注意

Native SQLite認証された全体連続世界、返球・再整列・全身／バット反動・落下、未完の公式H/E・ルール経路、全得能消費、リード／スライディング、走者間の共同最適化、中継探索範囲の拡張、実選手SI・成績分布の校正、最新Source100試合以上、実機スマートフォン。塁接触は身体全体の足運びではなく、走者位置が塁中心へ到達した証拠を使う。旧400/101試合や旧v41の511球を現在の証拠にしない。

Charter外部承認不足／HOLDと以前のFAIL/UNKNOWNは保持。会話の作業承認と機械的Charter承認は別。[履歴の追記単位](../history/README.md#今後追記する単位)に沿って証拠を残す。

## 再生成

```sh
node tools/browser-bridge/build-v47-release.mjs
node tools/browser-bridge/check-v47-game.mjs ../../outputs/ばせぼーるlv47_TBD_vs_LAD_中継とベース旋回版.html outputs/new-v47-game-proof
node tools/browser-bridge/check-v47-continuous-view.mjs ../../outputs/ばせぼーるlv47_TBD_vs_LAD_中継とベース旋回版.html outputs/new-v47-camera-proof
```

検証先は新ディレクトリを使う。bundle入力SHAを現Sourceと照合する。ブラウザQAのPlaywright/Chromeパスは現環境Windows用。Native非公開DBは通常HTMLに不要であり公開しない。
