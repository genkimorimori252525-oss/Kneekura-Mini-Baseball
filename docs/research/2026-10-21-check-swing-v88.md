# チェックスイングと打撃能力の設計調査

調査担当: ユーザー指定のLuna (`gpt-6-luna`)。コード修正担当とは独立して一次資料を調査。

確認日: 2026-10-21
対象: にーくらMini Baseball。「空振りは振り切る」「意図的に止めるハーフスイング」を別挙動にする案、および「ミートが高いほど止めやすく、低いほど振り切りやすい」という仮説。

## 結論

- 「ミート」と、開始後の動作を止める能力は別の要素として扱うのが妥当。ミートは接触精度、チェックは軌道情報に応じて運動開始後に抑制する能力に近い。ミート値が高いほど止めやすいという公開データ上の裏付けはない。
- 通常のStatcast CSVはチェック試行と成功停止を識別できない。ただし2026年PCLのchallenge済みcheck-swing裁定は公開StatsAPI live feedに個別記録が現れる。これは挑戦対象になった裁定に限られ、全チェック試行、バット運動、停止成功率の母数にはならない。
- 既存能力で判断を表現するなら、絶対選球眼を「見送り/振り始める判断」、積極性を判断閾値、タイミングとaim誤差を予測・動作のズレに使うのが自然。停止能力を差別化する場合はミートから直接導出せず、内部パラメータ/将来の独立能力とするのが概念上は整合的。ただしMLB公開データで較正できるとは言えない。
- MLBの公式ルールはチェック判定を角度で普遍定義していない。45°は限定されたマイナーリーグのchallenge試験基準であり、公式一般定義として扱わない。

## 1. 原因・視覚情報・意図変更・停止時間

Gray (2009) は20人の選手による高忠実度打撃シミュレーションで2494球を記録し、リリース角度が打者の選択範囲外、または球速/縦位置の予測と実際の軌道がずれた場合の抑制をモデル化した。ボールの飛翔から得る時空間情報により振る判断を変更できても、開始後の停止には限界があり、実験上、partial response (減速して始める) は95%、interrupted response (通常に近い速度で開始後に止める) は41%が「バット先端がプレート前端を越えない」基準を満たした。途中停止の信号はスイング相開始後平均212msで始まった。これは実験上の運動指標であり、実戦の審判裁定・MLB選手の成功率ではない。

研究では抑制反応の発生割合はskill高低群で有意差がなく、著者は経験レンジが狭い点を限界としている。これをパワプロのミート能力へ読み替えることもできない。よって本研究だけでは「ミート高ほど停止しやすい／低ほど振り切りやすい」を支持・否定できない。

## 2. 公開データで比較できる範囲

Baseball Savantの[Statcast CSV辞書](https://baseballsavant.mlb.com/csv-docs)では `description` は投球結果、`type` はB/S/X、`plate_x`/`plate_z` は投球位置。`swinging_strike`等を用いた空振り率やゾーン別傾向は集計できるが、「チェックを試みた」「打者が停止した」「審判のハーフスイング裁定」を示す独立フィールドは辞書にない。通常のtakeと成功チェックを区別できず、swinging strikeも停止失敗を示すものではない。

**例外: 2026 PCLでのcheck-swing challenge記録。** 公開StatsAPIの[2026-06-25 Salt Lake–Albuquerque feed (gamePk 815439)](https://statsapi.mlb.com/api/v1.1/game/815439/feed/live)を実見すると、`result.description` に「Omar Martinez challenged (check swing), call on the field was overturned」とあり、`reviewDetails` に `isOverturned: true`, `reviewType: "MZ"`, `player.id: 683079` / `fullName: "Omar Martinez"` が記録されている。したがってchallengeされた裁定の種類、挑戦者、覆り/維持を試合feedから抽出し、**challenge内の overturn rate** を記述することは可能。2026 PCL開始を定めた[MLB公式記事](https://www.mlb.com/mets/news/new-rule-changes-coming-to-minor-leagues-in-2026)は5月5日開始・45°基準を記載し、Isotopesの[公式Game Information PDF](https://img.mlbstatic.com/milb-images/image/upload/milb/vs5yqvtqyigxuczs2kdd.pdf)も同基準を説明する。

このchallenge成否は審判の初回裁定を覆せたかであり、選手の運動抑制の成否ではない。challengeのないハーフスイングや身体動作は分からず、挑戦は戦略的に選ばれるため、challenge対象選手の割合から個人の停止能力、停止成功率、ミートとの相関は算出できない。バット軌道の生データはStatsAPIの上記feedにも含まれない。

## 3. 能力値への割り当て

絶対選球眼1..100は投球を見て振るか選ぶ判断、積極性は振る判断の閾値、タイミング/aim誤差は振り開始時点や接触位置のズレと対応づけやすい。ただし、これは運動開始後の抑制動作そのものではない。まず「開始前」「減速/抑制」「振り切り」を動作状態として分け、既存能力だけで成否を出す必要がある場合は選球眼を判断変更、タイミングを停止可能時間のproxyとして使い、ミートの直接効果は入れない案が妥当。専用能力の導入はゲーム内で持続的な選手差が必要になった時に検討する。いずれもMLB公開記録で較正された式ではなく、設計仮定と明記する。

## 4. 公式裁定

[MLB公式2025 FSL記事](https://www.mlb.com/brewers/news/check-swing-challenge-comes-to-single-a-florida-state-league?t=mlb-pipeline-coverage)は、Official Baseball Rulesにcheck swing定義がなく、通常の判定は審判裁量であると説明する。Rule 8.02(c)はボール判定後にハーフスイングを塁審へ確認する手順を定めるが、角度の線は定めない。2026 PCLの45°はMLBの公式な実験ルールとして使われる閾値であり、ホームプレートを越えたか等の独自機械判定を公式の一般定義と説明しない。

## 主要資料

- Gray, R. (2009), *A model of motor inhibition for a complex skill: baseball batting*, PubMed: https://pubmed.ncbi.nlm.nih.gov/19586249/ ; 著者公開全文: https://www.researchgate.net/publication/26655640_A_Model_of_Motor_Inhibition_for_a_Complex_Skill_Baseball_Batting
- Gray, R. (2011), *Visual-Motor Control in Baseball Batting*: https://journals.sagepub.com/doi/10.1068/ic353
- MLB公式2026 PCL試験説明: https://www.mlb.com/mets/news/new-rule-changes-coming-to-minor-leagues-in-2026
- MLB公式2025 FSL試験説明: https://www.mlb.com/brewers/news/check-swing-challenge-comes-to-single-a-florida-state-league?t=mlb-pipeline-coverage
- Official Baseball Rules PDF (MLB配布): https://img.mlbstatic.com/mlb-images/image/upload/mlb/ub08blsefk8wkkd2oemz.pdf (Rule 8.02(c), Definitions “Ball/Strike”)
- Baseball Savant Statcast CSV辞書: https://baseballsavant.mlb.com/csv-docs
- MLB StatsAPI例 (2026-06-25, gamePk 815439): https://statsapi.mlb.com/api/v1.1/game/815439/feed/live
- MLB公式Albuquerque Isotopes 2026 Game Information PDF: https://img.mlbstatic.com/milb-images/image/upload/milb/vs5yqvtqyigxuczs2kdd.pdf
