# 初球の観測・感情・自動打撃判断

2026-10-16。全goalは継続中。MMDは使用しない。

## 今回の接続

初球の観測予測から `ObservedStrikeZoneOpportunityV1` が予測上の本塁通過と球半径を含むゾーンとの重なりを計算する。重なると1、重ならないと0を返す明示的なAI判断基準であり、安打確率や実測の選球眼モデルではない。実際の未来の打球・投球は入力しない。任意の0.8等を採用してスイングを強制しない。

`owned_initial_batting_emotion_execution_v1` は、既存の `batting_emotion_execution_v1_executions/heads` とWorld CASを使う。元のPerson・予約状態・実投球・受信済みの観測・初期感情・現在の操作を照合し、既存Coreで感情更新を計算して保存する。別の感情headを作ったり、後続球用のviewを初球に偽装したりしない。

`same_pa_observed_initial_decision_v1` は、この感情更新と元の3校正を使い、既存 `calculateBattingExecution` のAUTO判断を保存する。SWINGの場合の計画は共通の実測モーター計画を使う。判断を計算・保存したことだけでは物理制御を発行しない。レコードは `motionIssued:false`, `physicalEffect:none`, `physicalAdmission:requires_forward_initial_physical_right` を保持する。

今回の合成初球では、予測上のゾーン外を認識してTAKEとなった。実投球は1球、公式イベントはまだ0件。架空の2球の見送りで後続球のガードを通していない。心理モデルの入力値は明示した合成値で、本人の実測人格・選球能力の校正ではない。

## 履歴再読と実行速度

現在の物理cutと、後の判断から参照する不変の過去cutを分けた。通常の読取は全操作を再計算する。過去cut専用読取は、要求されたprefixを再計算し、後続行のID・Source・hash・連鎖・headのmetadataだけを照合する。後続の判断の動作を再帰的に実行しないため、感情→過去観測→後続判断→感情という循環を作らない。この読取で後続行の意味が正しいとは主張しない。現在cutの採用では元の予約状態とheadを別途照合する。

照合済みの初球contextは、既存の私有・同期・読取専用snapshot内だけで再利用する。接続・transaction・query-only・変更数・schemaのfenceを照合する既存機構を使用し、別の読取や書込み後へ持ち越さない。作者入力からcacheへ値を注入する口はない。実時間で動くことの保証や正式な性能ベンチマークはまだない。

## 検証

- 関連Core/Host 60件PASS。通過点の保存形式を修正した後、該当4件も再検証。全src型検査とツールstrict型検査PASS。
- 初球の実Native保存・再読: 9操作、共有感情revision 0→1、World revision 0→1、AUTOのTAKE判断を確認。不正な受信イベントを拒否。
- 同じ私有読取内で元のDB行を改ざんする隔離試験では、再利用を直ちに拒否。必ずロールバックし、次の読取で元の9操作を再認証できることを確認。
- 再利用追加の前後で9操作の保存内容が同一。既存の後続球Native統合試験BI01もPASS。
- 別processの原owner再計算: 71tableのschema/全行、DB本体、永続WAL内容が不変。実投球行が1件であることもSQLで確認。

最新artifactは `outputs/verification-observed-initial-decision-v4`。再現用helperは `work/native-observed-initial-decision-v5` と `work/native-observed-initial-decision-reader-v4`。コマンド・log SHAは `docs/ai-continuity/verification-receipts/MB-20261016-INITIAL-DECISION-*`。

空WALが存在しない状態からOS読取専用で開くと、0byteのWAL/SHMが作られる場合がある。最新reportの `durableFilesUnchanged:false` を隠さず、`durableContentUnchanged:true`, `emptyWalReadIndexOnly:true` と区別した。0byte以外のWALの変更を許す検証にはしていない。先行のWAL誤判定・通過点のundefined・型検査・改ざん試験のエラー文言の絞り過ぎによる失敗は履歴として保持する。

## 残りの接続

判断の保存はSWINGの実採用・実行TOTAL/身体消耗・公式の投球結果ではない。これらと更新後校正を、同じ実行に接続する必要がある。

投手制御はtick10787305で切れる。続けて物理を進める前に、実際の最終位置・速度と連続する次の制御が必要。現在の初球世界には、採用済みバットの初期保持位置と、そこから実測軌道へ至る手元の連続性も不足している。接触領域へ入るまでの既存ガードを解除して埋めず、投球前の装備・姿勢のSourceと、到達可能なバット/手元の制御を追加する。実測軌道の剛体変換だけでは人体での実行可能性を証明できない。

汎用9人守備、捕球/持替え/送球、走者、公式裁定、実打球混合9回、100試合監査、実機スマホは引き続き必要。NLB本人SI、実リーグ母集団、ファウル分布の校正も未完了。既存v31/実測メーカーHTMLは今回変更していない。
