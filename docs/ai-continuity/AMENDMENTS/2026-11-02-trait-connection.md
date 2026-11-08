# 2026-11-02 得能の試合・Maker接続

本人の凍結設計（08/09/05/02）に沿い、`UNSUPPORTED` 76種を経路で分類した。

| 区分 | 数 | 意味 |
| --- | --: | --- |
| 接続済み | 6 | 今のHostで効く |
| 要フック | 28 | 解決器と試験は完了。下のフック（H1〜H12）で試合へ届く |
| 見送り | 42 | 接続先がない、または説明用の表示。理由は表のとおり |

`OUT_OF_SCOPE` 25種と `REVIEW_REQUIRED` 1種（赤版 対ランナー）は触っていない。`キレ` は保留のまま。

## 共通の扱い

- 得能が `exitSpin`・打球初速・公式結果を名前で変えることはない。作用先は判断、狙いの誤差、スイング誤差、始動時間、Appraisal だけ。
- 重圧系は `liveEmotionResponseFromTraitsV1(profile)` だけが出口で、物理値にも技術値にも現れない。ActiveEmotion が立たない限り何も変わらない。`MatchImportance` の個人差は設計が求めていないため作らない。
- 緑特は監督の指示で置き換わる。積極盗塁・慎重盗塁は `baserunning` が `balanced` の時だけ効き、ボール先行・ストライク先行は `location: auto` の時だけ効く。
- 接続分は `live_trait_profile_v2` だけが持てる。`getLiveTraitCatalogV77` は18種のまま残し、上位集合 `getLiveTraitCatalogConnectedV1`（52種）を足した。旧JSONはそのまま読める。
- 新しい得能を切ると選択が残らない。基礎SIがないため。
- 係数は全て暫定（`local-trait-connection-v1-not-empirically-calibrated`）で、実測に基づかない。

## 76種の分類

### 接続済み（6）

| familyId | 名称 | 経路 | 対象 |
| --- | --- | --- | --- |
| pitch_platoon_left | 対左打者 / 左キラー | 技術 | 左打者への `effectiveCommandStd` |
| early_count_approach | ボール先行 / ストライク先行 | 判断 | 自動狙いの序盤カウントのコスト |
| walk_prone_approach | 四球 | 判断 | 自動狙いの `walkCost`。制球は不変 |
| pitch_strong_batter_response | 対強打者○ / 主砲キラー | 判断 | 自動狙いの `contactCost`。強打者の時だけ |
| stealing | 盗塁 / 電光石火 | 走塁 | `resolveStealV1` の始動。リードと企図は H1・H2 |
| pickoff_technique | 牽制○ | 走塁 | 牽制の動作時間。倍率は H5 |

### 要フック（28）

