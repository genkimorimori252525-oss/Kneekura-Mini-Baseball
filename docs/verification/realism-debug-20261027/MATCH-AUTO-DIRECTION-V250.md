# 通常試合の方向おまかせ: Hostの限定検証

2026-10-31。無指示の通常試合で既存の方向判断を利用できる明示opt-inをHostへ追加。現在の攻撃側の明示requestが優先し、その不在時にAUTOを使用する。本人の既存方針・方向分布・観測への反応の優先順位は既存ownerを使う。設定を継続状態にbindingし、再開時の追加・削除・変更を拒否。未指定時は旧形式のまま。

局所検証: 両halfの正規遷移・明示PULL/AUTO・TAKE/BUNT代表・binding・旧fullrecord/continuation/RNG/clockは `0f9eee6b3b8844ec933cd3e8e382b073` PASS。本人方針／既存sector優先 `7633b6785a404f1eb3d7ac6bdef4b875` PASS。保存HOOKのV244明示試行でopt-inと明示AUTOのrecord/capture一致 `620627988b83486d8fe6ddd99bad927d` PASS。malformed `23f6c82c4b7544f185ebc424aa59b887` PASS、strict `938a7072cabf4ff28ccae4d3818e46a7` PASS。実BUNT motor、非zero prior混合、資格付きV123 spin占有はこれらからは未証明。旧omission比較は２球TAKEに限定。

実Chrome 156.0.8078.76で本人データを正規importし、元打順・両軍・球場を維持。事前固定seed `20261019,20261030,20261031,20261101` の４打席、先行投球を含む109球を実行。本人12球は見送り５・空振り３・接触４。12球全てAUTO/REACTIVE、振った７球は方向運動PLANNED。Mainと実Workerの全record/captureが一致し、各初球後の同captureから両者を再構築して次球一致。receipt `d11bae8b1baf4c8cab996d2cf898fa03` PASS、207.311秒、report SHA-256 `7a1ed1918dfa286c4b92380fdca4c116c8a42dacdb2a14a598eb83926f2e7025`、127 artifact・logを照合。未中断Hostと再開Hostの独立比較ではない。

ゲーム内座標では三塁・左翼が−X、一塁・右翼が＋X。左打者の４接触は全て中央線より流し側で、初球 −13.54°／−15.36°、５球目 −18.90°／−21.36°だった（`atan2(exit.x,exit.z)`）。最初の２打席は初球接触で終了し以降の球はない。全４打席・12球の結果であり、方向固定や一般的な偏りの解消・悪化は断定できない。read-only `afc9f53ea88b4f27a2afd95671426007` PASS、結果SHA `3d723f1f74da36729979aef7ee493d21661a10e22848b17545eb0111cbc730fb`。このrunはV151記憶を使うがV222 region経験は未設定。family認識・人間校正・通常UIでの選択・９回・完成配送は未完。

初回 `7617d165fae44967a496469332c89230` FAIL は投球前にcheckerのWorkerイベント到着を待たず停止したもの。４seed全分母とraw結果を保ち、同じ条件・新outでイベント待機修正後に実行した。旧RED・テスト期待誤り・型誤りも原receiptに保持する。

## 通常試合の選択画面

実装候補 `work/match-auto-v250-ui-candidate-01/game.html` SHA-256 `747a15da906e256b46c9adc1560730cc49d599dc32c59655d5755197592a51f3` は、新試合の方向おまかせを「従来／観測に応じて両軍へ適用」から選べる。試合中の変更は次の試合から有効。OFFはpolicyを省略し、ONでは使用したversion/sourceIdを試合記録へ保存する。既存の方向指示と得能との優先関係はHostの条件を維持する。

通常HTMLの実Chrome GUIで OFF→途中ON→次の試合ON→途中OFF→次の試合OFF、summary実download、各受理球の連続Mainと実Workerのrecord/continuation一致、390px selector表示を検証。receipt `6b102df44b12423a8afb0281f008b0d8` PASS、95.265秒、report SHA-256 `a74ffe843e3570b113a50c85f4b17cbadb9b66e4845e608b5373e32774805f98`。通常画面の５球は接触・守備０。画面を主担当も確認した。Makerの２つの埋込ゲームも同じ動作を検証用に表示したiframeで比較したが、隠し描画用frameでありユーザーGUI操作の証拠には数えない。通常gameには継続状態を読み戻すGUIがなく、試合記録の保存はresumeを意味しない。

候補HTMLは検証版であり、完成版のMaker・通常HTML・調整室の同版配送ではない。メーカーの打撃練習における方向指定／おまかせの既存受入と、通常試合のこの選択機能は区別する。

## 流し側を選ぶ経路の保存済み分析

４接触球それぞれのV161の名目候補17件は全て予測接触があり、うち６件は左打者の引っ張り側を予測。現REACTIVEは準備時の幾何移動速度cost最小で選ぶため、４回とも流し側の予測候補を選択した。各回で最も低costの引っ張り側候補との差は順に約 1.113、1.175、0.400、0.320 m/s。保存結果のread-only比較 `aa9fe1a456074d849387930a297c813c` PASS、result SHA-256 `d1818f8957ba33e1a93ca15bb9c470919eee7305f5750791f88a2e934bfdfb50`。これは既存の有限予測と制約の結果であり、候補が実際にその方向へ接触する保証でも、costが人間の身体的努力の測定値である証明でもない。本人の懸念に沿う具体的な選択経路を示すが、４例だけで一般的な偏りや別の選択規則の効果を断定しない。
