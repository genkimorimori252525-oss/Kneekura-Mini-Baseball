# Team Trait Catalog — DRAFT

更新日: 2026-09-20  
状態: **初期カタログ設計。USER REVIEW REQUIRED。実装前。名称・閾値は調整可能。**

関連:
- `docs/game-design/08-player-traits-design-seed.md`
- `docs/game-design/09-player-trait-catalog.md`
- `docs/game-design/34-team-traits-and-relationship-network-DRAFT.md`
- `docs/game-design/05-psychology-emotion.md`

---

# 1. Catalog Contract

Team TraitはBlue / Red / Goldの3色。

```text
Blue
 = favorable temporary team state

Red
 = unfavorable temporary team state

Gold
 = master tier of a Blue family
```

Team Trait名そのものをMatch resultの原因にしない。

必ず:

```text
evidence / relationship / coordination / recent history
        ↓
underlying team state
        ↓
Team Trait label
        ↓
causal intermediate variables
        ↓
actual play
```

を通す。

---

# 2. Scope

各Traitは対象範囲を持つ。

- `TEAM_ALL`
- `BATTING_UNIT`
- `PITCHING_UNIT`
- `DEFENSE_UNIT`
- `PAIR`
- `CLUSTER`
- `CONTEXTUAL_ELIGIBLE`

Team Traitだからといって全選手へ作用させない。

---

# 3. Duration

- `SHORT`: 数日〜3週間
- `MEDIUM`: 1〜3か月
- `SEASON`: 今季終了まで
- `EVIDENCE_BASED`: underlying evidenceが維持される限り

恒久Traitは原則作らない。

---

# 4. Blue — Batting / Rally / Relationship

| UI名 | Family | Scope | 主なEvidence | 因果的な作用 | Duration |
| --- | --- | --- | --- | --- | --- |
| 打線連鎖 | rally_chain | BATTING_UNIT | 連続出塁・連続得点・positive contagion | 前打者成功を前向きにAppraiseしやすい | SHORT |
| 呼応打線 | batting_resonance | CLUSTER | 好感・信頼の高い打者群 + shared success | 各打者が自分の得意Channelを出しやすい | MEDIUM |
| 連弾の気配 | power_resonance | PAIR / CLUSTER | Power-compatible打者同士の共有成功 | teammate HR後に既存Power approachへの迷いが減る | SHORT |
| 好機必打 | clutch_confidence | CONTEXTUAL_ELIGIBLE | 得点圏・高Leverageでの反復成功 | pressureをpositive appraisalしやすい | MEDIUM |
| 逆境オーラ | comeback_confidence | TEAM_ALL | 逆転・追いつき成功の蓄積 | ビハインド時に恐怖よりやる気へ寄りやすい | MEDIUM |
| 追撃の波 | followup_pressure | BATTING_UNIT | 得点直後の追加得点成功 | 得点直後のpositive contagionが残りやすい | SHORT |
| 終盤集中 | late_focus | CONTEXTUAL_ELIGIBLE | 終盤接戦での反復成功 | late-game pressure appraisal安定 | MEDIUM |
| 初回攻勢 | early_attack_confidence | BATTING_UNIT | 初回の良い攻撃履歴 | 試合入りで積極性が出やすい | SHORT |
| 先頭出塁の波 | leadoff_momentum | BATTING_UNIT | 先頭出塁後の得点成功 | 先頭成功が後続へpositive cueになりやすい | SHORT |
| つなぎの意識 | chain_offense | BATTING_UNIT | 進塁打・選球・役割遂行の成功 | selfish swingよりrole-consistent choiceを取りやすい | MEDIUM |
| 代打陣の信頼 | bench_bat_trust | CLUSTER | 代打成功 + role clarity | 代打時の不安・迷いが減りやすい | MEDIUM |
| 新戦力歓迎 | newcomer_integration | CLUSTER | 新加入選手への高い好感・信頼形成 | 新加入本人のpositive appraisalを助ける | SHORT / MEDIUM |

