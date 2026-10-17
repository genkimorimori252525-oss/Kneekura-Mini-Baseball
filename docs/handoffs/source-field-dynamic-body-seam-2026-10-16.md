# Source field: fractional ground → integer boundary → dynamic body

元 full Core/Host/render goal の継続として監査し、最初の整数境界待機だけを新しい純 Core module に実装した。Native motor admission、9人駆動、custody、throw、走者、裁定、得点の受入完了は主張しない。今後の動作参考はユーザー指定の OpenBiomechanics であり、MMD を新しい校正根拠に使わない。

## 確認した境界

1. `src/host/world/ActualLocomotion.ts:29` は `actualDefensiveBoundary` を使い、`self.at.elapsedSeconds === (startTick-originTick)/ticksPerSecond` を要求する。元 Native ground の `originTick=34054636`, `elapsedSeconds=0.2793662989158183`, `ball.tick=34334003` はまだその整数時刻ではない。`0.279367` まで `7.010841816534885e-7` 秒を元 Source kernel で実行する必要がある。metadata の保存や同 tick の表示で進めてはならない。
2. `src/core/sim/liveAction/QuantizerClosedGenerationBoundary.ts` は許容誤差を持つ元 event quantizer の「最後に含む double」を求める。これは nominal integer より後になる場合があり、motor の exact integer boundary には使えない。旧 generation boundary は変更していない。
3. `src/core/sim/ball/SourceBattedFieldMotionV3.ts:23` は元 initial/history から private session を再生成し、cursor の tick と等しい horizon も扱う。ground 後の outgoing と同じ Source basis を伸ばして上の正の待機を評価できる。実接触が先に起きる場合はその接触で停止する。
4. `src/host/world/SamePlateAppearancePhysicalFieldCalculation.ts:129` の通常 field step は `throughTick <= currentTick` または `<= previous.evaluationTick` を拒否する。evaluationTick は元 requested horizon ではなく、実際に停止した world.ball.tick である（同 file:121/134）。したがって同 tick の正の待機には明示した version/action 契約が必要になる。旧 stale guard を一般に緩めない。また過去 requested horizon より待機先が小さくなり得る点と、evaluationTick が同値な点を区別する。
5. `src/core/sim/ball/BattedWorldMotion.ts:64` の `deriveBattedWorldMotionActorsAtExactCoverage` は旧 actor を exact moment で sample し、位置・速度を保った新加速度曲線を作る。actor の `startElapsedSeconds` は root の exact clock を保持する。ball Source descriptor を actor adoption の都合で再初期化する必要はない。
6. `src/core/sim/ball/SourceFreeBallWorldQuery.ts:69/207` の private escape certificate は actors/surfaces/bases の完全な scope に結合する。数学的に同じ actor 軌道でも表現の rebase は scope の変更になる。旧 certificate を新 scope へコピーしてはならない。clear boundary での独立検索を先に接続し、直前の数値接触で proof がまだ必要な場合は fail closed とする。位置 nudge、任意 epsilon、caller が渡す witness で補完しない。
7. `src/host/world/SamePlateAppearancePhysicalFieldActionFromSqlite.ts:277` の既存 motor 接続は旧 `deriveBattedWorldFieldMotionCheckpoint` を呼ぶ。動的 Source V3 は元 history と新 private query scope の replay へ別の明示分岐が必要で、旧 helper 呼び出しだけで V3 authority を得たとはしない。`SamePlateAppearanceTeamMotorSelectionV1.ts` の full team/latest decision/observation/calibration 等の検査も維持する。

## 今回の新 Core API

`src/core/sim/ball/SourceFieldIntegerBoundaryV1.ts` のみを追加し、既存 product modules は変更していない。

