# Team Mood — Baseball Decision Consequence Layer — CANONICAL v1

更新日: 2026-09-22  
状態: **CANONICAL / DESIGN FROZEN v1。2026-09-22ユーザー承認。実装前。**

> **FILENAME LEGACY NOTE**  
> ファイルパスの `-DRAFT` と旧名 `Manager Intervention Layer` は履歴上残っているだけ。
> v1ではUser向けのMood専用介入Systemを作らない。

関連:
- `docs/game-design/20-simple-surface-deep-simulation.md`
- `docs/game-design/32-roster-development-architecture-DRAFT.md`
- `docs/game-design/34-team-traits-and-relationship-network-DRAFT.md`
- `docs/game-design/35-team-trait-catalog-DRAFT.md`
- `docs/game-design/37-team-mood-architecture.md`
- `docs/game-design/49-manager-architecture-v1.md`

---

# 1. Core Product Rule — User Plays Baseball, Not Relationships

Mini BaseballのPennantは **「一見シンプルだが、奥深い。」** を守る。

Userが直接触るのは既存の野球上の面白い判断だけ。

- 打順
- スタメン / 控え
- 代打 / 代走 / 守備交代
- 投手起用 / 継投 / bullpen role
- 守備位置 / defensive assignment
- 休養 / 起用継続
- 一軍 / Reserve等の昇降格
- Training / development方針
- その他、Pennantに既に存在するBaseball / Roster / Development action

Team Moodのためだけに新しい操作系を増やさない。

---

# 2. No Mood-management Buttons

User向けには次を作らない。

- チームミーティング
- 檄を飛ばす
- 励ます
- 個別面談
- 役割を説明する
- リーダーに任せる
- 競争を促す
- ムード改善
- Mood専用の様子を見る
- weekly relationship chores
- gift / social spam

Userが一度もSocial UIを触らなくても不利益を受けない。
そもそも通常User flowにSocial maintenance UIを置かない。

---

# 3. Canonical Causal Flow

```text
User / Manager Baseball Decision
        ↓
actual world action
        ↓
affected Players observe what happened
        ↓
Player Appraisal
+ role expectation
+ personality
+ current relationship / trust
+ performance / context
        ↓
Relationship / Manager Trust / Role Harmony
+ Team Mood evidence
        ↓
background Mood evolution
```

Mood LabelやMood UIから逆向きに原因を作らない。

---

# 4. Baseball Actions Already Communicate

専用会話Buttonがなくても、実際の起用そのものがPlayerへ情報を与える。

例: Veteranを起用から外す。

```text
Veteran removed from lineup
        ↓
Player observes actual usage
        ↓
expected role + recent performance + trust + context
        ↓
acceptance / frustration / indifference
        ↓
Role Harmony / Tension / trust may change
```

同様に、若手昇格、休養、起用固定、守備位置変更、Training方針等も実際のWorld eventとして評価される。

禁止:

```text
Rest -> Mood +5
Bench veteran -> Tension +10
```

同じActionでもPlayerごとに受け取り方が違う。

---

# 5. Background Clubhouse Life

User向けButtonがなくてもBackground Simulationでは必要に応じて:

- ordinary teammate interaction
- routine manager communication
- veteran leadership
- newcomer integration
- natural conflict cooling
- ordinary support
- background disagreement

等を扱ってよい。

これは世界Simulationであり、別Game Loopではない。

---

# 6. Manager Architecture Connection

新しいMood専用Manager能力を作らない。
`49-manager-architecture-v1.md` の既存Sourceを使う。

- 采配
- 分析
- 適応
- 選手眼
- 運用
- 統率
- Philosophy
- Temperament
- Belief State
- Manager-Player Relationship

Background communication / role handling等へ差が必要な場合も既存SourceからDerivedする。

---

# 7. Human Control Overlay

`32-roster-development-architecture-DRAFT.md` のHuman Control Overlayへ接続する。

## HUMAN_OVERRIDE

UserがBaseball decisionを明示した場合、そのActionはそのまま正史Worldへ出る。
元監督のManager Skillで打順・起用判断そのものを勝手に変更しない。

## MANAGER_DELEGATED

UserがおまかせしたDomainは元監督のSkill / Philosophy / Temperament / Belief / Strategy Memoryから他CPU Managerと同じように決定する。

