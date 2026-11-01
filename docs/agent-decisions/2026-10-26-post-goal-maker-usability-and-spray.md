# 現goal完了後のメーカー整理・方向比較・投球比較

2026-10-26 JST。本人がこのチャットで「ゴールが終わったら、写真の作業をおこなってくれ」と明示した後続作業。現在のtask `MB-20261026-TRAITS-SPIN-CONTINUATION-V123` / SPIN v2＋SIGN基盤＋V122残件の完了条件に混入せず、そのgoalの実装・必要検証が完了してcompleteにした後に着手する。記録だけで新しい自動化や別goalを作成しない。

## 2026-10-27 最新 — 本人JSONを取得し、流し側への偏りを再現（未修正）

本人が`にーくら選手とバット (2).json`を提供。59857bytes、SHA-256 `e0123a572d66bf6bd5fa92af6c9ffbe6fe47fbcf27d00135c9441bf95927b3ce`。元fileは変更していない。以下の「編集済み入力未取得」はこの提供前の履歴であり、現在は同fileの`livePhysicalRoster`を取得済み。ただし比較UIのseed/投手/球種選択そのものは保存されていない。

Nichiroの1-b0 entryは左打ち・明示clip`obp-23_5`。top.playerは別の新規右打者、top.reference/scenarioも別系統なので、比較UIの元buildInputに従いlivePhysicalRosterだけを採用する。比較seedはUI既定20261019と明記し、top.scenario.seedを流用しない。本人rosterの投手/捕手もそのまま使い、初期選手と無断合成しない。

凍結V122 Core IIFE・元roster/library/decoder hashを照合したread-only診断を実行。初回dbc4454bは診断VMのstructuredClone未定義でFAIL、productバグと混同せず保持。実native clone後の通常object/array再帰rehomeと11項目preflightを追加し、undefined/-0/alias/cycle/元例外を保つ今回のinert graphだけの環境へ修正。一般browser完全互換とは称さない。

- 配布初期inputのinitial-02: `4f55e22738af4334bbe797df917c5536` PASS、8実行。
- 本人inputのuser-roster-01: `2d2daa9eb1874d3d8c4b946a4afd7592` PASS、8実行。
- 全16試行で実contact。同じcourse groupの4弾道内で投球Source descriptor/hash一致。zoneとinside、mode間の同球は仮定しない。
- 本人inputの左打者pull側符号付き打球角度は、zoneが弾道1〜4で約-29.06/-31.20/-38.34/-64.48度、insideが約-21.34/-19.96/-19.19/-18.92度。全てopposite側。初期clip51_3でも両course全弾道がopposite側で、報告された偏りを既定seed条件で再現した。

これだけでclip単独・得能単独・振り遅れを原因と断定しない。保存したbat pose/velocity/contact normalと、同一pitchの限定ablationからcontrollerの狙いと実接触幾何を次に分離する。product/UI/物理の修正は未着手、元goal後の実装順序を維持する。診断script/原結果は`../verification/post-goal-maker-spray-v122/`と`tools/verification/post-goal-maker-spray-v122.mjs`。本人の入力全文/私的保存先/原生ログをGitHubへ公開しない。

## 依頼された後続作業

1. 通常は打撃方針で操作し、細かい個人差は任意の詳細設定に整理する。
   - 打撃方針: 出力、コンパクトさ、修正優先度、追い込まれた際の対応。
   - 選手の個性: 一球ごとの意図の揺れ、方針への従い方。
   - 身体能力: スイングの加速上限。
2. 「動きの上限」「狙い方」の意味が分かりにくいとの指摘。既存の色・デザインを保ち、単位/対象/操作結果が分かる名称・配置・必要最小限の例へ整理する。通常操作のために全内部数値の手入力を要求しない。
3. Makerのニッチローを弾道1〜4で比較すると全て流し打ちになり、内角でも流すという報告。得能/スイング/メーカー入力のどれが原因かを実ログで切り分ける。原因を確認するまでは得能のせいと断定しない。比較UIでコース/狙い/左右/seed/clip/接触時刻/実バット・打球方向がどう結び付くかを調べ、必要な修正と通常HTMLの整合を判断する。

上記3の質問に答えるためのread-only Source調査は現goalと並行してよいが、後続機能の実装・UI変更は本人の順序指定を守る。現在の不十分さを「全項目が方針から自動決定済み」と偽らない。

## 確認済みの現状

`BatterApproachPolicyV121`は出力/コンパクトさをpower/contactで変えるが、全項目の自動生成ではない。Makerの`SwingPolicyV121`は任意の手入力設定であり、未設定時は従来経路を維持する。メーカーの「打撃方針」AUTO/TAKE/SWING（振るかどうか）と、試合のpower/contact等の使い方を、同じ意味として説明しない。

旧Source/JSON/HTML、能力・得能・個人差・球場差、公開ランクと真Sourceの分離を保持する。UI/データ変更前に対象・影響・検証/復旧方法を具体化し、本人の今回の実装依頼範囲で判断を記録して進める。後続実装を終えたと偽って元goalをcompleteにしない。元goal完了も後続作業の完了も、それぞれの証拠で判断する。

根拠は本人の直接指示。公開記録に私的画像path・生会話・個人ファイル内容を掲載しない。GitHubの既存作業記録への同期は、現工程のまとめに含める。

## 並行read-only監査（未修正・未試打）

既存SolによるCode追跡。比較UI/Core・初期roster・measured libraryについて、v122固定manifestと現Sourceのhash一致を確認したとの報告。編集済みの本人保存入力と実接触ログはまだ取得していない。以下を実際の「全て流し」の再現結果と混同しない。

