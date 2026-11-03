# にーくらMINIbaseball v58

- [通常試合](game.html)
- [カメラ調整室](camera-workbench.html)
- [変更と検証](../../../reports/2026-10-19-v58-pitcher-reaction.md)
- [配布SHA](SHA256.json)

投手が打球を見始めるまでの待機を0.1〜0.25秒へ短縮した。打球が速いほど早く追い始める。追尾開始後180msの移行と守備カメラへの切替条件は維持する。

v57の打者頭固定・設定B、物理・バット・能力・AI・裁定・22/55ms・画質・球倍率は継承する。調整室のUIと保存領域もv57と共通。

HTMLを保存してローカルで開く。外部通信は不要。再生成は `node tools/browser-bridge/build-v58.mjs`。pure検証は `node tools/browser-bridge/check-pitcher-reaction-v58.mjs`、ブラウザ検査コマンドは報告のmachine receiptを参照する。
