# v47 — 多段中継送球と連続したベース旋回

[最新入口](../handoffs/LATEST.md) / [v46の記録](2026-10-18-v46-running-and-fielding-ai.md) / [開発史 H19](../history/INCIDENTS.md)

v46で残していた中継送球の探索と連続したベース旋回を、ローカルHostから共有Coreを実行する通常試合へ追加した。シナリオ名や守備位置名から送球・アウトを与えず、実際の位置、速度、能力、球、走者の到達時間を使う。Native SQLite認証された全体連続世界の完成とは区別する。

## 実装した範囲

中継は、現在の保持者から最終塁の受け手まで、直接送球、最大2人の実在する中継者を経由する送球、保持したままの運搬を比較する。各区間は個々の肩、持ち替え、手の準備、受け手の到達、方向誤差の補正時間を含め、Aeroの有限送球計算で実行可能性を確認する。中継地点は架空の中点ではなく、現在の身体・グラブと速度から求める停止位置を基にする。

候補は最大8経路に制限し、直接送球を先に検証して競争力のない経路を除く。同じ区間のAero計算は計画内で共有する。一般的な短い直接送球ではAero計算1回で済むことを回帰で確認した。探索制限は計算量を抑える暫定方針であり、全経路の最適解を保証しない。

選んだ経路から発行するのは最初の1送球だけ。中継受け手は`relay`、`targetBase:null`として予約し、最終塁のカバーを別の野手に残す。球の接触、保持能力による捕球確定、持ち替え、手の準備が実際に成立してから次の送球を再計画する。前の送球者を対象走者・最終塁ごとに記録し、中継者として戻す循環を防ぐ。塁で受け取る最終受け手は別扱いとし、正当な塁への返球を妨げない。

リリース時にも、その時点のグラブ位置・身体速度でAero計算をやり直し、実際の手の準備、他の身体との距離、受け手の準備、対象走者がまだ有効かを確認する。`throw_release`は実受け手、実際の狙い点、最終塁、対象走者を保持する。カメラは各送球の発行済み情報を読み、未来の捕球から受け手を逆算しない。中継の選択だけで所有・捕球・塁接触・アウトを生成しない。

走塁は直線と円弧を接線で接続した経路を使い、実際の位置・速度を引き継いで走りながら追加進塁を検討する。円弧の速度を`v²/r <= lateralAccelerationMps2`で制限し、縦方向の加速・減速も扱う。通過する塁では停止せず、最後の停止対象では減速する。現在の速度から合法な接続が作れない遅い判断は、位置・向きの書換えや塁周囲の余分な一周で成立させない。

プレーの`runner_base_touch`は、実経路が塁中心を通過する`centerElapsedSeconds`を採用する。これは既存の足接触を表す代理モデルであり、経路モジュールが返す塁領域への進入時刻は接触factsに採用しない。その接触後、半径0.28mを既定とする塁領域から実際に退出する時刻に`runner_base_departure`を記録する。Hostと表示はCoreの解析的な走者速度を受け取り、塁ごとの停止モデルへ戻さない。

## 能力とメーカー

公開能力は11項目のまま。詳細設定はv46の42項目から44項目となり、次の2項目を追加した。旧JSONで省略した場合も既定値で受け付ける。

| 項目 | 許容範囲・省略時 | 実行への接続 |
| --- | --- | --- |
| `baserunningTurnRadiusMeters` | 0.5〜10m、既定4.5m | 旋回経路の半径 |
| `baserunningLateralAccelerationMps2` | 0.5〜20m/s²、既定は縦加速度の1.5倍 | 円弧を走る際の速度上限 |

走力の速度・加速、安全余裕、守備の反応・判断遅れ、持ち替え、肩、送球方向誤差も既存のSIを使用する。中継専用の公開能力や、捕球・アウトの成功確率を直接設定する項目は増やしていない。半径や加速度比、経路数、再計画間隔は作者用の暫定設定であり、実選手の実測校正値ではない。

## 開発中の失敗と改善

