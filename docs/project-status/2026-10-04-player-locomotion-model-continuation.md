# 非デザイン継続: Playerのlocomotion calibration所有層

更新: 2026-10-04 UTC / JST

実装base: `ec49d885`。Actual defensive decisionの後段で、一回のbounded locomotion stepに必要な明示的calibrationを所有する前提を追加する。この変更自体はmotor commandや物理運動を発行しない。

## 追加した契約

Core `PlayerLocomotionCalibration` / `createPlayerLocomotionCalibration` は、以下だけをdetached・deeply immutableにする。

- `accelerationRatingCalibration`: `lowestAbilityAccelerationMps2` / `highestAbilityAccelerationMps2`
- `brakingMps2` / `topSpeedMps` / `arrivalRadiusMeters` / `maxIntegrationStepTicks`
- `routeCalibration.maximumLateralDetourMeters` / 明示的な `preferredSide` (`-1` または `1`)

Acceleration abilityとroute-efficiency abilityはexact fielding-model Sourceの独立したratingsが所有し、新calibrationに複製しない。世界の `ticksPerSecond` は後続consumerが実際のphysical clockから導出・照合する。`deriveRatedDefenderMotionParameters` が上書きする独立したbase acceleration値を保存しない。

Native `SqlitePlayerLocomotionModelStore` は `AcceptedPlayerLocomotionModel` / `DurablePlayerLocomotionModel` と `accept` / `read` / `selectAtDay` を提供する。`playerLocomotionModelEvidenceFromSqlite` は同じSQLite connection上で `derive` / `before` / `read` / `selectAtDay` を提供する。

- Sourceに `capability: 'defender_locomotion_v1'`、source version、career、Player、exact Person-link Source、exact fielding-model Source、acceptance dayをpinする
- 能力範囲はlocomotion calibrationのみ。Source versionはcalibration provenanceであり、latest-version selectorではない
- Career/Playerごとに一つのimmutable baseline。別Sourceによる置換、未来日の利用、元fielding/Personの変更を拒否し、authorityなしのread/retry/reopenを維持する
- Callerのprofileや別DBのsnapshotを信用せず、own DBのfielding/Person ownerから再導出する
- Indexed列、Sourceのcanonical JSON/hash、再導出snapshotのcanonical JSON/hashを照合する。所有scopeはindex、Source、snapshot内Source、snapshot内fielding Source、snapshot内Personの全mirrorを検査する。Source IDもindexと両JSON mirrorで検査する
- Direct derive / preflightも入力全体をinert cloneしてから参照する。Sourceの形状・値の検証はSQLより先に行う
- Preflight、`BEGIN IMMEDIATE`内、INSERT後に依存と所有を再検証する。Inside/post-insert mutationは全新規行と同transaction内の依存改変をrollbackし、先にcommitしたWAL peerの値は保持する

## 数値・入力境界

余分/不足field、key集合のdelimiter alias、array、accessor、symbol、非enumerable、非plain object、cycle、非有限値を拒否する。CapabilityやSourceに別領域のrating、clock、reach、outcomeを追加できない。

Accelerationの両端、braking、top speedはfinite positive、acceleration上限は下限以上。Arrival radiusとdetourはfinite non-negative。Integration ticksはpositive safe integer。既存 `DefenderMotion` / `DefenderRoutePlan` / acceleration rating adapterの入力domainに合わせ、恣意的な物理上限やsynthetic本番defaultは設けない。

有限inputだけで全ての実際のroute/trajectory計算が有限になるとは保証しない。後続consumerは実際のclock、start/end tick、位置・速度・targetを検証し、既存rating/motion/route APIのderived outputにもfinite/safe境界を課す必要がある。このownerは仮のclockやfixtureの位置で将来の物理計算が安全だと認定しない。

Testsは明示的なtest clockで既存 `deriveRatedDefenderMotionParameters` / `planRatedDefenderRoute` / `buildDefenderMotionTrajectory` へcalibrationを接続する。Accelerationとroute efficiencyが互いを代用しないこと、braking、speed、arrival radius、integration limit、route sideの消費を確認する。Legacy acceleration adapterへ渡す初期fieldにはcalibrationの下限を使用し、独立したPlayer knobは追加しない。

