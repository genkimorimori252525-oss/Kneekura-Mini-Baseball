# DIR-v2 — 実装順序と正史Motorの契約

> 2026-10-28 / [総合計画](2026-10-28-batter-contextual-direction-v2.md)  
> 状態: APPROVED DESIGN / IMPLEMENTATION PLAN / NOT IMPLEMENTED AS A WHOLE。  
> [原則・データ意味](2026-10-28-batter-contextual-direction-v2-principles.md)と[受入行列](2026-10-28-batter-contextual-direction-v2-acceptance.md)を必ず同時に読む。

## 1. 最新Sourceの切分け

- 2026-10-28公開Sourceの src/integration/browser/LivePitchV1.ts では、V79 directionWeightsからコース共通の5方向抽選を行い、指定された目標角をスイング姿勢に使っている。球の主観推定が存在しても**方向選択重み自体のコース別再評価ではない**。
- docs/agent-decisions/2026-10-28-first-pitch-direction-v160.md は初球の自然AUTO、V122/V153、主観観測、元Clipと実接触を別に調査。docs/agent-decisions/2026-10-28-reactive-registration-v161.md はREACTIVEへの主観観測Motor適用を計画・限定検証。後続の実Sourceとreceiptを確認するまで完成と断言しない。
- src/core/world/psychology/batting/、src/core/sim/pitching/CourseAwareSwingKinematicsV1.ts、src/core/sim/contact/{ReferenceBatKinematicsV1,RigidBatBallContact,SwingKinematicsV1}.ts 等の既存Ownerを調査入口にする。**BATが所有する一つのBatterApproachPolicy/意思履歴/軌道Controllerへ結線**し、第二Engine/Contact Solverを作らない。
- 実装前に実PCのgit status、worktree、他担当・未commit、PR#380最新head/既存Source pinを確認する。旧FAIL/証拠を消さず、並行担当のファイルを上書きしない。

## 2. 一球の時系列

1. **投球前**: 長期Direction Preference、独立したSWING/TAKE・POWER/CONTACT方針、主観的な球種×コースBelief、Count、走者/守備認識、受諾した監督指示から暫定準備。
2. **投球観測**: 本人に配達済みの時刻付き位置・速度・変化/到達時刻の主観予測で更新。実投球の未来状態や捕手の真のPitchCallを読まない。
3. **候補評価**: AIMED(PULL/CENTER/OPPOSITE)かREACTIVEを、本人の長期好み、主観コース/球速、可能な接触窓、切替費用、戦術利益、残時間に応じて評価。固定5方向ガチャや「内角→PULL、外角→OPPOSITE」決定則は禁止。
4. **選択/保持/変更**: 意思と理由を時刻付き保存。証拠が増えれば再評価できる。無意味な毎tick再抽選による方向乱高下禁止。exact 0は通常方針で維持、明示受理overrideだけ別ソース。
5. **MotorTarget**: 方向目標を許容する接触時刻帯・打点・バット面/3D姿勢・grip/tip・努力/コンパクトさ・速度希望へ変換。REACTIVEも球道観測から実Motorを選択。角度一点へのスナップはしない。
6. **Actual Motor**: 始動済みの姿勢/速度、可動域、加減速、慣性と残り時間を守り、過去ではなく未来の軌道だけを修正。成功も未達も実時系列で生じる。
7. **Contact→Flight**: 同一Canonical時間の実球・実バットの衝突から射出速度/方向/回転を算出。ファウル/空振り/弱打/強い打球/公式結果を事後抽選しない。
8. **記憶と次球**: 観測→Intent→Motor→実Contact→Officialを別権限で保存。同一seed連続打席をリプレイできる。

## 3. 途中修正の物理

- スイング開始前と開始後の両方に変更窓を設けるが、**更新時刻・実行可能な身体運動・残り時間**が境界。急な姿勢反転、速度/角速度/加減速の無限上昇、時間遡行を禁止。
- **内角流し**はバット面・内側から通す軌道・衝突位置を試す。**外角引っ張り**も面・接触時刻・外まで届く姿勢から試す。Intent自体は許され、物理的に難しければ部分修正・失敗もあり得る。
- 流し=常に振り遅れ、流し=常に減速、引っ張り=常に強振、コンパクト=必中という固定式を設けない。
- 既存の実測Clip、有限yaw/arc登録、剛体バット・有効質量、身体/バット速度上限、衝突時のバット姿勢を再利用。**成功フラグでヒット、失敗フラグで凡打を作ることは禁止**。
- 技術Sourceは実行時のタイミング/面/軌道・修正精度にだけ寄与。本人の好みやTrait文字列、公開Power/Contactを結果の直接倍率にしない。

## 4. 実装フェーズと出口

| Phase | 実施 | 受け入れ |
| --- | --- | --- |
| A Owner & baseline | 最新worktree/Source/他AI担当、V79/V122/V153/V160/V161/Native、旧trace/失敗を照合 | 真の対象と未実装範囲を特定 |
| B Conditional Choice | 本人Preference＋主観コース/Context→同一BatterPolicyで条件付き選択 | 同一人でコース変更→判断変化。固定ガチャ禁止 |
| C Evidence/History | 主観観測、選択・変更時刻、理由、REACTIVEと固定方針を追跡 | 未来球を読まず、過去を巻戻さない |
| D Bounded Motor | 目標面/接触窓/努力量→既存実Motorを部分修正 | actual pose/velocityで成功/未達を示せる |
| E Contact | Native接触→BallFlight→守備/走塁/公式記録を一つに接続 | 意図と結果が分離、物理重複なし |
| F Compatibility | Manager49/Scouting/Maker/63/9/5/Save/PNG/旧roster | 意味と版を保った移行・回帰 |
| G Verification | DCA-01..40＋既存BAT/DIR/SWG/CATCH関連回帰 | 同seed、連続球、実試合、性能の実測を区別 |
| H Publication | Source/設計/証拠/失敗・復旧手順とGitHub反映を再照合 | 無断main mergeなし、未実証は明記 |

**実測のない係数はUNKNOWN/ESTIMATEDのまま**。速度、接触窓、視覚遅延などへ無根拠な世界共通閾値を導入しない。実装不能部分はNOT CONNECTED、実行未確認はNOT RUNとして報告する。

## 5. 互換・監督・追跡

- 旧メーカーの5方向は世界方位（左/左中間/中/右中間/右）と実打球統計。PULL/CENTER/OPPOSITEは打者相対Intent。右左とversionを確認しない黙示変換禁止。旧値・Save・JSONは保全、未設定はREACTIVE。検証用の指定目標角は実試合の自律Intentと区別。
- 63コースの主観認識、公開9、5方向実績、17得能/個別能力、シーズン/練習、原673軌道、3HTML・承認済PNGの保存・回帰を維持。表示は結果を計算しない。
- Managerの流し/引っ張り指示はSoft/Hardの理解・受諾を通し、本人Slow Preferenceは不変。守備は実打球/フォームから推定し、Private Intentを読まない。
- 開発者traceにseed、pitch ordinal/count、本人の主観Beliefと観測時刻、候補評価、前後Intent/変更理由、MotorTargetと実grip/tip/面/速度、実Contact、連続射出角/回転、Officialを分離記録。情報欠落を推測で埋めずNOT_OBSERVED/NOT_EXPOSED。診断用乱数で本体消費を変えない。

**完成宣言は実バット軌道の途中修正と内角流し・外角引っ張りの物理的再現が、真の試合経路で証明できてから。単球fixtureや本文登録だけでは未完成。**