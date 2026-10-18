# v49 — 守備位置の責任・走者の触塁・プレー終了の修正

[通常HTML](../demos/releases/v49/game.html) / [メーカー（従来版と共通）](../demos/releases/v47/maker.html) / [最新入口](../handoffs/LATEST.md) / [開発史 H21](../history/INCIDENTS.md)

守備位置を持たない共通割当、移動する球を基準としたバックアップ、走者と守備者の異なる触塁基準、退場後の古い占有判断、捕手のタッチ追跡から塁への往復を修正した。通常HTMLへ接続し、新しいSourceで規定9回を完了した。v48の打者視点・UI・配球・実測バット・4px/55msと、公開11／詳細44項目の能力メーカーを継承する。

## 原因と変更

| 症状 | 確認した原因 | 共通処理の変更 |
| --- | --- | --- |
| 捕手などの不要な移動、不自然なカバー | Hostの9人に正式守備位置が渡されず、到達時間だけで支援役を割り当てていた | `defensivePosition`をHostから渡し、カバー・中継・バックアップにポジション責任の有限コストを加える。余った選手は自分の定位置を維持する |
| 送球先へ集まり、バックアップが反転 | 保持球にも拾球バックアップを作成。送球中も動く球から支援点を再生成 | 自由球／保持／送球を区別。送球発行・実リリースの固定された線から後方支援を作る。重なる支援目標は作らない |
| 触塁して見える走者が一塁アウト | 守備は半径0.28mの領域接触、走者は塁中心到達まで待つ不一致 | 両者の同じ接触範囲で触塁・force消滅を記録。走者の運動は停止まで継続し、瞬間停止させない。走塁判断の競争時間も領域進入までとする |
| 進行できそうな状態で次打席へ切れる | 先行走者の退場で予約が消えても、後続の古い占有判断を終了条件へ使った | 退場時に走者の再評価を要求。次の判断と運動完了を確認して終了する。三アウトは即終了を維持 |
| 捕手がタッチ追跡中に本塁へ戻る | 非forceでも塁への運搬時間を比較し、走者から離れる判断になった | 非forceは現在の走者への接近時間を比較し、持球移動を選べばタッチを追う。実グラブ接触だけがアウト根拠 |
| 通し試験26球目の裁定停止 | 三塁を回る走者が保護範囲を出た瞬間、既に重なっていたグラブでタッチ。同じtickのため順序が欠落 | 実脱出を処理したCoreだけが`protectionEndedByDeparture`を付与。裁定は同走者・同塁・同tick・直前の保護塁に結合された証拠だけを受理する |

一塁手・捕手などの責任は絶対禁止ではなく有限コストであり、能力と配置による緊急カバーを許す。主捕球担当は引き続き物理的な捕球可能時刻を優先する。新しい公開能力は増やしていない。反応・走力・加速・グラブ・肩・持ち替え・積極性や進塁安全余裕など、既存の個人値が判断／実行へ入る。

同tickの入塁とタッチの競争、証拠のない離塁／タッチ、不一致の証拠、第三アウトと得点の未確定競争を無条件にアウトやセーフへ丸めていない。実試合の失敗入力を[portable fixture](../../src/core/sim/fielding/__fixtures__/live-runner-base-exit-tag-v49.json)へ保存し、証拠を除くと再びUNKNOWNになることも確認した。これは整合性を検証する追加情報であり、改変された全入力の真正性を保証するNative認証ではない。

## 守備ハーネスの改善

添付会話で紹介された既存`LiveFieldPlayDiagnosticsV1`は利用可能だった。ただし旧9分類が0でも、触塁遅延や早期終了を検出していなかった。変異入力で検査の失敗を先に確認し、次の5分類を追加した。

- `LIVE_PLAY_CLOSED_WITH_ACTIVE_RUNNER`
- `LIVE_PLAY_CLOSED_WITH_FREE_BALL`
- `UNSUPPORTED_RUNNER_RETIREMENT`
- `DUPLICATE_BASE_COVER`
- `RUNNER_BASE_TOUCH_LATE`

既存force helperを再利用せず、対応範囲の退場根拠をfactsから別に再構成する。タッチ／捕球の物理的成立は入力factとして受け取る限定監査であり、全公式裁定のoracleではない。単なる近距離や長い移動をすべて違反にせず、選手ごとの移動距離・役割・定位置からの距離を観測できる。

球が送球先を通過した後の正常な回収と、リリース前の古い観測による早すぎる予約解除も区別した。通過を歴史的な実発射から確認できない場合、解除を正常扱いにはしない。実際に受球し損ねた場合の`unfielded`記録も残す。

通常HTMLの「試合JSON保存」に最終守備フレーム・最終走者・判断診断・終了条件を追加した。大量の全描画フレームは従来どおり省略する。PCの実試合とスマホ幅の新試合について、保存JSONが実Core記録と一致することを検査した。

