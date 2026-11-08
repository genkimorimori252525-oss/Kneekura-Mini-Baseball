# 配達済み位置からの予測精度 pilot

2026-10-30 JST / MB-20261027-REALISM-DEBUG-PLAN。配達済みの過去位置だけで予測精度を改善できるか、実装前に固定した8機会を比較した。異なる投球は6つで、重複する2組を独立試行と数えない。接触しなかった機会も除外しない。旧V151や実試合のdefaultは未変更。

同Chrome156.0.8078.76・同SourceFreeBallKernelの古い位置をcutoff以前だけ再構成し、保存済みの3観測と旧V151 forecastを8件とも完全一致で再現した。その後に限って実球の未来を読み、各予測と同じ時刻の実位置誤差、および同じ面への到達時間誤差を評価した。実未来・実接触・実spinは予測の選択入力にしない。

| モデル | 異なる6投球の位置誤差中央値 | 最大 | 事前固定のpilot基準 |
| --- | ---: | ---: | --- |
| V151・直近3点の定加速度 | 34.815 mm | 43.595 mm | 基準 |
| 直近最大7点・二次QR | 46.873 mm | 58.172 mm | 未達・6件中改善0 |
| 直近最大7点・三次QR | 2.774 mm | 3.143 mm | 達成・6件中改善6 |

到達時刻の絶対誤差中央値は、1MHz時計でV151が300.49μs、二次が438.93μs、三次が33.92μs。8slotと6uniqueの全値・欠測判定をlocal artifactに保存。7f7a4ad0 PASS、18artifactとreceipt/log/endpinsを実SHA照合。初回4f9a70eaは各元caseの技術成績FAILを操作失敗と誤認し実行前に停止、修正前失敗として保持する。

入力位置はノイズのない理想観測であり、サンプル数は6投球。人間の知覚・実選手能力・他投球への一般精度を証明しない。Astraの限定レビューは、V246を明示実験として接続し、minimum4点/QR安定性/予測範囲/初回forward crossing、旧V151 fallback、p/v/aとanchorの整合、normal/trial同入力・未来排除を要求した。特に下流V153がp/v/a定加速度で接触探索するため、三次予測を最後まで物理的に保持したとは扱わない。

次は明示version・旧default/JSON/RNG/clock不変で、範囲・数値条件不足の理由付きfallback、位置/速度/加速度同一多項式、現在の配達済み標本のみを実装し、従来モデルと同じnormal/trial条件で実接触・回転を再検証する。予備的な位置誤差改善を4技術成立やGoldへ昇格させず、元の成功条件とすべての旧FAILを保持する。

## 明示V246の本人一投比較

V246実験policyを固定し、本人L/obp-23_5・TOP seed20261031の保存済み1投を同Chrome76・同Coreでnormal/trial各1回比較した1728bd75 PASS22.796s。新Host初期captureはpolicy binding以外が旧beforeと完全一致。両armのV246 7配達点snapshot/effective forecastは一致し、fallbackなし。旧V151 raw・V222 snapshotと両continuation内の旧memoryも一致。actual TOP成分は新normal −222.647→trial +90.599 rad/s。旧V151の同機会では +521.876→−649.814だったが、これは同一機会のモデル比較であり独立した反復や習得ではない。準備5.247秒、Core normal2.573秒/trial2.718秒はこの一投に限る。入力・Source・bundle/end pins、3artifactとreceipt/logは照合済み。4技術の反復検証と製品default/UI採用は未完。

## 新予測による固定反復の実験

既存の固定seed・同一成功条件を維持し、デバッグハーネスからV246 policyを事前に指定。これはMaker UIの既定機能やNative資格ではない。Chrome76／同Core・通常側と試行側の同じ7点予測、旧V151/V222記憶、Main／実Worker全record・保存再開・通常tailを比較した。

- TOPSPIN 20261031/32: 45d45e8d PASS168.078s、2回とも三次予測有効・フェア接触、normal −222.647→trial +90.599、−227.648→+68.348 rad/s、未校正の事前診断条件2/2。旧V151条件の同機会では1/2、旧FAILは保持。
- HOOK 20261102/03: 977c7bf1 FAIL165.905s、両回とも三次予測有効。1回目normal −99.960→trial +134.009 rad/sで成功、2回目は候補なしの通常接触で未達、全分母1/2。正常動作・記録比較・保存再生は通過。旧FAILも保持。

両caseの11artifactずつ、receipt/log/endpinsを実SHA照合。BACKSPIN・SLICEの同条件検証、測定ノイズや他選手・十分な独立投球、全4技術の自然な習得・Gold・製品default/完成版配送は未完。今回の実行時間は検証一式の測定であり試合全体の性能ではない。

- BACKSPIN 20261030/31: 2dea7bfd FAIL161.375s、三次予測2回有効・両方実接触。1回目の要求成分はnormal −379.762→trial −56.424 rad/sと改善したが逆符号のまま、2回目は+222.647→+534.048で成功。全分母1/2の未達、Main／Worker全record・保存再開・通常tailは一致。11artifactとreceipt/log/endpinsを実SHA照合。

- SLICE 20261101/02: d6e46e3e FAIL243.639s、三次予測2回有効・両方実接触。1回目の要求成分はnormal −204.369→trial −101.619 rad/sと改善したが逆符号、2回目は+99.960→+247.698で成功。全分母1/2の未達。全record比較・保存再開・通常tail・endpinsは一致し11artifactを照合。旧V151条件では2/2であり、この固定組では新予測による後退を保持する。

新予測の8 slotにおける局所結果はTOP2/2、HOOK1/2、BACK1/2、SLICE1/2。位置予測pilotの改善を全技術の回転成功率改善とみなさず、Makerの製品既定値には採用しない。異なる技術間で重複する投球は独立練習回数として合算しない。