- `deriveFieldIntegerBoundaryV1({originTick,elapsedSeconds,ticksPerSecond})` は strict division の二分探索で最初の整数時刻を求める。結果は `FieldIntegerBoundaryV1`。`fromElapsedSeconds`, `boundaryTick`, `boundaryElapsedSeconds`, `waitSeconds` を明示する。算術結果だけで motor/custody/Source の認証にはならない。
- `advanceSourceFieldToIntegerBoundaryV1({initial,throughTicks})` は元 stationary V3 history を全再生してから必要な待機を実行する。caller cursor/certificate/commands は受け付けない。結果は `SourceFieldIntegerCheckpointV1`: `already_at_integer_boundary` / `reached_integer_boundary` / `physical_boundary`、および boundary/startMoment/trace。free cursor が未解決なら拒否する。
- clear な到達時は元 Source initial/profile と actor 全曲線の不変を検査する。実 impulse が起きた場合は physical boundary として返し、元 impulse math による新 basis を隠さない。整数境界に既にいる場合は余計な zero-time query を追加しない。
- trace の appended horizon は純 Core の再生要求であり、Native accepted field step ではない。Host 接続は未実装。

動的 body の ordered advance/adopt は別担当の新 `SourceBattedFieldMotorMotionV1.ts` で独立実装中。同 file と既存 shared/Host files はこの担当では編集していない。

## Host checkpoint 契約（実装済み、Native admission 検証中）

旧通常 step の stale guard、旧 V3 Source version、`retained_quantizer_checkpoint_v1` はそのまま残した。新 reserved step SourceVersion は `same_pa_field_step_aero_ground_integer_boundary_v1`、専用 action kind は `source_integer_boundary_checkpoint_v1`（marker だけ）。認証済み V3 root/step prefix から専用 checkpoint でのみ明示分岐する。旧 consumer は未知 version を拒否する。分岐後はこの新 step version を固定し、既存5 metadata と no-action free advance、次の正の checkpoint だけを許可する。旧 V3 step に戻る遷移、motor/custody/capture/throw/runner 等は拒否する。

採用条件は以下に限定する。

1. 元 owner が同じ guarded DB read scope で root/全 step/metadata/Source set と各 owner/ref/hash/head/lineage/current cut/operation ordinal を検証し、完全な original prefix を独立再導出する。snapshot の cursor、診断、caller の数値境界・proof・replacement actor/Source は入力 authority にしない。
2. 入力 action は専用 marker だけとする。`source.throughTick === previous.evaluationTick === independentlyDerived.boundaryTick` かつ `0 < boundaryElapsedSeconds - originalCursor.elapsedSeconds` が必須。既に整数時刻、strict boundary が別 tick、過去時刻、任意 subinterval、未解決/保持 cursor はこの checkpoint では拒否する。
3. Root origin/clock/profile/ball mass と actor identity/curve/coverage を保持し、球は同じ root-relative Source kernel で進める。ground outgoing を使い、既に適用した bounce を再適用しない。horizon の延長以外の ball rebase は実 impulse の元応答再計算だけに限定する。
4. actor/surface/base 全 scope と private witness は original replay から再生成する。途中の実接触を隠して endpoint の状態を先に作らない。接触で止まれば `physical_boundary` を記録して motor-ready としない。未対応 capture/custody/unresolved は拒否し、その失敗を保全する。
5. positive elapsed でも evaluationTick が変わらないことを snapshot/actionResult に明示する。timeline は前回までの原 first-ground 証拠を保持し、新しい実証拠がある場合だけ追加する。checkpoint 自体に OUT/SAFE、PlayEnd、official、scoring を与えない。

主担当承認後、新 `SamePlateAppearanceSourceIntegerCheckpointV1.ts/.test.ts`、既存 `SamePlateAppearancePhysicalFieldAction.ts` の専用型/shape、`SamePlateAppearanceBallPhysics.ts` の exact version 遷移、`SamePlateAppearancePhysicalFieldActionFromSqlite.ts` の専用 dispatch、`SamePlateAppearanceSourceFieldV3.ts` の新 version 専用委譲を実装した。旧 `SamePlateAppearancePhysicalFieldCalculation.ts` の一般 no-action step guard は変更していない。

Native owner は元の guarded reader で Source/ref/hash/current view/lineage/全 original row を再導出した prefix を渡す。新 helper は全 physical horizon と5 metadata を再生し、全 field/evaluationTick/solver diagnostic、metadata の timeline と action、保存した checkpoint の数値診断を照合する。physical timeline は既存 owner の `samePaPhysicalTimelineAtField` で元計算し、保存 snapshot 全体との比較を既存 owner が行う。caller の保存 timeline/cursor/certificate だけで authority を得る API ではない。