---

# 5. Blue — Pitching / Bullpen / Battery

| UI名 | Family | Scope | 主なEvidence | 因果的な作用 | Duration |
| --- | --- | --- | --- | --- | --- |
| 鉄壁リリーフ陣 | bullpen_confidence | PITCHING_UNIT | 救援陣の反復成功・role clarity | 終盤登板時のpressure appraisal安定 | MEDIUM |
| 火消し連鎖 | inherited_runner_confidence | PITCHING_UNIT | 火消し成功の蓄積 | 緊急登板時に焦りにくい | SHORT |
| 継投呼応 | bullpen_handoff | PITCHING_UNIT | 継投役割の安定・catcherとの共有経験 | warm-up / role transitionの迷い低減 | MEDIUM |
| 守護神への信頼 | closer_trust | TEAM_ALL | closerの長期成功 + teammates trust | 終盤リード時の守備側不安を抑えやすい | MEDIUM |
| バッテリー結束 | battery_trust | PAIR / CLUSTER | catcher-pitcher trust + shared reps | サイン受容・配球合意・立て直しが速い | EVIDENCE_BASED |
| 先発の安心感 | starter_support_trust | TEAM_ALL | 先発陣の安定 + defense trust | 先発登板時の過剰な早期不安を抑える | MEDIUM |
| 立て直し上手 | pitching_reset | PITCHING_UNIT | 失点後の回復成功 | 失点Event後のnegative emotion継続が短い | MEDIUM |
| 四球後の切替 | post_walk_reset | PITCHING_UNIT | walk後の成功したreset経験 | 四球を連鎖的焦りへ変えにくい | MEDIUM |

---

# 6. Blue — Defense / Coordination

| UI名 | Family | Scope | 主なEvidence | 因果的な作用 | Duration |
| --- | --- | --- | --- | --- | --- |
| 守備連携 | defense_coordination | DEFENSE_UNIT | shared reps・trust・coordination | responsibility resolution / call timing改善 | EVIDENCE_BASED |
| 二遊間連携 | middle_infield_coordination | PAIR | 2B-SS shared reps | feed timing・base cover予測が安定 | EVIDENCE_BASED |
| 外野連携 | outfield_coordination | CLUSTER | OF shared reps・call familiarity | お見合い回避・優先権解決が早い | EVIDENCE_BASED |
| 中継網 | relay_coordination | DEFENSE_UNIT | cut-off repetition | 中継位置・二次送球準備の同期 | EVIDENCE_BASED |
| バント守備統率 | bunt_defense_coordination | DEFENSE_UNIT | bunt-defense rehearsal + success | charge / cover責任の確定が速い | MEDIUM |
| 挟殺連携 | rundown_coordination | DEFENSE_UNIT | rundown shared reps | throw timing / lane responsibility安定 | EVIDENCE_BASED |
| 走者警戒網 | runner_control_coordination | DEFENSE_UNIT | pitcher-catcher-infield coordination | 牽制・cover・盗塁警戒の共有判断改善 | MEDIUM |
| 一点防衛 | run_prevention_focus | DEFENSE_UNIT | 終盤一点差を守った経験 | high leverageでcommunicationが乱れにくい | MEDIUM |
| 声掛け徹底 | communication_discipline | DEFENSE_UNIT | clear calls / leadership evidence | ambiguous ballへのcall delayを減らす | MEDIUM |
| 新布陣順応 | alignment_adaptation | DEFENSE_UNIT | 新しい守備配置への反復成功 | unfamiliar shiftでrole confusionを抑える | SHORT / MEDIUM |

---

# 7. Blue — Context / Environment / Preparation

