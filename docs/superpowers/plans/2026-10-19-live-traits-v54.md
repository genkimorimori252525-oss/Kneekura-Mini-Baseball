# 通常試合の得能接続 v54

最新の人間回答: 「通常試合で実働できる得能を接続し、残りはメーカーに未対応と明示する」。既存のメーカーの構成・通常HTML・能力Source連携に対する実装承認を継続する。実行手段の再確認や、故障／育成等の独立未実装システムへの拡張は行わない。

## 契約と範囲

一つのSourceから公開能力・得能表示・実際の判断／物理を作る。色や名称から追加倍率を掛けない。bad_ball_hittingはv53の保有と同一Sourceを維持。通常Hostに独立Sourceのない技能を似た一般能力の別名にして実装済みと呼ばない。Native習得履歴の認証ではなくローカル作成用である。7 familyを接続し、正本の残り候補は理由付きでreadonly未対応／試合能力対象外と表示する。

### 1. Source作者と段階

Files: `src/integration/browser/LiveTraitProfilesV1.ts`, new `LiveTraitAuthoringCalibrationV54.ts`, their tests. Adapter owner: spacing agent.

- `getLiveTraitCatalogV1()` はbad_ball_hitting / throw_accuracy / plate_aggression / running_aggression / fielding_aggression / pitch_approach / swing_mode_preference。editor=OWNERSHIP/PREFERENCE/GRADE、state全てlabel/color、availabilityとlocal calibrationIdを持つ。
- v1 JSONのbadball Sourceはbytes互換。未知family/state/source key、同family重複、getter、physicalとの矛盾を拒否。
- 送球はexplicit `throwDirectionStdRadians` のみで唯一の段階を再投影。Source欠落は未査定。G .065 / F .04 / E .024 / D .016 / C .010 / B .006 / A .003 / GOLD .0015rad。精度良い順の<=閾値、F/G赤・CDE中立・AB青・GOLD金。これはversion付きローカル作者用校正で、Native/実測の閾値ではない。setterは一つのSourceを置換、段階をprofileへ二重保存しない。
- 緑3種のprofile.sourceは元baselineを保存し、setterがeffective Sourceを一度だけ代入。running aggressiveはbaseline-.25を0..3へ、fielding aggressiveはbaseline*.65を.25..4へ、plate aggressive/cautiousはthresholdを-/+.12して0..1へ。balanced/nullはbaseline。plateはAUTOのみ、認識誤差やchaseMargin/強制SWINGを変えない。source省略時のbaselineはrunning .35 / fielding1 / plate threshold0, aggressionWeight.5, approachAUTO。旧読込／projectionでは明示化しない。
- `resolveLiveTraitPreferencesV54(profile?)` → `{pitchApproach:FASTBALL|BALANCED|BREAKING,swingMode:POWER|BALANCED|CONTACT}`。virtual green source={}、省略/nullはneutral。
- `reconcileLiveTraitSourcesV54({roster,playerId,changedPaths})` はbadball詳細Sourceを同期、gradeは再投影、数値を直接編集した当該green metadataを外して新しい直接Sourceを優先する。他familyを変更しない。

Test: v1 exact無変換、7family exactvalidation、送球全段階/境界/欠落/明示0、green反復編集で二重適用なし/null復元、別選手SI不変、reconcile範囲、管理Sourceの競合。

### 2. 既存実行ownerへの接続

Files: `LiveBaseballMatchV1.ts`, `LivePitchV1.ts`, new `LiveTraitPreferenceExecutionV54.test.ts`. Owner: motor agent.

- command.battingへautoを追加。managedの明示autoとunmanaged AIだけ自身のswingModeを選ぶ。明示balanced/contact/power/take/buntはhard優先。旧profile省略はbalancedの旧Sourceと同一。
- pitcherのpitchApproachをAUTO球種だけへ。4択fastball/slider/curve/changeup、neutralは旧floor(u*4)とexact、FASTBALL weights7/1/1/1、BREAKING1/3/3/3。同一乱数draw数、明示球種の既存streamを維持する。速度・spin・commandSIは不変。
- runningの既存監督±.25秒はsoft指示として維持。physicalgreenは作者が一回反映済みなのでHostは再反映しない。

Test: 管理側／相手、全hard指示、neutral/旧JSONexactprefix、pitchtypeのpaired draw分布、actual swing decisionとbat motorに到達、field/runningの既存実行Sourceへの同値性。

### 3. 全候補の表示とメーカー統合

Files: canonical由来catalog JSON、`docs/demos/baseball-maker-ui.mjs`、`tools/browser-bridge/build-maker.mjs`、両browser entry。Root（inventory agentはreadonly audit JSONのみ）。

正本のADOPT/REINTERPRET/MERGEと既存registryを照合し、未確定のID/colorは確定と呼ばない。7実働項目を状態select、その他は不足する元ownerを添えたreadonly未対応表示。MOVE/REJECTは試合能力対象外。Source descriptorは分類器／観測不足なら数値があるだけでGold等を捏造しない。

旧1badball専用UIをcatalog駆動へ拡張し、公開10／既存内部44・2tab・JSON保存形式の旧互換を維持。詳細Source変更時はreconcile。gradeは公開／詳細編集後再投影。未対応スイッチの保存・効果を偽装しない。独立単体スイング実験は不変。

Test: PC1200/390px、allstates色、送球公開値と同Source同期、green詳細編集優先、unsupported理由/disabled、JSONdownload/reload/旧packet/no-op、通常試合importと実動作。

### 4. 通常HTML・検証・公開

New v54 builder/presentation/checkers/package。v53走塁・裁定とv52カメラbytesを維持し、Managerの打撃にautoを追加（初期auto、嗜好なしは従来balancedと同一）。Sourceを固定し、関連suite＋新trait境界、globalTSC、通常9回、新Source12球・カメラ・PC390px・メーカーgameimportを検証する。実行毎のreceiptとFAIL原本を保持。Source/compiled/HTML/dataのSHA・snapshotを照合。

履歴H26／最新入口／CURRENT／AMENDMENTSと元全計画IN_PROGRESSを更新。既存branch/Draft380へcommit/push、main未merge。userAGENTS・無関係変更は除外。deps/settings/lock/secret/DB/migrationは変更しない。外部Charter承認HOLDと全原FAIL/UNKNOWNを保持する。

## Review Focus

1. gradeラベルと数値を別々に加算せず、公開／詳細編集直後に唯一のgradeになる。
2. greenのON→state変更→OFF→再ONでbaselineをeffectiveから再取得して累積させない。
3. hard指示や認識／身体SIを嗜好が上書きしない。AUTOだけの選択乱数位置を変えない。
4. 未対応catalogや偽Goldをexecprofileへ注入できない。旧Source欠落を完全精度とみなさない。
5. 旧packet読込とUI表示だけでSourceを変更しない。v53帰塁義務・裁定・closureを維持。
