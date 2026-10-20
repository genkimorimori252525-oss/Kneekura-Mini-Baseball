# にーくらMINIbaseball v57

- [通常試合](game.html)
- [カメラワーク調整室](camera-workbench.html)
- [共通の選手メーカー（変更なし）](../v54/maker.html)
- [原因・実装・検証・限界](../../../reports/2026-10-19-v57-swing-head-hold.md)
- [配布SHA256](SHA256.json)

HTMLをダウンロードしてローカルで開く。Core・画像・フォントを含む自己完結HTMLで、外部通信は不要。

振り始めるまでは投球を追い、実測バットの動作開始に頭の向きを固定する。遅く振れば、その時点まで追った向きで固定する。スイング中は投球やミットへ頭を回さず、スイング終端と打球認識後の待機を満たしたあとに既存の打球追尾へ戻る。見逃し・バントは従来どおり。

画像で決まったBの設定を初期値に採用した。高さ0.30m／俯角上限0.20radは互換の保存値で、頭を固定する方式では向け直す補正に使わないため無効表示。待機300ms／移行70ms／投球追従率0.26／許容範囲0.02radは調整できる。Aは従来モード。「スイング開始」マーカーで固定の前後を比較できる。v57は別のブラウザ保存領域を使い、旧v56保存値が新しい初期値へ混ざらない。JSONは旧版も読める。

投球球22ms、他の描画55ms、4px格子、球の表示倍率初期値1はv56と同じ。物理・スピン・実測バット・能力・AI・裁定・メーカーは変更しない。実FPSは端末性能に依存する。

再生成と主要検証:

```text
node tools/browser-bridge/build-v57.mjs
node tools/browser-bridge/check-camera-head-lock-v57.mjs
node tools/browser-bridge/check-v57-head-lock.mjs "../../outputs/ばせぼーるlv57_TBD_vs_LAD_スイング時の頭固定版.html" "../../outputs/カメラワーク調整室_v57.html" "../../outputs/verification-v57-head-lock"
node tools/browser-bridge/check-v56-cadence.mjs "../../outputs/ばせぼーるlv57_TBD_vs_LAD_スイング時の頭固定版.html" "../../outputs/カメラワーク調整室_v57.html" "../../outputs/verification-v57-cadence"
py -3.10 -X utf8 tools/browser-bridge/package-v57.py
```

browser検査は既存ChromeとCodex workspace runtimeのPlaywrightを使用する。9回完走や全Native・全成績校正の新しい証拠は今回の変更範囲に含めない。原全計画とFAIL/UNKNOWN/Charter HOLDを保持する。