| familyId | 名称 | 経路 | 対象 | フック |
| --- | --- | --- | --- | --- |
| pitch_pressure | 対ピンチ / 強心臓 / ノミの心臓 / 要所○ | 感情 | response: stability, confidence | H11 |
| bat_pressure | チャンス / 勝負師ほか | 感情 | response: stability, confidence, competitiveness | H11 |
| setback_recovery | 打たれ強さ / 不屈の魂 | 感情 | response: stability, experience | H11 |
| anger_response | 短気 | 感情 | response: aggression, selfFocus, stability | H11 |
| trailing_motivation | 逆境○ / 火事場の馬鹿力 | 感情 | 負けている時の response だけ | H12 |
| steal_aggression | 積極盗塁 / 慎重盗塁 | 走塁判断 | `decideStealV1` の企図率 | H2 |
| quick_delivery | クイック / 走者釘付 | 走塁 | 始動から放すまでの時間。設計の上限どおり | H3 |
| runner_threat_attention | かく乱 / トリックスター | 走塁判断 | 牽制の頻度。投手の能力は不変 | H4 |
| first_pitch_execution | 初球○ / 一球入魂 | 状況 | 0-0 の時刻・位置の誤差 | H6 |
| two_strike_adjustment | 粘り打ち | 状況 | 2ストライクの時刻の誤差 | H6 |
| two_strike_narrow_options | 窮地○ / ヒートアップ | 状況 | 2ストライクの位置の誤差 | H6 |
| two_strike_weakness | 三振 / 扇風機 | 状況 | 2ストライクの時刻の誤差と認識 | H6 |
| cut_contact | カット打ち | 状況 | 2ストライクの遅めの接触と位置の誤差 | H6 |
| power_swing_generation | パワーヒッター / アーチスト | 状況 | 強振時の `attackAngleDegrees`。最大バット速度は不変 | H6 |
| bat_platoon_left | 対左投手 / 左腕キラー | 状況 | 左投手に対する `zoneJudgmentStdMeters` | H6 |
| pitch_putaway_execution | 奪三振 / ドクターK | 状況 | 2ストライクの `commandStdMeters` | H7 |
| runner_on_base_stability | 対ランナー○ | 状況 | 走者がいる時の `commandStdMeters` | H7 |
| inside_zone_hitting | インコースヒッター / 内角必打 | 技術 | 内角と読んだ時のスイング誤差 | H8 |
| outside_zone_hitting | アウトコースヒッター / 外角必打 | 技術 | 外角と読んだ時のスイング誤差 | H8 |
| fastball_recognition | 対ストレート○ | 技術 | 速球系へのスイング誤差 | H8 |
| breaking_ball_recognition | 対変化球○ | 技術 | 変化球系へのスイング誤差 | H8 |
| opposite_field_technique | 流し打ち / 芸術的流し打ち | 技術 | 逆方向を狙う時のスイング誤差 | H8 |
| pull_side_transfer | プルヒッター / 引っ張り屋 | 技術 | 引っ張る時のスイング誤差 | H8 |
| multi_direction_contact | 広角打法 / 広角砲 | 技術 | 中央以外を狙う時のスイング誤差 | H8 |
| diagonal_command | クロスファイヤー / クロスキャノン | 技術 | 対角の狙いの誤差 | H9 |
| dangerous_miss | 一発 / 逃げ球 / 本塁打厳禁 | 技術 | 大きな失投の外れ方 | H10 |
| release_miss_pattern | 抜け球 | 技術 | 大きな失投の外れ方 | H10 |
| pitch_velocity_consistency | 球速安定 | 物理 | 球速のばらつきの幅。平均は不変 | H10 |

`diagonal_command` だけは、フックがなくても自動狙いの予測が先に動く。他の27種はフックなしでは完全に無効で、これは結果ハッシュで確かめた。

### 見送り（42）

| familyId | 名称 | 理由 |
| --- | --- | --- |
| fastball_quality | ノビ / 怪童 | 実測の球質から導く説明表示。段階の指標が未定 |
| pitch_contact_quality | 軽い球 / 重い球 / 怪物球威 | 接触結果から導く説明表示 |
| fastball_lateral_shape | ナチュラルシュート / 真っスラ / シュート回転 | 実際の横変化の説明表示 |
| gyro_pitch_shape | ジャイロボール / ハイスピンジャイロ | 回転軸の説明表示 |
| wild_stuff | 荒れ球 | 球質と誤差のトレードオフの要約。誤差へ追加の利得を付けない |
| contact_precision | アベレージヒッター / 安打製造機 | ミートと同じ原因の要約。再加算になる |
| line_drive | ラインドライブ | 打球分布から導く説明表示。参考表示は既存 |
| pitcher_contact_distribution | ゴロピッチャー / フライボールピッチャー | 打球分布から導く説明表示 |
| throw_velocity_descriptor | レーザービーム / 高速レーザー | 肩力の説明表示。再加算しない |
| catcher_pop_throw_descriptor | バズーカ送球 | 捕手の送球の説明表示 |
| double_play_tendency | 併殺 | 結果の説明。併殺を直接増やさない |
| release_deception | 球持ち○ / ディレイドアーム | リリース位置の要約。見えにくさの観測経路がない |
| release_consistency | リリース○ | 球種ごとのフォーム差を実行していない |
| command_instability | 乱調 | 短期の乱れを持つ状態がない |
| cadence_manipulation | 緩急○ / 変幻自在 | 投球間隔の時計と打者の適応がない |
| pitch_tempo_preference | テンポ○ | 投球間隔の時計がない |
| catcher_handling | キャッチャー / 球界の頭脳 | 配球・意思疎通の技能が未実装 |
| blocking | ブロッキング | 体で止める捕手の動作がない |
| framing | フレーミング○ / フレーミング◎ | 判定はルールブックの幾何。RuleProfile依存 |
| home_tag_and_block | ホーム死守 / 鉄の壁 | RuleProfile依存。守備本体の変更が要る |
| team_matchup | ○○キラー | 対戦履歴と親しみの蓄積がない |
| batter_high_quality_matchup | 対エース○ / エースキラー | 高品質な球の指標と対戦学習がない |
| in_game_matchup_learning | リベンジ / 逆襲 | 選手ごとの学習速度がない |
| pinch_hit_readiness | 代打○ / 代打の神様 | 通常Hostに代打の交代がない |
| inherited_runner_readiness | 火消し | 投手交代と緊急登板の準備状態がない |
| early_game_readiness | 立ち上がり○ / スロースターター / トップギア | 肩慣らしの状態がない。回数だけの補正は禁止 |
| late_game_maintenance | 尻上がり / 終盤力 | 疲労状態がない。回数だけの補正は禁止 |
| fatigue_resilience | 根性○ / ド根性 | 通常試合で疲労が蓄積しない |
| pitch_effort_allocation | ギアチェンジ | 力の配分と疲労の持ち主がない |
| max_effort_tradeoff | 完全燃焼 / 全開 | 出力上昇と疲労の代償を同時に実行できない |
| effort_saving | 力配分 | 同上 |
| injury_resistance | ケガしにくさ / 鉄人 | 傷害の発生源がない |
| recovery | 回復 / ガソリンタンク | 試合間の回復がない |
| pitcher_condition_response | 投手調子極端 / 投手調子安定 / 鉄腕 | 調子の分布がない |
| batter_condition_response | 野手調子極端 / 野手調子安定 | 調子の分布がない |
| season_condition_tendency | 春男 / 夏男 / 秋男 | 季節と調子の分布がない |
| breaking_ball_quality | キレ○ / 驚異の切れ味 | 物理未定のため別工程で保留 |
| field_pressure_error | エラー | 守備に ActiveEmotion の受け口がない。送球へ直接足すのは禁止 |
| preclosure_pressure | 寸前 | 名前だけで原因が未定義。本人判断 |
| team_play_preference | チームプレイ○ / チームプレイ× | 作用先が未定義。本人判断 |
| mound_position | 投球位置左 / 投球位置右 | 左右の基準と移動量が未定義。本人判断 |
| plate_crowding_avoidance | 死球集中 | 回避動作がない。立ち位置を動かすと打撃全体が変わる |

