# V151 位置観測の予測と未分類経験記憶

2026-10-27 / root / MB-20261027-REALISM-DEBUG-PLAN。前工程V150は実装・実検証を伴うprogress。step-007を継続する。

## 変更前の不整合

LivePitchの旧予測は1時点の真position/velocity/spin/materialOrientationと実空力profileから外挿し、観測時刻も将来のplate crossingに依存する。既存のfutureSourceUsed表示だけを厳密な非未来保証へ昇格できない。さらにzoneRecognitionはprior混合後なので、その結果を新しい独立観測として再学習すると自己確信を増幅する。

## 判断と範囲

新しい明示V151 policyで、release基準の観測時計を決め、配達された位置標本だけを入力する推定器を接続する。2点は線形、直近3点は一定加速度の外挿。これは打者の予測モデルであり、正史の物理を置き換える簡略シミュレータではない。正史は元のSource/時間刻み/接触/回転/裁定を使用する。新policy省略時の旧結果を保持する。

新しい標準policyは運用上の明示Sourceとして、旧判断の上限0.14秒をrelease基準に固定し、位置標本の間隔0.02秒、配達遅延0（旧経路と同じ未校正の即時配達）、予測上限2.5秒を使う。正の遅延も受理・検証する。これらは人の測定値ではなく、校正前の理想位置観測モデルである。選球眼をms/確率Buffへ変換せず、既存の認識誤差とmotor制限を残す。Nativeの明示校正必須型へ偽の校正値を登録しない。

生の位置予測、本人の保存された事前方針、過去の経験を混ぜた予測を別々にtraceする。記憶には生の予測だけを使い、実pitchType/非公開repertoire/未来Source/contact結果を入力しない。初回はprior無し、受理済みの一球から経験を得る。未採用branch、再生、再開だけでは経験を増やさない。

経験は最大3件の運用windowで保持し、実際の経験標本のempirical mixtureから独立streamで一つを想起する。既存本人approachのpriorRelianceがあれば優先し、なければ共通運用policyの重み0.25を明記する。人格・方向の均等profileや個人の実測値として保存しない。重みは予測入力の合成であり成功率補正ではなく、外れた経験は次球の準備を誤らせ得る。

球種classifierはまだないため、新型のclassificationをUNCLASSIFIED_OBSERVED_FLIGHTとし、confidenceはnullを維持する。球種family×region推定の原要求をこの経験記憶の実装で完了扱いにしない。位置confidenceを球種reliabilityへ流用しない。通常の感情を能力Buffへ変換しない。

## 根拠と検証

本人の同Core高速debug・打者心理/連続打席・未来情報禁止のgoal、元BAT/DIR/SWG/PLV仕様、V150読取監査に基づく。過去の球とカウントが運動に影響するという研究は機構の参考で、今回の数値や個人校正の根拠にはしない。[Gray 2002](https://pubmed.ncbi.nlm.nih.gov/12421060/)、[Gray & Cañal-Bruland 2018](https://doi.org/10.1016/j.psychsport.2018.02.009)。本文取得不可の箇所はabstract以上を推測しない。

検証は位置だけのpure推定器の数学境界/未配達・未来suffix不変、受理済み経験だけの記憶、Host/練習/Workerと同seed・同continuation一致、元JSON/旧入力互換。新経路の遅い観測が接触後へ漏れないよう、元運動prefixの接触を先に調べ、観測以前に閉じた球を再観測しない。根拠なく速度・時刻を丸めない。

変更は別名候補で検証し、共有dist/元V133/元JSON/原PNG/スイングを保持。復旧は新policyを省略または旧候補を使う。Sourceは未commit/push/merge/deploy。全goalはACTIVEで、球種分類/人の校正、方向幾何/キレ、SPIN/SIGN基盤と旧残件、性能B/9回、最終配送は維持する。
