# V160 実行前固定：初球の方向判断と連続状態

2026-10-28 JST / root / MB-20261027-REALISM-DEBUG-PLAN。前工程V159はSource/UI実装と検証、設計4文書のGitHub反映が進んだprogress。本人の「初球だけ流しへ固定されるのではないか」を、方向判断・実行・接触に分けて確認する。全goalを保持し、描画担当の別作業を取り込まない。

## 確認済みのSource境界

read-only explorerが実呼出を確認した。`resolveBatterIntentV122`へ渡るcountはstrikesだけで、初球番号/選手名は入力されない。count分岐は2strike時のcommitment delta。旧5方向も全zone共通のweightsで、course別にはなっていない。この経路内に初球専用OPPOSITE分岐は見つからなかったが、本人の連続試技を未実行のまま現象の不存在とは結論しない。

未設定AUTOは `REACTIVE_NO_ANGLE_TARGET` となりV153方向motorを使わず、元clip/probeの方向を基準にする。観測位置はtranslation/既に選ばれた角の幾何実行へ入るが、内外角から方向を選ぶ通常戦術は未接続。これは個人方針未設定者を均等抽選や共通CENTERへ変える理由にはしない。

原[DIR計画](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/jolly/core-foundation-plan-2026-09-17/docs/superpowers/plans/2026-10-16-batter-directional-intent-and-spray.md)もGitHub本文で照合した（blob afee1ce700fd83bcf200f97ed5b29e117220c441）。REACTIVEは方向を決めず投球に合わせて打つ正式Intentで、3方向を抽選するmodeではない。方向を事前に狙う頻度へ、事後の打球方向を転記しない。本人の長期0重みをepsilonで正値にせず、技術タグから方向を曲げない。観測後の再planは同じMotor Target/実行可能時間/接触経路へ統合する仕様である。

元[スイング統合計画](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/jolly/core-foundation-plan-2026-09-17/docs/superpowers/plans/2026-10-26-batter-swing-capacity-intent-context.md)もGitHubで確認（blob 188136656310de771acaf434318dc0b954faf8f0）。主観的予測・DirectionIntent・振る判断・目標運動・実運動・接触結果の分離を保持する。観測に合わせる運動が不足していても、ダミーの本人Preferenceを保存したり結果角度を直接修正したりして解決しない。

## 固定するケース

- 入力は保持中の本人packetの `livePhysicalRoster` のみ。entry1-b0の保存clip obp-23_5とpublic catalogを使う。top-level player/scenario/reference等のプレビュー設定を試合入力へ混ぜない。原本SHA/bytesを開始/終了で照合する。
- 最新V159のNative/WB bundle、Chrome完全version156.0.8078.48、通常時間stepを使う。初期seedは20261019のみで事前固定し、都合のよいseed/球を探さない。
- 実Maker設定生成と同じteam順・打順先頭・相手投手、位置観測V151/方向motorV153/MATCH乱数を使う。
- 初期から初球AUTOをpreviewして未採用のまま保持。元状態から初球TAKEを採用し、第2球AUTOをpreviewする。previewで元状態/乱数/記憶を消費しないことを検証する。PA終了等があればそのまま記録し、countやseedを差し替えない。
- 通常Hostへ同じrecord.commandを渡して全record比較し、実blob WorkerのWorkbench V150 adapterでも同分岐を実行する。受理後のcaptureを保存/復元し、第2球も全record比較する。

実V150 adapterはoffense操作専用で、球種/コースはautoである。通常Hostだけでinside等を指定した対比較が必要になっても、このMaker同値ケースとは分ける。独立単球seed+1を第2球の連続状態として扱わない。

## traceと判定

global pitch ordinal、count/走者、保存approach/旧方向配分の有無、AUTO所有者/理由、V122名目Intent、旧course方向抽選、13domain/key/seed/drawCount、配達済み観測/rawForecast/recall、名目motorの有無/角、実行誤差、実接触のexitVelocityから求めた角を別列にする。

V122のcommitment/choice draw実値・実効weightsは現diagnosticsに含まれない。既存recordにない情報を推測で埋めずNOT_EXPOSED、未設定profileはABSENTとして残す。実RNGに診断用drawを追加しない。drawCountはwrapper経由の消費で、委譲API内の全消費数とは別である。

今回1rootの自然previewは原因切分けの具体例であり、方向分布や心理校正全体の証明ではない。初球だけの規則、保存方針、固定clipの向き、観測/通常戦術の欠落、実行誤差を区別する。必要な修正はこの結果を見てから共有Decisionへ限定する。未来球・実spin・将来crossing・結果Buffやダミー人格を判断へ入れない。

