# v49 — 守備責任と走塁裁定修正版

- [通常試合HTML](game.html)
- [選手メーカー（v47と共通）](../v47/maker.html)
- [原因・変更・検証・残件](../../../reports/2026-10-18-v49-positional-defense.md)
- [最新入口](../../../handoffs/LATEST.md) / [開発史H21](../../../history/INCIDENTS.md)
- [配布SHA](SHA256.json) / [検証した107入力・compiled bundle・manifest](tested-core-inputs.zip)

GitHubではHTMLを **Download raw file** から保存してブラウザで開く。外部通信不要の単独HTML。守備位置ごとのカバー・支援、実触塁とforce消滅、退場後の再判断、捕手のタッチ追跡を修正した。v48の打者視点・既存UI・4px/55msを維持する。試合JSON保存には最終状態と判断診断も含む。

250テスト／全体型検査、新Sourceの通常320球・規定9回、1200/390pxとメーカー取込を確認。能力値と成績分布は未校正。全AI判断や実機スマホの保証ではない。

OpenBiomechanics実測研究データの[原案内](license.txt)、[データライセンス](LICENSE-DATA.md)、[コードライセンス](LICENSE-CODE.md)を保持。CC BY-NC-SA 4.0と上流の追加除外条件を参照。MMDを使用していない。
