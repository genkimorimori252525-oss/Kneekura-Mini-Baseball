# V157 平均力データからSourceへ接続する条件

2026-10-28 JST / root / MB-20261027-REALISM-DEBUG-PLAN。

本人の「キレを変化量から分ける」「同じCoreで高速かつ正確に検証する」という直接指示と、Task4 Step5の明示version追加方針に基づく。今回は研究reader/test/データの追加に限定した通常判断で、ゲームのAPI/保存schema/既定挙動は変更していない。理由は[V157結果](../verification/realism-debug-20261027/EMPIRICAL-PHASE-DATA-V157.md)の部分データと単位・座標の未確定事項である。既存の正常な経路を広範囲に書き換える理由にはしない。

## 取得結果からの判断

- AJP Fig.4/6のgray自動読取候補は原図QAで物理入力不採用。thesis Fig.3-24のgreen/blueは原図との8特徴・再読1250点が整合した部分読取データとして保存する。両者を接合しない。
- thesis右軸は `F_L/W_B` でCLではない。左軸lbf→Nだけを換算し、動圧規格化を未取得のrho/U/Aで補わない。風速70mph/Reの範囲と資料間の違いを保存する。
- ensemble平均・フィルタ済みの周期位相データを、単球のwake履歴・瞬間force・独立white noiseとしない。lateral DCと図固有batchは未確認。周期端/欠損を暗黙に閉じない。
- 全liftをMagnus＋seamへ加算しない。支持されたtotal-transverse profileを使う場合は、明示選択時だけ既存横力を置換する。legacy省略入力は現演算順まで保持する。

## 現Sourceで対応が必要な所有箇所

read-only explorerによる調査結果を採用した。以下は接続済みの一覧ではなく、変更前の境界監査である。

| 所有箇所 | 現在の境界・必要な対応 |
| --- | --- |
| `src/core/sim/ball/BaseballAerodynamics.ts:19` | 型/validationと、公開診断219行以降、owned RK350行以降の両force経路。新profile時だけ横力置換、診断でもMagnusと誤表示しない |
| `VersionedBattedBallPhysics.ts:35` / `BaseballSeamForceV1.ts:29` | exact whitelistが未知fieldを拒否する。旧schemaへ追加値を黙って流さず、新discriminator/validationを明示する |
| `AerodynamicPitchTrajectory.ts:61` / `FreeBaseballTrajectory.ts:56` | 現在のmaterial依存判定はseamForce係数だけ。新profileにもqを配達する共通判定が必要 |
| `SourceFreeBallKernel.ts:64` | 材料姿勢必須、ground後の格子再設定、全RK段へのq伝播。元時間stepの変更と混同しない |
| `SourceFreeBallSpeedBound.ts:18` | 全phaseの力上限だけでなく、velocity/spin/phase勾配と適用domainが必要。周期端の跳び・平行軸のphase特異点を放置しない |
| `SqliteObservedInitialPitchStore.ts:159` | 現control descriptorにmaterialOrientationAtStartがなく、release加速度もqを渡さない。Native初期cutの実release基底の保存/再読を明示versionで通す必要がある |
| `CanonicalActorJsonV130.ts:19` / `PhysicalPlateAppearanceActorEvidenceFromSqlite.ts:36` | profile全体のcanonical hash/bindingを維持 |
| `SqliteBattedBallFlightStore.ts:42` / `SamePlateAppearanceBallPhysics.ts:20` | sourceVersion/profile header/保存hash/同PA継承を維持。constructorだけ追加してNative接続としない |

## 次の実行順

1. 既存Sourceの64条件（低spin倍率.02/.1/.3/1、gyro0/30/60/85度、材料位相0/90/180/270度）を別protocolへ事前固定する。V156の元descriptor、PV、重力基準、共通Trefを再利用し、caseごとの有界payloadで実行する。量差の相対5%**かつ**絶対2cmと方向5度を別々に報告し、10cm以上の量帯と微小量帯を分ける。既存モデル内での実現可能性を先に確定し、新しい測定モデルを必要とする範囲を狭める。screenで有利なseedを選ばない。
2. 測定profile側は、原図のphase/回転軸/流れの基底、完全q0に必要な独立2方向、力の単位と参照条件、欠損区間/周期端、lateral DCをそれぞれ解決済み/未確認として明示する。全般的な追加調査へ拡散せず、この入力契約を埋めるための関連資料だけ読む。
3. 支持できるdomainが決まったら、研究用の部分平均profileと実ゲームの明示新版を区別した具体差分を作る。値/勾配の有限上限と境界拒否を先にテストし、診断・RK2経路・q伝播・速度囲い・Native実phase保存/再読を同じprofile hashで接続する。範囲外を旧forceへ黙ってfallbackしない。未支持部分はUNKNOWNのまま、完成claimをしない。
4. 新model追加時は `BaseballAerodynamicV97EquivalenceV98.test.ts`、`BaseballAerodynamicImmutableV98.test.ts`、`BaseballSeamForceV1.test.ts`、`VersionedBattedBallPhysics.test.ts`、`SourceFreeBallSpeedBound.test.ts` と対応新試験を実行する。省略旧profile全recordの厳密一致、Main/実Worker/JSON再計算、観測密度/物理step感度、ground/未到達の分類を維持する。

この順序はTask4 Step5内の限定比較と接続設計であり、既定モデルを採用する承認ではない。大きなAPI/保存形式/互換性変更が必要なら、上記の対象・影響・検証/復旧を具体差分にして本人の承認条件と照合する。通常の研究tool/可逆な修正は都度承認を求めず判断を記録する。

## 検証・復旧と残件

現段階は6合成reader試験、原図8特徴、全1250点再計算、Core/Maker/元JSONのSHA不変を実検証した。旧候補01・gray不採用・全RED receiptは保持。新しいhelper/研究出力を外しても元game Source/HTMLへ影響しない。元画像・スイング・本人JSON・共有distは変更していない。

Task2/3・V154・SPIN v2の独立4技術/2種以上Gold/希少性・Native・V122/V148旧残件、性能B/9回/同版配送・SIGN命名のペナント延期を削減しない。全goal/step-007はACTIVE。記録先は既存PR #380の集約commentと通常branch内の本文で、新規Issueの乱立、force push/merge/deployは行わない。