| UI名 | Family | Scope | 主なEvidence | 因果的な作用 | Duration |
| --- | --- | --- | --- | --- | --- |
| ホームの鬼 | home_familiarity | TEAM_ALL | home routine / park familiarity / crowd comfort | home環境をpositiveにAppraiseしやすい | SEASON |
| デイゲーム巧者 | day_game_adaptation | TEAM_ALL | daytime routineへの適応 | visual / schedule adaptation安定 | SEASON |
| ナイター巧者 | night_game_adaptation | TEAM_ALL | night routineへの適応 | sleep / preparation rhythmの安定 | SEASON |
| 遠征慣れ | travel_adaptation | TEAM_ALL | travel schedule経験 | away routine disruptionを抑える | SEASON |
| 初見対応 | unfamiliar_opponent_prep | BATTING_UNIT | scouting / video / first-exposure success | 初対戦投手へのrecognition uncertaintyを早く縮める | MEDIUM |
| データ共有 | shared_preparation | TEAM_ALL | scouting情報の共有・採用成功 | preparation evidenceのteam diffusionが速い | MEDIUM |
| 大観衆慣れ | crowd_pressure_adaptation | TEAM_ALL | 大観衆下での反復経験 | crowd由来EmotionPressureを過剰化しにくい | SEASON |
| 雨天集中 | weather_adaptation | TEAM_ALL | wet-game preparation / experience | routine disruptionへの適応 | SHORT / SEASON |
| 首位攻防慣れ | pennant_pressure_adaptation | TEAM_ALL | title-race経験 | standings pressureへの過剰反応を抑える | MEDIUM |
| カード勝ち越し | series_confidence | TEAM_ALL | series後半での立て直し成功 | 同カード内のrecent resultを前向きに処理 | SHORT |
| 連敗ストッパー | skid_reset | TEAM_ALL | losing streakを止めた経験 | 敗戦Memoryのteam-wide持続を短くする | SHORT / MEDIUM |

---


### Derived Synchrony Descriptor

以下はBlue表示だが追加効果を持たない。

| UI名 | Family | Scope | 主なEvidence | 因果的な作用 | Duration |
| --- | --- | --- | --- | --- | --- |
| 投打好循環 | team_synchrony | TEAM_ALL | game-level offense/pitching alignment | **DESCRIPTOR_ONLY**: 投打が同じ日に噛み合っている状態の要約 | SEASON_ONLY |

# 8. Gold — Master Team Traits

GoldはBlue Familyの最高Tier。

| UI名 | Blue Family | Scope | Goldとして必要なUnderlying State | 因果的な表現 |
| --- | --- | --- | --- | --- |
| 共鳴砲 | power_resonance | PAIR / CLUSTER | Power-compatible pair + 極高好感/信頼 + shared HR success | teammate HRを自分のPower approachへの強いpositive cueにする |
| 黄金打線 | rally_chain | BATTING_UNIT | 打線全体のpositive contagion networkが非常に強い | successが複数打者へ自然に波及しやすい |
| 不屈の逆転劇 | comeback_confidence | TEAM_ALL | 長期にわたる逆境成功 + 高いcollective confidence | ビハインドでnegative appraisalへ崩れにくい |
| 勝負所の結束 | clutch_confidence | TEAM_ALL | 高Leverageで複数Unitが安定 | pressure時のteam appraisalが非常に安定 |
| 鉄壁ブルペン | bullpen_confidence | PITCHING_UNIT | role clarity / trust / successが極高 | 終盤救援陣のpressure resetが速い |
| 阿吽のバッテリー | battery_trust | PAIR | pitcher-catcher間の極高trust/coordination | サイン・修正・意図共有のlatencyが極小 |
| 鉄壁連携 | defense_coordination | DEFENSE_UNIT | 守備Unit全体のshared reps / trust / coordination極高 | responsibility conflictがほぼ起きない |
| 阿吽の二遊間 | middle_infield_coordination | PAIR | 2B-SSの長期高連携 | feed / cover / turn timingが非常に安定 |
| 完全中継網 | relay_coordination | DEFENSE_UNIT | OF-IF relay coordination極高 | cut-off chainの判断・準備が高速 |
| 本拠地要塞 | home_familiarity | TEAM_ALL | home environment adaptation極高 | home routine / crowd / park familiarityが非常に安定 |
| 初見看破 | unfamiliar_opponent_prep | BATTING_UNIT | scouting + adaptationが極高 | 初対戦でもrecognition uncertaintyを速く縮める |
| 遠征巧者 | travel_adaptation | TEAM_ALL | travel routine / recovery / preparation極高 | away disruptionを最小化 |
| 鉄の切替 | skid_reset | TEAM_ALL | defeat reset / mental stability / leadership極高 | 連敗・大敗Memoryを翌戦へ持ち越しにくい |