| 観測した失敗・差異 | 確認した原因 | 改善と残した検証 |
| --- | --- | --- |
| 中継の役割があっても実送球が塁への直送だけだった | 役割割当と送球命令の受け手・狙い点が別だった | 実在する中継者への最初の送球を命令化し、実捕球後に次を再計画。2送球と3送球の実イベントを検証 |
| 各塁で走者が減速・停止し、追加進塁で速度が失われた | 塁間ごとに停止する経路と速度を作っていた | 現在位置・速度から連続経路を作り直す。旋回速度、塁接触、Hostへの速度伝達を検証 |
| 通過塁で離塁イベントが出ない | 走り続ける区間では新しい塁間走行の開始が発生しなかった | 実際の塁領域退出を独立イベントにし、接触後・退出前後の位置と速度、重複なしを検証 |
| 既存の「二塁→一塁の2フォース」を期待する試験が失敗 | 実際のAero所要時間では、一塁先行の方が余裕を確保でき、続く走者は実タッグでアウトになった | 2人の実退場・送球・捕球・タッグを確認する期待へ更新。別の走者速度で真の二塁→一塁の2フォースも維持 |
| 反応60秒の受け手を待つ旧試験で、準備や二塁進塁が起きなくなった | 新計画は受け手の反応待ちを含め、実行不能な送球を準備前に拒否した | 負の余裕で保持・タッグ追走し、走者が一塁に止まることを検証。別の身体で実リリースを塞ぐ試験を加え、待機中の目標消失と命令取消も維持 |
| 中継受球を「捕ったのに塁を踏まない」と誤検出 | 旧診断は`tag_play`以外をフォースとみなし、別の受け手の塁接触も共有した | `relay_play`を識別し、塁接触は受け手IDも照合。実フォースの接触欠落の検出は維持 |
| 正しく保持した3シナリオで異常が残った | `receivingSeconds===Infinity`を無条件で送球不実行と扱い、明示的な負の余裕の計画を区別しなかった | 同じ保持者・塁・時刻の`hold`計画が説明する場合だけ抑制。正の機会を報告したのに実行しない矛盾は引き続き検出 |

期待値を変えただけで成功扱いにはしていない。元のv46記録を保持し、新しい物理的な接触・所有・持ち替え・アウトの成立と、診断が必要な誤りを引き続き検出することを回帰へ残した。

## 確定済みの検証

最終対象24ファイル・213テストが成功した。CCG taskは`MB-20261018-V47-AI-TESTS`、所要時間61.421秒。[machine receipt](../ai-continuity/verification-receipts/MB-20261018-V47-AI-TESTS_b1d5d9d169914f90915da322a95227a5.json)と[実行ログ](../ai-continuity/verification-receipts/MB-20261018-V47-AI-TESTS_b1d5d9d169914f90915da322a95227a5.log)にコマンド・結果・対象を保持した。旧18ファイルに走者経路・速度、中継計画、実中継、実旋回の6ファイルを加え、Hostの規定試合、Playable規則、TagUp、Force義務も含む。リポジトリ内の全テストを実行したという意味ではない。

`FIELDING_DIAG_TIERS=1`、`FIELDING_DIAG_REPORT=1`で20シナリオを3能力構成で実行した。

| 能力構成 | 全20シナリオのアウト数 | 内野対象13シナリオのアウト数 | 診断異常 |
| --- | ---: | ---: | ---: |
| low | 13 | 9 | 0 |
| default | 19 | 13 | 0 |
| high | 21 | 15 | 0 |

- 16m/sの保持者から20m先付近の38m/sの中継者を経由し、約90m先の本塁へ2回の実送球を行う。直接の有限Aero命令は到達不能、両区間は実捕球・新しい持ち替え・最終捕球と本塁支配まで成立する。同じ配置で保持者を50m/sにすると直接送球を選ぶ。これらは明示的な合成SI条件であり、実選手の能力の主張ではない。
- 16m/sの4人を約22m間隔に置いた条件では、中継者2人を経由して3回の実送球、4回の捕球確定、各持ち替え、本塁の実支配によるアウトを確認する。将来の受球を所有済みとして扱わない。
- 実旋回では塁接触、通過速度、危険な次塁への停止、半径・横加速度変更による経路と速度の変化、複数走者の分離、通過塁の実離塁を確認する。
- 実行ログSHA256は`86c924b2dfcf6c66fed93ffb8eef123eec45e40a8cc25283a5c17d1c04f1a39d`。試験前後で製品107入力のfingerprintは同一で、試験後の107入力は最終build manifestと全一致した。bundle SHA256は`a470058b7fe0c95c5119fd1376bfa5a91ffc82f9767d95e4cae3daf369ea6a1d`、manifest SHA256は`94f4e9039b33cf10aafdc2e5909758148de6c749c622186e9526637409419aae`。

