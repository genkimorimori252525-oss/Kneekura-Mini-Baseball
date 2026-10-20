# 04. 検証マトリクス、再現手順、リスク、受入と中断のルール

## 最初に試験証拠の水準を区別する

**PASSは分割表記**する。計画・source compilation・単体機能・9人役割候補生成・Native physical pitch・一塁OUT partial・K/BBのみ9回・混合打球公式9回・PNG表示・スマホ実機は、全て異なるレベル。

| 品質ラベル | PASSの必要証拠 | 2026-10-15時点 |
|---|---|---|
| DESIGN | ユーザー決定、承認/保留の別、設計ownerと入力が明記 | 多数あり、未定値と未実装も多数 |
| SOURCE_EXISTS | 実TS/HTML/APIがありSource管理された | 物理・ルール・9人AI候補とBrowser分離プレビューあり |
| SCOPED_UNIT | 該当単体Vitest、境界、型検査PASS | 88 PASS / 1 SKIPの限定監査あり |
| CAUSAL_PHYSICS | Accepted物理球・バット・身体・知覚Sourceが読める | 一球・打席、実一塁ゴロ事例の部分sourceで証拠あり |
| OFFICIAL_KBB_9 | Native SQLiteで実K/BBのみ9回完走・再読 | 178球/58打席/9回/1-0、履歴一致PASS |
| OFFICIAL_MIXED_PLAY | K/BBだけでなくフェア/ファウル、守備と走者、連続送球、RuleEngineが同一native Ledgerへ保存され9回完走 | **未達** |
| PNG_ONE_CORE | 旧試作結果を排除して正式Coreの同一sourceだけで通常画面を動かす | **未達**（v25/v28は別観測モード） |
| DEVICE_OFFLINE | 実PC/Android/iOSの9回プレイ、保存/再開、冷起動、クロス機器hash比較 | **未達** |
| PRODUCT_ACCEPTED | すべてに合格・ユーザーの視覚承認・政策承認を伴う | **未達** |

「テスト数が多い」「100試合完走」だけで上位PASSへ昇格しない。同一Sourceに帰属しないケースの足し算で元LAN01の通し合格を作らない。未完の物理プレーをゲームが進むように偽のOUTへ置換しない。

## 1. 再開前の技術コマンド

ワークスペースはWindows PowerShell。必ず実際のレポジトリに移動して、git statusが利用者の作業を保持しているか確認する。

    git status --short
    git branch --show-current
    git rev-parse HEAD
    git remote -v
    git log --oneline -8
    git ls-remote --heads origin

必要な元のブランチ名は 00/02 にある。リモート参照にリベースする際は他作業者がいるか検査して、無断のforce pushやmain mergeを避ける。保存後の当該Draft PR #380も確認する。

ライブラリと型検査：

    npm ci
    node tools/catalog/compile-catalog.mjs
    node_modules/.bin/tsc.cmd --noEmit --pretty false

厳密な局所テスト（2026-10-15に実行し11ファイル88PASS、1SKIPになったセット）：

    node_modules/.bin/vitest.cmd run src/core/sim/fielding/GeneralDefensivePlaySearch.test.ts src/core/sim/fielding/GeneralTeamTacticalCoordinator.test.ts src/presentation/mini/OpticalBaseballGlyph.test.ts src/presentation/mini/NativeSpinOrientationObserver.test.ts src/integration/browser/NativeAerodynamicObserver.test.ts src/integration/browser/NativeAerodynamicReferenceFixture.test.ts src/integration/browser/NativeImmutableReplayLedger.test.ts src/integration/native-game/TeamCoverageExecutionGate.test.ts src/integration/native-game/PhysicalLivePlaySmoke.test.ts src/core/rules/ForceDoublePlayVerticalSlice.test.ts src/core/rules/P1RuleAcceptanceMatrix.test.ts --reporter=dot

Nativeブラウザ境界：

    node_modules/.bin/vitest.cmd run src/integration/browser --reporter=dot
    node tools/browser-bridge/build-native.mjs
    node tools/browser-bridge/check-native.mjs
    node tools/browser-bridge/build-demo.mjs

Node/SQLite正式K/BB 9回の元受入は大きい（以前415.74秒）。必要なときだけ別実行し、失敗/タイムアウトを区別：

    node_modules/.bin/vitest.cmd run src/integration/native-game/PhysicalGameSmoke.test.ts --reporter=verbose

実打球のNative追加ケースは、1件本当に通った partial check と、source所持者の重い完走が**skipped**だった。既存のtestを短縮し成功扱いに変えず、実行できる時間/元sourceを確保して別途実施する。

