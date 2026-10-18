# v54 — 通常試合の得能接続

[HTML・メーカー・使い方](../demos/releases/v54/README.md) / [接続計画](../superpowers/plans/2026-10-19-live-traits-v54.md) / [候補監査](../verification/releases/v54/catalog-audit.json)

## 確定した範囲

2026-10-19の人間回答「通常試合で実働できる得能を接続し、残りはメーカーに未対応と明示する」で、v53の未回答だった範囲を確定した。独立した故障・心理・育成等の元システムを今回新設する解釈にはしない。GitHubの正本canonical09はcommit `63ccf99e29dba0488278f52db39747c68e07b545` のまま、bytesも前回と一致することを再確認した。根拠は[Source記録](../verification/releases/v54/design-source.json)。

## Sourceと得能の責務

`LiveTraitProfilesV1` は悪球打ち、送球、plate/running/fielding aggression、pitch/swing preferenceの7系統へ拡張。v1悪球打ちJSONは維持する。unknown family/state/key、重複、getter、不整合を拒否し、未対応catalogから実行profileを作らない。Nativeの習得・mastery・心理履歴を偽造せず、ローカル作者の設定として扱う。

送球は `throwDirectionStdRadians` の唯一のSourceからG〜A/Goldを表示する。段階をprofileに二重保存せず、公開／詳細編集の直後も再投影する。ローカル校正の代表値はGold .0015、A .003、B .006、C .010、D .016、E .024、F .04、G .065rad。省略を完全精度と推測せず未査定にする。明示0はユーザーの完全精度設定として分類する。Nativeの段階閾値や公開Sの別名とは主張しない。高い段階の再選択で同段階内の個別微調整を丸めない。

緑3系統はprofile.sourceへ元baselineを保持する。setterだけが現在Sourceを一回書き、Host／validatorは再倍率を加えない。runningはbaseline-.25を0..3秒へ、fieldingはbaseline*.65を.25..4へ、plateはthresholdを積極-.12／慎重+.12して0..1へ制限する。認識誤差・走力・反応・捕球保持を変更しない。plateの個人Sourceが強制TAKE/SWINGの場合はこのAUTO嗜好を付与しない。欠落値を読込時には補完せず、setter時だけ実行と等価なbaselineを使う。

緑設定なしは元Sourceへ復元する。詳細Sourceの実編集は当該green metadataだけを外し、直接値を優先する。No-opはmetadataを残す。badballはON時の技術値を同期し、OFFへの非0直接編集から保有を推定しない。gradeはSourceだけを編集するため公開値との二重加算もない。

## AUTOと明示指示

Hostの打撃命令へautoを追加した。管理側のautoまたは相手AIはその打者の好みを使い、明示したbalanced/contact/power/take/buntが優先する。profileなし／neutral／nullは旧balancedと同じ動作。初期UIは「選手に任せる」で、個人設定が通常操作から使える。

投手本人の好みはAUTO球種だけへ接続する。従来4択fastball/slider/curve/changeupを、中立は従来exactな一様抽選、速球中心は7/1/1/1、変化球中心は1/3/3/3とする。これらは局所的な作成用比率である。同じ1drawを使い、明示球種は従来のstream位置を維持する。速度・spin・command・打撃誤差を名前や色で上書きしない。固定64seedのfastball数は中立21／速球42／変化球12。実測校正や成績の正しさを意味しない。同じ球種が選ばれたpaired testでは下流のframes・ball Source・打撃誤差もexactである。

新auto／非中立設定にだけ `traitPreferences` 診断を加え、旧命令と省略／中立profileの全record互換性を維持する。既存の走塁監督指示はSource安全余裕へのsoft調整として継承する。

## 一覧の範囲と未対応

正本表114行を119 familyへ対応付け、未対応行0。既存Native等の37と、監査上の提案ID82は区別する。未確定のtier/colorを確定しない。MOVE23・REJECT2は試合能力対象外、矛盾1は仕様確認待ち、残り未対応86。実働7以外の112には理由と検索を設け、編集用スイッチを作らない。Source数値があるだけでレーザー／ノビ／ラインドライブ等の未定義名称・段階を断定しない。既存classifierも十分な観測・専用modelを要し、通常試合の生涯履歴を代用しない。

## 新規検証

- `ac1a0aaa`: 41files368tests PASS／77.500s。v53走塁・帰塁／appeal、全public/roster/hidden control、守備ハーネスを含む。
- `50489eb6`: global TSC PASS／37.422s。
- `2bdf1593`: Native113入力・maker79入力でbuild PASS／1.407s。
- `1772eb70`: 最新通常HTML320球・9回表3outs完走／102.141s、fallbackfalse・例外なし。着地前進塁26判断、未帰塁終端0。130fieldplay/17169frame重なり0。
- `97d877cf`: PC1200/390・12実Source／bat・左右／既存カメラとUI PASS／30.469s。v52helper bytes不変。参照側にAUTO選択肢をQAで追加して同一命令に揃え、異なる命令のdiagnostics差を表示回帰と混同しない。
- `346c53c0`: Maker PC1200/390・7family22stateの色と効果、green20cycle、public10/internal44、20人、Source同期、JSON保存再読込、両幅の通常gameでPOWER/BREAKING等の実到達 PASS／22.032s。単独bat実験は不変。

先行REDと型修正の原証拠を保持した。メーカー初回 `92dafbc0` FAILは閉details本文をinnerTextで取ったcheckerの誤りだった。textContentで本文の存在を検証し、実際に開いた検索・無操作子・無Source変更も確認してPASSにした。Source/UIの不具合を期待値緩和で隠したものではない。

## 残る限界

段階・比率・個別SI・read誤差は未校正。色が実測能力を証明するものでもNative習得履歴でもない。今回承認された範囲は実働接続＋未対応表示で満たすが、元の全計画はIN_PROGRESS。Native認証連続world、全公式H/E、残りルール、身体・lead/slide、新100試合、実機等を完了扱いにしない。原FAIL/UNKNOWN・外部Charter承認HOLDを保持する。

## 配布照合

- PACKAGE: `MB-20261019-V54-PACKAGE_50016995f1b94215863fd47283e1de65.json`、1.764秒、PASS。全Source・compiled bundle・HTML・共有JSONのraw bytesとZIP CRCを照合。
- RELEASE: `MB-20261019-V54-RELEASE_7433fec9e832462ab2914a1a82360457.json`、0.156秒、PASS。14参照、113/79入力、7実働/119分類、v52カメラ・v53規則と走塁の保持を確認。
- [リリース照合](../verification/releases/v54/release-check.json)。公開後のremote/PR headとGitHub raw bytesの証拠は同ディレクトリの `publication.json` へ記録する。

Continuity監査の原出力は `docs/verification/releases/v54/continuity-audit.txt`。原Charter外部承認不足によるHOLDと過去の未決記録を維持し、今回の会話承認から自動承認を生成しない。初回CLIの未対応引数によるusage errorも `continuity-audit-initial-cli.txt` に保存し、正しい呼出しの監査結果と区別する。配布説明の独立確認でLATESTの古い離塁代理の残件記述を訂正した（v53実disk退出factを参照）。
