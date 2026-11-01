# V119 接触停止・同塁集中の修正判断

2026-10-25 JST / Task `MB-20261025-CONTACT-COORDINATION-V119`。

## 依頼・対象

本人の添付試合JSON、pitch51/seed2856833970の `numerical_contact_refinement_required` 停止、および守備選手の重なり/同じ塁への集中を調査して修正する。能力・個人差・得能・信頼・球場、物理と公式裁定、見た目を保持し、同Coreのメーカー/通常HTML/調整室へ反映する。前taskの感情接続・連続dive計画全体は実装承認へ拡張しない。

通常の依頼範囲内の修正判断は、本人の2026-10-23判断記録方針に従い記録して進める。依存追加・public API/必須JSON変更・旧ファイル置換・Source commit/push/merge/deployは行わない。shared dirty作業をreset/clean/revertしない。既存Sol一名にはDecisionとそのtestだけを限定所有として委任し、他の調査・実装・統合・検証は主担当が所有する。

## 修正前の再現と原因

- 凍結V118 Core `66e4893815d8fd7705014368e2a0b749efe40d37712ba7e2bda2d0b5f257539b` で、50球のclassification/call/matchが添付保存結果と一致し、51球の同じ停止を再現。入力SHA `50ccb10ab42b2f432c5ff4a385c1febaeaa9198b336fd7f19d669de2589c8707`。再現receipt1529a1ab、元入力は不変。
- SSが4.863539sに保持、同じ二塁へ4.992779sに短いトス、2B身体へ5.004113sに接触。その後SS身体への微小反発が続き、身体接触計11回（SS10回）の後、5.257859sで離脱証明に必要な時間8.974e-7sが保証区間1.258e-7sを上回り停止する。SourceFreeBallWorldQueryではなくLiveFieldPlayの `contact_departure` guard。実接触を飛ばしたり、誤差で保持/OUTを作って続行してはいけない。
- 二塁へ来たSS/2Bの水平間隔は約.501m、球体body半径.24mの連続motor guardは非貫通を保っていた。同じ塁を狙う判断の重複と、投球の受け手の準備を身体到達だけで扱う点を切り分ける。投影画像の重なりをそのまま物理貫通とは断定しない。
- coverの便益は仲間の同塁宣言/既到着で減らず、同じETAの二人が両方同一base中心を選ぶunit反例がある。個人の観測・受信情報から追加価値を比較する有限costへ修正し、中央固定割当/追球一人制限へ戻さない。
- 別経路でpost-play benchの全員同一点という表示上の重なりも発見。インプレーの公式結果とは分離して扱い、対応結果/残件を最終報告に明記する。

## 実装・検証方針

1. 元51球の実field入力を回帰fixtureとして固定し、修正前FAILを保存する。
2. 同塁coverの重複評価を、受信済み宣言と観測位置/到達見込みから修正する。pickupは消さず、信頼/能力/配置/複数脅威を維持する。
3. 受球準備の不足が残る場合は同じ既存手/姿勢motorを見積もりへ反映する。球の反発/半径/接触探索精度やunresolved guardは緩めない。
4. 修正51入力、信頼/能力/球場差、二塁併殺・一塁カバー・中継・失策回収、関連unit/typecheckを検証する。元試合seedは新版で9回通し、先読み/取消と3HTMLを確認する。
5. 旧V118・元JSONを保護して新版を別名配置。未対応の物理接触条件や未計測条件を完成済みとしない。

baselineは `docs/verification/releases/v119/baseline.json`、詳細再現はローカルoutputs/v119-reproduce-1。再現用に診断callbackを挿入したが演算/RNG/判定は変更していない。外部公開は個人path・生会話・入力本文なしの判断要約に限定する。

## 採用した最小修正

実field fixtureはDecisionの同塁重複cost修正だけでGREENとなった。新結果ではPの保持・送球から2Bが受球し、4.8679sの実 `controlled_base_contact` と一塁走者のretiredを確認した。判断を止めたり実接触を省いて完了させたものではない。Mainの受球時間・接触探索・物理反発への追加変更は不要と判断して採用しなかった。持続接触の一般解を実装したとは主張しない。

採用差分は `LiveFieldDecisionV1.ts` の有限冗長costと、`LiveBaseballMatchV1.ts` の公式終了後のベンチ移動終点のみ。後者は全員同一点だった終点を同じベンチ側の異なる場所へ分け、3秒の歩行・身体/頭の移動offset・公式終了tickを維持した。インプレーへの固定担当割当ではない。ベンチ経路全区間の全身連続非交差まで証明した修正ではない。

Native169入力は同じ集合で、変更は上記2fileだけ。Source球・地面/壁/身体応答・公式rules・選手能力・緑得能・PNG/カメラは不変。候補/宣言の不一致による一時的な重複は許容し、近い球を複数人が追う候補は消さない。

元の51球目入力の完了、同入力の再現一致、frameSecondsだけ変更したfacts/rules/end/finalRunnersの一致を確認bc64b9e6。最終Core `4e1dd0aad2ec2aa4156777e2946e39657d9a25c40406f436d60be5c47a0d964d`。関連102tests、全repo型、PC/スマホ12場面、旧JSON編集保存、状況別19場面、背景生成取消を確認。9回通し/最終配置は別の完了証拠に記録する。
