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