---

# 9. Red — Batting / Offensive Pressure

| UI名 | Family | Scope | 主なEvidence | 因果的な悪影響 | Duration |
| --- | --- | --- | --- | --- | --- |
| タイムリー欠乏症 | scoring_pressure | BATTING_UNIT | 得点圏での反復失敗 | 得点圏で焦り / 打ち急ぎAppraisalが出やすい | SHORT / MEDIUM |
| あと一本病 | finishing_pressure | BATTING_UNIT | 走者を置いて無得点が反復 | inning終盤ほどfailure expectationが強くなる | SHORT |
| 満塁硬直 | bases_loaded_pressure | CONTEXTUAL_ELIGIBLE | 満塁失敗の蓄積 | bases loadedで過剰pressureを受けやすい | MEDIUM |
| 追撃失速 | followup_anxiety | BATTING_UNIT | 得点後に追加点を逃す反復 | positive contagionが途切れやすい | SHORT |
| 連打断絶 | rally_fragility | BATTING_UNIT | rally中の焦り・強引な打撃が反復 | teammate successを自分の型へ翻訳しにくい | SHORT |
| 初回沈黙 | early_game_hesitation | BATTING_UNIT | early inningでの消極的入り | 初回のdecision commitmentが遅れやすい | SHORT |
| 終盤焦燥 | late_batting_anxiety | BATTING_UNIT | late close-game failures | 終盤で焦り / 強引さが発火しやすい | MEDIUM |
| 代打硬直 | pinch_hit_anxiety | CLUSTER | 代打陣の失敗・role不明確 | 代打時のdecision commitmentが不安定 | MEDIUM |

---

# 10. Red — Pitching / Bullpen

| UI名 | Family | Scope | 主なEvidence | 因果的な悪影響 | Duration |
| --- | --- | --- | --- | --- | --- |
| 終盤恐怖症 | late_pitching_anxiety | PITCHING_UNIT | blown lead / late loss蓄積 | 終盤接戦でnegative emotionが発火しやすい | MEDIUM |
| ブルペン不信 | bullpen_trust_breakdown | TEAM_ALL | 救援失敗の反復 | lead時も守備側が不安を抱えやすい | MEDIUM |
| 守護神不安 | closer_trust_breakdown | TEAM_ALL | closerの反復失敗 | 9回リード時のcollective expectation悪化 | SHORT / MEDIUM |
| 四球連鎖 | walk_spiral | PITCHING_UNIT | walk後の崩れ反復 | walkを次打者への焦りへ持ち越しやすい | SHORT |
| 継投迷走 | bullpen_role_confusion | PITCHING_UNIT | role変更・準備不足・連携失敗 | warm-up / role expectation / handoffが不安定 | MEDIUM |
| 火消し恐怖 | inherited_runner_anxiety | PITCHING_UNIT | inherited runnerでの失敗蓄積 | 緊急登板時のpressureが過大化 | MEDIUM |
| 失点引きずり | post_run_spiral | PITCHING_UNIT | 失点後の連続失点 | resetが遅れ、negative appraisalが残る | SHORT |
| バッテリー不信 | battery_distrust | PAIR | pitch-call conflict / repeated communication failure | サイン受容・修正判断が遅れる | EVIDENCE_BASED |

---

# 11. Red — Defense / Coordination Failure

