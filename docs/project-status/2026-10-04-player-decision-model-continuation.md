# 非デザイン継続: Playerのdecision calibration所有層

更新: 2026-10-04 UTC / JST

実装base: `2045573a9bfd6e228bbf22ad05342b40614d42bb`。既存の[actual field observation](2026-10-04-actual-field-observation.md)から個人判断へ接続する前提として、明示的なdecision calibrationだけを所有する。

## 追加した契約

- Core `PlayerDecisionCalibration` は既存 `DefensiveDecisionTimingParameters`、`DefenderFirstStepTimingParameters`、`minimumCueConfidence`、`communicationTrust` を明示的に受け取り、detached/deeply immutableにする
- situational awarenessとfirst-step abilityを新しいcalibrationに複製しない。これらのdefensive ratingsはexact fielding-model Sourceが引き続き所有する
- Native `SqlitePlayerDecisionModelStore` はcareer、Player、original Person-link Source、exact fielding-model Source、source version、acceptance dayをpinする。DB内の既存fielding/Person ownerから再導出し、callerからprofileを受け取らない
- Career/Playerごとに一つのimmutable baseline。別Sourceによる置換、latest選択、acceptance day以前の利用、元model/Personの変更を拒否する。Authorityなしのimmutable retry/read/reopenを維持する
- Sourceのindexed列・canonical JSON/hash、再導出したsnapshotのcanonical JSON/hashを照合する。所有scope探索にはindex、Source、snapshot内Source、snapshot内fielding Source、snapshot内Personの全mirrorを使う。Source IDの探索にもindexと両JSON mirrorを使う
- indexとSourceを同時に別scopeへ移しても、元Playerを示すsnapshotが残れば隠れた重複baselineを新規作成できない
- Preflight、`BEGIN IMMEDIATE`内、INSERT後に依存・所有を検証する。Inside-transaction/post-insert mutationは全新規行と同transaction内の依存改変をrollbackする。別WAL connectionが先にcommitした値は消さない

## 数値・入力境界

Exact key配列でfield集合を検査する。区切り文字を含む一つのpropertyで複数fieldを偽装すること、余分/不足field、array、accessor、symbol、非enumerable、非plain object、非有限値を拒否する。

Delayのdomain検証と導出は既存の `resolveDefensiveDecisionTiming` と `resolveDefenderFirstStepTiming` を使う。各ability domainの最大delayを得る境界値0で、origin tick 0からdecision→first-stepを合成し、safe-integer overflowを拒否する。独自の上限値・最小delay・本番defaultを導入しない。後続consumerは実際のevidence/recognition tickでも同じCore APIの検証を行う必要がある。

Confidence/trustは現行decision APIと同じfinite `[0,1]` domain。Communicationの実配信・受信やcue provenanceを所有したことにはならない。

## 対象外と次の依存

Contextual `PrePlayDefensivePlan` は永続Player abilityと分離し、別Sourceとして後続で所有する。この変更はplan、actual observation消費、decision receipt、pending decision、motor command、communication deliveryをまだ生成しない。

次はexplicit plan provenanceと、owned perceived receiptに基づく個人decision/first-step receipt。古い記憶で新規判断時刻をbackdateしないこと、pending judgmentを再開し直さないこと、actual motorの完全coverageとcoordinate contractは別に接続・検証する。

実測calibration、autonomous controller、全試合/Career、PlayEnd、UI/design/Presentationの完成を意味しない。既存Person/fielding/observation ownerのproduction実装は変更しない。

## 検証

CoreのREDは26 failing assertions、Nativeのmirror/direct-derive REDは7 failing assertionsで確認。Direct preflight accessorも1 failing assertionから修正した。Synthetic fixturesは本番値ではない。

- Final cloud-local focused gate: **12 files / 245 tests PASS** (7.48秒)。新規Core/Native/WALは **93 tests**、既存decision/timing、observation/fielding/Person ownerも同時に再検証
- `npm run typecheck`: PASS（catalog precheckを含む）
- Node 26、Vitest single worker、指定のcloud-local TMPDIRで実行
- Whole suiteはこのsliceでは実行せず、先行Sourceのwhole成功を流用しない。Workflow/config/lockや自宅CIは変更・起動しない

Fresh independent review: staged 8-file sliceにactionable findingなし。Calibration境界、timing合成、exact provenance、全ownership mirror、retry/reopen/WAL/archiveを確認。245-test gateは既存logで確認し、同suiteを重複実行していない。
