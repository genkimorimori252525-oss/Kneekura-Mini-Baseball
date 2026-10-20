# 実接触までの累計消耗

後続の[接触後の連続制御と実行](same-pa-post-impact-recovery-v1.md)で、このviewに結び付けた回復指令を実行した。回復後の新しい仕事を含む累計再評価と、汎用守備への接続はまだ必要。

2026-10-17。前工程の実行済みprefixを、打席内の消耗投影へ接続する。元の物理・判断・予約状態は変更しない。

`SqliteInitialJointWorkloadViewStore` は、実行権を消費した元の実行を通常ownerで再計算し、その投球・観測判断・実行区間・10人の予約状態を含むcoverage hashを作る。開始は元Worldの開始時刻、終了は正確な小数の接触momentである。架空の見送り、追加の投球、接触件数を作って累計を満たすことはしない。

評価Sourceには、正確なcoverage、全参加者の元reference、累計effortUnits、利用可能日、校正・評価の出典を要求する。打撃動作を開始した打者と、実際に投球した投手に開始時のzero TOTALを流用することは拒否する。静止していた他の参加者についても明示的な評価が必要だが、そこでのゼロは許容する。評価が欠ければ進行を認めない。

`InitialJointWorkloadProjection` は既存Coreの`advancePlayerWorkloadRecovery`を使う。前回の投影値へ上乗せするのではなく、元の予約状態から累計全体を再計算する。したがって打席内で何度評価しても、同じ仕事を二重に加算しない。旧累計より少ない値、別人物・別状態、欠員、重複、未来の校正を拒否する。

保存時には、実接触を持つ現在の物理frontierに対して、元のofficial frame、全員の現在の予約状態、元の観測判断headとWorldを再確認する。旧「静止した選手の世界」のcurrent guardは解除しない。新しい専用tableは`pa_joint_workload_v1_views`で、元のtableを変更しない。schema・索引・Source/snapshot hashを照合し、履歴では元ownerから再計算する。

新viewの`workloadTotalAdmitted:true`は、正確な実行区間の評価が所有されたことを表す。`globalWorkloadCommitted:false`は打席内の投影であり、globalへの確定はプレー全体の精算時に一度だけ行う。`physicalSuccessorRequired:true`と`nextMotionAllowed:false`も維持する。消耗を評価しただけでは、バット反動後の制御や身体の制御期限は更新されない。

今回のNative試験では、元の合成18人世界に、打者0.75・投手1.25・他の静止参加者0という明示的な合成評価を与える。これは生理学的な推定式、製品の既定値、NLB本人の実測値ではない。元の合成policyが1unitあたり0.1のため、打者はfatigue0から0.075、投手は0から0.125へ投影される。原policyを変更したり、球速・打球結果を過去へさかのぼって変更したりしない。

生成物は`verification-authored-with-bat-workload-v1`。各工程の結果は`prepare-report.json`、`accept-report.json`、`tamper-report.json`、`independent-readback.json`と対応machine receiptを参照する。存在しないreportや途中のDBだけで完了を主張しない。

次の物理ownerは、このviewで示された投影状態へ能力校正を結び付け、実際の球・バット反動・胴体・保持手・足・投手の状態から後続制御を作る必要がある。既存汎用守備controllerには整数境界と剛体姿勢の制約があるため、小数の接触momentを丸めて渡すことはしない。実際に時計・姿勢を連続させる接続が必要である。正式9回・100試合・実機・NLB校正は未完了。
