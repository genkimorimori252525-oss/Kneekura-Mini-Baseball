# v62 投手の目・リリース位置・守備機会

## 変更

投手の平面位置はすでにrubberと同じ `{x:0,z:18.44}` だった。Host表示用の足位置はy=0、内部守備collider中心はy=.9であり、両者を混同しない。カメラに不足していたマウンド標高.254mを加え、現在の投手位置＋地面高＋身長*.92を目の基準とした。マウンドから離れる場合の標高は半径2.74mの仮の斜面で減衰する。

既存投球アニメーションと同じ1540msの準備時計から、投手の身体に付く頭の局所位置を算出する。踏み込み・低下・回復を連続に補間し、リリース後1050msで局所offsetが0へ戻る。投手視点に独立した接近カメラを設けない。通常／調整室ともenabledと倍率0〜2を編集でき、調整JSONと現Coreの再現sessionへ保存する。これは作者が設定した頭部・上体の仮モデルであり、OpenBiomechanicsの実測骨格・足の踏み出し・全身動力学とは主張しない。足と衝突位置は既存Coreが所有する。

旧投球は右x=+.18／左x=−.18、高さ1.83、z16.9の固定値だった。home→外野=world +zの座標系で投手は−zを向くため、本人の右は−xになる。通常HostはSourceへ明示rubberと身長を渡し、実球の開始位置とaim逆算速度を以下へ変更した。描画だけの偽の投球位置ではない。

| 編集項目 | 単位・範囲 | 未指定の作者既定 |
|---|---|---|
| `pitchReleaseHeightMeters` | マウンド面からm、.2〜3.2 | 身長*.86 |
| `pitchReleaseSideMeters` | 本人の左右幅m、0〜1.5 | 身長*.25、右−x／左+x |
| `pitchReleaseExtensionMeters` | rubberからhome向きm、0〜3.5 | 1.54 |

メーカー47詳細項目へ3欄を追加し、20人に明示の暫定値を保存した。既存公開能力・絶対選球眼・得能SIは保持する。身長比は実測値ではない。明示world spinを左右だけで推測反転しない。既存の低水準APIで身長/rubberを省略する呼出は旧座標互換を維持し、通常Hostは新モデルを使う。

決定的HRは「遠そう」という結果ラベルでは選ばない。現在の観測prefixから同じ球物理で予測し、飛距離15m以上のフェンス余裕・高さ2.5m以上・フェア線3m以上の余裕、全9人の連続到達上界での捕球不能、40ms以上を隔てる2観測確認を要する。大きなNLB到達能力でも捕れる余地があれば通常AIへ残す。8秒内に初落下を予測できない超高弾道もUNKNOWNとして残す。

成立中だけ `defensiveOpportunity` を現在フレームへ公開し、9人はholdへ減速する。現在速度を瞬間ゼロにしたり位置を移したりしない。予測が崩れたら解除する。投手カメラは同じ本人に留まり、100〜250msの反応後は球を見る。際どい球は従来の守備カメラへ移る。公式HR表示は実際のフェンス通過まで出さない。

## 検証

- HEAD `07893f33`: eye/マウンド、左右の肩、動作境界の連続性、未来payload不読、OFF/倍率/rewind、動く本人位置、範囲検査PASS。
- CORE `a2b4b4e3`: 10ファイル96件PASS、98.78秒。新リリース、逆算aim、旧API互換、Host、守備役割・担当者・衝突回避、深いHR／際どい球／低ライナー／ファウル／巨大能力／予測解除／実裁定／9人の連続制動を検証。
- TSC `cf8ad484`: 全体 `tsc --noEmit` PASS。
- COREBUILD `3aa84e45` / BUILD `a43432e2`: Native114入力と通常／調整室生成PASS。Makerは80入力。
- BROWSER `7b34bede`: 1200／390px、実右投手release x−.46,y1.8364 と実左投手x+.4825,y1.9138、身体OFF/0/1/2倍率、6動作境界、Source不変、メーカー編集→通常HTML実投球、名前／zone、調整JSON／session再読PASS。実deep強打はcarry130.117m・フェンス余裕20.730m・高さ2.534mで投手視点維持、通常打球は守備視点へ移行。未来フレームの注入はしない。初回の限定PASS `461e268c` も保持。
- GAME `cecf06cd`: 通常HTMLで320球、127守備プレー、9回表3アウトの規定終了までPASS。PC／390pxの最初8球の実Sourceが一致。実export320球、legacy結果fallbackなし、例外／外部通信なし。試験時の得点18対34は分布校正の達成を意味しない。
- CADENCE `c70decaa`: 投球22ms／他55msとloopの既存検査PASS。
- 独立Maker検査：全20人の3項目、小数6桁編集、実JSON download・reload・再読、不正importの原子的拒否、CLI既定の維持と空／重複override拒否PASS。これは非receiptの直接実行記録であり、正式BROWSERでも実試合への編集反映を検証した。

