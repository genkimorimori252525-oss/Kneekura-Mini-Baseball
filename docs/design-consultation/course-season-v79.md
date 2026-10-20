# v79 相談用仕様 — コース特性・シーズン成績・打球方向

2026-10-20。人間が承認した範囲は、内部63コース、ストライクゾーン内の公開9分割と外側別集計、通常試合のシーズン蓄積、練習、締め、JSON保存。[承認範囲と元計画](../plans/2026-10-20-v79-course63-and-spray-review.md)を維持する。本書は実装されたローカル契約を整理する。最終HTMLの検証は [検証索引](../verification/releases/v79/README.md) と対応するartifact hashを参照。

## 座標と公開成績

- 捕手側から投手を見る固定図。列1〜9は左から右、行0〜6は下から上。IDは `列×10＋行`。左上16、右上96、左下10、右下90。配列は10〜16、20〜26、…、90〜96の63要素。
- 打者身長から得た現在のstrike-zone geometryを使う。ゾーン幅・高さを各5等分し、横に各2マス、上下に各1マス追加する。範囲外を端へ押し込めず、位置欠損も分ける。
- 公開9分割は同じ元座標からゾーン内を直接3等分する。IDは上段左1〜右3、中段4〜6、下段7〜9。内部5×5の整数マスから多数決で割り当てない。左右打者で図を反転しない。
- 公開打率は安打合計H／打数合計AB。`.300以上=red`、`.200以下=blue`、間とAB0は`gray`。AB0の打率は`null`。確認中の打席が混在する区分も`average:null`とし、確定分は`knownAverage`と件数で区別する。
- 終打席の本塁前縁 `z=.15m` の球中心を統計に使う。前縁より手前で接触した場合は、元の自由投球Sourceを延長した位置を `source_estimated_after_front_contact` と記録する。実通過は `source_plate_crossing`、位置不足は `missing_source`。統計を物理・裁定へ戻さない。

実装：[BatterCourseProfileV79.ts](../../src/integration/browser/BatterCourseProfileV79.ts)、[LiveCourseScoringV79.ts](../../src/integration/browser/LiveCourseScoringV79.ts)。

## 保存契約と入口

| データ/API | 現在の契約 |
|---|---|
| `batter_course_profile_v79` | `referenceAverages[63]`、`effectScale`、任意の`directionWeights[5]`。`physical.batterCourseProfileV79`へ任意設定。基準値は0〜1、効果係数は0〜3、方向配分は合計1。省略を自動移行しない。 |
| `summarizeLiveIssuedPitchV79(record)` | `live_pitch_summary_v79`へ射影。打者・投手・打席ID・投球ID、前後の最小match state、終端・試合終了、コース来歴、出球速度、記録判定と根拠を保存する。framesや通常Host履歴全体を複製しない。 |
| `createLiveGameStatisticsV79({gameId,seed,players,records,finished})` | `local_course_game_v79`。playersの身長から元座標を分類する。playersはID・名前・左右・身長・任意の先天設定を保持する。終端の`gameOver`を確認し、未完走の試合をシーズンへ登録しない。 |
| `validateLiveGameStatisticsV79(raw)` | JSON正本を検証する。未知フィールド、ID・順序・集計根拠・座標分類の不整合を拒否する。 |
| `createLiveSeasonStoreV79()` | `live_seasons_v79`、`selectedSeasonId:null`、空のseasons／longTerm。 |
| `reduceLiveSeasonStoreV79({store,command})` | `create`、`select`、`record_game`、`practice`、`close`。`select`は`seasonId:null`で単独試合へ戻せる。 |
| `getLiveSeasonReportV79({store,seasonId,playerId})` | inside9、outside、offGrid、missing、totals、方向別counts／ratios／homeRuns／fouls。 |
| `deriveLiveCourseProfileV79({store,seasonId,playerId,profile?})` | 先天設定に長期差分・今季差分を重ねた新しいprofile。元profileを変更しない。省略時の基準は中立`.250`。 |

ゲームの`players.courseProfile`は学習前の先天設定。実行側は別copyへ有効profileを渡し、試合開始時に固定する。試合中の読込・練習・再表示で過去の投球や能力を変えない。初期20人へ特性を一括付与しない。

シーズンの重複game ID／practice ID、投球重複、打席途中の選手変更、非有限値、範囲違反、締めの再実行を拒否する。締め後は試合・練習を追加できず、先行シーズンから順に締める。失敗時に入力storeを変更しない。