| UI名 | Family | Scope | 主なEvidence | 因果的な悪影響 | Duration |
| --- | --- | --- | --- | --- | --- |
| お見合い注意報 | fielding_ambiguity | DEFENSE_UNIT | shared call不足・新布陣 | fly-ball responsibility resolution遅延 | SHORT / MEDIUM |
| 二遊間ぎこちない | middle_infield_miscoordination | PAIR | low shared reps / trust | feed / cover timingがズレやすい | EVIDENCE_BASED |
| 外野譲り合い | outfield_hesitation | CLUSTER | low communication familiarity | call優先権が決まらずhesitation | EVIDENCE_BASED |
| 中継混線 | relay_confusion | DEFENSE_UNIT | relay失敗・role ambiguity | cut-off location / next throw preparation遅延 | MEDIUM |
| バント守備迷子 | bunt_defense_confusion | DEFENSE_UNIT | bunt coverage失敗 | charge / cover assignment決定が遅い | SHORT / MEDIUM |
| カバー遅れ | cover_breakdown | DEFENSE_UNIT | backup responsibility失敗 | secondary coverage startが遅れる | MEDIUM |
| 挟殺ぎこちない | rundown_confusion | DEFENSE_UNIT | rundown失敗 | throw / lane交代timing不安定 | MEDIUM |
| 声掛け不足 | communication_breakdown | DEFENSE_UNIT | call不足 | ambiguity resolutionが遅れる | MEDIUM |
| 新布陣混乱 | alignment_confusion | DEFENSE_UNIT | position changes / shifts導入直後 | unfamiliar alignmentでreplanning遅延 | SHORT |

---

# 12. Red — Pennant / Context / Environment

| UI名 | Family | Scope | 主なEvidence | 因果的な悪影響 | Duration |
| --- | --- | --- | --- | --- | --- |
| サヨナラ負け癖 | walkoff_anxiety | TEAM_ALL | repeated walk-off losses | away late tied gameで「またか」が出やすい | MEDIUM |
| 逆転負け癖 | blown_lead_anxiety | TEAM_ALL | repeated blown leads | lead縮小時のnegative expectation増加 | MEDIUM |
| 連敗病 | losing_streak_pressure | TEAM_ALL | losing streak + close losses | negative contagionが強くpositive resetが弱い | SHORT |
| 5割の壁 | threshold_pressure | TEAM_ALL | .500接近時の失敗反復 | symbolic standings thresholdでpressure増加 | MEDIUM |
| 初物苦手 | unfamiliar_opponent_anxiety | BATTING_UNIT | unseen starterへの準備不足 | 初見recognition uncertaintyが長く残る | MEDIUM |
| ビジター萎縮 | away_pressure | TEAM_ALL | away environmentでのnegative reaction | crowd / routine disruptionを重く受けやすい | SEASON |
| デイゲーム苦手 | day_game_maladaptation | TEAM_ALL | daytime routine failure | visual / sleep schedule adaptation不安定 | SEASON |
| 遠征疲れ | travel_disruption | TEAM_ALL | travel / recovery不全 | routine・集中の再構築が遅い | SHORT |
| 大観衆萎縮 | crowd_anxiety | TEAM_ALL | large crowdでのnegative emotion | crowd pressureを過剰Appraise | MEDIUM |
| カード取りこぼし | series_closeout_anxiety | TEAM_ALL | series優位からの失敗反復 | series終盤で勝ち急ぎが出やすい | SHORT |
| 首位攻防硬直 | pennant_race_anxiety | TEAM_ALL | title-raceでの反復失敗 | standings leverageを重く受けすぎる | MEDIUM |
| 新戦力ぎこちない | newcomer_integration_delay | CLUSTER | trust / coordination形成不足 | newcomerとの共同作業だけcoordination低下 | SHORT / MEDIUM |

---


### Derived Synchrony Red Descriptors

以下はRed表示だが、Trait自体から悪影響を追加しない。

