# v49 守備ハーネス監査（修正前の証拠）

- 既存の20局面×3能力段階は8 tests PASS。既存9分類では異常0、outsはlow13/default19/high21。これは特定局面と検査分類の結果であり、全プレーの合理性を証明しない。
- 旧分類にはプレー早期終了、公式touch後force消滅、カバー重複、描画で既にベース領域へ入った走者のtouch遅延を検査するものが無かった。
- 新しい6 mutation tests は旧診断で全FAIL、拡張後全PASS。走者の進塁中終了、自由球で終了、同一塁の複数base_cover、合法touch後の支持されない退場（前tick/同tick）、袋内frameと後続officialtouchの矛盾を注入した。
- 拡張診断で同じ60局面を再検査すると2 tests FAIL。RUNNER_BASE_TOUCH_LATEはlow15/default7/high4件。defaultのSS_up_middleは袋内実観測からofficialtouchまで0.3263秒、force_3B_grounderは3走者0.2813～0.2825秒。停止経路中心までtouchを待つ実装の不一致を検出した。原ログ・FAIL receiptを保持。
- 検査は観測/事実の整合性に限定する。touchとbase_controlが同tickならtouchを優先し、時刻解像度の不確実性からOUTを創作しない。controlled_tag/catchは世界から提供された事実として受け入れ、衝突や捕球保持そのものの正当性をこの診断で再証明しない。
- 早期終了の新分類は、最終frameで走者target/速度が残る、または球が非保持という直接矛盾を検出する。静止中でも今後の再判断で進塁可能かを独立に最適化する完全oracleではない。
- 密集の一般的距離閾値をエラーとはしない。塁上受球/走者/バックアップが近接する合法例がある。各人のsampled移動距離、初期位置からの最大離脱、intent別移動を非判定の観測値として追加した。

## 一次資料と設計上の解釈

- [ABCA / Sam Piraro: The Hot Corner: Execution of the Cutoff and Relay System (2020)](https://www.abca.org/magazine/magazine/2020-4-July_August/The_Hot_Corner_Execution_of_the_Cutoff_and_Relay_System.aspx): 打球処理する外野、送球線と深さを整える内野、全体を確認する捕手、送球先後方へ回る投手の役割を区別する。望みのない送球を強制せずcut-holdする。全員を同じ捕球追走へ向かわせず、捕球・塁・中継・後方の仕事を分ける設計の参考。具体的な距離・重み・反応定数を実測値として提供する資料ではない。
- [MLB 2026 Official Baseball Rules](https://mktg.mlbstatic.com/mlb/official-information/2026-official-baseball-rules.pdf): Rule 5.09(b)(6), 本文p47（PDF第59頁） はforced-to baseへの到達でforceが消滅すること、後続走者のforce-outで先行へのforceが消滅することを規定する。Rule 5.09(c)(2), 本文p50（PDF第62頁）はmissed-base appealを別扱いとする。今回の診断はforce消滅の限定再構成を行い、未実装appealを推定して退場を正当化しない。

## 残る制約

サンプルframeはexact bag-entry時刻を解くものではなく、既に袋内にある時点という上限の証拠。足先形状/footfallの実測モデルでもない。60固定局面の成績は実リーグ分布校正や100試合監査、実機確認の代替ではない。product修正後の同検査PASSを別receiptで確認する必要がある。


## touch 修正候補の再検証

Rootが公式touchを宣言袋領域への実侵入へ変更し、motor停止は別イベントとして維持した候補で再検査。最初のcandidateではlate-touch26件がすべて解消し、以下の旧ハーネス依存が露呈したためFAILを保存した。

- 非force本塁tagの実ケースが本塁へ2回送球する展開になった。最初のreceiverを最終taggerと固定した旧testを、最終実tagに先行する最後のrelease→receiver→実secure→tagで照合した。実tag/捕球の因果assertは保持。
- 正marginを注入するnegative controlが、旧catch→runner到達1.1秒固定フィルタに隠れた。固定窓を除き、1B到達前・base1の実hold決定だけ検査する。正margin contradictionは引き続きエラー。
- low 56_hole_grounderでは、外れた送球がreceiverを通過してから正常に追走回収へ切り替えていた。旧診断は後の拾い直しまで全時間をflightと扱い、正常解除をmidflight cancellationと誤検出した。最後の過去frameだけだと55ms区間がclosest approachをまたぐため、接触を挟まない実発射位置/速度/spinから当該過去観測時刻までfree-ballを再構成し、目標を通過済みか検証する。pre-release seenAtを注入した負例は引き続きmidflight errorとなる。接触を挟む不確実な場合はこの説明で免除しない。

HARNESS-TOUCH-GREEN_4222b810a6ba4ca2835a42a90927e60e: **17 tests PASS、60局面すべて現14分類anomaly0**。outs low13/default18/high20、既存minimum-outs/ability monotonic assertionsは維持。候補時点でglobal TypeScript checkもPASS。ただしclosure/roleのroot作業は続いているため、最終固定sourceに対する証明とは区別する。


## 正式守備ポジションの matrix と最終診断検証

定型20fixtureの既知P/C/1B/2B/3B/SS/LF/CF/RFを、productionのdefensivePositionへ明示登録した。これはfixtureの配置定義であり、productionのplayerId特例ではない。

- HARNESS-POSITIONS-FINAL_5862c73352a14dc1adcbe87fd32bd465: **18 tests PASS、20局面×3能力段階すべて14分類anomaly0**。outs low13/default18/high20、infield outs9/13/15、旧minimum-outs/ability-monotonic assertionsは維持した。
- 正式position化で初回glove接触が変わり、以前のpost-pass対照だけが『初回接触前の通過』仮定を満たさなくなった。正式60matrixは維持し、post-pass負例は既存APIのposition省略入力を明示した独立対照へ固定した。
- 途中でlegacy fixtureにundefined値を入れcloneInertのinert-data境界に拒否された作成ミスがあった。プロパティ自体の省略へ直し、原FAIL receiptを保持した。productのvalidationは変更していない。
- 同候補時点でglobal TypeScript checkはPASS。owned診断2sourceはfreeze。通常HTML・試合・全suite・publicationの最終判定はroot側の統合検証による。


## 持球tag改善後の既存テスト因果更新

root統合suiteの旧期待2件を、product変更を行わず実fact/判断traceで監査した。

- 一塁force受球後に同じ守備者が走者を直接tagできるため、旧「必ず2送球」の固定期待は不要な再送球を要求していた。実force送球2.3143秒→受球と一塁支配3.2962秒→同じ保持者が6.5087秒に実tag。新assertionはforceの実配送・捕球・支配、同保持者の実tag、force支配後の再送球なし、各送球に対する手準備/速度/reach/実receiverを維持する。
- 反応60秒の受球者を拒否するfixtureは、旧「必ず一塁停止」期待だった。実際は一塁motor停止後、二塁到達ETA4.6930秒に対し守備ETA5.3123秒、margin+.6193秒で安全進塁し、三塁はmargin−3.9556秒で停止した。手準備なし・送球なし・架空支配/tagなし・棄却送球判断なし・motor完走後終了という元の因果目的を維持し、安全二塁進塁と危険三塁辞退をassertした。

CAUSAL-ASSERT-TRACE_abd4d94c6ca74b9186feaeef8046d0d2 は固定期待の原FAILとtraceを保持。CAUSAL-ASSERT-GREEN_0051690c27314922ac17578259e620bd はLiveFieldPlayV1.test.ts全20 tests PASS。変更ファイルは同testのみでproduct変更なし。
