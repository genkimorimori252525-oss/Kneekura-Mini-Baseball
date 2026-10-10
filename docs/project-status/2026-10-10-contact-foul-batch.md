# 実接触practiceとfoul履歴のrepetition接続

検証済みcode commit `3417aae846c24ee03866697640b886ab78a006bf`、src tree `80d5c30b939b5f6648ebbcd563a76fee76a62e5d`。先行の[practice・能力・Manager統合](2026-10-10-practice-capability-roster-batch.md)に続く、元の非デザイン領域8の確定済み接続である。

## 動作

- [Standalone接触](2026-10-10-standalone-practice-contact.md)：別Playerの本当に消費された投球releaseから、受理済みbat modelによる接触/outgoing ball、静止グラブのcapture/rebound/支配成立を既存の物理kernelで導く。元Player/body/model/episodeを保持し、実行済み原本をPRACTICE負荷と学習へ接続する。
- 静止receivingはcommand開始を元release以前に限定し、開始前のcontactへcreditを付けない。捕球の完了境界はCoreの連続接触時刻＋settlingを一度だけ量子化し、元の同tick競合検査を保つ。ちょうど完了tickでの成立と、その1tick前のpendingを実例で確認した。
- [Foul原本](2026-10-10-non-pitch-foul-repetitions.md)：completed ordinary foul、reserved untouched-foul、後続count terminalの同PA prefixに保持された以前のfoul contact/motionを、既存の一つのPlayer/game/play repetitionへ接続する。元TOTAL workloadを保持し、複数contactから追加の負荷や学習倍率を作らない。静止だけのrunner、gloveに触れていないfoul、根拠のないcount-onlyには事実を補わない。

## 一括検証

13-path batchを独立reviewし、stationary start coverageとcapture deadlineの二点を修正後、差分reviewもclear。最後の全compilerは33.45秒でPASS、関連11 files / 153 casesは48.47秒で全件PASS。fileと階層付きtest名を完全照合した。各runのsource/dependency/runtime/controlは安定し、残留processはゼロ。

実際の2 Playerを使うstandalone接触caseは、実release前の拒否、部分capture、支配成立、失敗時の反発、学習書込み中断、PRACTICE一回計上、retry/reopenを含む。foul familyの追加caseはlower ownerを置換したadapter検証であり、元の実試合全chainのqualificationではない。既存Coreの16 acquisition casesには同tick競合・幾何coverageの拒否も含む。

このバッチは保持対象18ファイルを先行公開 `7b2125ac` から変更しない。元manifestとの比較は、先行で明記したlocomotion current-admissionの例外一件と、他17 blobsの一致を維持する。

## 残件と実経路の帰属

原area8/doc53は各種drillをすべて専用モードとして作ることを要求していない。moving receiving、bat-to-field連鎖、tee/machine/fungo等の非対応域を追加の完了条件にはしない。元body/実行/負荷/健康/学習を通す今回の接続と、自律機会・処方・根拠ある評価/校正の未定義producerは区別する。

Nationalは別の固定Source `91499b8f`（公開 `7b2125ac`）を実行中。保持観測/modelから再開した正規planが160.343秒でcommitし、次のdecisionへ進んだ。旧runの同じplanはcapまで返らず、完成した旧比較値はないため速度倍率は主張しない。元37 assertions全体は未完。

IFNの固定Source `762ef2bd` は1200.532秒capでfailedとなり、捕球・p2支配・送球plan・途中transferとcut16 TOTALまでcommitした。view/calibrationとrelease以降は未完。原本と15の成功操作保存点を保持する。次の保持続行は元assertion/履歴を保って公開 `7b2125ac` へsourceを更新する準備中で、まだ実行していない。これらの実経路は今回のSource `80d5c30b` の全体成功を示さない。

全9領域の実シナリオ完了、移動non-third-out settlement、Career時計/自律前進と未定義の判断モデル、venue exit/award/interference policyは引き続き[残件入口](2026-10-09-nonvisual-nine-area-status.md)に分けて保持する。UI/designや新arsenalを追加しない。
