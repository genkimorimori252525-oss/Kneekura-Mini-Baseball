# v48 — 打者視点の制動調整

[通常HTML](../demos/releases/v48/README.md) / [最新入口](../handoffs/LATEST.md) / [開発史H20](../history/INCIDENTS.md)

見逃しでは球がミットに達するまで視線を落とし続けず、スイングは予定打点へ早めに寄せて制動する。人間の最新指示に沿った表示調整であり、実測した眼球・頭部モデルではない。

## 原因と変更

v47は近距離の投球を最後まで角度の目標とし、全場面で同じ緩やかな追従を使っていた。角速度を落とすのが遅く、見逃しで深く下を向いた。スイングの狙いへの長い混合も、終盤まで動き続ける見た目につながった。

- 見逃し判断が利用可能になった後、知覚遅延を含む観測prefixの球がホーム前方3.5mへ来た時点で注視点を保持する。下向き目標は最大0.30rad、左右は基準から±0.38rad。捕球済みの球の座標は使わない。捕球後は従来の準備姿勢復帰へつなぐ。
- 予定打点の取得を接触予定の230ms前から90ms前へ寄せる。停止距離に基づく目標角速度と有限加速度で、狙いに寄った後の動きを抑える。スイング終端後40msで新しい制動を解き、従来の打球追尾の制御式へ戻す。
- eyeと角運動状態は一つ。角度の直接代入、ランダムな揺れ、フレーム間引きで力感を作らない。速度上限2.5rad/s、加速度上限20rad/s²、4px/55ms、身体追従・画角・球の予測・他カメラは維持。
- v47のhelperとHTMLは保全し、v48用の[表示helper](../../tools/browser-bridge/live-batter-braking-view.js)と[build](../../tools/browser-bridge/build-v48.mjs)を追加した。能力の新項目は増やさない。

これらの距離・時間・角度は今回の感触調整の暫定値であり、実際の選手の計測値とは呼ばない。

## 実行した検証

| 検証 | 結果 |
| --- | --- |
| [制動回帰](../../tools/browser-bridge/check-batter-braking.mjs) | [PASS receipt](../ai-continuity/verification-receipts/MB-20261018-V48-BRAKING_567fb968662646f0a5686670338ebec3.json)。左右、見逃しの下降量と捕球前の制動、予定打点への収束、静止身体での終盤保持、bunt・空振り・seek/rewind・判断前の因果性を検証 |
| 既存の連続視点回帰を新helperへ適用 | [PASS receipt](../ai-continuity/verification-receipts/MB-20261018-V48-CONTINUITY_8ba5523c9453488e9f38c1e623e78b5a.json)。8ms角速度・加速度、左右と役割境界、55ms不規則サンプル、prefix縮小と復元、hidden球、予測差・選球眼の既存対応、Source不変 |
| 新HTMLのChrome 1200/390px | [PASS receipt](../ai-continuity/verification-receipts/MB-20261018-V48-BROWSER_9adbce44e44b4a3681b57b8f79a2c980.json)、46.062秒。[生QA](../verification/releases/v48/continuous-view-check.json)。左右スイング16境界、見逃し6球、全12球のframes/play/events/match SHAがv47と一致。他4カメラの姿勢、球保持時の非表示、身体eye、再生と巻戻しを確認 |
| build | [PASS receipt](../ai-continuity/verification-receipts/MB-20261018-V48-BUILD_498f331fab77441aa5db7d2359756963.json)。107入力・Core bundle・PNG/font・4px/55msの保全 |

実投球6球の見逃し最大下向き角は旧0.404〜0.839radから新0.080〜0.103radとなった。実スイングの接触から終端までの予定打点に対する角誤差累積は、左が旧の約50%、右が約70%。これは当該12球の表示比較であり、現実の打撃成績の校正ではない。画像も確認した。

打球／送球から始まる走者観測の単体条件はv47と全姿勢が一致する。通しの投球では、改善した直前姿勢が打球追尾の初期状態へ連続して引き継がれるため、打球後の全数値まで同一とはしない。打球の追尾式や身体の移動自体は変更していない。

## 開発中に検出した問題

初期試作は見逃し目標角を制限するだけで、捕球前の角速度が残った。観測した停止点を保持し、停止距離から制動する方式へ変更した。スイング終端で制御を即切替すると端数時刻の角度連続性が失敗したため、40msの制御混合で解いた。

読取レビューで、初期の見逃し制動が判断利用可能時刻より前に`swingOffered`を参照して姿勢を変えることも検出した。判断＋知覚遅延のguardと32msの立上りを加え、同じbalanced投球の判断前の姿勢一致と、早期のdecision読取を拒否するgetter試験を追加した。これらは開発中の直接コマンドでのFAIL／指摘であり、後からmachine receiptを捏造していない。最終コマンドのログは上記receiptに保存。

## 同一性と未完

HTML SHA `a529f2f0e3a99ce256ad1e136a6b7d5642048d27f32ccc83c1453cd78b8821b5`、視点helper SHA `f987a851185dcd70e7f31429c748abb2b46d0f70999e15aaa92d4c26dee9cc9b`。Core bundleはv47の`a470058b7fe0c95c5119fd1376bfa5a91ffc82f9767d95e4cae3daf369ea6a1d`と107入力が全て同一。新しい9回試合・213 Coreテスト・全体型検査を実行したとは主張しない。表示のみの変更に必要な回帰と実12球を実行した。

元計画のNative認証連続世界、残る公式採点・ルール・全得能、走者間共同最適化、実選手SI・成績分布の校正、新100試合以上、実機スマートフォンは未完。今回の調整の最終的な感触はユーザーのプレイで確認する。


## GitHub保存

実装とHTML・履歴・証拠49ファイルをcommit `505bf94b439202210cff9d7e45750799f8bf0118`として既存ブランチへ通常pushした。Draft PR #380を更新し、main未マージ。remote/PR headとGitHub rawの6ファイルのbyte一致を[公開確認](../verification/releases/v48/publication.json)と[最終receipt](../ai-continuity/verification-receipts/MB-20261018-V48-PUBLICATION-FINAL_2f266720260f43d290e7bd3dd03c383d.json)に保存した。この確認後の文書・証拠のみのcommitで保存記録を追記する。

初回の公開確認は、エージェントが引数のcommit SHAを誤記し、remote一致ガードで停止した。[原FAIL](../ai-continuity/verification-receipts/MB-20261018-V48-PUBLICATION_1c61a2c37c884faa9742cde042ea85db.json)を保持。`git rev-parse HEAD`から実際のSHAを取得した最終確認はPASSで、製品ソースやHTMLの修正は伴わない。
