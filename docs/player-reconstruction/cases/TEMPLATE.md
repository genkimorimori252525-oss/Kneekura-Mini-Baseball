# 選手再現部 — ケース作成テンプレート

> 状態: TEMPLATE。コピーした選手ケースは、資料調査/技能校正/テスト未完なら `PROVISIONAL / NOT CALIBRATED / NOT IN GAME` と明記する。

## 0. Person / Variant / Source

- Person ID:
- Variant ID: `PRIME_COMPOSITE`（ほかは根拠と許可が必要）
- 正式氏名、球団、投打、役割:
- 評価対象の競技/年度/基準League:
- 史実Source URL (公式優先):
- 取得日/資料の対象時点/不確実性:
- 元データの利活用条件:

## 1. ユーザーが承認したOB原則への適合

- [ ] OBの基礎True Skillと初期選手カードは年をまたいでも固定。
- [ ] 本人の全盛期が同等条件で到達可能、毎年固定記録ではない。
- [ ] 全盛期の複数年データ（可能なら連続期間）により代表能力を推計。特定最高年だけからゲームパラメータを確定しない。
- [ ] 能力差は物理/判断技能のSourceに接続し、最終打率/HRへ直接Buffしない。

## 2. Historical Evidence

| Year | G | PA | AB | H | HR | BB | IBB | SO | AVG | League/park context | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

選年ルール:
含めなかった年と理由:
史実の代表年と最高年の違い:
年月/試合数・打席数の違い:
スカウティングによる動作傾向と「実打球観測」「本人の狙い意思」を分離した証拠:
不明な情報:

## 3. Physical / Cognitive / Behavioral Player Sources（提案値と確信度）

| Source | Proposed state | Evidence | Confidence | Affected intermediate variable |
| --- | --- | --- | --- | --- |
| Contact precision | | | | |
| Raw power, transfer | | | | |
| Zone recognition | | | | |
| Swing approach | | | | |
| Pull/Center/Opposite intention | | | | |
| Direction-specific technique | | | | |
| Baserunning, defense, durability | | | | |

`○○Trait` や公開`ミートA`はSourceから導出する。Traitが史実結果を直接Buffしない。

## 4. Frozen OB presentation / Provenance

- 初期OB固定能力カード:
- 参照League population snapshot:
- Cross-league comparison policy:未確定なら未確定
- 勝手に年変動させない元Source一覧:
- Season Context案を採用したか（未採用なら理由）:
- 出典/変換Version、seed/version:

## 4.1 史実NPB環境・すべての能力とTraitの点検表（AI必須）

- 使用する [NPB 1936–2026 source atlas](../NPB-SOURCE-ATLAS-1936-2026.md)、[年度/リーグ/球場Ruleモデル](../NPB-HISTORICAL-ENVIRONMENT-MODEL.md)、[AI runbook](../AI-RECONSTRUCTION-RUNBOOK.md) と [全能力・全色Trait台帳](../PLAYER-CAPABILITY-TRAIT-ATLAS.md) の版:
- 出典の利用/再配布/内部処理権限: `LINK_REFERENCE_ONLY / LICENSED_LIMITED / APPROVED_LOCAL_USE / RIGHTS_PENDING / LICENSE_BLOCKED`。情報を見つけたことと合法的に大量インポートできることを混同しない。
- 該当年度の CompetitionSeasonKey、リーグ年次成績、球団/球場名変遷、相手質、全選手の実出場Rosterの証拠:
- Historical Era/Park/Rules/ball/打席数・相手Rosterに未確認の条件:
- 公開能力（☆、ミート、パワー、選球眼、バント、走力、盗塁、走塁、守備力、肩力、守備適性。投手なら球速・制球・変化・球種・スタミナ）を全て Source に関連づける。全数値を憶測で埋めない。
- 打者の隠し技能/行動（認識、判断、接触、アドリブ、方向/打球角、PULL/CENTER/OPPOSITE/REACTIVE、カウント別、打撃局面）を `OBSERVED / ESTIMATED / UNKNOWN` に分類:
- 投手の隠し技能（球種Arsenal、release、command、pitch quality/variance、投球tempo、牽制/クイック、疲労）:
- 守備の11 source（positionSuitability、firstStep、acceleration、battedBallRead、routeEfficiency、catching、transfer、armStrength、throwingAccuracy、situationalAwareness、tagSkill）:
- 捕手の7知能Source（該当選手のみ）、走者のリード/判断/加速/スライディング、個人のFamiliarity:
- 青/金の強み: **Trait名 / 正本09 Family / Tier / Source技能 / Evidence / GRANTED or NOT_GRANTED or UNKNOWN**:
- 赤・Negative Familyの弱点: **能力の低さと「未記録」を区別**。同Family赤TierとGold/Blueの重複を排除:
- 緑のSlow Preference（強振/ミート、積極/慎重、方向の選好、走塁/盗塁/チームプレイ等）:
- 青赤の不可分Tradeoff（採用対象がある場合）・Neutral Descriptor・REJECT/MOVEは明記:
- 標準的なCondition/Fatigue/ActiveEmotionと、固定OB True Sourceの境界:
- **歴史的に「Traitがない」ことが分かったのか、証拠がなく未判定なのか**を各Familyごとに区別:
- 機械可読な実例を別ファイルに保存する場合: [提案JSON Schema](../schemas/reconstruction-case.schema.json)。このSchemaは**研究形式の案**であり、Match Coreの人物Save Schemaや実装済み入力仕様ではない。

## 5. QA Evidence

| Gate | Status (PASS/FAIL/NOT RUN/NOT CONNECTED) | Proof / Seed / Environment |
| --- | --- | --- |
| REC-01..14 general | | |
| Player-specific prime average | | |
| Player-specific upper-tail attainable | | |
| Underperformance year attainable | | |
| Rating / Trait causality invariant | | |
| Same seed, same inputs | | |

**注意:** この書式を埋めたこと自体は試合エンジンで再現できた証拠ではない。
