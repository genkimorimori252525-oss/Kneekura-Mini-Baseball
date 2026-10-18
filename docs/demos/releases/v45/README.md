# v45 — 連続打者視点

- [通常試合HTML](game.html)
- [変更ファイル・設計・検証](../../../reports/2026-10-18-v45-continuous-batter-view.md)
- [公開能力メーカー（v41）](../v41/maker.html)
- [最新入口](../../../handoffs/LATEST.md) / [開発史](../../../history/README.md)
- [配布SHA](SHA256.json)

GitHubのHTML表示画面の **Download raw file** から保存し、ブラウザで開く。外部通信不要の単独HTML。**打者目線**を選ぶと、球を追う・打点へ狙いを寄せる・打球を追う動きを一つのカメラでつなぐ。打者が走者になっても視点を瞬間移動させない。他の視点・操作・物理・判定は従来どおり。

選球眼の既存SIを表示上の追従確度へ限定反映しているが、眼球の実測能力ではない。突然の変化や予測との差に対する遅れは暫定の表示モデル。PC/スマホ幅で検証し、実機スマホは未確認。

Driveline Baseball / OpenBiomechanics `44b98dae05cceb016f080ab39d105c85b8639084` の実測派生研究データを含む。[原案内](license.txt)、[データライセンス](LICENSE-DATA.md)、[コードライセンス](LICENSE-CODE.md)を保持。データはCC BY-NC-SA 4.0と上流の追加除外条件に従う。匿名の研究軌道を特定選手本人の測定フォームとは扱わない。MMDは使用していない。