上限は64シーズン、各512試合・8192練習、全体100000投球、1試合3000投球・100選手。保存全体を`cloneInert`へ一括投入せず、containerのdata descriptorと小さな記録単位を検証する。既存の100000-node上限は変更していない。

## ローカルの記録方針

版は `local_physical_scoring_v79_1`、全試合 `nativeAdmission:false`。物理とrules確定後に記述し、安打などの判定から物理・アウト・得点を変更しない。

- 途中のファウルやcountは `in_progress`。終打席だけを集計し、途中投球を追加ABにしない。
- 四球はAB0/H0、三振はAB1/H0、rulesの確定HRはAB1/H1/HR1。
- 捕球アウトは通常AB1/H0。先行走者と得点があり犠飛判断が不足する場合は確認中にする。先行走者がいる2アウト未満のバントも、犠打判断不足を確認中にする。
- 一塁前の打者アウト、他走者の一塁到達前のforce outを区別する。後者はローカル方針の野選H0。送球選択だけで安打との区別が足りない場合は確認中。
- 安打の根拠は、一塁到達が守備接触・送球より先、または通常守備の完了・有効な一塁到達・捕球保持の成功・一塁到達までの処理失敗なし等の物理trace。伸塁時の打者アウトは一塁前アウトと分ける。無接触の打球によるground-rule awardも区別する。
- body接触、保持失敗、送球後の地面接触、送球逸脱、未解決の捕球・送球等は曖昧さの根拠として残す。進塁だけでHとしない。H/E/FCや犠打飛を判断できない記録は`pending`でAB/H/HRを`null`に保ち、学習へ入れない。

これは既存Native公式記録のvalidatorや育成認証を置き換えるものではない。確認中記録を手動確定する訂正APIは今回の契約に含めていない。

## 先天・今季・練習・長期の分離

実装：[LiveSeasonV79.ts](../../src/integration/browser/LiveSeasonV79.ts)。調整版は `local_course_learning_v79_1`。すべて作者が設定した係数で、実測校正値ではない。

| 状態 | 更新元と式 |
|---|---|
| 先天設定 | メーカー等の明示編集。中立目安`.250`。学習時に元値を書き換えない。 |
| 今季の試合差分 | 確定H/ABのみ。`評価=(H+40×基準)/(AB+40)`、`差分=.15×(評価−基準)`、上限±.04。AB0は差分0。 |
| 今季の練習差分 | courseごとに`Σ((2×quality−1)×attempts)`を蓄積し、`.02×加重和/(試行数+100)`、上限±.03。試合差分との合算は±.06。練習から公開H/AB・長期特性を増やさない。 |
| 締め時の長期差分 | `評価=(H+200×基準)/(AB+200)`、`η=.05×AB/(AB+200)`、`追加差分=η×(評価−基準)`。1シーズンの追加を±.005に制限し、一度だけ保存する。 |

長期差分を適用した先天設定を基準として今季対応を求め、有効値を0〜1へ収める。新シーズンは公開実績と今季対応を空から始め、先行する締め済みシーズンの長期差分を引き継ぐ。過去シーズンの参照に後続シーズンの成長を混ぜない。

## 方向の意図と実結果

入力の5配分は左翼／左中間／中堅／右中間／右翼を狙う意図。独立した`direction-intent-v79` streamから意図を選び、打撃前のバット方向へ接続する。コース特性はその時点の知覚予測から選び、timing／aim誤差へ一度合成する。未来の実球や安打結果で能力を選ばない。

実績は接触後の初期出球速度から `atan2(vx,vz)` を計算する。フェア域±45度を境界−27／−9／9／27度で5区分し、フェア打球数を割合の分母とする。バントを含み、ファウルは別件数。HR欄はrulesで確定したHRだけを数える。方向配分を出球角やHR本数へ直接代入しない。球場方向は左右打者で固定し、意図配分と実績の完全一致を保証しない。

## 確認できた範囲と相談事項

[実検証索引](../verification/releases/v79/README.md)に原receiptを列挙した。Coreの9回完走例はseed2468、133投球／80打席、確定74・確認中6・H29。これは動作と記録coverageの1例で、リーグ成績の現実校正を示さない。実133球のgame JSONはこの単体試験では保存していない。

最終通常HTMLは別seedで320投球・127打球/守備処理の9回を完走し、実game/season JSONを検証索引へ保存した。残る範囲は、確認中記録の判断coverage拡大、係数と実打撃傾向の評価、Native公式履歴／認証育成への将来接続。元計画の100試合校正、守備・走塁・裁定・実測物理の残件を完了扱いにしない。
