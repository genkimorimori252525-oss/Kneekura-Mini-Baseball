# V156 キレのモデル内実現可能性を調べる固定実験

2026-10-27 / MB-20261027-REALISM-DEBUG-PLAN / root。前turnはV155 Source/Workbench/UIの実装と限定検証を完了したprogress。全goalはACTIVEで、独立した終盤集中の実現可能性は未証明。今回の実行前プロトコルを以下へ固定する。ゲームのSource・力・得能・既定clock・元JSON・素材・既存候補は変更しない。

## 固定条件と比較基底

公開curve preset/変化量4/seed3/zoneの通常Workbenchを1回実行し、その実リリースposition/velocity・origin・horizon・重力・風・係数profile・groundを全条件へ使う。再照準しない。spin軸（元/元spinを初期相対風速方向へworld外積軸で30度回す）×材料位相（元/各case spin軸のworld90度左積）×seam（保存係数/scale0）×spin減衰（保存値/property省略）の16条件。spinの大きさは回転で保存する。ゼロspin・平行軸・必要設定欠落は黙って補わず拒否する。

seamのON/OFFで積分精度まで変わることを避け、基準の実seam解像度 `resolveAerodynamicIntegrationStepTicksV1` を全caseの共通nominal stepへ固定する。基準caseの実経路は従来の実効stepと同じ。これは明示されたlab内counterfactualのprofileであり、gameの既定profileを書き換えない。元nominal step・共通step・各caseの解決stepを全て保存する。

実装時の訂正（screen結果を見る前）: 「同じ初期実効stepなら元経路もbit完全一致」という期待は実証されなかった。旧gate FAIL34ddfa2d、差分診断FAILf7d6e450で、1083tick共通labと元nominal5000/初期実効1083の最大position差4.8068e-15m、velocity/spin差約7.1e-15を観測した。外側格子から渡す浮動時間差と、減衰に伴う内側resolverの増加により、元入力は1step、固定入力は1083＋微小残余となる可能性がある（因果trace自体は未確定）。上段の「同じ」は初期実効stepに限り、同一数値軌道の主張を撤回する。

元normal descriptor/全sampleはそのまま保存し、**同一の元descriptor**を正規kernelへ戻したp/v/spin/姿勢/phase/clockの完全一致を必須gateとして保持する。labの異なる宣言profileとの比較はexact=false・最初/最大/全時刻の実差を無加工で保存し、tolでPASSへ変換しない。共通lab内の同一descriptorのMain/実Worker全record一致も引き続き必須。Sourceを修正して元軌道を変える対応は取らない。

主比較は基準通常球のplate到達時刻Trefで打ち切った共通時刻・同じairless-gravity基準。重力との差は空力全体であり、Magnus単独や「重力を除いた純変化球」の実測値と呼ばない。各case自身のplate到達時刻も別に残す。従来のzero-spin基準は材料位相/seam設定で変わるため、それを横断比較の共通基準にしない。各球の同zでのgravity-only差・従来無回転差・速度/飛行時間も併記する。

## 実行前の数値規約

主比較の最終XY量が1μm以上かつ単調、実groundなし、同z到達が成立したcaseだけを対比較する。時刻閾値はV155と同じ最終XY方向への射影。瞬間drag/lift/seamと各成分の同方向射影を保存する。

16caseの全120対を列挙し、次の両基底で量と方向が近い対を選ぶ。

- Trefの共通重力基準に対するXY量、および同zでの重力基準に対するXY量。
- 各量差は `max(0.02m, 両case平均量×0.05)` 以下、各XY方向差は5度以下。

量/方向が近い対のうち `abs(Δ(p50/Tref)) >= 0.05` または `abs(Δlate20比) >= 0.05` を、時間形状差の調査候補とする。これはこの実験のscreenで、現実のキレの認定値/能力値ではない。閾値は結果を見て変えない。

160区間の主観測に加え、全16caseを640区間で観測する。さらに共通物理stepを半分にした別の全16caseでも640区間を取り、観測補間と積分刻みの感度を分ける。高密度化で実球や元Sourceを再基底化しない。物理step変更は感度実験の別profileとして保存する。

対が得られても、真の打者知覚や現実の独立late-onsetの証明にはしない。得られなければこの固定範囲で未実証。一般不可能とは結論せず、任意時刻のforce ON/OFF、別seed/係数の事後選別、得能名の結果補正をしない。

## 実装・検証・復旧

追加先は `tools/verification/pitch-break-feasibility-v156.ts` と同Chrome/実Worker runner、限定テスト/結果記録。正規Source kernel、V155/PBT観測、既存Quaternion/空力APIのみを使う。新しい飛行solverは作らない。全Core入力をV155 pinへ照合し、通常Workbenchの基準球が同一Sourceであること、実Workerと同Chromeの全記録一致、JSON再計算、入力不変、factor以外のprofile保持を検証する。

出力は新folderへ保存し、旧FAIL/TIMEOUT/UNKNOWN/候補と原JSONを保持する。復旧は追加研究工具を使用しないだけでよく、ゲーム既定へ変更はない。Source commit/push/merge/deployはこの判断に含めない。次のモデル改変はこの実験と一次資料の根拠を評価した別工程とする。
