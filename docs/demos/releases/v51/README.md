# v51 — 野手の回避と間隔改善版

- [通常試合HTML](game.html)
- [選手メーカー（v47と共通）](../v47/maker.html)
- [変更・検証・限界](../../../reports/2026-10-18-v51-fielder-avoidance.md)
- [最新入口](../../../handoffs/LATEST.md) / [開発史H23](../../../history/INCIDENTS.md)
- [配布SHA](SHA256.json) / [テスト対象Core108入力とcompiled bundle](tested-core-inputs.zip)

GitHubでは **Download raw file** からHTMLを保存してブラウザで開く。外部通信不要の単独HTML。

同じ目的地へ向かう判断だけでなく、途中で交差する野手の軌道も比較し、捕球担当・受け手を優先して減速と回避を行う。個人の最高速度・加速度・反応条件と既存の戦術値を継承する。v50の打者カメラ、実測スイング終端+700ms、既存の打球追尾・UI・4px/55msを維持する。

身体は平面の代理モデルであり、接触後の反発・転倒、全AIの最適性、成績校正の完成を示す版ではない。残件は報告と最新入口に保持する。

OpenBiomechanics実測研究データの[原案内](license.txt)、[データライセンス](LICENSE-DATA.md)、[コードライセンス](LICENSE-CODE.md)を保持。CC BY-NC-SA 4.0と上流の追加除外条件を参照。MMDを使用していない。