## 出力・検証・復旧

新runner1fileだけを追加し、初回はSourceを変更しない。通常Host/adapter/Workerのfull dataはtask専用のrepo外private cacheへ保存し、公開可能なfolderには技術trace/理由/bytes/hashだけを残す。本人raw payload・全roster・氏名/sourceId・私的実pathは公開側へコピーしない。公開前にも対象を確認する。

初回機能枠は240秒。実Coreの守備/H-E計算を省略/簡略化しない。時間未達/Source例外は原記録を保持して同じhandleの終了状態を確認し、理由なしに再起動/枠拡大しない。Task1の180秒/9回性能受入とは別の小さい機能probeである。

出力は新folder/EEXIST拒否、元Source/原本/runnerの開始終了pin、HTTP0/意図した実Worker1のみを照合する。新runner/出力を外せば既存ゲームに影響しない。他者と共有し、他者編集・旧FAIL・元原本を戻さない。

Task4校正・V154人体/再構築性能・SPIN/Native・旧V122/V148・性能B/9回/同版配送・SIGN命名延期・全工程後の最新設計GitHub再照合は全て未完として保持する。

## 自然AUTOの結果を受けた固定追試

自然AUTOの01はf2b74d33でPASS。26個の厳密比較、全673clip/92,201frame、同じ打席の初球/次球を通常Host・adapter・実Worker・保存再読で照合できた。初球はball/見送り、TAKE採用後の次球はfoulだった。本人の方向profile/旧配分は実projectionでも不在、両球ともREACTIVE/null角、方向domainの消費なし。観測は配達済み、受理で記憶0→1、次球が1件を想起し位置/時刻へ混合するが、次球の方向motorはREACTIVE_NO_ANGLE_TARGETだった。

この自然ケースには初球のスイングがないため、初球の実打球方向を証明したとはしない。同じseed/roster/config/球順/乱数policyのまま、AUTO_FIRST/AUTO_SECONDのbatting操作だけをswingとした別02を事前固定する。方向はAUTOのまま、TAKE採用・状態遷移も維持する。振る判断を固定した運動比較であり、本人の自然な振る判断や打球分布の証拠にしない。接触なし/ファウルでもそのまま保持し、新seedや狙いは選ばない。初回と同じ240秒枠/実Coreの全計算で検証する。

## 追試の失敗と撤回、再開運用の修正

02は不正な `batting:'swing'` を渡し `invalid manager command` で停止した（receipt `17bbe1ea23ac46bfad260385823a78ef`、13.796秒）。上記の追試案は現APIで実行可能という確認が不足していた。原FAIL/report/入力pinは保持し、自然01のPASSと混ぜない。runnerのoptional swing引数を取り除き、自然01で実行した29676bytes/SHA `707bd142f6febb43cc79e5a94badbb40a90de22aea21fafea122f34085e0b269` の全bytesへ戻した。これは診断runnerだけの修正で、ゲームSource/原JSONの巻き戻しではない。

合法commandのbalanced/contact/powerはAUTO見送りgateを解除しない。本人physicalのSWING化はV1 trait所有との整合拒否となり、traitを除去する二重介入は投手AUTO狙い点にも影響する（`LiveTraitProfilesV1.ts:152–155`、`LivePitchTargetPlanV111.ts:102–104,120`）。同じ球で判断だけを変えた比較とは呼べないため、この枝を撤回する。新しい診断権限やダミー本人profileを足して追試を成立させない。既存の自然初球/次球の証拠を使い、共有REACTIVE運動の実装へ進む。

本人から反復確認/説明の改善要求を受け、CCG/Workflowの狭い監査を実施した。V160のreceiptは現存する一方、CURRENT/Workflowの次手順はV159のままだった。`continuity.py:438–468` のcheckpointは本文を更新しない。記録喪失と断定せず、担当CURRENT本文更新→Workflowの同じ次手順→checkpointの順へ改める。過去の担当節はbytesを保ってCURRENT_ARCHIVEへ退避し、再開入口を短くする。原証拠は保持する。

完了済UI/V160自然probeは、関係するSource・入力・runtimeが変わる、新しい失敗が出る、本人が再検証を求める場合だけ再開する。理由を実行前に記録する。receiptが入口より新しい場合は実行せず先に整合し、実行中handleは再利用する。説明は差分だけとし、tool結果は必要fieldへ絞ってから取り込む。新しい台帳・Hook・設定変更は加えない。
