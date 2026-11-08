# にーくらMINIbaseball v59

- [通常試合](game.html)
- [カメラワーク調整室](camera-workbench.html)
- [変更と検証](../../../reports/2026-10-19-v59-impact-gaze.md)
- [配布SHA](SHA256.json)

振ると決めた後は、今の球の高さではなく予測打点へ視線を寄せる。予定インパクト付近では完全停止せず、身体と打点に沿う小さな動きを許して安定させる。v57の「振り始めた時点で固定」を置き換えた。見逃し・バントと、その後の打球追尾は継承する。

Bの高さ.30mと俯角上限.20radは再び有効で編集できる。待機300ms／移行70ms／投球追従率.26／許容角.02radも維持する。予定打点の基準は打者自身の登録済み動作意図で、将来の衝突結果を先読みしない。小さな補正を許し、人工的なランダム揺れは加えない。

投手の追尾待機0.1〜0.25秒（v58）、投球22ms／他55ms、4px格子、球倍率1、物理・バット・能力・AI・裁定を継承する。HTMLは自己完結し、外部通信なしでローカル起動できる。

再生成:

```text
node tools/browser-bridge/build-v59.mjs
node tools/browser-bridge/check-camera-impact-gaze-v59.mjs
py -3.10 -X utf8 tools/browser-bridge/package-v59.py
```

ブラウザ検査のコマンドとmachine receiptは報告を参照する。カメラ係数の生体校正、実機の操作感、原全計画の残件を今回の検証完了へ含めない。