## 最終検証

| 検証 | 結果・証拠 |
| --- | --- |
| Core・Host・走塁・守備・裁定 | **29ファイル250テストPASS**。[receipt](../ai-continuity/verification-receipts/MB-20261018-V49-AI-FINAL_c3f1f499d40348feb985132588056a7c.json)、73.670秒 |
| 正式9ポジション・20局面×3能力段階 | 上記と同じSourceで60局面、14分類の検出異常0。outs低13／標準18／高20。既存の最低アウト数・能力単調性の条件は維持 |
| 全体TypeScript型検査 | [PASS](../ai-continuity/verification-receipts/MB-20261018-V49-TYPECHECK-FINAL_5cf4a32dbeae4fa8ae36acc9bbc41512.json)、35.202秒 |
| 最新Core＋通常HTML生成 | [PASS](../ai-continuity/verification-receipts/MB-20261018-V49-BUILD-FINAL_4f44a193bc264eb9be96fe322b3331e5.json)、107入力の全SHAを前後照合 |
| 通常HTMLの規定9回 | **320球、9回表三アウト、away10／home46**、例外なし／fallback=false。[生記録](../verification/releases/v49/game/normal-game-records.json)、[receipt](../ai-continuity/verification-receipts/MB-20261018-V49-NORMAL-GAME-FINAL_532a3d18957a4f4fbac807d810d8ec71.json)、101.406秒。成績分布は未校正 |
| カメラ1200/390px | [PASS](../verification/releases/v49/cameras/continuous-view-check.json)、12球の同一Source再現、6見送り、左右16境界、外部通信・ページエラー0。旧Sourceとの物理同値性の主張ではない |
| メーカー1200/390px | [PASS](../verification/releases/v49/maker/public-maker-check.json)、20選手・公開11／詳細44・旧JSON・編集・取込・再読込・不正入力の原子的拒否。最新試合へ反映し各幅1球を実行 |
| 保存Source | [107入力＋compiled bundle＋manifestの109エントリZIP](../demos/releases/v49/tested-core-inputs.zip)。全byte／CRC／SHA検証。改行を変換しない |

最終HTML SHA `b4903f219e81c0efa77c560b7961afb8eafaa85843be90fc9460a2db9a23428a`、Core `e0677928d7641513228fb78782a8afcceb5e4890fddbd99ac93c05f271da2e6c`。[配布SHA一覧](../demos/releases/v49/SHA256.json)。検証済みSourceのあとから改行変換をしない。原ログの末尾空行・assertion出力の空白はSHA保持のため残し、ログ以外の差分空白検査はPASSした。

## 失敗を残す

[旧ハーネスの監査・原FAIL・修正](../verification/releases/v49/harness-baseline/harness-audit.md)と[最初の通常試合停止](../verification/releases/v49/initial-game-failure/game-check.json)を保存した。最初の全体検査は242PASS／2FAILで、不要な二本目の送球や一塁停止を固定要求した旧期待だった。実際の捕球→支配→同じ保持者のタッチ、安全な二塁進塁と危険な三塁進塁の辞退を確認してテストを訂正した。送球・捕球・タッチ成立の検査は削除していない。

旧版の9回・旧分類0・途中SourceのカメラPASSを最終Sourceの証明として流用しない。今回の最終検証と、各開発途中のreceiptを区別する。

## 現実資料と限界

役割分担・送球線・後方支援・不要な送球の抑制は[ABCAのSam Piraroによるカット／中継指導](https://www.abca.org/magazine/magazine/2020-4-July_August/The_Hot_Corner_Execution_of_the_Cutoff_and_Relay_System.aspx)を参考にした。forceが触塁で消える点は[MLB 2026 Official Baseball Rules 5.09(b)(6)](https://mktg.mlbstatic.com/mlb/official-information/2026-official-baseball-rules.pdf)と照合した。ゲームのNPB2026 profileに属する未実装規則を、この参照だけで実装済みとは呼ばない。責任コスト・支援距離は著者設定で、実測校正値ではない。

役割目標の重複は抑えるが、野手同士の連続した衝突回避・全経路の大域最適性は未実装。非forceの接近時間は現在位置からの推定で、動く走者の最適迎撃解ではない。触塁は走者位置と半径領域による足接触の代理モデルで、足のIKではない。通常の新しい走塁legの離塁factはmotor開始の代理を残す。今回の順序証拠には使用せず、連続通過の実脱出だけを用いる。タッチアップの全appealも未完。

元計画のNative SQLite認証された全体連続世界、返球・再整列・全身／バット反動・落下、公式H/E・残る規則、全得能、リード／スライディング、共同走塁最適化、実選手SI・成績分布、最新100試合以上、実機スマートフォンは未完。今回の高得点試合を現実の成績分布の証明にはしない。原CHARTER_UNAPPROVED／HOLDと過去FAIL／UNKNOWNを保持する。