後続 current cut の clock 校正を可能にするため `SamePlateAppearanceObservationClockProjectionV1.ts/.test.ts` に新 step version 定数の明示列挙だけを追加した。元 field/root owner 読取、current view reference、同 pitch/lineage、旧 nominal/effective の同 clock、非連鎖 projection、free cursor の検査は保持した。未知 version の一般許可にはしていない。

**team selection の順序:** `SamePlateAppearanceTeamMotorSelectionV1.ts:51` 以降は assignment 後の free progress を action/actionResult なしに限定する。専用 checkpoint は action を持つため、旧選択を checkpoint 越しに使うと元 guard が正当に拒否する。最小経路は **checkpoint → current cut の新 observation/decision/team/9actor selection → motor** として、guard を変更しない。既存選択を維持する要件があるなら、positive/event-free/same-actor checkpoint を元 owner が認証する別契約が必要である。checkpoint を metadata/noAdvance と誤分類して解決しない。

最初は小さい Core の ground→wait→adopt→advance と途中接触、元 history の改変拒否を確認し、その後独立 DB copy の真正 owner admission/cold reopen へ進む。Native では元 V2/V3 closed prefix の refs/hash/bytes を前後照合し、新 Source だけを追加する。長い fixture の最初からの再作成はしない。runner の current 原制御と decision/locomotion temporal clock の校正は未証明/UNKNOWN のまま保持する。

## clock の未決事項

`src/core/sim/fielding/PlayerLocomotionCalibration.ts:10/29` の `maxIntegrationStepTicks`、`PlayerDecisionCalibration.ts:7-8` の decision/first-step delay fields には個別の clock 宣言がない。locomotion contract は具体的な consumer が actual clock を検査する設計である。旧値の出自を根拠なく 1000Hz と決め、1e6Hz へ自動で1000倍してはならない。現在 Source が選んだ tick 値をその actual clock で使うことと、実測の身体反応時間として校正済みと主張することは別である。observationClockProjection は明示した observation route の契約であり、decision/locomotion の自動変換の承認にはならない。SI の加速度・速度・距離は時間 tick の変換対象にしない。

## 検証と原失敗

