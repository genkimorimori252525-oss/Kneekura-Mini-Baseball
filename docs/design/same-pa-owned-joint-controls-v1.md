# 身体参照・投手の後続制御のNative所有

後続の実装では、[初球の結合物理と有限実行](same-pa-initial-joint-physical-execution-v1.md)へ進んだ。以下は参照・指令を所有した時点の記録。最新の実接触採用、検証のtimeoutと再読による認証、消耗/TOTALによる停止は後続文書とCURRENTを参照する。

2026-10-16。正式Coreへの接続を継続中。今回も通常HTMLは変更していない。

## 身体参照

`SqliteMeasuredBattingBodyReferenceStore` は、新しい専用tableへ元のバットと身体参照を保存する。元の人物・身体・打撃モデル・選択された実測試行・137個の原キーの時計・利用可能日を照合する。姿勢速度の上限には別の明示的な校正と出典を要求し、走力や相対能力値から補わない。

今回の18人合成試験では上限5m/sを明示的な合成校正として登録した。NLB本人の測定能力ではなく、製品の既定値にも追加していない。実測の腰位置は股関節中点の参照であり、重心や筋力の測定値ではない。

`InitialMeasuredBatControlFromSqlite` の新しい結合準備処理は、現在のSWING判断とWorldを再認証し、保存済みの身体参照からCoreの連続制御を組み立てる。旧方式の出力は維持する。

Native試験では、不正な元バットhash、別試行、時刻改変、未来の利用日を保存前に拒否した。元の72tableは不変。保存後の校正改ざんを拒否し、元の行を戻した後に再認証できた。作者callbackを持たない再読・再受理でも同じ結果となる。

## 投手の後続制御

`PitchHandHoldRenewalV1` は、元の制御がちょうど静止して終わる場合だけ、その位置・速度から別の有限な手の保持指令を作る。元の期限や軌道は変更しない。位置・速度・開始時刻を差し替える引数はない。動いている終端は、別の連続した回復制御が必要であり拒否する。球の保持状態を推定する処理でもない。

`SqliteInitialPitchHandHoldStore` は、元の投球、現在の判断・予約状態・World、元の身体とscene期限を再認証して指令を保存する。発行予定時刻が元の期限を過ぎていれば拒否する。今回の指令はtick10787305から11134216まで。元の指令は10787305のままで、旧queryは期限超過を引き続き拒否する。

明示した後続指令を受け取るCore queryだけが追加区間を扱う。ボールは同じ元のSource rootから計算し直し、切り分けた観測点へ積分の基点を移さない。手は期限後も衝突対象として残る。合成試験では、旧期限より後に実際に球が手へ当たる例でこれを確認した。空中と地面の重力が一致しない最初の試験入力は拒否され、入力を直して再検証した。物理の検証条件は緩めていない。

## 同じ世界での結合

`InitialOwnedJointControlPreparationFromSqlite` は、身体・バット・投手の後続指令が同じ判断とWorldに属し、必要な期間を覆うことを照合する。Native試験は元の73tableを変更せず、新table1個を追加した。手の位置注入、scene期限超過、不正な参照と保存snapshotの改ざんを拒否した。

別processから通常のNative ownerを使って再計算し、74tableの全行・schema、DB本体と永続WAL内容が不変であることを確認した。137バットキー・137腰キー・49障害物を維持し、tick11134216までの準備を再現した。関連116件、全src型検査、検証ツールstrict型検査はPASS。

最新生成物は `verification-authored-with-bat-owned-hand-v1`。先行する身体参照の保存試験は `verification-authored-with-bat-owned-body-v1`。再現バイナリは `native-owned-coupled-body-v1`, `native-owned-pitch-hand-hold-v1`, `native-owned-joint-control-reader-v1`。コマンド・log SHAは `docs/ai-continuity/verification-receipts/MB-20261016-OWNED-*`。

## 実行との境界

今回所有したのは参照と指令のデータである。`motionIssued:false`, `physicalExecutionAdmitted:false`, `workloadTotalAdmitted:false` を維持する。実行権の消費、身体消耗、球との接触、公式イベントを発行してはいない。

投手の要素queryには元の静止したsceneを使用している。打者の動く胴体と保持手、実際のバットを処理していないため、`batterBatInteractionChecked:false`, `fullWorldAdvanceAllowed:false` として保存した。このqueryの結果を試合全体の物理進行に流用してはならない。

次の実行ownerは、元Sourceの球に対して、実際のバット・胴体・保持手と他選手の最初の接触を統合する必要がある。元の静止した胴体・保持手を単に削除せず、同じ人物・roleの連続制御へ置き換える。障害物配列では保持手を除いた分だけindexが変わるため、sceneへ戻す際は人物IDとroleを照合する。初期の把持基準点と手球の中心に差がある場合は、その取り付けを保存して連続させる。

採用後の再読には、元の判断と準備を履歴として再計算できる経路が必要。現在headだけに許可した準備関数を、そのまま後続headから呼び戻してはならない。実行権・消耗/TOTAL・公式事実を同じ実行へ結び付け、架空の見送り・接触・仕事量を作って進めない。

汎用9人守備、捕球/持替え/送球、走者、正式9回・100試合監査、実機スマホ、NLB本人SIとリーグ母集団の校正は引き続き未完了。Sourceの保存・再読が通ったことを、これらの完了証拠とは扱わない。
