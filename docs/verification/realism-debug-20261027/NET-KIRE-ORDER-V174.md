# V174 保存80件の実軌道順序

Task `MB-20261027-REALISM-DEBUG-PLAN` Task4。`c71a392b612d490494f06ee73c27ecdc` PASS2703ms。新flight0/現game Core実行0、旧V171選択は変更していない。

保存80件の親receipt/各record SHA/共通初期PV/Trefを確認し、V172初期接線垂直偏差で再観測した。80件すべて共通時間CLASSIFIED、own endpointは80件、ownの全時系列は0件。親のactual ground報告は80件ともなし。仮想重力基準のgroundIgnoredを実球のground無視へ転用していない。

3160対/82160組をlosslessで保存。共通時間とown endpointの両方で絶対2cmかつ相対5%/方向5度を満たす851対/6739組のうち、net p10増加・p90-p10短縮・late20増加も満たす研究順序は2319組。旧探索screen A込みは0組のまま。Aは本人指定や知覚閾値ではない。

事前に固定した順位規則で `.04/gyro30/phase225 → .02/gyro30/phase0 → .1/gyro30/phase270` を一度選択した。最小の隣接p10遅延/区間短縮は.005924013261098704秒、最小late20増分.0025839075810546452、最大相対量差.0040342203726206095。

これは実測/知覚校正、全球種、通常の狙い補正後、3選択UIの採用を証明しない。own timingは `POINT_MEASURED_TIMING_NOT_OBSERVED`、新observerのChrome比較も未実施。次は固定した3件だけをV176で確認する。保存dense/半stepが一致すれば再利用し、不足分だけ測る。

原データは `net-trajectory-matrix-v174-01/report.json`、`cases.json`、`pairs.json`、`all-triples-packed.json`、`ranked-research-inputs.json`。元gravity基準/旧V171/旧FAILは保持。