長時間元LAN01：docs/project-status/2026-10-09-nonvisual-nine-area-status.mdのrights 4 journal+terminal 17操作。最後の保存Source・owner状態を読み、受理済みprefixを再演せずに元の継続機構を利用。成功した別版のsuffixから最新fresh全体PASSとは主張しない。

## 2. 全シードの正史照合監査

**ユーザーの明示希望：100試合程度、全seed、全内部記録の照合。それより良い方法なら改善可能。**

推奨:

1. 全100固定seed＋300追加seed、打者戦術・投手配球・打球方向・左右・守備レベルを組み合わせる。ただし試合AIが正史を生成できる段階になってから計数。特別なケースを選ぶ固定seedも別枠で追加。
2. 各球のsource record：gameId, playId, pitchId, seed, accepted command/issued tick, original pitch position/velocity/spin/releaseOrientation, swing/actual rigid contact, post-contact flight/contact, surface, secured custody, transfer/release, all 9 defenders source and bodies, all occupied runners and motor ticks, legal force/tag context, RuleEngine, Scorebook/Official, Presentation tickを保存。
3. **同じtick/Source**で「画面で捕った」対「正式捕球成立」「表示走者のベース到着」対「公式force」「球が場外へ実際に出た」対「ホームラン」を1行ずつ照合する。後から結果に合わせて描画軌道を補正しない。
4. 同seed＋同commandの独立リプレイで、正史event hashとSnapshot hashesが一致。OS/FPS/画面/視点/球表示倍率/拡大HUDの有無／アプリ終了→再開で正史が不変。
5. 意図的なログ改ざん（未来の球の地面接触記録、存在しない受球、走者時刻すり替え、先着なのにOUT、腕力を過大にする、未受理の配球、重複SourceID、壁反射をout-of-play、球の保持中にfree描画）を監査へ投入し、全て拒否すること。異常挿入テスト自体の弱さも検証する。
6. テストの累計件数は PASS/FAIL/SKIP/TIMEOUTを分け、物理・野球規則・描画・永続化に種別分類。Source/commit/実行環境/DurationとCLIログを同梱。

旧v22 fixed100の25,000球級・約149万検証PASSと旧v23の100+300=400試合・85,254球PASSは**旧ブラウザ自己整合性**。Native混合9回へ転記してはいけない。

## 3. 野球ルール・走者の必須検証

| 対象 | 入力の条件 | 期待する正史挙動 |
|---|---|---|
| 初回大谷の外野飛球疑惑 | seed TBD-LAD-2025 初打席5球目など | 真の地面接触、球と野手のグラブ距離、actual possession、公式安打/失策/フライアウトが矛盾しない。単に表示結果名を書換えない |
| 二塁の先着とSAFE | 一塁走者が強制二塁、実送球が先着 | fielder secure球＋合法ベース触塁とrunner接触時刻、フォースが有効かで審判認定 |
| 二塁→一塁／本塁→一塁 | 同じ汎用9人AIに異なる塁上・距離・速さ | 片方の受球が次の球保持者となり、実転送し、RuleEngineが独立に最大2OUTを判定。名称で2OUTを足さない |
| 一塁を先にOUT | 一塁で打者走者のフォースOUTが先 | 他走者の強制義務が解除され、二塁を踏むだけではアウトにならない |
| 満塁ホームフォース | 三塁走者本塁到達とホーム持球時刻を比較 | 実受球＋捕手踏みの合法性で認定。遅い野手はセーフになる |
| 飛球・インフィールドフライ | 直接捕球／地面接触／審判宣告 | 打者OUT時は強制進塁を解除。走者の帰塁／合法なタグアップ／犠飛／失策を別判定 |
| 3アウトと得点 | ホーム触塁と第三アウトが近い | force 3アウト等の得点無効条件を適用。結果画面と世界が同じ記録を示す |
| 四球・押し出し | ボール4個、占有走者複数 | 打者も走者も実身体で合法的に進塁、表示途中で未来の塁状況に切り替えない |
| ファウル | 真後ろ／両翼スタンド／境界線 | 実打球角度／接地/捕球/lineで決め、ファウル処理2/5秒の表示を確認 |
| 球場差 | 複数フェンス、天然芝、内野土、土/芝境界 | 初期守備位置とfoul lineを同じworldから決め、物理転がり・バウンドを素材で校正 |

## 4. 物理・打撃・投手の試験軸

