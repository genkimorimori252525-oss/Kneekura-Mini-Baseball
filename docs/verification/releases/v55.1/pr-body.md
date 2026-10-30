調整室がフィールドcanvasだけをコピーし、透明レイヤーの実バット・ボールを落としていた不具合を修正。通常と同じfield→bat-overlay→ball-overlayを1:1で合成します。任意の打者視線ガイドの倍率も修正しました。通常試合・カメラ・Core・球サイズ・JSON仕様は変更しません。

検証: 旧版で96/120の欠落を再現。修正版はPC1200/390px・5視点・左右打者／投球／打球／所持とガイドを含むA/B120画像がRGBA全pixel一致（同一software2D backend）。12球のCore／bat hash不変、所持球alpha0、例外・外部通信0。通常HTMLのSHA02644793と旧v55配布の全SHAも不変。原FAILと実行backendを保存しています。

[修正版調整室・配布と使い方](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/jolly/tbd-lad-native-browser-core-2026-10-14/docs/demos/releases/v55.1/README.md) / [根因と検証](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/jolly/tbd-lad-native-browser-core-2026-10-14/docs/reports/2026-10-19-v55-1-workbench-layers.md)

スイング視点が長く低い打点で地面を映しすぎる問題を、読取専用camera observerの調整で改善します。通常HTMLは注視目標を0.30m上げ、下向き目標を0.30radに制限し、保持解除を180msから100msへ短縮します。実姿勢の瞬間resetは行いません。

専用カメラ調整室は単一の通常試合Coreから同tickのA/Bを描画し、従来／改善設定、scrub/55ms step/区間loop/速度/全カメラ/自由な次球/9回、角度グラフ、設定JSONとseed・配球履歴からの再現sessionを扱います。中断時に部分試合と表示を同期し、Coreエラーを含む再現保存は拒否します。

検証: focused単眼／prefix／rewind／設定往復、PC1200/390px、通常実12球のCore／bat一致、他カメラ維持、保存・厳密再現・13不正packet・途中停止・独立エラー注入、調整室で320球の規定9回をPASS。配布126ZIP entriesの全byte/CRCとHTMLを照合。新cameraと版名metadataを除けば通常HTMLがv54 raw bytesに完全一致します。

v54の実働7得能と112参照、Core113入力・実測バット・走塁守備裁定・4px/55ms・メーカーを継承。視点係数・全体成績は未校正、実機未検証。原全計画・FAIL/UNKNOWN/Charter HOLDを維持し、main未マージ。

- [調整室・通常HTML・再生成](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/jolly/tbd-lad-native-browser-core-2026-10-14/docs/demos/releases/v55/README.md)
- [原因・変更・原FAIL・最終検証](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/jolly/tbd-lad-native-browser-core-2026-10-14/docs/reports/2026-10-19-v55-camera-workbench.md)
- [最新の再開入口](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/jolly/tbd-lad-native-browser-core-2026-10-14/docs/handoffs/LATEST.md)
- [開発史H27](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/jolly/tbd-lad-native-browser-core-2026-10-14/docs/history/INCIDENTS.md)