## 統括が入れるフック

いずれも置換の前後を示す。入れなければ該当の得能は効かないが、結果も変わらない。全て入れた私的な写しでも、得能を持たない選手の結果は同じハッシュだった。

`LiveBaseballMatchV1.ts`

- 型: `resolveLiveMatchPlayerPhysicalV98(player:LivePlayerV1):LivePlayerPhysicalV1` の戻り値を `LivePlayerPhysicalV1&LiveTraitPhysicalFieldsV1` にする。
- H1 readyFrame: `leadMetersV1(physical(players.get(match.bases[name]!)!).topSpeedMps,leadInstruction)` から `.topSpeedMps` を外す。
- H2 decideStealV1: `instruction:runningInstruction` の後へ `,runnerOf:id=>physical(players.get(id)!)` を足す。
- H3 resolveStealV1: `throwSpeedMps:cp.throwSpeedMps` の後へ `,...(pp.deliverySecondsV1===undefined?{}:{deliverySeconds:pp.deliverySecondsV1})` を足す。
- H4 decidePickoffV1: 引数へ `,runnerThreat:physical(players.get(beforeMatch.bases.first!)!).runnerThreatV1??0` を足す。
- H5 resolvePickoffV1: `pitcherTechnique:JSON.stringify(pitcher.traitProfile??null).includes('pickoff_technique')?1:0` を `pitcherTechnique:pp.pickoffTechniqueV1??0` にする。
- H6 pitchInput: `batter:{...bp,` を `batter:{...resolveLiveBatterSituationV1(bp,batter.traitProfile,{balls:beforeMatch.balls,strikes:beforeMatch.strikes,pitcherThrows:pitcher.throws??'R',batting}),` にする。
- H7 pitchInput: `pitcher:{...pp,` を `pitcher:{...resolveLivePitcherSituationV1(pp,pitcher.traitProfile,{strikes:beforeMatch.strikes,runnersOn:Object.values(beforeMatch.bases).filter(Boolean).length}),` にする。
- H11 emotionTrackerV1: `({playerId,clubId:team.id})` を `({playerId,clubId:team.id,response:liveEmotionResponseFromTraitsV1(players.get(playerId)!.traitProfile)})` にする。

`LivePitchV1.ts`

