# 配球経験を次球の準備へ反映する

2026-10-30 JST / 全Goalの利用機能「打者心理・配球履歴」の次の完了単位。Sol主担当が既存Sourceを照合し、Astraは新しい情報・保存契約の一点だけを独立確認した。通常判断は本人の継続・委任指示に基づき記録して進め、追加の承認待ちを設けない。

## 届ける動作と未完の境界

同じ打者が同じ投手から得たコース経験をまとめ、次球の準備位置・到達時刻に反映する。同時に、後続の球種family推定に必要な観測根拠を、計算時点で凍結して保存する。これは全心理やfamily認識の完成ではない。familyは根拠が揃うまでUNKNOWN、confidence未設定を保持し、元Goalの残件へ残す。

既存の方向4選択・連続打席・独立13乱数domain・位置予測を作り直さない。物理、時間刻み、実行誤差、本人JSON、roster、旧成果物を変更しない。

## 現在の根拠

V151 Evidenceは本人×投手・投球連番・観測／利用可能tick・raw予測位置・到達時刻・region・元観測IDを保持する。位置系列と速度／加速度は保存しない。既存想起は1件を選び現在観測へ混合する。明示V122 family beliefのconsumerはあるが、V151からの分類producerは無い。単一予測点から実pitchTypeを同定できない。

## 検討した案と判断

- **A: region経験の集約だけ。** 小さいが後続推定の観測根拠欠落を残す。
- **B: region準備priorとversion付き観測sidecar。採用。** 既存保存schemaを保護しながら、利用動作と必要な根拠保存を同単位で接続する。Astraもこの案を推奨した。
- **C: 作者pitchType・非公開repertoireや一点予測からfamilyを埋める。禁止。** 真値教示・偽confidence・情報不足の隠蔽になる。

## 不変条件

1. 新policyは明示version/bindingを持つ。V151の厳密Evidenceへfieldsを追加せず、sidecarを別versionへ置く。省略時は旧branch・出力keys・RNG draw消費を完全保持する。旧JSONから位置系列を補作しない。新Makerで既定採用する場合も旧continuationの旧configはそのまま復元する。
2. sidecarは本人×投手・pitchOrdinal・evidenceIdと結び、raw forecastのusedObservationIdsと最大3標本を順序・値・時刻まで照合する。V151が実際に記憶するraw forecastのcutoffで凍結し、受理後に増えた観測から再構築しない。初期／late updateを混同しない。
3. observedTick / availableTick / originTick / ticksPerSecond、座標・単位・予測planeを解釈可能に保存する。estimatedVelocityはplane到達時点の推定速度。2標本の加速度0は未推定モデル仮定、3標本推定と明確に区別する。観測された無変化と称さない。
4. 次球origin以前に利用可能な同pairの経験だけを使う。既存の同じ1drawで選ばれた経験のregionを用い、そのregion内のraw位置・release相対到達秒を平均する。選択頻度と追加draw0を保持し、null regionを既知regionへ再配分しない。familyId:null / confidence:null / familyRecognized:false / humanCalibration:NOT_MEASURED。
5. 記憶はraw予測だけ。prior混合を自己学習しない。公式一球受理時だけ記憶と対応sidecarを一緒に更新し、preview / 再生 / 保存はcommitしない。保持上限・削除・本人／投手分離を対応させる。明示V122 priorの既存優先順位を維持する。
6. 新policyとV151観測の設定必須条件、途中変更拒否、continuation bindingと旧restore経路を実Sourceに沿って定義する。通常Host / 実Worker / Makerへ同じ契約で明示採用し、未使用のopt-inだけを置いて完成扱いしない。

## 実装・検証の単位

新pure moduleと回帰、観測freeze取得、LivePitchの準備／診断、LiveMatchの受理・保存再開、必要なexport / UI設定採用に限定する。具体fileはTerraの型・組立確認後に所有を確定し、広範refactorをしない。

単体は空／null region／未来未配達／別pair／同region複数／固定draw／2対3標本仮定を確認。統合はrawのみ記憶、preview非消費、明示prior優先、旧省略fullrecord互換、次球の準備変化と保存再開一致。新Sourceで通常Host対実Workerの有限caseを受け入れ、新Maker検証版へ採用する。旧2048seed・方向matrix・同条件のChrome成功は再演しない。

各完了時に「利用可能化／新検証／残るfamily・校正・全心理・最終配送」を機能表とCCGへ短く残す。全Goalをこの単位へ縮めず、全受入・最終配送前のGoal completeは禁止。

## 直前受入版のpractice保存互換（限定例外）

UIはbuild全体の一致を先に検査する。CoreのsameConfigurationは保存設定の不変を確認するだけで、異Coreの意味的互換を証明しない。Astraの新一点reviewにより、proof前は厳格拒否を維持する。

許容候補は直前4ff95023受入版だけ。保存build object全体と指定target build object全体を厳密固定し、旧/新Source pinsと実検証receiptを持つ今回限りの互換proofへ結ぶ。旧configにV222が無く、continuationにも新sidecar/bindingが無い場合だけ。未知field/欠損/別hash組合せ/V161等未証明版/新policy混在を拒否し、将来buildへ自動継承しない。

実旧Workbench bundle2b954cb4…で作成したcaptureを新bundleへ渡し、同じ次commandのfullrecord・次capture・RNGtraceを旧bundleと厳密比較する。新同士の保存再開だけでは足りない。saved configurationの書換・新既定値注入・旧series補作は0。現build一致とCoreの通常検証は残す。target UI自身hashをコードへ埋める自己参照は避け、検証済み外付けmetadata等で固定する。本人原JSON保全を無制限crossbuild continuation互換へ拡大しない。

Terra読取で、現在のV151 commitはdecision cutoffのdiagnostics.batterObservationV151.rawForecast、lateEvidenceV121.rawForecastではないと確定。captureは同じforecast呼出で標本とのpairをfreezeし、commit対象raw全値/cutoff/usedIDsと一致を検査する。

旧/新のUI互換proofはconsumerと同じChrome build内で行う。Node old/new比較は補助に限定し、既知Node/Chrome末尾差があるためbrowserのbuildguard許容根拠へ流用しない。旧実module由来のHost/captureを保持し、新同士比較へ化けないことと全record/nextcapture/RNGのlossless一致を確認する。
