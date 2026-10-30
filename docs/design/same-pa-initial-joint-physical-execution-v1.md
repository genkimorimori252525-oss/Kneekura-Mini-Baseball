# 初球の結合物理と有限実行

後続工程の[実接触までの累計消耗](same-pa-initial-joint-workload-v1.md)で、非空の実行区間の累計評価をNativeへ保存した。これは打席内の消耗投影であり、globalへの確定や反動後の物理制御の発行とは区別する。

2026-10-16。OpenBiomechanicsの原バットキーと同じ試行の腰参照を使う。MMDは使用しない。通常HTMLの試合実行器は今回変更していない。

## 同一世界の最初の接触

`ControlledBatBodyPitchWorldV1` は、元の投球Source rootを使い続け、実バット、動く胴体と保持手、投手の手、他の身体形状を同じ時計で比較する。49形状のうち打者の胴体・保持手だけを人物IDとroleで連続制御へ置き換え、残り47形状と実際の太さを持つバットを残す。球の観測点へ積分基点を移さない。

元の把持基準点と手球中心の差を保存する。実際の手の中心について、胴体との間隔、手とグローブの到達距離、地面・他形状との間隔を連続区間で検証する。手をバット基準点へ移す補正はしない。その他の選手が動く場合は別の連続sceneが必要であり、この版は拒否する。

各積分区間の速度上限と丸め誤差上限を使って分離を証明し、重なりのある接触時刻を細分化する。接触順が確定しない場合や接近インパルスが得られない場合は未解決として停止する。衝突を作るための狙いの変更・半径縮小・時刻や位置の微修正はしない。

剛体接触は既存の製品用木製バット応答を使い、球の速度と回転、バットの並進・回転反動を得る。これは打球方向や飛距離を抽選する処理ではない。元の材質姿勢と正確な小数時刻も保持する。

## 採用と再読

`InitialOwnedJointPhysicalCalculationFromSqlite` は保存済みの装備・身体校正・判断・World・指令から計算する。呼出側から反発係数、球の未来、接触位置、希望結果を受け付けない。この計算単独では実行権を与えない。

`SqliteInitialJointPhysicalExecutionStore` は次の二つの専用tableを持つ。

- `pa_initial_joint_v1_rights`: 現在の元判断・予約状態・Worldに照合した有限な実行権。元の投球dispatch権とconsumerも結び付ける。この段階では動作しない。
- `pa_initial_joint_v1_executions`: 実行権を一度だけ消費した最初の物理区間。同じ投球・同じ権の二重実行をUNIQUE制約でも防ぐ。

採用は同じprivate Native transactionで現在性を再確認して行う。Source・snapshot・hash・索引・schemaを照合し、保存後と再open後には、元の所有者だけから物理結果を再計算する。履歴再計算専用の経路は、元の判断が参照したWorld revisionを再読する。現在性の検証経路は維持し、履歴経路を新規採用権として使わない。

バット接触が最初なら、この剛体計算結果から実際の`BatBallContact`を既存のcanonical timelineへ追加する。別の接触探索や架空の見送りを挟まない。球の正確な接触momentと打者の実際の胴体・保持手・バット姿勢も同じ実行に残す。canonical eventの整数tickへ物理の基点を丸め直してはならない。

## 停止と未完了

採用後の区間は実際に実行された非空の仕事として保存する。消耗量を校正できたとは扱わず、`REQUIRES_NONEMPTY_WORKLOAD_SETTLEMENT`、`workloadTotalAdmitted:false`で停止する。元の空prefix・zero TOTALによる再開を認めない。既存の現在予約状態の検査に停止ガードを接続し、古い静止sceneで先へ進む経路も拒否する。

特に打撃後はバットが反動を受けている。後続ownerはこの実際の球・バット・身体・手・足・投手の状態から継ぐ必要がある。元の実測軌道を接触後まで強制再生したり、打者の胴体位置をバットのgripへ戻したりしてはならない。

次の工程は、この非空の実行証拠を消耗/TOTALと後続物理制御へ接続すること。汎用9人守備・走者・公式裁定、混合9回・100試合監査、NLB本人のSI校正と実機スマホは未完了。このNative合成試験の姿勢速度5m/sや実測再生速度を、NLB選手の校正済み能力として流用しない。

検証生成物は `verification-authored-with-bat-world-query-v1` と `verification-authored-with-bat-physical-execution-v1`。前者は条件付き計算のみ、後者の採用状態は`native-report.json`とmachine receiptで確認する。途中停止や未解決を成功に昇格しない。実行バイナリとその入力SHAはfrozen Native helperの`build.json`に残す。
