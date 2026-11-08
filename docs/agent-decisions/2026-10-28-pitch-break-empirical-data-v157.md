# V157 次工程：低回転の実測平均係数と材料位相

2026-10-28 / MB-20261027-REALISM-DEBUG-PLAN / root。V156の固定16条件は近量/近方向40対でも時間形状screen0だった。これは高spinのcurve/2軸/2位相/保存seam・減衰の範囲の陰性結果であり、低spinや一般のキレを不可能と結論しない。元goal・全残件を維持する。

## 次の順序を変える理由

未校正のseam重みの範囲を広げて好ましい球を探す前に、状態依存の力を支持する一次資料が得られた。まずグラフの取得・座標同定・測定範囲と誤差を整理する。現Source/既定profileへ自動採用せず、得能や任意の時刻のON/OFFで力を加えない。Source変更の具体設計は、取得したデータを評価した別の判断として残す。

## 取得の優先資料

[Borg & Morrissey, AJP 82, 921–927 (2014)](https://doi.org/10.1119/1.4885341) / [著者側のPDF](https://baseball.physics.illinois.edu/KBall/Borg-AJP-Oct14.pdf) / [関連Morrissey thesis](https://epublications.marquette.edu/theses_open/8/)。read-only担当は本文を確認済み。rootは次工程で原図・座標を直接確認する。

- Rawlings MLB球、2S/4S、50rpm、流れに垂直な回転軸。主force曲線はRe=1.6×10^5、代表速度の本文表記31m/s=70mph。SourceのR/粘性/温度から同じReになるかは未照合で、数値を合わせるために物性を捏造しない。
- Fig.3：静止4SのCL(θ)、Fig.4：4S静止と50rpm、Fig.5：静止2Sのlift/lateral係数、Fig.6：2S静止と50rpm。誌面924–925頁。元PDFの物理page番号と図/軸の対応を確認してから読む。
- 2000Hz・300回転・9反復からの**ensemble平均**。瞬時2000Hzのforce(t)やwake相関時間として扱わない。数値CSV/生系列は未取得。図をdigitizeする場合は元PDF SHA・図・座標変換・読取誤差・周期端の扱いを記録する。
- 結論p.926では、2Sの位相120–180度で正lift、その後の負liftを、浮いて見えてから落ちる説明に結び付けている。同終点量/終盤集中の直接対比較は未取得。

50rpm曲線は**全lift係数**であり、既存Magnusへseam項としてそのまま足さない。新しく検証するなら、測定範囲/軸/パターンに限定したtotal transverseの平均profile、または根拠を持つ成分分離が必要。動的lateral係数、任意3D姿勢、高spin、ground後の低速等への適用は別の未検証範囲。旧forceのfallbackで範囲外を黙って成立させない。

## 補助資料と限界

[USU Garrett/Smith data](https://digitalcommons.usu.edu/all_datasets/191/) / [Smithほかの論文](https://doi.org/10.1007/s00348-023-03751-3)は、Re/材料姿勢/回転数に対するPIV分離位置や原画像が公開対象。CSVは剥離角であり、force(t)ではない。担当側の実downloadは403で本体未取得。剥離角を力へ変換する法則を作った扱いにしない。

[Darbois Texierほか, Physics of knuckleballs (2016)](https://yakari.polytechnique.fr/Django-pub/documents/darboistexier2016rp-1pp.pdf)は非定常力のスペクトルを扱うが、元spectrumはsmooth sphere、自由飛行は主にbeach ball。未報告位相は乱数であり、野球の発生時刻を予測/校正した根拠ではない。seedを選んでlate候補を生成する手法として採用しない。

## 具体的な次作業

1. PDF原図と本文の座標/符号/2S・4S/軸/50rpm・Re条件を照合する。局所データを新folderへ保存し、既存画像/原スイング/原JSONを保持する。PDF全文や原図を公開repoへ転載せず、一次URLと読取データ/誤差を必要な範囲で記録する。
2. Fig.4/6の平均CL(θ)を、取得できる精度で数値化できるか検証する。測定の標本/ensemble差と図の読取誤差を分ける。取得できない成分を0の測定値として補わない。
3. 現Sourceへの対応では、実material Quaternionの位相と流れ/回転軸の座標変換、全liftの二重計上回避、profile適用範囲、必要なforce/speed boundを設計する。まだ新modelを既定採用/Native認証しない。
4. 既存法則側の追加比較が必要なら、同PVの低spin倍率.02/.1/.3/1×gyro傾斜0/30/60/85度×位相0/90/180/270度の64条件を**実行前に別protocolへ固定**する。小変位の打消しだけによる割合増大を、人が感じるキレや70cmの例と同等に扱わない。量一致は相対5%と絶対2cmの両条件を報告し、10cm以上の帯も分ける。候補選別は数値screenであり、時間集中が実証された能力認定ではない。
5. 大きい配列を1payloadへ積まず、caseごとの有界出力/全値比較を使う。同一Source・clockのMain/実Worker比較、保存入力再計算、観測密度/物理stepの感度、ground/非単調/微小/未到達の理由を保つ。元Sourceと別lab profileの差はV156同様に明示し、tolで完全一致へ変換しない。

本記録は次工程の採用判断ではない。資料取得/限定検証を進めるための具体化で、Task4物理再現は未完。Task2/3・V154・SPIN/Native/旧残件・性能B/9回/同版配送・SIGN命名のペナント延期を保持。Source commit/push/merge/deployなし。