## 最終の通常HTML・画面検証

最終HTMLを新しく実行した結果を、Host回帰や途中版のブラウザ結果とは分けて記録する。通常試合は292球、9回表3アウト、ホーム26対アウェイ10で規定終了した。エラーはなく、旧結果へのfallbackはない。この得点は当該入力の結果であり、新Sourceの得点分布・安打率等が現実へ校正済みであることを示さない。

| 検証 | 最終結果・数値・receipt |
| --- | --- |
| 通常HTMLからの新しい規定9回 | PASS、292球、80.858秒。[完走結果](../verification/releases/v47/game/game-completion.json)、[画面・入力検査](../verification/releases/v47/game/game-check.json)、[receipt `e60b015f…`](../ai-continuity/verification-receipts/MB-20261018-V47-NORMAL-GAME-FINAL_e60b015f5d294434b338028172c98f0d.json) |
| カメラ・PC/狭幅表示 | PASS、1200px／390px、24.813秒。左右の連続打者視点等を[実行結果](../verification/releases/v47/cameras/continuous-view-check.json)と[receipt `3010dd9e…`](../ai-continuity/verification-receipts/MB-20261018-V47-CAMERAS-FINAL_3010dd9e43374d0f9161b1d18441980d.json)に保存。各中継の発行済みtargetと受け手切替、未来情報の不使用は対応する回帰でも検証 |
| メーカー・JSON取込 | PASS、1200px／390px、9.641秒。公開11・詳細44、旧JSON、編集・保存・通常試合への取込を[実行結果](../verification/releases/v47/maker/public-maker-check.json)と[receipt `61923ed2…`](../ai-continuity/verification-receipts/MB-20261018-V47-MAKER-FINAL_61923ed2017344e8ab11bc3a6bf0cedc.json)に保存 |
| 最終typecheck・build | `tsc --noEmit --pretty false` PASS、24.016秒、[receipt `383a33c7…`](../ai-continuity/verification-receipts/MB-20261018-V47-TYPECHECK_383a33c709c041cd9a50622fa3ae42ac.json)。build PASS、1.016秒、[receipt `67b9c7b5…`](../ai-continuity/verification-receipts/MB-20261018-V47-BUILD-FINAL_67b9c7b5c50b406c9131c9576d52308b.json) |

最終通常HTML SHA256は`81cdc7c402f2a8461ef07cac8d6d541cf304208fe97f23ba9bc02915ba880747`、メーカーSHA256は`7848228105d598f75c8e1eeb347c2ecbb6f3b749c9b1ea5433f2dcdfc97abd8c`。狭幅ブラウザの検証を実機スマートフォンの検証とは扱わない。配布整合は[最終release receipt](../ai-continuity/verification-receipts/MB-20261018-V47-RELEASE-FINAL_3de5f1081c104ec5aaf98cfd9c97fdb2.json)でPASS。107入力・compiled bundle・manifestを収めた109エントリのZIP、配布SHA、各QAの最終HTML SHA、既存UI helperとv46 HTMLの保全を照合した。[配布入口](../demos/releases/v47/README.md)から試合とメーカーを保存できる。

## GitHub保存

