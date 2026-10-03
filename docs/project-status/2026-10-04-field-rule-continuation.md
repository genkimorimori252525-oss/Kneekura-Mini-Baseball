# 非デザイン継続: actual field physical history / first-base rule

> 最新続報: [original pitchからwhole-play physical historyへの接続と検証結果](2026-10-04-whole-play-history-continuation.md)。以下の実行中・次段予定の記述は当時の記録として保持する。

更新: 2026-10-04 JST（2026-10-03 UTC）

> 続報: [未解決truthとofficial callの分離](2026-10-04-unresolved-adjudication-continuation.md)を追加した。以下はfield-rule sliceの記録。

## 実装範囲

[PR260](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/260) のfield acquisition/custody/throwに続き、[確定済み残計画](2026-10-04-nonvisual-implementation-checkpoint.md) §5項目3の物理履歴・一塁判定接続を追加した。デザイン、UI、art、Presentationは接続していない。全計画の完了ではない。

前段の公開commitは `55cacd18dc2f709bd058f0e74dfd55ed0ef57cbb`。ローカル検証commit `943d18cbfaaec0d2cfd269a12f46642d41c5ffcf` とはcommit metadataだけが異なり、全file tree `87aa0c8f44677279b9865a71f955ec71441d970f` とsrc tree `f11a854299583c21eead0c552adebc63fefb9b7a` の一致をfetch/diffで確認済み。

## 実際に接続したもの

- Original bat contactのelapsed0から、field action、capture、carried motion、transfer、released throwまでのNative所有prefixを一つの物理履歴へ組み立てる。旧ownerに見せかける変換は行わない。
- 元Player/Person/geometry、完全なSource順序、actor時計とrebase、actual horizonを再確認し、両足のcontact/departure/recontactと実際の確保区間を既存のowner-neutral kernelへ渡す。
- 確保はactual securityから始まる。release/interruptionでは支配区間をexclusiveに閉じ、送球後までthrowerの支配を延ばさない。Ground/free-flight区間は実際のresponse cursorまたはrelease cursorから始める。
- Bag接触のexplicit companionを維持する。確保中・保持移動中・持替え中・release後のbag境界も同じ履歴に含める。
- Native `base_touch_history` / `first_base_race` observationを追加する。Observationは物理時間を進めず、観測を挟んでも直前の本当のphysical actionからcustodyを継続する。
- First/third bagの実接触はfairの根拠になり得るが、groundを生成しない。Ground raceには実際のgroundが必要。Bag衝突を除去してfly catchを製造しない。
- 元batterと全active defenderのtrue elapsed履歴でOUT/SAFEを解釈する。相手の未来到着が未発生でも成立済み先行結果を扱い、同じ記録tickの実時刻差を保持する。Exact tieは未解決。
- Surface/non-defender/simultaneous/persistent/unsupported-base等の未解決事象は必要な判断時刻までblockする。後から起きた未解決事象で、先行する成立済み判断を消さない。
- Foul-side contactのcatch-pending、actual fly catch、actual grounded foulを区別する。まだ確保されていないことを「捕球なし」とみなさない。

## 検証と修正

Node26.10.0、既存lock、cloud-local TMPDIR、focused1workerで検証した。

- Core: 5 files / 105 tests PASS（新規40 testsを含む）
- Physical-prefix adapter: 12 tests PASS、112.55秒
- Native new/previous execution/WAL: 4 files / 31 tests PASS、402.07秒
- Source-id namespace修正後に、影響するnew Native/WALを固定Sourceで再実行: **2 files / 13 tests PASS**、156.57秒、exit0。対象9 Source SHA256は全て不変
- Final typecheck / diff check: PASS
- Fresh independent review: 新しいmaterial findingなし。実際のground→capture→transfer→releaseと、複数観測を挟むcustody/throwの独立2 testsがPASS、59.62秒

結合時に判明した次の差異は実データとregressionで解消した。

1. Original modelにinactive rosterも含まれることと、実行中active Playerの完全性を区別する
2. 既存ground responseが球中心をballRadiusへ補正する意味をそのまま再導出し、浮動小数の境界位置を無根拠の別位置として拒絶しない
3. Fieldとexecutionは別Source namespaceなので、両tableで同じSource文字列を使用できる。各owner内部の重複拒否は維持する

独立reviewやfocused gateはwhole成功の代わりにしない。新しい固定Sourceのwhole verifyは別途必要で、結果を追記する。前段#259/#260のwholeも独立した固定checkoutで継続中。#255–258の古い各固定Source gateを成功扱いしていない。

## 未完了境界

- この観測はofficial ruling、PlayEnd、OfficialPlayClosure、MatchState適用、scoring、workload closureを生成しない
- 捕球中断やcarried contact後の未知のrelease/transportを捏造しない。Failed-retention reboundの実cursorだけは既存実行へ継続できる
- Foulのcount/dead-ball適用には元intentの必要な証明が残る。現在のphysical pitch Sourceの`swing`だけからbuntではないと推測しない
- 未知のwall collisionをout-of-play/awardへ読み替えない。Versioned venue/legal policyと実際のboundary-crossing証拠は別の必要接続である
- Next-play、general body/capability/perception/controllers、実際の練習/出場機会、自律Careerは元の残計画のまま継続する

次のcalibrationを要しない確定契約の差分は、canonical07 §6.2の「Correct Rule Resultが未解決でも、根拠を保持した別のOnFieldCallを扱えること」。既存adjudication engineへ追加し、未知の正しいOUT/SAFEを仮定しない。

## 公開方針

PR260の上へstacked draftとして保存する。自宅/self-hosted CIはdispatchせず、workflow/config/lock/公開範囲を変更しない。GitHubへの公開は接続済みGitHub APIで行い、公開treeとローカル固定treeの一致を検証する。CI成功・マージ可能・全体完成は申告しない。
