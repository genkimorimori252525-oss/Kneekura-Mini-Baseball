# Fixed OB Skills × Season Expression — Design Options / 未確定

> **状態:** DESIGN PROPOSAL / NOT IMPLEMENTED / NOT CALIBRATED（2026-10-16）。
>
> 固定OBの能力を使い、なぜ1年は突出し、別の年は大きく振るわないのかを説明する技術案。「調子を使うべきか？」への設計回答。原則本体は [PRINCIPLES](PRINCIPLES.md)。

## なぜ「当日の調子だけ」では不十分になり得るか

- OBのTrue Skillを固定したまま、単発の好不調でシーズン成績が一定程度上下することはすでにあり得る。
- しかし単年突出型の60HR級と通常年の大幅な差まで、独立した毎日のCondition抽選だけで再現しようとすると、**1日の能力変化を異常に大きくする**か、あり得ない幸運が続くモデルになりやすい。
- そこで、遅く変わる **season-spanning execution context**（数週間・数か月継続する技術再現/打撃タイミングの噛み合いなど）を検討する。ただし無根拠な「季節Buff」ではなく、実測可能な技能の発揮プロセスに限定。
- **能力の恒久値・公開OBカードは年次固定**。変わるのは短期/中期の技術発揮・対戦/役割の文脈・結果だけ。

## 原因分解（同じ原因を二度適用しない）

```text
Frozen OB true technical and physical skill + frozen style/preference
        ├── current Game/Pregame Condition (daily form)
        ├── proposed slow season-spanning execution coherence:
        │      swing timing consistency, launch/control repeatability,
        │      recognition adaptation / readiness only when causally grounded
        ├── existing current fatigue, stamina/recovery, actual health
        ├── public schedule/park/league, opposing pitchers/defenders,
        │   manager usage, matchup, scouting adaptation
        └── deterministic sampled physical pitch/bat/ball/contact variance
                          ↓
           canonical actions and official events
                          ↓
           observed seasonal HR / BB / K / AVG / defense / games
```

**危険な例**: 「疲労が増えた→日々Condition低下→同じ疲労をseasonFormに加算→スイング速度を3回下げる」。原則08の二重計上禁止に抵触する。

**望ましい実装**: 技術の正確な発揮を支配する少数の実原因（例: リリース/スイングタイミングの再現性）が時間的に相関して推移し、見た目のSeason Formがそこから必要なら導出される。同じ原因を別の隠しスカラーで再加算しない。

## 試行モデル候補（未Freeze）

1. **Daily-only baseline**: 固定Skill + 既存Condition + opponent/park/schedule + プレイのばらつき。まずこれが史実に近い年次のばらつきを自然に作るか計測。
2. **Slow-form addition only if needed**: Daily-onlyでは安定・突出の両方を再現できなければ、短期と長期の時間相関を持つ `SeasonExecutionContext` を一部の発揮ソースに導入。数週間単位の継続性、持続・回復・環境からの変化を検討。恒常Skillは不変。
3. **Context-rich alternative**: 投手陣の質、球場の広さ、打席機会、敬遠・四球の戦術、守備シフト、相手の情報適応などが年によって大きく変わるなら、slow-formを大きくする前にこれらを導入/校正。
4. **Player-specific repeatability**: 王型は、同じ高水準の実能力から高い再現性を多くの年で発揮する候補。単年突出型は、年間の技術的噛み合い/相手環境への感度が大きい候補。ただし `OB_MONSTER_YEAR=true` のような専用シーズンフラグは禁止。本人の客観的な安定性証拠が薄い場合は低confidenceのままにする。

### season context実装時の候補契約（型の例、未正式化）

```ts
type FrozenObAbility = Readonly<{
  playerId: string;
  variantId: string;           // e.g. PRIME_COMPOSITE
  sourceRevision: string;
  physicsAndSkillStateRef: string;
  defaultDecisionPolicyRef: string;
  ratingContextSnapshotRef: string; // OB card display comparison; spec pending
}>;

type SeasonExecutionContext = Readonly<{
  playerId: string;
  seasonKey: string;
  modelVersion: string;
  slowlyVaryingObservedExecutionSources: Readonly<{
    // Only source-backed motor/readiness parameters, NOT magic HR bonuses.
    timingConsistencyEstimate?: number;
    launchControlRepeatabilityEstimate?: number;
  }>;
  evidenceRefs: readonly string[];
  seedDerivationRef: string;
}>;
```

- これは後から `hitRate +X` / `homeRunsYear=60` を渡す構造ではない。
- Typeの数値は例示、確率分布・更新幅・継続期間・上限下限はいずれも **未校正**。
- 特殊能力 `野手調子極端/安定` は既存ConditionResponseSourceの表示であり、Season Expressionへ二段の追加Buffを掛けない。将来統合時は該当Sourceを一か所で解釈する。
- `ActiveEmotion` を発火させずに心理由来の隠しBuffを入力しない。未確定の「流れ」層を密かにOBの年次分布へ使わない。
- 「一発屋」らしさをひとつの新しい永久NegativeTraitにしない。個人の発揮再現性と条件下の変化から説明する。

## 実装判断ゲート

- **Gate A:** Daily-only + physical random + environmentで複数seed/複数年分布を再現できるか。可能ならSeason Contextの新変数を増やさない。
- **Gate B:** 足りないばらつきはどの技能/対戦状態か。結果出力を直接操作せず、sourceレベルの実測/合理性に戻す。
- **Gate C:** 一年だけ突出して次年に落ちる例の一部が、同じFrozenSkillで現実的な頻度で発生するか。
- **Gate D:** 同一Roster/リーグ/日程/PA数・seedで、王型の高い持続性と他の極端型の違いが人物原因から説明できるか。
- **Gate E:** 追加の中期状態が既存Condition/Fatigue/Developmentを二重加算せず、試合終了で不当に永久Buffとして保存されないか。
- **Gate F:** ユーザーの「OB能力固定」を破らず、固定OB評価カード/リーグ比較欄の意味が一貫するか。

**現時点の推奨:** **当日の調子だけ**で即完成扱いせず、まず既存手法だけのSeason Simulationを計測。それで史実の長期分散・極端な年へ届かなければ、少数の因果的な中期実行状態を追加する。これはより慎重な設計案であり、実測がない今は必須採用とはしない。