- `docs/demos/baseball-maker-ball-comparison-v69.js:43-65`と`MeasuredTrajectoryComparisonWorkbenchV69.ts:43-49`: 比較は全打者共通。4段階とも同seed/投球/能力/明示clipを使い、impactTrajectory.levelだけを変える。方向や接触時刻を結果へ強制代入しない。方向入力が共通なので同方向の結果と整合するが、物理が返す打球方向を固定する仕様という意味ではない。
- clip未指定時は同じ左右の先頭default clipを明示選択して4試行へ渡す。初期左打者のニッチローは`obp-51_3`となり、この比較中はseedによる別clip抽選をしない。同じ左打ち/clip未設定者にも共通する。
- `docs/demos/live-game-roster-v98.json:566-630`: 配布初期ニッチローは左打ち、pullAngleDegrees=-3、technicalTimingOffsetSeconds=0、contactDepthMeters=.15。方向配分/new approach/個別clip未設定、得能は悪球打ちのみ。悪球打ちは実行誤差への作用であり流し方向を選ばない。本人が後から編集した能力/得能/clipを確認した意味ではない。
- `LivePitchV1.ts:206-208,325-333,363-369`: 方向入力はv122 approach→旧5方向配分→保存pull角の優先。内角の投球目標Xを変えたら必ず引っ張りへ切り替える分岐はない。最終打球は接触時の剛体状態から計算する。

仮説は基準clipのバット姿勢、実接触時刻の前後、接触法線の寄与。保存pull角-3だけで大きな流し角度を説明できるとは断定しない。弾道の差だけを制御比較する目的と、状況に応じて合理的に引張/センター/流しを使い分ける目的を混同せず、**内角なら必ず引張り**という結果の強制で修正しない。

後続では既存の「比較条件と結果をJSON保存」からinput.batter全体/seed/コース/clip ID・hash、各段階のcontact.tick/referenceContactTick/motorDelaySeconds/playbackRate、directionIntent/batterIntent、normal/segmentT/exitVelocity、接触時のsampleBatAtTick姿勢・速度を取得する。同条件の別左打者・別seed・別clipも必要範囲で比較し、個人設定/共通フォーム/時刻/表示左右を分離する。本人へ同じ問題説明を繰り返し求めず、この監査から再開する。

## 追加依頼 — キレ/ブレーキ/変化量と狙い補正

本人が同じチャットで、変化量1と7のカーブの終点が似ること、ふくらみと落ちる量を取り違えていないか、同じ狙いへ合わせる初速方向補正が原因ではないかを指摘した。補正があるなら投球の比較タブを追加してほしいという条件付き実装依頼。Source確認で条件が成立したので、上記と同じgoal後queueに追加する。5cm/30cm/25cmは説明例であり、全球種へその数値を固定する承認ではない。

確認済み:

- `PitcherWorkbenchV77.buildPitcherWorkbenchInputV77`→`simulateLivePitchV1`は通常試合と同じ投球計算を利用する。
- `LivePitchV1.ts`のrelease直前に、狙いと予定回転・平均空力から初速度の方向を3回補正している。意図した強い変化も同じ狙いへ届くよう上向き等を調整するため、終点の一致だけで変化量の差を判断できない。ただし縫い目の実現偏向はこの平均補正へ入れず、投手の回転再現失敗も補正後に実現するので、実投が必ず狙いと一致するという意味ではない。
- `PitchMovementV92`の0〜7は、基準4に対し[0,.25,.5,.75,1,1.25,1.5,1.75]の編集倍率で回転と縫い目の強度を変える。球速・リリース位置は保存し、回転方向も保つ。ナックル/上限制約には別処理がある。実測cmの目盛りでも、段階ごとの曲がりが必ず単調増加する保証でもない。
- 現投手調整室のcmは「同じ初期位置・初速度で回転だけを0にした球との差」。元空気抵抗と縫い目を残す。`PitchQualityV121`には別に「空気抵抗・マグヌス・縫い目を外して重力だけ残した球との差」、回転効率、有効回転、リリース〜本塁の速度低下のread-only観測がある。これらを同一指標や、ブレーキ/キレの独立調整機能が実装済みという意味にしない。

後続の変更対象:

1. 既存表示様式のまま、「狙いを合わせる（通常投球の補正あり）」と「投げ出し方を固定する（基準球のリリース位置・初速度を保持して回転等だけ比較）」を切り替える投球比較タブを追加。参照する基準球/球速/再現性/seedと、補正した投げ出し角・実際の終点を明示し、比較条件を保存/再読可能にする。
2. 変化量・総落下・重力/空力差・速度低下を混同しない見せ方にする。本人の意図する「終盤でどれだけ曲がったか」も測定区間を定義して観測する。図に合わせるために特定地点から突然力をONにしたり、結果座標へ強制offsetを加えない。
3. ブレーキは球速差/到達時間/飛行中の減速を分け、キレは終盤軌道や打者の判断時間との関係を含めて整理する。必要な調整項目は物理モデルとSourceに根拠を持たせ、変化量と一括りの万能Buffを追加しない。通常試合の狙い補正は保ち、比較用固定リリースのために試合AIを無補正へ変えない。
4. 原0〜7/既存球の保存形式・物理・JSON互換を無言で再定義しない。例示したcmの通りへ一律設定せず、球種/球速/回転軸/縫い目/個人再現性を保つ。変更前に具体的な互換/移行・検証を判断記録へ残す。

参考確認: MLBのPitch Movement/Induced Vertical Breakも、重力込みの総変化と重力によらない縦変化を区別する。一次資料 https://www.mlb.com/glossary/statcast/pitch-movement 、 https://www.mlb.com/glossary/statcast/induced-vertical-break 。用語をゲーム独自の0〜7目盛りと同一視しない。今回はSource読取と資料確認のみで、比較タブ/UI/物理の修正は未着手。
