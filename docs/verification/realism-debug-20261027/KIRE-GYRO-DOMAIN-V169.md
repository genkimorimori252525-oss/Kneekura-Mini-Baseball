# V169 有界軸方向試験

Task `MB-20261027-REALISM-DEBUG-PLAN`。全goal継続。3技能/選択UIは未完。

事前固定した新24件（spin .04/.08、gyro0/60/85、phase0/90/180/270）を5000tick/同Chrome156で実行した。既存56件は親receipt/全record/hash/同じ計測依存を照合して再利用。V168のLivePitchV1変更と追加helperは旧版同一と偽らず、物理kernel/空力/姿勢/観測関数のbyte不変と、実旧新binaryの同省略入力161Source一致を根拠として区別した。

`99c626670d5a4a509dcb9f9904301611` PASS9.421秒。新24件のMain/実Worker/JSON全record同値、旧再計算0。全80件/3160対/82160組の判定をlosslessなindex/flagと、case/pair/near行へ保存し、全verbose tripleとsummaryの往復を送信前に厳密比較した。378check、end pins一致。結果は `kire-gyro-domain-v169-01/`。

旧A込みのmodelCandidateは0、refinement計算0、通常authoring計算0。旧near311組はすべて旧56由来で、新24を含むnear組は0。新caseを含む1620対には近量方向3対があったが、どれも旧adjacent screen未達。protocolを自動拡大しない。factory新7件 `d063bbb7`、新TS追加後の全型 `2080ded9e0cb47c287b6d2b389be15d5` PASS26.281秒。

## 保存結果だけから得た次の切り分け

near311組中143組は、Q=旧量/方向、P=p10増加、D=p90-p10短縮、L=late20増加をすべて満たし、A=旧adjacent screenだけを満たさなかった。旧Aは `Δp50/Tref >= .05 OR Δlate20 >= .05` であり、本人指定や実測知覚閾値ではない。旧A込み候補0を変更しない。

一例は同spin .04/gyro30、phase5→-5→-15。p10=.17126176394729611/.18151635441465838/.19278273400624948秒、区間=.30093369017151916/.2877558073337846/.27781888524149967秒、late20=.20588338575890158/.21444285855635611/.23655154776068843。隣接の最大A不足量は.028540014140464434であり、丸め差とは扱わない。

独立設計レビューでは、Q/P/D/Lだけを満たすものを別category「物理的順序入力・実用的段階差未確認」としてdense/half/通常PVへ評価することは本人要件に沿うと判断した。旧screen合格・明確な技能差・知覚可能性・実測/Native認定へ昇格しない。次測定前にcategory/選択規則/対象を固定し、結果で入力を選び直さない。

Task5の未完では、wall-support後の遠方poleが現在時刻停止を強制する箇所を限定読取で特定した。新no-contact windowは別V170設計として進める。Kireの未完を削除したり、この別課題で代替して全goalを完了したりしない。
