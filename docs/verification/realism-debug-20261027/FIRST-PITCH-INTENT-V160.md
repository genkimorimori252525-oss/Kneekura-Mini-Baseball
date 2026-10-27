# V160 初球判断の実連続診断と再開運用修正

2026-10-28 JST / MB-20261027-REALISM-DEBUG-PLAN。全goal/step-007はACTIVE。ゲームSourceと最新V159候補は不変。

## 新しい証拠

自然AUTO→初球TAKE採用→次球AUTOを、同じ本人roster・実673clip/92,201frame・seed20261019・通常5000tick・Chrome156.0.8078.48で実行した。本人原本は不変、採用はlivePhysicalRosterのみ。Maker adapter・通常Native Host・実Workbench Worker・保存再読の全record/継続状態を26比較で厳密照合した。

| 試験 | 実結果 | 証拠 |
| --- | --- | --- |
| 自然01 | PASS、26.812秒、全26比較一致、preview非消費 | `first-pitch-intent-v160-01/report.json`、receipt `f2b74d331f444ac2b37baa799eadb911` |
| 強制SWING案02 | FAIL、不正manager command、13.796秒 | `first-pitch-intent-v160-02-swing/report.json`、receipt `17bbe1ea23ac46bfad260385823a78ef` |

初球は0-0から見送りのballで、TAKE受理後は1-0・観測記憶1件。次球はその記憶を想起して予測へ混合し、実際に振ってfoul/1-1となった。両球のPLAY seedと実行誤差は異なる。本人方向profile/旧方向配分はいずれも不在、名目方向はREACTIVE/null角、方向抽選streamは消費していない。次球の方向運動は `REACTIVE_NO_ANGLE_TARGET` で不適用だった。

この経路に初球専用OPPOSITE分岐は見つからない。しかし初球が見送りのため、初球の実打球方向を証明するケースではない。次球の角146.86度は後方foulで、引張りのfair hitと数えない。未設定REACTIVEの観測対応運動が不足することと、本人方向嗜好/初球固定/誤差を区別する。

02の不正操作は実装者の確認不足。SWINGは合法commandではなく、本人profile改変による代用も投球計画を変えるので採らない。失敗を保持してこの枝を撤回した。自然01のrunnerはprivate保存sourceとの全bytes一致へ戻し、自然01の再実行は行わない。詳細とSource根拠は `../../agent-decisions/2026-10-28-first-pitch-direction-v160.md`。

## 反復を生んだ運用上の問題

CCGの実receiptは残っていた。CURRENTとWorkflowはV159時点で、実行済V160を次作業として指していた。checkpointはCURRENT本文を自動更新しないため、本文を更新せずに記録が揃うと扱ってはいけない。今回の確認範囲から全環境の障害や記録喪失とは結論しない。

修正は既存のAGENTS/CURRENT/Workflow内で行う。担当CURRENTの過去節はCURRENT_ARCHIVEにそのまま保存し、入口は完了証拠・現在の一件・具体的な次操作だけにする。実receiptが新しければ再実行の前に整合する。完了済試験の再開理由は関係Source/入力/runtime変更、新しい失敗、本人の明示再検証だけ。理由を先に記録する。進捗説明とtool出力も差分へ限定する。追加Hook/設定/別台帳は導入しない。

WorkflowはstateVersion20へ更新し、CURRENTの次操作と全文一致。担当旧節15,337bytes/SHA `19ecb945852cf0e480cc167e8e4b76846d256d8b998c0a1d93d1d81beb78c48f` を保全し、入口を18行へ短縮した。`verify-recovery-v160.mjs` によるmetadata/整合性だけの19項目はPASS `8934cd2f2a2245ac90ee6054bfc1a7de`、ゲーム試験再実行0回。旧receipt/log hash、runnerの実行済原文、両Coreの全Source pinも照合した。最初の整合性scriptの既存API引数shape誤り（FAIL `6b2f38aed43d4df8bc957eae3f8c6b96`）も保持し、ゲーム失敗に数えない。結果は `workflow-recovery-v160.json`。その後の監査scriptのhome path表記変更は `node --check` で確認し、同じmetadata検査を再実行しない。

## 次の一件

V161-R1：未設定AUTO/REACTIVEの主観内外角対比較を先にRED化する。既存V153の有限yaw・surface登録・最初の主観接触・準備/arc/回復certificateを共用し、REACTIVE/null角を保って、held poseからarc開始poseへの最大endpoint移動量/準備時間が最小の実行可能候補を選ぶ。これは運動選択規約であり人体の校正値ではない。

適用を明示AUTO＋既存観測/方向policy＋REACTIVE＋振る判断成立＋SPIN専用motorなしに限定する。旧request省略、手動/V122方向目標は従来経路。既存上限/全候補拒否を保持し、未来球・方向均等抽選・仮CENTER・結果補正を加えない。限定testの後、変更により初めて必要になる同Chrome本人caseと旧省略/手動互換を検証する。V154証明/人体未校正は解決済にしない。

V160自然probeの再撮影、UI4選択の再監査、強制swing追試を次作業にしない。Task4校正・V154・SPIN/Native・旧残件・性能B/9回/同版配送・SIGN延期・最終最新設計GitHub照合は計画どおり未完。