- 新7件＋旧 stationary V3 3件＋旧 generation boundary 5件: **15 PASS**、2.078s。receipt `docs/ai-continuity/verification-receipts/MB-20261016-SOURCE-INTEGER-BOUNDARY-ESCAPE_5858ea397a4b4a9ca6c18dee2c9a8cd9.json`。
- 内容: genuine Native の既知時刻差の算術、exact/nonbinary/safe-limit 時計、実 synthetic ground→同 tick 待機の位置/速度/spin 更新と独立 kernel 一致、途中の壁で停止、元壁 impulse 後の same-scope private escape 再導出、original V3 history JSON 不変、getter/追加 cursor/certificate/不正 clock 拒否。Native 値の算術テストと、純 Core synthetic trajectory の実物理テストを区別している。
- 初期の新6件＋旧3件 **9 PASS** receipt `MB-20261016-SOURCE-INTEGER-BOUNDARY_e1562b1692b040ac938c8ee7d015647a.json` も保全した。
- whole TSC は他担当編集中の `SourceBattedFieldMotorMotionV1.test.ts:90/93/99` union narrowing の3診断で **FAIL**、receipt `MB-20261016-SOURCE-INTEGER-BOUNDARY-TSC_6993156985d3432a92287218eb364e87.json`。今回の新2filesには診断なし。所有者へ共有し、同担当が修正後の最終 TSC を実行する。元 FAIL を上書きしない。
- その型エラー修正後、別担当の Core wait→adopt→advance 統合を含む **67 PASS**（`efb6a888...`）、whole TSC **PASS**（`0de481e32b164b34a231f1988e1e360c`）。真正 closed Native owner readOnly→純 Core 接続 **PASS46.719s**（`5a148b79...`）も別担当が記録した。operator fixture の body 加速度であり Native body 採用ではない。
- Host 初回は exact-zero が既存 Core guard で正しく拒否されたが、試験の error message 期待が別だったため **1 FAIL/14 PASS**。receipt `MB-20261016-SOURCE-HOST-INTEGER-CHECKPOINT_dd1922f3f46742159afcdf37b787bbed.json`。拒否動作を変えず message の固定だけを外した。
- 最終 Host/Core/旧 V3/clock の5files **28 PASS16.047s**: `MB-20261016-SOURCE-HOST-INTEGER-CLOCK_df841c9202be4897931759d288444c7b.json`。実 first-ground event を持つ batted-ball-pending timeline bytes 不変、途中壁反射で physical_boundary、その元 private escape 再導出も検査した。whole TSC **PASS24.702s**: `MB-20261016-SOURCE-HOST-INTEGER-TYPECHECK_9ade303208164ba1a39b6db392c72b73.json`。別担当 read-only review の指摘は解消、現時点 actionable finding なし。
- 新 Native repro helpers: `tools/verification/aero-ground-samepa/source-integer-checkpoint-entry.ts` と `build-source-integer-entry.mjs`。固定 bundle `../native-source-integer-checkpoint-v1/entry.mjs` SHA `693bc4b8984e71b7e3981088b8cc889c5ea60391e92f94603c8d18f6aaf99528`、748 source inputs の build 前後 SHA 一致。
- Native 入力は主担当指定の `../native-v3-metadata-clock-v1/run/closed-calibrate-20800/manifest.json`。original DB SHA `d6519a2e38cd8f1a622f53b4a8075200fe46e5459682ab1c159a2b23470afcaa`、Source Map SHA `a7b672070cb2357609088bcd5cffb9f2680db9131e02ba33d4532cfcb33d2fbf`。current cut13 が元 ground step を指す真正境界を新 private DB へコピーした。新固定 bundle の元 owner root/step/current view 再読は **PASS42.015s**、receipt `MB-20261016-NATIVE-INTEGER-CHECKPOINT-ORIGINAL-READ_35992ad396274424be12fd2e0b0e7cf1.json`。旧 refs/Source/hash/timeline/全 rows/schema を保持した。
- Native checkpoint 1件の元 owner admission **PASS113.968s**: `MB-20261016-NATIVE-INTEGER-CHECKPOINT-ADMISSION_ede7cb0460064b5e9d2de1e5c89b6972.json`。追加は新 field step 1行と元 owner head CAS1件だけ。旧行/schema/原 Source Map 全 entry は保持した。
- 別 process の accepted-Source callback を使わない original exported reader cold reopen **PASS54.235s**: `MB-20261016-NATIVE-INTEGER-CHECKPOINT-COLD-REOPEN_95bc81fa331043b884ba21e75ee115f7.json`。SourceId `source-integer-native-v1:checkpoint:0`、Source SHA `4e840577332b231acfc01bfca4f5670afbb1932a42459f5b807625132a85d4b7`、snapshot SHA `58ed4f9cb894ac45190bece898ff94200eaf65edad8e3315cce6885dc7a59da4`。
- 閉保存 `../native-source-integer-checkpoint-v1/run/closed-reopen-59172/manifest.json` の DB SHA `4b8dbef7a32d0c7a944da592582f092d47cafec775996e10926f24843e128e12`、Map SHA `e4aadb8964c852ad92ddedea613be96ca03160ec9008d9086feed74252676c1d`。実時刻は `0.2793662989158183 → 0.279367`、同 tick `34334003`、球 basis/profile と50 actor curves を保持、first-ground timeline SHA `c60e48c6999ab6a4d7167399b82081a4e07250ab4ba6ec6403f8dfc2da8c0fbf` は不変。body/custody/runner/rules の credit は0。
- Native checkpoint は成功したが、その直後の lifecycle view はまだ cut13/元 ground step を指している。これを current な checkpoint view と偽装しない。次は独立 copy で真正 lifecycle cut14→元 unprojected calibration に結合した新 clock projection→INTEGER version metadata 1件と cold reopen を検証する。新 `source-integer-metadata-entry.ts` は準備・syntax check 済みで、共有 motor Source 編集の安定後に新 bundle を固定する。元 600s fixture の再作成はしない。
- 長い Native fixture の最初からの再実行、元 DB/Source の書換え、旧 Source owner/header/hash の更新は行っていない。全 goal は未完。
