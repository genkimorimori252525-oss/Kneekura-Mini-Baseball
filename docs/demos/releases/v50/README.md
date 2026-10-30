# v50 — lv27打者カメラ復元版

- [通常試合HTML](game.html)
- [選手メーカー（v47と共通）](../v47/maker.html)
- [変更・検証・限界](../../../reports/2026-10-18-v50-v27-batter-camera.md)
- [最新入口](../../../handoffs/LATEST.md) / [開発史H22](../../../history/INCIDENTS.md)
- [配布SHA](SHA256.json) / [同じCore107入力の保存ZIP](../v49/tested-core-inputs.zip)

GitHubでは **Download raw file** からHTMLを保存してブラウザで開く。外部通信不要の単独HTML。

打者視点の構図と見逃しをlv27基準に戻し、見逃し後の姿勢を固定する。最新の実測スイングを維持し、軌道の終了から700ms後に打球への追尾を始める。v49の守備・走塁・裁定、既存UIと4px/55msを継承する。

OpenBiomechanics実測研究データの[原案内](license.txt)、[データライセンス](LICENSE-DATA.md)、[コードライセンス](LICENSE-CODE.md)を保持。CC BY-NC-SA 4.0と上流の追加除外条件を参照。MMDを使用していない。