| UI名 | Family | Scope | 主なEvidence | 因果的な悪影響 | Duration |
| --- | --- | --- | --- | --- | --- |
| 投打不協和 | team_synchrony | TEAM_ALL | negative game-level alignment residual | **DESCRIPTOR_ONLY**: 投打の成功日が噛み合っていない状態の要約 | SEASON_ONLY |
| 好投見殺し | wasted_pitching_gems | TEAM_ALL | strong run prevention + repeated low support | **DESCRIPTOR_ONLY**: 好投が勝利へ変換されない傾向の要約 | SEASON_ONLY |
| 援護空回り | squandered_run_support | TEAM_ALL | high run support + repeated high runs allowed | **DESCRIPTOR_ONLY**: 得点した試合で投手側が崩れる傾向の要約 | SEASON_ONLY |

# 13. Family Exclusivity

同一FamilyのBlue / Gold / Redを同時に作用させない。

例:

```text
rally_chain
  Red: 連打断絶
  Blue: 打線連鎖
  Gold: 黄金打線
```

```text
bullpen_confidence
  Red: ブルペン不信
  Blue: 鉄壁リリーフ陣
  Gold: 鉄壁ブルペン
```

```text
defense_coordination
  Red: 声掛け不足 / coordination breakdown
  Blue: 守備連携
  Gold: 鉄壁連携
```

ただし異なるFamilyのTraitは同時に存在できる。

---

# 14. Pair / Cluster Gold Traits

Gold Team Traitは全チームに均等に配らない。

特にRelationship-derived GoldはPAIR / CLUSTERを積極的に使う。

例:

```text
A: Power hitter
B: Power hitter

Affinity high
Trust high
Shared success high
Power compatible

        ↓
Gold: 共鳴砲
Scope = [A, B]
```

BがContact型なら:

```text
共鳴砲 eligibility = false
```

だが、別のContact系Blue / Gold Familyへ進める余地を残す。

---

# 15. Dark Era Pattern

「暗黒期」は独立Traitにしない。

例:

```text
連敗病
+ タイムリー欠乏症
+ ブルペン不信
+ お見合い注意報
+ 逆転負け癖
        ↓
UI / Commentary:
「チーム全体に重い空気」
「暗黒期の様相」
```

これはDerived Narrative。

`暗黒期 -> 全能力-10`は禁止。

---

# 16. Acquisition / Loss Principle

Team Traitは結果一発で即付与しない。

候補Evidence:

- repeated event
- relation / trust / coordination
- current roster continuity
- recent success / failure memory
- role stability
- preparation quality
- manager / tactical continuity
- environment adaptation

消失:

- opposite evidence
- roster turnover
- manager change
- role change
- time decay
- meaningful success / failure reset

---

# 17. Anti-cheese / Anti-frustration Rules

1. Red TraitはBase Contact / Power / Velocityを直接下げない。
2. Blue / GoldもBase Ratingを直接上げない。
3. Result probabilityへ直接加算しない。
4. Relationship由来Negative Batting Debuffは禁止。
5. Low coordinationの悪影響は共同作業へ限定。
6. One bad gameでRed Traitを乱発しない。
7. One good gameでGold Traitを取得しない。
8. 同じEventを複数Familyへ無制限二重計上しない。
9. CPUも同じ取得・消失ルール。
10. Traitの説明から「なぜ付いたか」を追跡可能にする。

---

# 18. Progressive UI

通常画面:

```text
チーム得能

[金] 共鳴砲
     王・長嶋型のPower-compatible pairが
     仲間の本塁打を強い刺激として受ける
     対象: #3 / #4
     状態: 発動中

[青] 鉄壁リリーフ陣
     終盤登板時の救援陣が落ち着きやすい
     残り: 24日

[赤] タイムリー欠乏症
     得点圏で悪い期待が広がりやすい
     状態: 衰退中
```

詳細画面のみ:

- source evidence
-対象Player / Unit
- acquired date
- projected expiry
- underlying relation / coordination summary

を確認可能。

---

# 19. Catalog Size v1

初期カタログ候補:

- Blue: 42
- Gold: 13
- Red: 40

合計 **95 Team Trait候補**。

最終採用時に重複Familyを整理し、名前を調整してよい。

