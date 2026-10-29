# 技術別運動を元練習の根拠へ結ぶ

全GoalのSPIN4技術を、タグではなく運動→実接触→回転→空力へつなぐための次の単位。

V223の正常再認証で、保存BACK / TOP資格は真正だが、TOP選択と無指定のplan / commitmentが一致すると確認した。技術別の目標は元command.planに残る一方、旧contact DTO / mastery refsには渡っていない。旧資格hashを書き換えたり、同じ練習6件を再生成したりしない。

## まず利用可能にする根拠

`SqliteStandalonePracticeStore.ts`へ別versionのread-only motor evidence exportを追加する。既存byEvent / learningGuard / 正規contact・release proofを同snapshotで通し、元command、clock、model / repertoire / equipment、plannedDelivery、consumedRelease、contact / ball、実装familyを凍結したdata-only DTOで返す。元sourceとphysicalProofHashへ対応させ、hashをauthorityの代わりにはしない。`originalContactNativeAdmission`は元接触の受理を指し、新しい技術採用の受理とは呼ばない。

旧DTO / 旧registry / writer / 旧Mastery deriveを変更しない。資格との結合は循環importを作らずgate側で行う。DTOはdetach・deepfreeze、存在しない値の補作、実contactからの事前目標逆算を禁止する。

## 適用域の判断

A: 同じsetupで保存絶対planを再現できる根拠まで。handedness、姿勢、zone、座標、plane / depth、時刻基準、観測条件が必要。絶対contactTickを次球へそのまま移さない。

B: 相対motionへ変換する場合、元release・固定physics・計算規則に結ぶ未補正の事前anchorと当該planの対応を独立に証明する。保存された補正済みplanやprofileRefだけから±.02を復元した扱いにしない。Bが不明ならUNKNOWN、Aでも時計移替え等が証明できなければ原練習再現に留める。

旧資格fullref、元3contact、認証したmotor evidence、適用域・transform・根拠を参照する新version Owner sidecarと新consumerが後続候補。4技術共通型を設けても、BACK / TOPの証拠をSLICE / HOOKへ転用しない。新しい適用域を主張する根拠が既存原本に無いときだけ、変更した契約での新practiceが必要か判断する。

## 実装と受入

Terra所有は既存Storeの新exportだけ＋新test＋必要な新readonly gate3files。編集前に全bytes baselineとGit親を別保存した。追加exportを除けばbaseline全文へ逆変換できるproofを用意する。他dirtyをGit親へ戻さない。

genuine SQLite正常Reader、missing / wrongfamily / reference / proof改竄、caller transaction / query_only / savepoint / authorizer、old DTO全値不変、detach / freeze、全rowid / schema / head / data保全を確認する。新readonly gateは原DBを開かずpaired copyで元6plan・anchor有無を再認証し、前gateと目的を区別する。新practice・新接触・Native技術採用・回転加算はこの段階では0。

根拠不足を外部Raw不足と決めつけず、正規原本のどの情報が未保存かを具体に記録する。全SPIN4・希少Gold・球種認識・最終配送の受入をこの単位へ縮めない。