- 球種ごとの最初のworld回転軸/角速度と球面縫い目の見え方を、800rpmと2200rpm、release phase既知/不明、spinDecayあり/なし、60/120/高Hzとシャッター時間で比較。高spinが低spinに見えるaliasを評価。ただし露光は表示のみ。
- 球が投手から遠くへ飛ぶ投球視点で、世界距離の増減につれ球直径が連続的に変わる。minimum径一定となる平台、固定白円や表示消失を禁止。俯瞰では**打球だけ**小さく、投球/送球の視認性は維持。
- 見逃し球のカメラは以前承認済みの浅い角度に固定。捕手へ180度振り返る演出は復活禁止。
- 木製バット画像の輪郭、ノブ/グリップ/芯帯/ヘッドと本人身体、打者・捕手双方の投影が一致。芯狙いに微誤差があり、バット接触→実弾道まで因果を追える。都合の良い当たりの乱数抽選なし。
- NLBティカオの投球目標、実release、球種、空力飛翔、ミット地点、捕手の配球提案と投手の拒否記録を比較。ナッパの選球の悪さが制球の物理精度を下げない。
- ゴロの滑り→回転転がり→摩擦減衰、芝・土・人工芝、跳ね返りが1球のstate machineで発生。空中位置固定/瞬間移動はFAIL。

## 5. 画面とシーンの操作試験

1. バットは球の真の接触時刻に沿い、follow-through終了前に走者発進しない。後方ファウルも含め正規球道を打者が一時的に追い、フェアなら走者カメラへ。
2. 投手カメラは被打球で2秒以下の追尾、実守備者が関与するなら守備者カメラへ。投手本人処理なら切替しない。Runner POVはホームラン確定時に前へ向く。
3. 実secure possessionで白球が消え、放球で表示復活。野手と捕手が持った球がグラブ外でゆらゆら残るのはFAIL。俯瞰例外を勝手に復活しない。
4. LF/CF/RF名が読め、赤色の走者名がどの視点でもわかる。攻守で人名が入れ替わる際は選手IDで追う。
5. アウト確定tickから打者/走者はベンチへ向かう。3アウト全員即移動、ただし合法なタッチアップ/三塁からの生還の途中経過はRuleEngine次第。1秒ホールドは表示のみ、1秒以降のタップで2〜4秒ベンチ演出を短縮。
6. ファウルは最大5秒、タップ0〜2秒なら2秒、2秒後なら即短縮。画面タップは次球の物理結果を変えない。
7. 下部シークバーを削除した3操作ボタンで、前球は正史リプレイ、新指示の採用は次球のみ。表示fps/描画倍率の違いでは同じSource/score。

## 6. PC・スマホ品質ゲート

- スマホ幅390pxやChromiumのdevice emulationはUI/layoutの一次検査。実機Android/iPhoneのメモリ、タッチ、オフライン保存、ページ復帰、発熱/電池、リフレッシュレート、バックグラウンド中断を追加実証する。
- 実Core単体のオフラインBundleで require('node:sqlite') / fs 等が残らない。リアルな保持球と球表面ソースが保存でき、IndexedDB等からcold resume/replayできること。
- 端末間の同期を導入するときは一意のauthorityとsequence、別端末の入力が過去の投球を変更しないこと。ネット切断中に各端末で独立試合を勝手に進めない。

## 7. 中断、追加判断、ユーザーへ確認すべき時

- **ユーザーに確認が必要な例：** LADの年度、ライポアの確定守備位置、李将軍.305、NLB162試合の最終採用、未指定球場の特例規則、性格をどこまで固定してよいか、本人バット実寸など、結論が実装の正史を左右するもの。質問せず実装できる内部インターフェイス・仮fixtureなら続けてよい。
- **やってはいけない補完：** 戦術AIで投げ先を選んだからセーフ/OUTにする、打球が画面の野手と重なったのでフライアウトにする、地面に当たっていないのにバウンド描画を足す、四球が少なくなるよう審判結果を直接変える、見えない球を実物理から消す。
- **タイムアウト時：** 元Native長時間テストの途中をPASSと記すな。元Sourceを保存しcheckpoint+待機状態、どこまで終わったか、残り要求を明記。永続DBは本人元データを上書きしない。
- **再検証の優先度：** 所有ファイル単体、型検査、他の実Coreとの出力契約、元の複合source、PC/スマホ・実機、定量seed監査、セーブ／再開の順。全部にPASSしなければ製品完成扱い禁止。

## 8. CIで残すべきレシート

1. 基準コミットとすべてのファイルのsource hash。
2. User-approved B1/フォント/バット参考画像SHA・差分スクショと意図。
3. PASS/FAIL/SKIP/TIMEOUT、テスト数、seed数・球数・打席数・実経過、独立再生ハッシュ。
4. 主要source（pitch/ball/field/runner/umpire/score）のaccepted IDと前後の整合。
5. 続きに必要な未定義policy、長時間未完ゲート、実機障害と正しい再開手順。

総試合数、処理速度、名目FPS、キャリア全体などの性能数値は実測なしに推定せず、ユーザーの要求を中心に説明する。
