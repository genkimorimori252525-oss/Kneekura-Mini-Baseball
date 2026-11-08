# v55 カメラワーク調整室

人間の最新依頼: スイング後の打球追尾を早め、予定打点のやや上へ向けて地面を映しすぎない。通常試合を保ち、長期に調整できる専用デバッグHTMLを作る。

## 設計

- v54の通常試合・113入力のCoreと実測バットを固定。Presentationだけを交換する新helper。従来設定Aと改善Bが単一試合・単一tickを別々に描画する。A/Bで別試合を生成しない。
- 設定: enabled、aimLiftMeters、swingMaxDownRadians、hitFollowDelayMs、aimReleaseMs。falseはv52の厳密baseline。新defaultは0.30m/0.30rad/100ms/100ms。未来接触の先読みをせず、観測prefixの打球から待機を始める。単眼と既存角運動制限、見逃し・能力依存の投球追従・身体eye・打球後の追尾lawを維持する。
- 独立HTML/CSS/JSの調整室にA/B、全カメラ、ms scrub/55msコマ送り/区間ループ/速度/自由な次球/9回finish、狙いと角度の診断を用意。非表示iframeは固定した試合runtime。親UIから試合の既存command/seek APIを使用し、observerだけを交換する。
- 設定JSONと再現session JSONを分離。sessionはseed/innings/各球のUI指示/選択球/時刻を保存し、既存Coreで再生成する。LocalStorageは調整値だけに限定。未知key・非有限値・不正schema・範囲外を拒否してから反映する。
- 通常HTMLも同じ改善defaultを使用。旧v54成果物と既存makerは保存。無関係なAGENTS/settings/lock/deps/secrets/DBを編集しない。生成物・JSONの作成は今回の明示依頼範囲。

## 実装と分担

1. root: build-v55.mjs、camera-workbench-v55.html/js、再生成手順・履歴・保存。
2. helper担当: 新camera factoryとfocused testのみ。既存helperは変更しない。
3. browser担当: 新checkerのみ。現Source/同tickのCore・bat不変、A従来pose一致、B早期追尾・狙い上、UI/保存/再読/不正値/9回/PC390pxを実検証。
4. 原FAILとreceiptを残し、配布raw bytesとGitHub公開を照合してcheckpoint。

## 境界

実測の眼球モデルを追加する作業ではない。ローカル視点係数は比較可能な暫定値。元全計画・原FAIL/UNKNOWN/Charter HOLDを維持する。新たな表示仕様の範囲は人間の今回の直接依頼から承認されており、再確認を待たず実装する。
