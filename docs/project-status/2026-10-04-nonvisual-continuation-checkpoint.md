# 非デザイン継続実装: 現在の接続と検証

更新: 2026-10-04 JST（2026-10-03 UTC）

ユーザーの継続指示に従い、最新の確定済み残計画を進めている。**計画全体・自律試合/Career全体の完了ではない**。デザイン/UI/art/Presentationは未接続のまま。

## 公開済みの積み上げ

| Draft PR | 実装commit | 接続した範囲 |
|---|---|---|
| [260](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/260) | [55cacd18](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/55cacd18dc2f709bd058f0e74dfd55ed0ef57cbb) | actual field acquisition/custody/transfer/throwの所有 |
| [261](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/261) | [2b35ecaf](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/2b35ecafb1fc1bb77d96f92c6891613d69d3c59f) | 足/塁/支配履歴とactual first-base rule |
| [262](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/262) | [83838144](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/83838144dff16b9af4e553570d09b9ea78b5b132) | 未解決truth/call分離、continuing contact修正、original pitchからwhole-play physical history |
| [263](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/263) | [e2f635da](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/e2f635daded52326404bcda09935057639591c72) | 持替え途中の保存/再開、exact release、source固有queueとball/contact handoff |
| [264](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/264) | [de36ce08](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/de36ce08c310ab382fe25328dc27d4c143354ba1) | Player/Personにpinした明示的な観測calibration baseline |
| [265](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/265) | [2e361ee4](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/2e361ee47e8dc32297b51fc185ab911b3ebac681) | 旧atomic release境界のversioned custody補正とarchive互換性 |

各公開treeはローカルの検証Sourceとfetch/diffで一致を確認した。GitHub上のcommitはmetadataが異なるため、commit IDだけでなく全tree/src treeの同一性を各PRに記録している。いずれもmergeしていない。

## 現在追加しているactual observation

[詳細契約](2026-10-04-actual-field-observation.md)。既存のperception部品を、実際に所有・実行したfield/execution prefixへ接続する。

- Player/pitchごとのimmutable view/attention Sourceとobservation receipt
- 明示的なbody-center相対eye anchorとforward。真のballや速度から視線を決めない
- Exact physical moment、actual actor primitives、adopted ball cursorだけをsampleする。Pending planやincoming velocityを現在の真実にしない
- FOV、実actor sphere、ノイズ、refresh、記憶予測。未知のwall/base opticsは `surface_visibility_unavailable` として記憶を保持する
- Sparse sampleから連続注視時間を捏造せず、瞬間観測と明示calibrationを使う。整数tickのmemoryとexact evidence timeを区別する
- Future payloadを読まない履歴再生、complete metadata/head checks、現在性、WAL rollback、元archiveの保持
- AI-facing perceived stateへCanonical truthを渡さない。Caller結果注入、property-name alias、導出後のnonfinite値を拒否する

このreceiptはautonomous gaze/decision/controllerやcomplete-play registryではない。

## 全体検証の正確な位置

| 固定Source | 結果 | Sourceの範囲 |
|---|---|---|
| #259 `ad296f7e` | `npm run verify` exit0、620 files / 4,157 tests、81分9.642秒 | 元の公開checkpoint。全1,624 tracked hashes一致 |
| #260 local `943d18cb` / published `55cacd18` 同一tree | exit0、623 files / 4,198 tests、85分12.031秒 | Field execution追加時点。tracked hashes一致 |
| #262 local `43dc03df` / published `83838144` 同一tree | exit0、632 files / 4,326 tests、94分12.209秒 | 修正済みwhole-play historyまで。全1,656 tracked hashes一致 |

いずれもtypecheckを含む。#262のfull treeは `c9c1fd2a91c94b43966a77cb4c8b958d70df86e9`、src treeは `3215fe92c34ae51c5deca1bfcff7bacb59b847a6`。Tracked diffは空で、検証checkoutのuntracked itemはruntime dependency用node_modules symlinkのみだった。

#261旧Sourceのwholeは、continuing-contact不具合発見後に意図的に中止した。成功扱いせず、修正を含む#262を別に全検証した。#255–258の古い各固定Sourceの未完了記録も後続結果で書き換えない。

#263以降はfocused gateと独立reviewの記録があるが、#262のwhole成功を流用しない。**Actual observationと互換性修正まで統合した最新Sourceを固定し、一つの累積whole gateで確認する**。その間は新規機能を増やさず、検証とreviewを閉じてから確定残計画を続ける。最新terminal resultと固定Sourceのtree情報は該当PR本文に記録する。

## 残る確定非デザイン接続

1. 実acquisitionのsecureまでのscheduled lifecycleと、actual ball/ruleの生成・消費source
2. 知覚receiptに基づく個人decision、情報/判断/first-step遅延、既存motor所有を維持するbounded controller実行
3. 全contributorsとcausal actor dispositionを集めるNative registry/watermark、実際のPlayEnd
4. Physical endと独立したcall/reviewを既存official closure/scoring/legal Match/actual-role workloadへ接続
5. 版付きvenue/legal/dead/out-of-play/interference policy、bunt依存foul intent、実移動/recoveryによるnext-play
6. Pre-pitch runnersを含む一般participant/body/capability、実際の練習・出場機会、既存Club/competitionを使う自律Career、performanceと実測calibration

既存ownerと既存Coreアルゴリズムを再利用する。Accepted Sourceやsynthetic test motorは、自律本番生成・数値校正・全試合/Career完成の証明ではない。未知の方針・入力は未知のまま保持し、結果・PlayEnd・実測値を捏造しない。

## 正本と変更境界

最新確認した正本はfoundation `44b9f5de7b9d87e649f12f1af78c202f2b5ab44d` とrealism `4f0a60a3818926327b6bf5877ab3dec456a76530`。元の[確定済み残計画・prior PR記録](2026-10-04-nonvisual-implementation-checkpoint.md)を継承する。古いDRAFTファイル名だけでstatusを巻き戻さず、archived Pixel/JSON案や未接続designを再開しない。

自宅/self-hosted CIをdispatchせず、workflow/config/lock/公開範囲を変更しない。実行済みのcloud-local検証と、未実行の現在commit CIを分けて記録する。
