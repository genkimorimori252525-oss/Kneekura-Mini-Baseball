# v55 カメラワーク調整室・打球追尾調整版

- [カメラワーク調整室](camera-workbench.html)
- [通常試合HTML](game.html)
- [選手メーカー（v54・変更なし）](../v54/maker.html)
- [原因・変更・検証](../../../reports/2026-10-19-v55-camera-workbench.md)
- [配布ファイルのSHA256](SHA256.json) / [検証した入力のZIP](tested-camera-inputs.zip)

HTMLを保存してブラウザで開く。外部通信・サーバー・追加ライブラリは不要。調整室も単一HTML内に通常試合Core・素材・フォントを含む。

## 比較と調整

1. 「12球生成」または「次の一球」で試合を進め、記録から打球のあるプレーを選ぶ。
2. 打球発生／スイング終端の時刻ボタンとscrubを使い、区間の始点・終点を設定してループする。55msコマ送り、速度変更、全カメラへの切替もできる。
3. Aは従来、Bは改善初期値。同じ試合・同じtickを2つのobserverで描画するため、異なる配球や打球を比較しない。A→B／B→Aや従来・改善へのリセットで両側を編集できる。
4. 「調整JSON」で値を保存。「再現セッション」はseed・各球への指示・選択球・表示時刻も保存し、同じCoreで再生成する。LocalStorageは調整値だけを保存。JSONの基準試合／Core SHAが異なるものは読み込まない。

| 初期設定 | Bの値 | 意味 |
|---|---:|---|
| 狙い目から上へ | 0.30m | 物理上の予定打点から注視目標だけを上げる |
| 下向きの上限 | 0.30rad（約17度） | スイング中の目標角。現在姿勢を瞬間resetしない |
| 観測後の待機 | 100ms | 感覚遅延後の実打球観測から数える。予定スイング終端が早ければそちらを優先 |
| 移行時間 | 100ms | 狙い目の保持を解除する時間。実姿勢には従来の角速度／角加速度制限も作用 |

通常HTMLもBの初期値を使う。見逃し・能力依存の投球追従・身体eye・打球後追尾の既存law、実測バット、走塁・守備・裁定、4px／55msを継承する。カメラが変わるとバットの画面上の投影は変わるが、物理軌道は変えない。

「次の球へ進む」再生モードでは通常試合同様に進行。「規定終了まで生成」でまとめて生成し、全履歴を比較できる。生成停止とsession再現中断は部分試合の履歴・カメラを同期する。Coreエラーがあるsessionの保存は拒否する。

## 編集と再生成

- `tools/browser-bridge/live-camera-tuning-batter-view.js`: 調整可能な単眼controller。`enabled:false`は従来v52の制御と同じ。
- `tools/browser-bridge/camera-workbench-v55.html`: デバッグ専用レイアウト。
- `tools/browser-bridge/camera-workbench-v55.js`: 1つの試合からA/Bを描画、操作・保存・再現・診断。`window.KneekuraCameraLab` が検査用入口。
- `tools/browser-bridge/build-v55.mjs`: v54の固定HTMLへ新helperを追加し、通常HTMLと調整室を生成。Core113入力のraw SHAも検査する。

```sh
node tools/browser-bridge/build-v55.mjs ../../outputs
node tools/browser-bridge/check-camera-tuning-batter-view.mjs
node tools/browser-bridge/check-v55-normal.mjs ../../outputs/ばせぼーるlv55_TBD_vs_LAD_打球追尾調整版.html outputs/new-v55-normal-proof
node tools/browser-bridge/check-camera-workbench-v55.mjs ../../outputs/カメラワーク調整室_v55.html outputs/new-v55-workbench-proof
```

ブラウザ検証先は毎回新しいディレクトリを指定する。既存配布成果物を上書きするpackage操作は拒否される。Playwright／Chromeパスは現Windows環境用。Coreを更新する場合はv54と同一という前提を破棄し、builderの基準SHA・セッション互換性・物理とルールの検証を別途設計する。

## 固定したSource

通常HTML SHA `02644793d8c6e41b66d5330fe37cc0ce8d2fa7756ad6bc139b045fbef38d3b17`。

調整室SHA `ad40f7832a1621b09cd5efa3804d6cbfa6ef2534c73242ec6e6a9e0a41e05016`。

共通Core SHA `4a581b262a71530ef67503ba76e71849d52c394a2b7c113852a461b423486279`、113入力。v54メーカー・旧配布版は保持。視点係数は人間の比較用暫定値で、生体モデルの実測校正ではない。元の全計画、FAIL/UNKNOWN/Charter HOLD、実SI・成績分布・最新100試合・実機・全Native等の残件を保持する。

## 検証結果

左右・単眼のfocused検証、通常HTML実12球／PC1200・390px、調整室の保存・再現・中断・不正入力・エラー注入、規定9回320球をPASS。同一Core／batを確認し、通常pageは例外・外部通信0。待機値は予定throughが早いと影響しないため、観測時刻と角度グラフも比較する。実機スマートフォンは未検証。[詳しい証拠と原FAIL](../../../reports/2026-10-19-v55-camera-workbench.md)。