---

# 8. HUMAN_OVERRIDE Social Consequence Rule

HUMAN_OVERRIDEの意思決定帰属と、Worldで起きた社会的結果を分ける。

```text
User benches Veteran A
        ↓
HUMAN_OVERRIDE
        ↓
A appraises the real benching
        ↓
A's role acceptance / trust / tension may change
```

このWorld consequenceは保存する。

一方、元監督のStrategy Memoryへ「自分がこの采配を選んだ」とは記録しない。

> **Userの行動が生んだ世界の結果は正史。HUMAN_OVERRIDE自体は元監督の自己選択学習にしない。**

Userが別Clubへ移動して元監督表示へ戻っても、既に起きたRelationship / trust / role historyは消さない。

---

# 9. No Mood Diagnosis Game

UserへMood原因当てPuzzleを要求しない。
Mood内部True Stateや数値を攻略対象にしない。

Userは普通にBaseball decisionを行う。
その判断が長期的にTeamへどう響いたかを、結果・Player状態・Team Trait・News / Commentary等から感じ取れる程度でよい。

---

# 10. Passive Information Only

Team Moodを表示する場合も操作対象ではなく観測情報。

通常画面へ必須の5軸S〜G表を置かない。

候補:

```text
チーム状態: 平常
```

重大時のみ:

```text
チーム状態: 不穏
・役割面で摩擦が見られる
```

程度のpassive summaryは許可する。

表示からAction Buttonを生やさない。

---

# 11. Severity / Recovery

Mild / Moderate / Severeを固定Gameplay tierにしない。
必要ならpersistence / evidence mass / affected player count / network centrality / role importance / duration等からsignificanceをDerivedする。

また固定Recovery timerを置かない。

```text
future usage + results + repeated evidence + appraisal + time
        ↓
new social state
```

から変化する。

---

# 12. Simple Surface / Deep Simulation Contract

User Surface:

```text
lineup
pitching
defense
usage
training
roster
baseball decisions
```

Deep Simulation:

```text
relationship
trust
role acceptance
team mood
social diffusion
manager credibility
player appraisal
```

表面機能を増やさず、内部だけを深くする。

---

# 13. Acceptance Tests

1. UserはSocial / Mood専用ButtonなしでPennantを完全に遊べる。
2. 通常User flowに面談・励ます・Mood改善等のButtonが存在しない。
3. Veteranを起用から外すだけで、そのUsageをPlayerがAppraiseできる。
4. 同じ起用変更でもPlayerごとに反応が異なる。
5. 起用固定で実際のshared repsが増え、Coordinationが変化し得る。
6. Baseball decisionからMoodへDirect +X / -Xしない。
7. HUMAN_OVERRIDEは元監督能力で勝手に変更されない。
8. HUMAN_OVERRIDEが生んだRelationship / role historyはWorldに残る。
9. HUMAN_OVERRIDEは元監督Strategy Memoryへ自己選択として学習されない。
10. MANAGER_DELEGATEDでは元監督AIが通常どおり判断する。
11. Userが別Clubへ移動しても前Clubの社会Historyは巻き戻らない。
12. Team Moodはraw Contact / Power / Velocity / Fielding / direct win probabilityを変更しない。
13. passive Mood表示の有無でSimulation結果を変えない。
14. Social UIを操作しなかったことによるPenalty構造が存在しない。

---

# 14. Rejected Historical Candidate

2026-09-20 DRAFTのMood専用介入UI案は2026-09-22 user reviewで不採用。

旧候補:
- 個別面談
- 励ます
- 役割説明
- リーダー仲介
- 競争促進
- Mood対策としての休養
- Mood対策としての新戦力投入
- Mood専用の様子を見る

休養・昇降格・起用固定等のBaseball Action自体は残る。
ただしMoodを治すための重複Buttonにはしない。

---

# 15. Final v1 Status

**Team Mood — Baseball Decision Consequence Layer v1は2026-09-22にユーザー承認され、DESIGN FROZEN。**

```text
User plays baseball
        ↓
real decisions happen in world
        ↓
players appraise them
        ↓
deep Relationship / Mood simulation reacts
```

これが「一見シンプルだが、奥深い。」のTeam Mood実装境界。