- H8 `predictedZoneHeight` の前へ次の行を置き、`zoneHitStrength` の和の末尾へ足す。

```ts
const hitDirectionDegreesV1=battingDirectionV149?.direction.pullAngleDegrees??intentV122?.direction.pullAngleDegrees??directionIntent?.pullAngleDegrees??b.pullAngleDegrees??undefined;
```

```ts
+resolveLiveContextHitStrengthV1(b.technicalSkills,{bats:b.bats,perceivedX:judgmentPosition.x,...(zone.centerX===undefined?{}:{zoneCenterX:zone.centerX}),zoneHalfWidth:zone.halfWidth,pitchType,...(hitDirectionDegreesV1===undefined?{}:{pullAngleDegrees:hitDirectionDegreesV1})})
```

- H9 `resolveLivePitchCommandStdV111` の実投球側の呼び出しへ `,...(p.throws===undefined?{}:{throws:p.throws})` を足す。
- H10 `baselineErrorMeters` を次のように包む。

```ts
baselineErrorMeters:shapeLiveCommandMissV1({x:commandRandom.normal()*effectiveCommandStd,y:commandRandom.normal()*effectiveCommandStd},{target:pitcherRequest.position,zone,commandStdMeters:effectiveCommandStd,...(p.throws===undefined?{}:{throws:p.throws}),...(p.technicalSkills===undefined?{}:{technicalSkills:p.technicalSkills})}),
```

- H10 投手の型へ `velocitySpreadScaleV1?:number` を足し、球速の行を次にする。

```ts
const speedDrawV1=speedRandom.uniform(),speed=selectedPitch.releaseSpeedMps*(p.velocitySpreadScaleV1===undefined?.98+.02*speedDrawV1:.99+(speedDrawV1-.5)*.02*p.velocitySpreadScaleV1);
```

`LiveEmotionV1.ts`

- H12 `LiveEmotionPlayerV1` へ `trailingResponse?:Partial<Record<ResponseAxis,number>>` を足し、`liveEmotionTrailingResponseFromTraitsV1(profile)` の値を渡す。`appraise` へ `behind:boolean` を足し、`response:{...NEUTRAL,...(behind?player.trailingResponse??player.response:player.response)}` とする。`observe` は打者へ `event.runDifference<0`、投手へ `event.runDifference>0` を渡す。

## 本人の判断待ち

1. 赤版「対ランナー」の意味。09 が保留。接続していない。
2. 「寸前」の原因の定義。09 は名前だけ。
3. 「チームプレイ○/×」が何の判断へ作用するか。
4. 「投球位置左/右」の左右の基準と移動量。
5. 「抜け球」の方向。設計は「特定方向」までで、今は上と腕の側で仮置きしている。
6. 「ノビ」「対エース○」の品質指標と段階の閾値。
7. 打撃の二重の弱点。09 §2.5 は三振・扇風機を two-strike 系統の赤としたが、カタログは粘り打ちと別 family に分けている。今は別のまま両立できる。
8. 08 §16 の未決。#12（青赤と緑が同じ行動へ作用する時の優先）、#13（監督指示・傾向・信頼の統合式）、#14（怪我・疲労・感情の合成順）。今は緑を指示で置き換えるだけ。
9. 全ての数値。クイックの 1.8倍・1/1.8・1/2.5 だけが設計由来で、他は全て暫定。重圧系の response 配分、誤差の `.4`、狙いの `.6`、盗塁の `.4m`・`.06秒`、企図の `1.5倍・1/2倍`。

## 検証

- `npx tsc --noEmit -p .`: 通過。フックを全て入れた私的な写しでも通過。
- `LiveTraitConnectionV1` 26件が通過。関連の既存試験は、キレ（V177）の15件を除き通過。その15件は基準のソースでも同じ箇所で失敗する。
- 結果の不変: 設定 `config-v8c.json`、seed 91、40球、`--hash=1` で、基準・接続後・全フック適用後のハッシュが全て `a58c87019c08832581da1c3ca51cf4d215d2554eafb030e77e54072b53955470`。得能なしの v2 プロファイルへ変換した設定でも同じ。
- 全34種を全選手へ持たせ、全フック適用で60球を実行した。停止はなく、結果は変わった。
- Maker を接続後のCoreで組み直し、実際の選択欄で確認した。選択欄52、段階の保持、エラーなし。
- `release/maker` はローカルのみのため、配布物へ反映するには `retarget-core.py` を実行する。
