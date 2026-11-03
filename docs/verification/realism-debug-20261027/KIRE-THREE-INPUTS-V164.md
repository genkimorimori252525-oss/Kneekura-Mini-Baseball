# キレ3段階のモデル入力候補 V162–V164

Task `MB-20261027-REALISM-DEBUG-PLAN`。全goal/Task4 Step5・7は継続。通常の選択UI・実技能・全球種への採用は未完。

## 結果

同一の公開curve4/seed3、投げ出し位置/速度、共通時計を固定し、既存モデルの初期spinと材料姿勢だけで、近い変化量を持つ3つの時間分布を得た。新しい力のON/OFFや結果補正は導入していない。

| モデル内の相対段階 | spin比 / gyro / phase | 共通時刻の変化量m | p50/Tref | 最後の20%の時間に生じる変化の割合 |
| --- | --- | --- | --- | --- |
| LOW | .04 / 30 / -5 | .12386139687709047 | .615989597860714 | .21444285855635611 |
| MIDDLE | .1 / 30 / 270 | .12295433718260444 | .6816809096044364 | .3452028282647652 |
| HIGH | .02 / 30 / 0 | .11783260501297511 | .7881740440608048 | .47889850311705 |

3対すべてで、共通時計と各到達断面の両方について絶対差2cm以内かつ相対差5%以内、方向差5度以内を満たした。最大相対量差は .049887807036746806。通常5000tick・観測160分割、同刻み640分割、半刻み2500tick/640分割の全3条件で候補と順序が一致した。半刻みの最大相対量差は .049887790327607026。

## 実行と再利用

- V162固定40条件: 26分類/14非単調、近量方向13対、3段階候補0。`c5d17d988047434b826e77a34de12757` PASS 7.639秒。0候補も結果として保持。
- V163弱位相17条件: 旧3件を再利用し新規16件だけ計算。全19分類/候補0、`dc3cf43adca544c0ae6f4d528453df0c` PASS 3.328秒。固定中/強自体が量条件を満たさない入口判断を見落とした。記録は修正せず、次のanchor事前検査へ反映。
- V164: 中をV162の既存Bへ変更。通常19件は全件再利用し、候補の和集合5件だけ観測密度/半刻みを追加計算（新規10件）。`188cf8349d7f4aa49de730075281957e` PASS 4.233秒。Main/実Worker/JSONの全record厳密一致、入力/Source/親receiptを照合。
- helper: V162 11件 `5dad9c86`、V163 11件 `140e0c7b`、V164 9件 `a1bcdb8d`。最終全型 `841a1b81e05346a0a1c1770e9efbc68d` PASS。
- 保存抽出 `390346871faa404387baf38e73c8d81b` PASS。この文書と同じディレクトリの `calibrated-three-inputs-v164.json` と `calibrated-model-integrity-v164.json` が保存入力。元の飛行を再計算していない。

## 適用範囲と次工程

3段階はモデル内の相対的な候補であり、キレ○/キレ◎/脅威の切れ味◎として未採用。保存済み3recordを読んだところ、p10は弱181.516ms/中158.491ms/強200.677msで中→弱→強と逆転した。p50/p90順だけの成功を「変化が始まる時期も段階順」と扱わない。既定無技能より全段階が改善する証拠、通常の狙い補正後の量/時間分布、他球種/左右、実測校正も別途必要。力は投げ出しから働くので、無力期間や真の変化開始遅延を証明したとはしない。

## V165: 初期順を含む保存データ診断

`fb5920e169714677ad1aff3f0e44cbb2` PASS 718ms。V162の40件とV163の新16件を使い、重複3件の全record一致を確認して除外した。新規飛行0件。56件/1540対/27720組から近量方向311組、旧primary候補3組、p10/p50/p90をすべて厳密増加させる候補は0組。旧条件や閾値は変更していない。全311判定を `kire-saved-onset-v165-01/near-triples.json`、各56件の値を `cases.json` に保持。report SHA `cd0cb5cf769f12eb77628f83a624e04c5e0da60bcafc8d615ca3686c762bc423`。

保存されていた原public投球はp10=.15565143785865876s/p50=.3593860558308054s/p90=.4919562602559961s、late20=.33948230220410675、最終量=.55995568806448m。今回の低spin約12cmとは量が異なり、保存時Source集合も同一でない（sameSavedSourcePins=false）ので、別列の記述比較だけに限定した。既定比の改善証拠へ昇格しない。

したがって、この入力域の3段階は未成立。3技能の適用や表示へ進めず、成立しない候補でのV166通常試投も実行しない。新規実験の自動拡張はしない。次は既存空力Sourceの入力を、投手が制御するrelease・球の物性・環境に分類し、検証可能な技能入力と未測定値を具体化する。名札や時間指定の力補正で埋めない。

`tools/verification/check-kire-authoring-v166.mjs` は通常V78保存spin/q/seam→2Core/Main/実Worker/JSON・同PV共通161sample・3pair時間分布の検証用として準備済み。Chrome/studyは未実行。適格入力が成立した場合だけ使い、V159のmax-horizon差はそのまま保持する。production Source/ゲーム候補はV161から不変。

## Sourceの適用域と実装先

限定読取により、投手の実release値のownerは `src/integration/browser/LivePitchV1.ts` の `simulateLivePitchV1()`、名目値/保存検証は `src/integration/browser/LivePitchAuthoringV78.ts` と確認した。spinは保存値→一様倍率の再現誤差→任意workload、qは保存値の直接入力、velocityは球速変動/狙い誤差/逆算→任意workloadを経てSourceへ入る。現在、キレ技能や手指動作から名目spin/qを決める経路と、軸/材料姿勢の再現誤差は未接続。左右変換はV78 preset生成時に行い、Source直前で重ねない。

`BaseballAerodynamics.ts` は現在のvelocity/spin/qから力を求める。`BaseballSeamForceV1.ts` はquasi-steady mean-force近似で、独立の開始時刻入力や流れの履歴状態を持たない。mass/radius/density/wind/viscosity/drag/coefficientProfile/spinDecay/seam係数は球・環境・モデルの値で、キレ技能ごとに変える根拠はない。有限56条件の不成立から全release入力の不可能性を結論しない。

次の実装判断は、既存release owner内で、選択した技能→制御可能な名目spin/q→実行誤差→実Sourceをどう接続するかに限定する。既存の個人球速上限/spin上限/unit q/保存履歴を維持し、測定されていない手指能力や姿勢精度の数値を捏造しない。新しい測定を行う前に、基準無技能・球別適用域・同量/方向・p10/p50/p90/late20・狙い補正/保存/Workerの受入を先に固定する。

UIは既存 `live_trait_profile_v2.selections` とcatalogのselect、`stateId:null`による通常復帰を使う。`breaking_ball_quality` は提案ID/UNSUPPORTED/nativeStates=[]のままで、3段階のstate/実行consumerが必要。`TECHNIQUE`の汎用effectScale数値欄をこの選択へ露出させない。本人指定表示は「キレ○／キレ◎／脅威の切れ味◎」、旧aliasは履歴として保持する。
