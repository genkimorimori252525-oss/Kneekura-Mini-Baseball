# 捕球できなかった投球のカウントと走者: 実装調査

2026-11-01。対象は試合再生の後続処理であり、検証用候補を実用品と認定するものではない。

- `src/core/rules/PitchCountRule.ts` の3ストライクは捕球状態を入力に取らない。`PlayableMatchRulesV1.ts` の `pitch_call` は直ちに打者アウト・打席終了とし、同時に動いた走者のfactを受け取らない。
- `field_play` は打球のfair/foulとcontactを前提にする。暴投・捕逸を打球factに偽装しない。`buildLiveFieldPlayInputV95` は球のmoment、physics、field、守備者・能力、occupiedBasesと打者位置から、打者base0および既存走者base1〜3を生成するが、実際の投球中の走者の位置・速度と走者判断は別途継承が必要。
- 未捕第3ストライクは一塁空きまたは2アウトの場合は打者走者になり、それ以外では打者アウトでも走者に関して球は生きる。根拠: [MLB, Rule 5.05(a)(2)](https://www.mlb.com/news/dropped-third-strike-strangest-baseball-rule)。第3ストライク時の直接捕球と、落球後の後続回収を区別する。
- 既存`LiveFieldPlayV1`は `runnerTouches`、`controlledBaseContacts`、`controlledRunnerTags`、`runnerDepartures`、`playEnd` を出すが打球処理に依存する。実接触時のground、capture、球、守備者、走者の同時状態を繋ぐ専用事実と、カウント・アウト・進塁のルール適用が必要。既存の三振適用だけで代用しない。
- 調査のみ。実装・検証は未完。2ストライク、走者あり、4ボール、同時進塁、三死、保存再開の実Worker検証は未実施。ユーザーが求めた通常試合を保証しない。

## 日本側の解釈と試作の訂正

2026-11-01、`npb-2026` の関連資料として、一般財団法人全日本野球協会アマチュア野球規則委員会の[審判員マニュアル修正一覧（2024、22–25頁）](https://baseballjapan.org/jpn/umpire/doc/%E9%87%8E%E7%90%83%E5%AF%A9%E5%88%A4%E5%93%A1%E3%83%9E%E3%83%8B%E3%83%A5%E3%82%A2%E3%83%AB%E7%AC%AC%EF%BC%94%E7%89%882020-2024%E4%BF%AE%E6%AD%A3%E4%B8%80%E8%A6%A7_20240401.pdf)を確認。捕手にはじかれた投球が単に打席に立っている打者や所持するbatに当たっただけならインプレイ。打者の動作が守備機会を奪ったとき等はデッド、スイング後のbatが当たった場合はデッドの例がある。打者の状態、接触時刻、守備への影響による判断が必要。2025年刊の第5版および2026年修正資料は[協会入口](https://www.baseballjapan.org/jpn/umpire/umpire_manual.html)にあるが、第5版本文は未閲覧。

静止body接触を無条件deadとした試作 `batter-dead-admission-v2.ts` と `fc131fe9a8cc4cf192a295210e31a9fc` の受理はこの日本資料を満たさず非採用。2026 MLB規則の一般文だけで同一と推定しない。実際の反発を継続して観測するか、必要事実が不足する間はHOLD。旧試作とそのreceiptは削除せず保存する。