通常SHA `e035ca5fa575ee3528c3f029353419a4a92fe0d2e94e96417494a083cf02a8fc`、調整室 `c29e0cc042a7956877e7fdb3bc32c53a7fe39d41ad10fb0ccf108465307cdd73`、メーカー `a99bb8b947001fcf780a3c9f615e1a759b8a5ae300d0a87c57467fab5d087dac`。Native `865078dc9881ce5c37754dbe2c7b502f586206f3ada972cfe2d3368207720c00`。

[ブラウザ証拠](../verification/releases/v62/presentation/presentation-check.json)、[9回試合](../verification/releases/v62/game/game-check.json)、[配布照合](../verification/releases/v62/release-check.json)。実コマンドと原logは `docs/ai-continuity/verification-receipts/MB-20261019-V62-*`。

調整室生成の最初の直接試行は改行形式を固定したmarkerでAssertionErrorになり、HTML出力前に停止した。markerを一意の要素へ変更し、再生成／実ブラウザをPASS。元のHTMLや保護検査を削除して回避していない。

## 互換性と残件

旧調整JSONは読める。v62は投球物理と守備AIを変えたため、旧Coreの再現sessionを同一試合として再実行しない。新sessionは同じv62 Coreに限る。凍結済みv54〜v61はbyteを保持する。

最新人間追加：v59のスイング視点を好み、見逃し同期後にスイングも変わった理由を質問。v62はv61打者helperをそのまま継承しており、投手修正と混同せず同一実recordで原因監査する。見逃し同期そのもの以外に、v61の絶対選球眼の追従強化と旧vision寄与の固定が共通投球注視へ作用する。grade45かつ判断SI=.025での不変検査を、全能力のスイング不変と一般化してはいけない。人間の希望を確認せず絶対能力の仕様を撤回しない。

今回の仮の身体移動、初期リリースSI、予測の閾値は未実測校正。元全計画、Native認証された連続世界／公式裁定、得能未接続、守備走塁の残件、100試合・成績分布校正、実機は継続。原FAIL/UNKNOWNとCharter承認不足/HOLDを保持する。main未マージ。

PACKAGE-FINAL `68cecfb1` PASS1.266秒。3HTMLと全raw入力／旧配布を照合。[同一記録によるv59スイング原因監査](2026-10-19-v59-swing-gaze-drift-audit.md)は `5fb54fd1` PASS。実個人gradeで最大約.80°の向き差を確認し、未変更とする説明を訂正した。製品の打者姿勢はこの監査では変更していない。

## GitHub保存

製品コミット `17de1933ba09e1954eee7cd637ac0ab3ac39ce3c` を既存ブランチ／Draft PR380へpush。STAGING `2a43fbc0` と最終追加分で96ファイルのGit blobと試験済みraw byteを照合。credential pattern0、非log whitespace PASS、ユーザーAGENTSは除外した。PUBLICATION `a8fbaeec` PASS3.342秒でremote／PR head一致、Draft OPEN、公開raw15ファイルのbyte一致を確認。[公開証拠](../verification/releases/v62/publication.json)。後続は記録だけを閉じるコミットで製品byteを変更しない。