---

# 20. Review Points

ユーザーと今後詰める点:

1. 名称の好み
2. Goldの数を増減するか
3. Pair / Cluster Traitをどこまで増やすか
4. 打撃Resonanceのlineup distance条件
5. Team Moodと重なるTraitをどこまでTeam Trait側へ残すか
6. 「暗黒期」をNarrativeだけにするか、UI上のDerived Badgeを出すか
7. Durationの具体的な日数 / Evidence閾値

---

# 21. Season Boundary Policy

Team TraitはSeason終了時に一律resetしない。

ただし「Trait表示」と「Underlying Evidence」を分離する。

```text
Trait Label
 !=
Relationship / Coordination / Adaptation / Memory
```

Season BoundaryではTraitごとに次の3Policyを使う。

## 21.1 CARRYOVER_ELIGIBLE

翌SeasonへTrait自体を持ち越せる。

条件:

- sourceがRelationship / Coordination / persistent adaptation
- 対象Player / Unitが維持される
- roleが大きく崩れていない
- underlying evidenceが閾値以上

代表:

- 呼応打線
- 共鳴砲
- バッテリー結束
- 阿吽のバッテリー
- 守備連携
- 二遊間連携
- 阿吽の二遊間
- 外野連携
- 中継網
- 完全中継網
- 挟殺連携
- 走者警戒網
- 声掛け徹底
- 本拠地要塞
- 遠征巧者

Red側では:

- バッテリー不信
- 二遊間ぎこちない
- 外野譲り合い
- 新戦力ぎこちない

等の**実際の人間関係 / coordination問題**だけ持ち越し可能。

重要:

```text
same roster / same pair / same role
 -> carryover possible

player leaves / role changes / unit broken
 -> re-evaluate immediately
```

---

## 21.2 REVALIDATE_NEXT_SEASON

Underlying Evidenceは持ち越すが、Trait Labelはいったん非Activeへ戻す。

Preseason / Opening weeksで再確認し、条件を満たせば早期復活できる。

対象:

- role confidence
- organizational preparation
- environment adaptation
- bullpen trust
- lineup identity
- routine familiarity

代表Blue / Gold:

- 鉄壁リリーフ陣
- 継投呼応
- 守護神への信頼
- 先発の安心感
- 立て直し上手
- 四球後の切替
- 黄金打線
- 鉄壁ブルペン
- 勝負所の結束
- 鉄の切替
- ホームの鬼
- デイゲーム巧者
- ナイター巧者
- 遠征慣れ
- 初見対応
- 初見看破
- データ共有
- 大観衆慣れ
- 首位攻防慣れ

代表Red:

- ブルペン不信
- 守護神不安
- 継投迷走
- 初物苦手
- ビジター萎縮
- デイゲーム苦手
- 大観衆萎縮
- 首位攻防硬直

これらは:

```text
2026 season evidence
 -> retained partially
 -> 2027 preseason revalidation
 -> may return quickly
```

とする。

「去年そうだったから今年も自動発動」にはしない。

---

## 21.3 SEASON_ONLY

Season終了でTrait Labelを強制終了。

原則として翌SeasonへActive状態を持ち越さない。

対象:

- streak
- current-season momentum
- current-season scoring pressure
- current-season comeback confidence
- symbolic standings pressure
- short-term fatigue / travel disruption

代表Blue:

- 打線連鎖
- 連弾の気配
- 好機必打
- 逆境オーラ
- 追撃の波
- 終盤集中
- 初回攻勢
- 先頭出塁の波
- つなぎの意識
- 代打陣の信頼
- 火消し連鎖
- 一点防衛
- カード勝ち越し
- 連敗ストッパー
- 不屈の逆転劇

代表Red:

- タイムリー欠乏症
- あと一本病
- 満塁硬直
- 追撃失速
- 連打断絶
- 初回沈黙
- 終盤焦燥
- 代打硬直
- 終盤恐怖症
- 四球連鎖
- 火消し恐怖
- 失点引きずり
- サヨナラ負け癖
- 逆転負け癖
- 連敗病
- 5割の壁
- 遠征疲れ
- カード取りこぼし