## 対象外

Relative glove reach、catching execution error、gaze/communication、route-progress policy、actual locomotion receipt、mechanical compositor、existing field-execution ownerへのadoptionは未実装。この変更はdecisionのtargetやissue timeを変更せず、実測calibrationや全試合/Career/PlayEndの完成を意味しない。UI/design/Presentation、既存Person/fielding/decision ownerのproduction実装、workflow/config/lockは変更しない。

## 検証

初期Core/Native skeletonに対して67 failing assertionsを確認後、実装・境界テストを追加。Fixtureは明示的synthetic test値であり、本番値ではない。

- Final focused gate: **12 files / 249 tests PASS** (7.71秒)、新規Core/Native/WALは **130 tests**
- 既存motion、route、rating separation、fielding/Person owner、decision ownerとWALも同時に再検証
- `npm run typecheck`: PASS（catalog precheckを含む）。初回の直接tscはfresh worktreeの未生成catalogで失敗したため、通常のpretypecheck手順で再生成・再実行した
- Node 26、Vitest single worker、指定のcloud-local TMPDIRで実行
- Whole suite、自宅CI、profilingは実行しない。先行sliceのwhole成功を新sliceの成功として流用しない

Independent read-only reviewはproduction実装と初期104 testsにactionable findingなし。追加edge coverageはown-DB peer、capability、malformed archive、SQL前のdirect-helper validation、fully rehashed dependencyのinside/post-insert rollbackを含む。

Final delta reviewも追加testsと本記録を確認し、actionable findingなし。最終249-test logとtypecheck/RED logを照合し、重複runは行っていない。

## 追加訂正: duplicate JSON identity / container ownership

初期実装commit `ab09f1f61c4d380ace768ce325054dad239268e2` と上記249-test gateの後、別ownerの独立reviewからJSON重複keyの解釈差が報告された。SQLite `json_extract` は最初のkey、`JSON.parse` は最後のkeyを採用するため、first-foreign / last-originalのraw JSONで元PlayerやSource IDをscope探索から隠せた。初期gateおよび初期reviewは、この不正形式を検証していなかった。

追加REDは **11 failed / 1 passed**。Sourceとsnapshot内Source/fielding Source/Personの4つのscope mirror、Source IDの2つのmirror、snapshotの4つのduplicate container、escaped duplicate identity keyで実際に再現した。無関係rowのopaque domain payloadとarchive bytes保持のcontrolは元からPASSした。

共有helper-only commit `63dd60c4b847134917ae13eda6636edddd1bd978` を、このbranchでは `e83f6cd` として適用した。`SqliteOwnershipMetadata` のNodesはdecoded keyとduplicate ancestorを列挙し、Projection/Matchesは選択したscalar metadataのみを型・出現数と照合する。

訂正後は全candidate occurrenceから同じcontainer内のcareer/Playerを探索し、Source IDもduplicate-awareに探索する。該当rowだけを選択後、Source/snapshot/nested ownerのcontainer数とidentity metadataを検証し、その後に従来のexact own-DB rederivationとcanonical archive照合を行う。無関係rowのcalibration等をdeserialize・再検証する全件走査にはしない。Schema、Source format、snapshot生成、Core calibration、既存ownerのproduction実装は変更しない。

- Correction focused gate: **5 files / 163 tests PASS** (4.26秒)。初期locomotion 130 tests、追加metadata 12 tests、共有helper 21 testsを含む
- `npm run typecheck`: PASS、`git diff --check`: PASS
- 正常archiveのread/retry/reopen、既存fielding/Person archive、無関係rowを含む全archive bytes保持、before/inside/post-insert WAL rollbackを再検証
- 初期249-testの長い依存aggregateとwhole suiteは訂正時に重複実行していない

Correctionのfresh independent reviewもblockerなし。独立temporary probe 6件（middle/escaped owner container、同値duplicate Source ID、sparse duplicate ancestor、異なるcontainer間scope-pairのnegative control、middle/escaped Source-ID alias、malformed unrelated row）を通過した。Repository編集や重複suite runは行っていない。
