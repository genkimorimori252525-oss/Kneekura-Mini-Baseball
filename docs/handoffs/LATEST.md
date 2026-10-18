# 最新の再開入口 — 2026-10-18

現在は **v46（走塁と守備AI改善版）**。既存ブランチ `jolly/tbd-lad-native-browser-core-2026-10-14`、[Draft PR #380](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/380)で継続。main未マージ。

- [通常試合HTML・メーカー・保存方法](../demos/releases/v46/README.md)
- [変更・原因・検証・限界](../reports/2026-10-18-v46-running-and-fielding-ai.md)
- [開発史](../history/README.md) / [原因別事例H18](../history/INCIDENTS.md)
- [元の全要求・実装計画・受入条件](2026-10-15-mini-baseball/00-START-HERE.md)
- [v45連続打者視点](../reports/2026-10-18-v45-continuous-batter-view.md)

## 現在の範囲

ローカルHost＋共有Coreの通常試合。B1/4px/55ms、v31以来のUI・間・配球・アニメ、所持球非表示、v45連続打者視点を維持。OpenBiomechanics実測研究軌道を使い、MMDへ戻らない。

v46は第一接触後のタッチアップ、回収・肩・持ち替え・受け手を使う追加進塁、塁到達後の再判断、非フォース送球からの実タッグを接続。捕球可能時刻が同じなら到達・進入方向の負担を比較。余剰野手は自分の初期位置へ戻り、backupの不要な位置放棄を抑える。公開能力11項目を保ち、詳細42項目に任意の安全余裕／追球負担の重みを含める。旧JSONを受け付ける。

最新Core bundle SHA `3e2a6f06c24152d2648bb0ae7876910ae3cc0f695f1e0427a9e57cb511539fab`、105入力。HTML SHA `d6bbcd5c7cb2990028693d968f27e73997c7cd603d2fbaf244b04842ae32ccb0`。配布内`tested-core-inputs.zip`に検証した作業ファイルとcompiled bundleのbyteを保存。v45の103入力／旧9回証拠を流用しない。

## 新しく確認したこと

155テスト／18ファイルと全体型検査PASS。20場面×3能力構成は診断異常0。通常HTML251球で規定9回を完了し、旧結果フォールバックなし。Chrome1200/390pxの視点・UI、20選手メーカー、旧JSON・詳細編集・保存・通常試合への反映を確認。[最終receiptと実行範囲](../reports/2026-10-18-v46-running-and-fielding-ai.md)を参照。

判断係数は暫定。実成績や実機スマートフォンを校正した主張ではない。

## 残るもの・再開時の注意

Native SQLite認証された全体連続世界、返球・再整列・全身／バット反動・落下、未完の公式H/E・ルール経路、全得能消費、リード／連続ベース旋回／多段中継、実選手SI・成績分布の校正、最新Source100試合以上、実機スマートフォン。旧400/101試合や旧v41の511球を現在の証拠にしない。

Charter外部承認不足／HOLDと以前のFAIL/UNKNOWNは保持。会話の作業承認と機械的Charter承認は別。[履歴の追記単位](../history/README.md#今後追記する単位)に沿って証拠を残す。

## 再生成

```sh
node tools/browser-bridge/build-v46-release.mjs
node tools/browser-bridge/check-v46-game.mjs ../../outputs/ばせぼーるlv46_TBD_vs_LAD_走塁と守備AI改善版.html outputs/new-v46-game-proof
node tools/browser-bridge/check-continuous-batter-view.mjs
```

検証先は新ディレクトリを使う。bundle入力SHAを現Sourceと照合する。ブラウザQAのPlaywright/Chromeパスは現環境Windows用。Native非公開DBは通常HTMLに不要であり公開しない。