新Seasonは新しいPennant Storyとして始める。

---

# 22. Offseason Echo

SEASON_ONLYでも、内部Memoryを完全消去する必要はない。

ただし翌年へ**Traitとしては持ち越さない**。

候補:

```text
Season ends
 -> active Team Trait expires
 -> 10〜30%程度のlatent memoryだけ残る場合がある
 -> Opening weeksの新Evidenceで上書きされやすい
```

例:

```text
2026: サヨナラ負け癖
season end -> Trait expires

2027 opening month:
  no walk-off losses
    -> latent memory disappears quickly

  repeated walk-off losses again
    -> reacquisition threshold becomes slightly easier
```

これにより「去年の悪夢を少し引きずる」は可能だが、Opening Dayから赤Traitを背負わせない。

---

# 23. New Season Reset Philosophy

新Seasonは心理的に一定のresetを与える。

特にRed Team Traitは:

> 去年弱かったから今年も最初から弱い

を禁止する。

したがって:

```text
performance-derived Red
 -> Season endでActive解除

relationship / coordination-derived Red
 -> 当事者関係が変わらなければcarryover可

organizational / routine Red
 -> revalidate
```

とする。

---

# 24. Roster Turnover Effects

Season跨ぎのTrait維持にはRoster Continuityを必ず見る。

例:

```text
Gold: 共鳴砲
A + B pair

A remains
B transferred
    ↓
Trait ends immediately
```

```text
Gold: 阿吽の二遊間
SS + 2B both remain
same roles
    ↓
carryover eligible
```

```text
Blue: 鉄壁リリーフ陣
closer / setup / manager / catcher大幅変更
    ↓
preseason revalidation required
```

---

# 25. Manager Change Effects

Manager changeで全Traitを消さない。

影響が大きいのは:

- tactical preparation
- bullpen roles
- defensive alignment
- communication rules
- lineup role expectations

したがって:

```text
Relationship-derived
 -> mostly preserved

Coordination-derived
 -> preserved if personnel / roles stable

Tactical / Role-derived
 -> revalidate or partially reset

Momentum / Slump-derived
 -> season reset
```

---

# 26. Gold Carryover Rule

Goldだから自動で翌年へ残るわけではない。

Goldもsource familyで判定する。

### Carryover eligible Gold

- 共鳴砲
- 阿吽のバッテリー
- 阿吽の二遊間
- 鉄壁連携
- 完全中継網
- 本拠地要塞
- 遠征巧者

### Revalidate Gold

- 黄金打線
- 勝負所の結束
- 鉄壁ブルペン
- 初見看破
- 鉄の切替

### Season-only Gold

- 不屈の逆転劇

Goldの希少性を保つため、carryover eligibleでもOffseasonのroster / role changeで条件を失えば即消失する。

---

# 27. UI at Season Start

Opening Day時点では:

```text
持越し
[金] 阿吽の二遊間
[青] バッテリー結束

再評価中
[青候補] 鉄壁リリーフ陣
[青候補] ホームの鬼

昨季終了で解除
サヨナラ負け癖
連敗病
タイムリー欠乏症
```

のように整理可能。

通常UIでは「再評価中」を必須表示しなくてもよい。

---

# 28. Approved Direction Candidate

Season Boundaryの基本方針候補:

1. **関係 / 連携は翌Seasonへ残る**
2. **組織習慣 / 役割 / 環境適応はEvidenceのみ残して再評価**
3. **勢い / 連敗 / 得点圧力 / 暗い空気はSeason終了で解除**
4. **Redは原則、新SeasonのOpening Dayへ直接持ち越さない**
5. **ただし関係・連携由来Redだけは例外的にcarryover可能**
6. **SEASON_ONLYでもlatent memoryは少量だけ残せる**
7. **Goldも色ではなくsource familyで持越し判定する**
