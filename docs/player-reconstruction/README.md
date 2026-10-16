# 選手再現部 — Historical Player Reconstruction Department

> **創設:** 2026-10-16（ユーザー提案）
>
> **状態:** DOCUMENTATION / QA DEPARTMENT ESTABLISHED。OB能力固定・複数年の全盛期データからの再構成・突出年も届き得るが毎年保証されない、という**明示されたユーザー方針**を長期保存。詳しい推計係数・年代補正・Season Expressionは**DESIGN PROPOSAL / NOT IMPLEMENTED / NOT CALIBRATED**。
>
> **対象:** Kneekura Mini Baseball（将来のNatural Baseballも同じ正史Core）。実在OB・歴史的選手、将来は現役選手の時点別再現。これは新しい試合エンジンでも、キャリア開発コードの別実装でもない。

## この部署の目的

「有名選手にSや金特を大量につける」のではなく、**本人の歴史的プレーを生み出せる因果的な能力・判断・身体技術を、出典と不確実性を持って復元する**。選手をペナントに投入しても、全盛期到達の可能性・通常年の水準・シーズン差・他選手との相対関係を損なわない。見た目の☆/0–100/G–Sは内部原因の要約にすぎない。

### 読む順番（AI必須）

1. [OB再現の確定原則と未確定事項](PRINCIPLES.md) — 固定能力、全盛期、複数年平均、成績分布。
2. [史実データからの再現手順・QAゲート](METHOD-V1-PROPOSAL.md) — 時代・リーグ・球場・打席数・相手とデータの正規化。
3. [固定能力と成績変動のモデル候補](SEASON-EXPRESSION-PROPOSAL.md) — 「調子だけ」にならない、調整可能な設計案。
4. [王貞治／全盛期の試作ケース](cases/sadaharu-oh-prime.md) — **引っ張り屋候補**と検証対象。仮査定は確定値でない。
5. 元の正本: [能力/Rating 02](../game-design/02-rules-ratings-defense.md)、[Trait正本09](../game-design/09-player-trait-catalog.md)、[Trait原則08](../game-design/08-player-traits-design-seed.md)、[育成/変化53](../game-design/53-player-development-trajectory-breakthrough-v1.md)、[既存打者・方向Intent計画](../superpowers/plans/2026-10-16-batter-directional-intent-and-spray.md)、[正史物理](../superpowers/specs/2026-09-17-causal-contact-and-individual-defense-design.md)。

## この部署が責任を持つもの

- **史実調査とEvidence**: 公式年度別データの出典・年・シーズン規則、未確認情報/不確実性の保持。
- **Prime Window**: 恣意的なベスト数年の摘み食いを避け、連続的な全盛期の観測窓を事前定義して記録する。
- **年またぎの基礎能力設定**: 実成績の単純コピーではなく、球道/スイング/選球/身体/守備など正史因果ソースを推定する。OBの基礎能力はペナント進行で変動させない。
- **成績の再現可能性**: 通常年の分布、悪い年の発生、史実に並ぶ好成績の到達可能性。最も良い記録を毎年強制せず、極端な年だけ合わせない。
- **適切な個性・Trait**: 強い引っ張り志向と引っ張り屋の技能は区別。広角打法は実技Evidenceなく自動付与しない。
- **検証**: 複数シード/複数年/リーグ条件で、生データの適合、ワンシーズンだけの過大評価、対戦条件の再現性、同一能力の固定を比較。
- **バージョン管理**: 選手テンプレ・歴史的時点・校正環境・データ版を記録。同じ人物に複数の時代プロファイルがあり得ても、ペナントの同一OBが毎年能力を書き換えることとは別。

## この部署が勝手に変更してはいけないもの

- Match Coreの投打/守備/判定物理を、OBの成績目標へ合わせて後から変更しない。
- 公開ミート/パワーの数字を直接Matchへ投入したり、HR/安打を結果抽選したりしない。
- 選手能力の「年ごと自動成長/加齢衰退」をOBの固定モードへ混入しない。
- 動的な所属リーグ相対Ratingと「OBカード能力値固定」の間にある表示仕様の未解決事項を黙って上書きしない（[PRINCIPLES](PRINCIPLES.md)）。
- 「カル・ローリーが歴史的に一発屋で確定した」等、キャリア判断を一つの突出年だけで確定しない。あくまで「単年突出ケース」の検証題材。
- 未承認のSeason Expression数式・数値係数をCANONICALに昇格させない。

## 引継ぎ・作業完了条件

すべての再現対象について、資料台帳・対象環境/年数・技能ソース対応・Trait根拠・不足資料・試作ステータス・複数年リプレイ検証を保存する。検証がない場合は **DRAFT / PROVISIONAL / NOT RUN** と書き、完成選手として配布・登録しない。

### 設計組織での位置

[AGENTS.md](../../AGENTS.md) と [AI-INDEX](../AI-INDEX.md) から本部署へ直接リンクする。実装の所有先は既存のPlayer Truth/Rating/Simulation/Fixture adapterであり、この部署は**史実再現の品質とEvidence管理の責任者**であって別の試合処理を生やす場所ではない。
