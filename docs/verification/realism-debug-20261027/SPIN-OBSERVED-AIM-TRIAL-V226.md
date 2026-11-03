# 配達済み観測から打点・運動を変える試行

2026-10-30 JST。新しいNative試行1件で実接触が成立し、既存の局所座標による評価でTOPSPIN 626.2489333765586 rad/sを確認した。接触から既存continuous空力Coreの25ms評価まで接続した。通常AIへの採用、技術習得、4技術、Gold、完成版配送は未完。

## 実装したこと

保存された元target / anchorのx/y差を、配達済みforecastのneutral plate / contact-depth crossingへ適用する。forecastを変更せず、既存course-aware motorのtiming / latency / window / speedを共用する。初期域は右打者、measured profileは未対応として拒否する。

新しい同一打席の明示trial capabilityは、正常view / input / intent、V225の記述、assessment → prediction → delivery → captureを同snapshotで再認証する。元/currentの姿勢・zone・physicsは別に保持し、`UNCALIBRATED_CURRENT_OBSERVED_DOMAIN` / `qualifiedTransferProven:false`とする。通常のearned spin consumerと旧Mastery / V225 flagsを変更しない。仕様は `../../superpowers/specs/2026-10-30-observed-spin-aim-trial.md`。

## 実行済みの関連検査

- pure seamと旧V1 / V123関連 `d860d681`、追加 `4e35cc4b` PASS。Rootの右打者座標域の指摘は RED `50b05bd9` → 修正 → GREEN `bbc70c5691da4665af300b3e9d29e72f`、最終pure strict `3dddc4e904aa440c995898f4f1cbc56e` PASS。
- 新Core / Host各4件 `242bfafe`、旧physical / metadata関連9件 `9a538834`、production最終focused strict `67831449` PASS。Host結合の新規テストは正常Readerの戻り値をスタブした単体検査であり、Nativeでの結合証明ではない。
- 編集前baselineと新Coreを、v1 SWING / TAKE、v123 NO_TARGET / BACKの4ケースで全記録・keysまで比較。`956cc865` PASS、80 Sourceの終了pins一致。新しいSWING試行はdefault profileを先に実行せず、指定profileを計画する。
- motorは2 literal、production旧4ファイルは各hunkの逆適用で、編集直前の全bytesへ戻る。Git親は別保存。production逆proof SHA `2fc7e1073a9cfde7cf8b24aa5cbe59e4a21fe1477cf1d203911b72a689211071`。
- Sol独立静的レビューは重大指摘なし。9ファイルの開始／終了hashがproducer最終freezeと一致。Native実受理・再読は引き続き未検証。

## 実検証と実行前レビュー

未commit current inputを持つV209の保存DBを再利用する。receipt `f2977213f9134a6b9dd532aee02c0cd4`、current cut9 / ordinal3 / World1 / 12 fullrefs / calibration32 / commitment・resolution未受理。元DBを開かず所有コピーを作り、正常原本再認証 → 元運動記述の登録 → TOPの新trial → 正常接触・exit spin → 保存済み事前宣言physicsによる既存continuous空力Coreの順に進める。空力の限定評価をNative fieldや公式採用とは呼ばない。元6練習・2TAKE・観測・予測・inputは再生成しない。

実行前のRootレビューで2点を修正した。旧V225検証gateは接触済みresolutionを要求するため、未commitのV209に流用できない。ここを正常Actor / Mastery / 元motor evidenceだけを認証する専用入口へ変更した。また、外側の後段検査失敗時にも`report.pass:false`を保証した。両方とも新試行の起動前に発見し、修正のためのNative再実行は0。

worker timeoutは既存V210の実stage約257.4秒を根拠に、285秒から480秒へ変更した。外側600秒の中で、追加の正常原本再認証と終了保存の時間を確保した。試合速度の測定ではない。修正後strict `0682d98f90764fe5b3cb4237e1546d15` / 構文 `395616a2`、Rootレビュー後の850 Sourceとbundle SHA `5e1b722df9ae57a481c63171de68da47788db13fe56f892cc98190b15c1be8ce` を固定し、新しい所有コピーで1回だけ実行した。

### 実結果

receipt `30a0abefd7e94f88a63f230d82558d35` PASS、284,703ms。command は `node tools/verification/check-native-observed-spin-aim-trial-v226.mjs work/native-observed-spin-aim-trial-v226-01 work/v226-source-freeze-reviewed-01/reviewed.json`。正常commitmentとresolution、cut10 / cut11のcurrent coverage・各calibration32、World1→2を確認した。

- 試行選択・実接触とも成立。exit velocity `(2.0091493570015633, -14.030006780996056, 38.53953699012955)` m/s、exit spin `(626.1518524669871, 3.247827264554667, -18.174986797833363)` rad/s。
- 既存`observeBattedBallSpinV123`の打球方向に基づく局所basisでTOPSPIN `626.2489333765586` rad/s。Sourceの技術名やworld x符号だけで結果を決めていない。
- `createBattedBallInitialStateFromContact`のtick / position / velocity / spinがNative接触結果と全値一致。保存済みの事前宣言physicsを使う`aero_ground_continuous_source_kernel_v2`へ渡し、25ms後もairborne。Native field physicsの採用や全弾道・公式結果の証明ではない。
- 既存7tableの91行追加、当該physical headの2更新とWorld headの1更新、V225の新table2行だけ。旧全行・rowid・catalog・他headは不変。元DBは開かず、全8既存DBの開始終了files一致。caller状態・850 Source / bundle / 既存成果物の終了pinsも一致。
- 元6練習、前2TAKE、観測、予測、inputの再生成は0。新接触は旧資格へ付け替えていない。

実行log SHA `c383d08823f49fa3376fe37c3e156b582f51cb9b51de4bceda856e9acfe1c52b`、report SHA `909587e7aafa13fdd4ca21cc0fa5207110a92e1f6e0d8600bc54f3b54fa00f44`。元/currentのgeometry差と`qualifiedTransferProven:false`を保持する。private記録は `work/native-observed-spin-aim-trial-v226-01/`。

次はこの実結果を再生成せず、未検証の技術・条件と通常consumer採用に必要な根拠を閉じる。TOP1件を3件以上の新資格、他技術、自然Gold、通常AIの完成へ拡張しない。

## 保持する失敗・限界

pure初strict `c422904d`、production初strict `60964caf`はtestの型修正前のFAILとして保持。並行編集中の全体型検査 `6fdfa021c9854fd4a6f1add8d68700b1` FAILと後の途中PASS `45a8b30e`も、最終freezeの保証とは別に保持する。opt-in workerのcollection `314d0608`は実試験skipでNative coverageは0。旧Worker異常・suffix終了pins UNKNOWNは解消していない。

試行を選べたこと、motionの差、実接触、意図方向の回転、空力への接続は別々に記録する。未接触・逆方向・未分類は実結果として残し、旧資格の成功へ付け替えない。