実装・HTML・メーカー・履歴・証拠109ファイルをcommit `4c10521884cbc029cb7c0498353141a493ea4d35`として既存ブランチへ通常pushした。[Draft PR #380](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/380)を維持し、mainは未マージ。remoteブランチとPR headの一致、GitHub rawの10ファイル（主なCore、新中継・走者モジュール、配布HTML・メーカー・ZIP、入口と履歴等）のbyte一致を確認した。[保存確認](../verification/releases/v47/publication.json)と[receipt](../ai-continuity/verification-receipts/MB-20261018-V47-PUBLICATION_0b79d4b6bb984b9ead6971deb9f479c9.json)に記録。保存確認後の文書・証拠だけの追記commitで、この記録を保存する。

## 参考資料と定数の扱い

- [ABCA / Sam Piraro: Execution of the Cutoff and Relay System（2020）](https://www.abca.org/magazine/magazine/2020-4-July_August/The_Hot_Corner_Execution_of_the_Cutoff_and_Relay_System.aspx)：送球先・レーン・カバーの責任、不要な送球を避ける判断を参照した。本実装の経路探索数や実際のグラブ狙い点の計算を記事から実測したとは扱わない。
- [ABCA / Darren Fenster: The Details of Running Around the Diamond（2025）](https://www.abca.org/magazine/2025-4-July-August/Coach_Your_Kids_Details_of_Running_Around_the_Diamond.aspx)：早い段階での進路、塁への接触、速さだけでは決まらない判断を参照した。円弧経路、既定半径4.5m、横加速度比1.5は本プロジェクトの暫定モデルである。
- [MLB 2026 Official Baseball Rules](https://mktg.mlbstatic.com/mlb/official-information/2026-official-baseball-rules.pdf)：Catchの定義、5.06の走者・塁、5.09のアウトを参照する。規則profileは`npb-2026`であり、この資料の確認をNPBの全裁定の実装済み証明にはしない。

最大2中継者・8経路、再評価の0.12秒、塁領域の既定0.28m、方向誤差から補正時間への費用は計算・制御上の設定である。記事に基づく実測定数や実選手に校正済みの能力値とは呼ばない。

## 残る仮定と未完

中継計画の将来の手の姿勢・停止位置・捕球所要時間は予測であり、捕球成功を保証しない。有限探索は全経路の最適解を保証せず、強い風による加速では速度だけの経路絞込みが厳密な下界にならない場合がある。旋回は平面の直線・円弧と加減速の縮約モデルで、脚・足・全身姿勢や滑走を実測再現していない。最終停止の判断や危険度も暫定方針である。複数走者の進塁候補は占有・予約を保守的に扱い、全走者と全守備者の経路を共同最適化するものではない。

投球前リード、盗塁、帰塁やスライディングを含む全走塁戦術、タッチアップ違反のアピール、Native SQLite認証された全体連続世界、Nativeを含む全隠れ能力と全得能の消費、公式H/E/FCの採点、実選手SI・現実の成績分布の統計校正、最新Sourceでの大規模な多数試合検証、実機スマートフォンは未完。3段階の合成能力構成と213テストは、これらの代わりにはしない。元の承認HOLD・FAIL・UNKNOWNを保持する。

## 主な変更ファイル

- Core: [中継計画](../../src/core/sim/fielding/LiveRelayPlanV1.ts)、[実プレー](../../src/core/sim/fielding/LiveFieldPlayV1.ts)、[役割割当](../../src/core/sim/fielding/LiveFieldRoleAssignmentV1.ts)、[診断](../../src/core/sim/fielding/LiveFieldPlayDiagnosticsV1.ts)、[連続走者経路・速度](../../src/core/sim/running/LiveRunnerMotionV1.ts)と対応する回帰テスト。
- Host・能力: [通常試合Host](../../src/integration/browser/LiveBaseballMatchV1.ts)、[能力adapter](../../src/integration/browser/LivePhysicalRosterV1.ts)、[メーカーUI](../demos/baseball-maker-ui.mjs)、[詳細設定カタログ](../demos/live-game-roster-catalog-v2.json)。
- 表示・検証: `tools/browser-bridge`のv47 build/checkと、送球targetを読むカメラ。[最終配布](../demos/releases/v47/README.md)と[最新入口](../handoffs/LATEST.md)を更新した。GitHub保存は既存ブランチ・Draft PR #380へ行い、mainはマージしない。
