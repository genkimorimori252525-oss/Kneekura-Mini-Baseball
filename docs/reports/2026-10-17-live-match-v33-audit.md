# v33 通常試合接続・監査記録

2026-10-17。投球・裁定担当による有限範囲の記録。最終統合結果は主担当が追記する。

## 実行経路の区別

- **Native SQLite の正史**：回復後の累積負荷 owner（79th table）、有限の後続守備実行 owner（80th table）は別途実受入・独立再読取済み。`verification-authored-with-bat-field-successor-v1` の記録を保持する。これは有限 prefix の証明であり、自由な次球や9回完走の証明ではない。
- **v33 ローカル通常試合**：`LiveBaseballMatchV1` が同じ Core の球・衝突・捕球・走者・裁定を実行する別試合。旧 HTML の抽選結果を fallback にせず、SQLite の認証・Source 所有・正史を装わない。既存 v31/v32 と Native DB は保全する。

## 実装と確認範囲

| 対象 | 確認した内容 | 限界 |
|---|---|---|
| 投球 | 原始 Source の Aero/Ground、回転・空力・地面接触。release command を決めた後に球を狙いの結果へ修正しない | リリース手・打者身体の collider はローカル投球に未接続 |
| バット | OpenBiomechanics の実測軸・手元から剛体参照を作り、同じ長さ・姿勢の tapered bat に連続衝突判定。木材の impulse から exit velocity/spin を得る | キー間は宣言した線形/SO(3)補間。身長登録・実行速度・狙い誤差は明示的な編集モデル。身体 torque・軸回り実測位相を捏造しない |
| バット表示 | `referenceThroughTick` までの有限参照。終了後は `null` | 表示参照の終了は実際の release/drop の成立を意味しない。衝突後 motor は prescribed reference。recoil/drop/身体との連成は未接続 |
| 捕手 | 実 glove 接触後に Core `resolveCatchRetention` の secureTick が成立した場合だけ count call と球の非表示を行う。観測 state からの別 Aero/Ground 予測で bounce を考慮 | 捕球中の内部変形は reduced-order pocket constraint。理想的 state 観測・C1 glove 制御は神経・筋力の実測モデルではない |
| 捕手 SI | Host が field と同じ捕手の速度・reach・半径・保持 energy・吸収 power・pocket を投球へ渡す | optional 未指定経路は旧 explicit test calibration。人物の実測能力の証明ではない |
| 裁定 | Core の count/foul/fly/walk/force obligation・解除/third-out scoring/half-inning を再利用。実際の touch/control/tag から判定。場面別 DP パッチなし | 同じ量子 tick の race は unresolved。未完 route を hit/base/run に変換しない |
| 試合進行 | 第三 out、force 第三 out の得点抑止、time-play の前後、9回裏省略、サヨナラ、同点延長を pure tests で確認 | これらの単体試験は通常 HTML の9回完走を証明しない |

独立 Host review で、接触前の `contactMoment.ball.velocity/spin` を field へ渡す誤りを発見した。主担当が実 impulse の `contact.exitVelocity/exitSpin` を使う形へ修正した。origin、実接触の小数 elapsed、位置、event tick、材料位相を維持する。量子 tick から実接触時刻を逆算しない。

## 投球1000球の監査

入力 seed・左右・投球 command・OBP dataset・基本 SI を固定し、各球の compact record を NDJSON、失敗を個別 JSON へ保存した。実打球を次の Source へ渡す原始 moment も検査した。

| 版 | 捕手モデル | 実バット接触 | secure 後の count call | 未解決 | 例外 | 結果 |
|---|---|---:|---:|---:|---:|---|
| v1 | explicit compatibility / air-only 予測 | 623 | 374 | 3 | 0 | FAIL |
| v2 | 同 SI / Aero+Ground 予測 | 623 | 377 | 0 | 0 | PASS |
| v3 | Host と同じ捕手 SI / Aero+Ground 予測 | 623 | 377 | 0 | 0 | PASS |

v1 の3件は、低い投球の実 bounce に対し air-only 予測が床下を狙った捕手モデル不足。実球の Source・時刻・回転・出力結果は補正せず、捕手の予測だけを修正した。v3 は **11 m/s・1.35 m reach・0.11 m glove・160 J・3000 W・0.14 m pocket** を使用し、成功のため能力を上げていない。

v1/v2/v3 の全1000球を独立比較し、seed・左右・command・pitch type・clip・実バット接触・接触 moment・接触 orientation が完全一致することを確認した。全12実測 clip を使用した。dataset SHA-256：`72b615a28cd99b4a91c6e52cb02ee35f4ff97850c3bfe71ca73d0e609ba480ef`。

- v1 FAIL：receipt `a2bba8b911d242c59ced0dbedd4b7499`、`outputs/verification-live-pitch-1000-v1`。`failure-0090.json` / `failure-0612.json` / `failure-0746.json` を保持。
- v2 PASS：receipt `76e1707e3aeb4d5cb2783893a2a93f80`、`outputs/verification-live-pitch-1000-v2`。
- v3 PASS：receipt `54309af98e60404d9e2381f73e63faf5`、`outputs/verification-live-pitch-1000-v3`。
- 比較 PASS：receipt `f785849910c4440195b13bcdf7a09083`、v3 の `cross-model-comparison.json`。
- 回帰・捕手 SI 単体11件 PASS：receipt `3928781e9116428fbb8ad247f1ee94da`。
- 最新投球 module/test 厳格型検査 PASS：receipt `5a06042b37cc48fe8dbe73324a53e409`。
- 初期裁定 adapter と既存 Core 合計39件 PASS：receipt `17665b9f3a8a4779b8d88e88437d9bdb`。後続の ground-award 等の統合変更は最終検証で更新する。

各 receipt の実 command・log・hash は `docs/ai-continuity/verification-receipts/` にある。Frozen audit 入力は `work/live-pitch-audit-v1/v2/v3` に保持する。v1 の失敗を上書き・削除・再抽選していない。

1000球の初期 exit direction は前方 fair sector 543、側方 foul sector 67、後方 sector 13。これは**接触直後の方向の診断**であり、最終 fair/foul 裁定・スタンドへの到達率・現実集団との一致の証明ではない。

## 残る設計・接続

- named NLB/MLB/NPB/KBO の実態 SI 校正は **UNKNOWN**。表示名・リーグ名から physical を倍率変更しない。現ローカル既定値は全選手共通の明示 authored SI であり、ちんすけ等の実態能力再現とは主張しない。
- 各投球間の ready 再配置、捕手から投手への返球、保持・構えの連続制御は未接続。ローカルのプレー単位継続と Native 連続 world 全動作の完成を区別する。
- v33 ローカル試合の SI は固定の参照校正であり、Native 累積消耗 owner を各プレーへ自動採用していない。既存の実累積再評価・有限後続動作の正史証拠を、この別試合の負荷履歴へ読み替えない。
- 未捕球投球・保持失敗の後続 live ball は停止して明示する。架空 strikeout にしない。未捕球第三 strike の走者条件を含む完全経路は未接続。
- HBP、infield fly、explicit defensive appeal/advantageous fourth-out、完全な公式 scorer closure と H/E/FC 統計は未接続。現 hit/error は `null`。タッチアップ違反だけで自動 out を作らない。
- ball と bat の身体連成、衝突後 recoil、実 bat release/drop、全設備・身体 collider、実測神経反応・筋力は未完成。
- ローカルの history が全描画 frame と field frame を重複保持する memory リスク、表示身体と実バット手元の座標登録を独立 review で主担当へ報告した。最終の修正状況は主担当が追記する。

### 個人能力について確認できた原データと未接続

`docs/roster-seeds/2026-10-14-nlb-tambov-dragons-v1.md:10-14,40-54` は、ちんすけの power94/vision96 をリーグ相対の暫定表示とし、能力から成績への逆算が未校正であることを記録する。旧HTMLの `power=.56+.006*rating` 等は独自の仮換算で、実測 SI の証拠ではない。過去の打率・終盤HR率を直接確率の補正として使用しない。

同 roster の76行には、ティカオ最高151km/hという既知のユーザー指定がある。一方、v33既定の fastball release は42.5m/s（153km/h）で、**この個人上限も未接続**。最高速度から平均速度・回転・制球誤差・球種別分布を推定して採用していない。未接続と未知を同一視しない。

`tools/browser-bridge/v33-live-runtime.js:10-13` は identity/name/height/hand のみを Host に渡す。個人の積極性・選球・弾道・引張・得能・クラッチ・悪球制御・守備差・pitch arsenal・最高球速・累積消耗、およびメーカーの最大芯速度 envelope は現在の通常試合へ接続していない。共通の監督指示倍率は本人能力の代替ではない。

`WorkbenchPlayer.ts:85-97,120-141,167` の SI と母集団50+20z表示は authoring 値であり、Native 採用値ではない。`outputs/選手能力の反映範囲.json` は旧メーカー2経路の静的監査で、v33全試合の能力反映を証明しない。これらは元の計画の残作業として保持する。

## 追加の物理制御 helper

- `LiveThrowPlanV1`：身体に対するリリース速度上限を守り、同じ Core 空力で送球初速度・飛行時間を解く。最後に Source kernel で空中経路と到達誤差2cm以下を検証する。球・標的・捕球結果を補正しない。20m/70m、速度上限で到達不能の140m、風・spin・body velocity、決定性の6件 PASS（`702579ba6a334185b553e38c811590ca`）、strict TSC PASS（`91a542c0e9c642a28932d67c0b1f3994`）。`unreachable` は有限 solver 内の失敗で、全ての解の不存在を意味しない。
- `LiveHandPreparationV1`：実際の保持位置・相対速度から、肩側の準備位置までの有限 C1 Hermite command。全 Bezier controls の reach・速度上界を検証する。5件 PASS（`5ec38f3fa3644629ac9943ca94e70eb5`）、strict TSC PASS（`80b2724cb76e43358cff935d63648299`）。これは身体相対の運動制御であり、筋トルク・関節負荷の実測モデルではない。通常捕球 servo 全体の C1 性をこの helper だけで主張しない。

両 helper の単体 PASS は通常試合への統合成功を意味しない。統合結果は次節で別に記録する。

## 統合状況 — v6 の通常 HTML・101試合記録監査 PASS、能力校正は未完

2026-10-17 最終 Source v6：通常 HTML の初期待機→次球生成→通常 UI の「残りを高速計算」で9回・173球・115実守備プレーを完走した（LAD12–14TBD、9回裏省略）。1200px の完走と390px の二球・五カメラ、実 actor camera anchors、Source と同じ fence、微小 ball の縮小、打球中 zone 非表示、走者名の前面順、例外・外部通信0を確認した。実機スマートフォンとは区別する。receipt `24b58fe5e3384cc7857c9300450db250`。HTML SHA-256：`bb3e7d00390bbce32b070d28cf2076108bb49eedbef29a7d665af88c20a66af9`。Core/Host production52入力と実測JSONの SHA が frozen audit v6 と一致（`ed34c019e65243bdb48a19dba5c65d85`）。主担当も終了画面と390px投手画像を実画素で確認した。

同 Source の10ファイル96テスト PASS（`05ce325f2e094d6583439732c95539b8`）、全 src TypeScript PASS（`d92fdd5b7afb4898a2683e79ef9b5dff`）。64 focused PASS と停止 raw20件の実再実行 complete は `e7c073db9a604237a51ac2e1b82a83a1` / `089639d89e8d40f2a2815c50ae18df9a` / `3c609b664c6043f399c650bec58337ab`。v5 の不必要な送球方向 gate と force 取消順序が held scope を作った原FAILは、v5 frozen runtime・HTML full-v3・population-final-v1 に保持した。無理な負margin送球、境界で伸ばした腕の再追跡阻害、C1準備・他body/glove gap、同時地面/glove接触、空力を無視した予測/送球を汎用制御として修正した。アウトや到達結果を個別に補完していない。

最終 Source v6 で101 unique seed・20346球を全試合完走し、物理継続の未解決・例外は0件（`d36830a903bd4a8a97332fca61dcc957`）。実接触13015、送球3680、捕球13671、地面接触33846、複数アウト269プレー、最大10回。全保存記録について裁定・順序・打順・clock・最終状態・得点/line/classesを再検算し、全101seed/fileと集計・Source pinsも照合、改ざん404試験を拒否した（`eb183cf02de94fb4878b054f171437d5`）。ここでの全記録再検算は全101試合の物理再実行ではない。選択した2試合の物理再実行は下記。

101試合の参照SI集団は3122得点（約30.91/試合）、849HR（約8.41/試合）、21三振。高得点・高HR・極端に少ない三振は校正未完の重要所見であり、現実との統計一致は PASS としない。fixtureの身体・能力・parkは明示参照値で、NLB/MLB本人の実力・実球場を再現する100試合ではない。通常HTML実チーム名での9回は別途上記1試合で確認した。

選択2試合の再実行は完了した。seed2468（226球）と754773（245球）の計471球で、接触・exit impulse・後続球・守備facts/診断・裁定・イベント・field/presentation全frame hashを含む compact 全体が一致した。両試合の改ざん10試験（うち接触impulseと後続球を同時改変して再hashする2試験を含む）も拒否した。receipt `48dabba6ece641ed99540084cd613f44`。元の population 保存ファイルと選択copyのSHA・seedは `outputs/verification-live-match-selected-reexecution-v1/selection.json` に保持する。この2試合だけを再実行した証拠であり、101試合全ての物理再実行とは呼ばない。

同2試合の323接触を数値監査した。初期打球速度は中央値141.47km/h・90百分位173.03km/h・最大203.93km/h、回転ベクトルの大きさは中央値3375.40rpm・90百分位5697.17rpm・最大8265.88rpm。揚力を生じるspin成分の中央値は-801.33rpm、発射角中央値7.21度。spinは単なる回転模様ではなく、接触impulseからSource空力へ渡す量である。ただし実測集団との統計比較や材料・知覚・運動限界の校正は未実施で、これらを現実への一致とは評価しない。参照場の中堅110m等も実球場校正ではない。receipt `1025d708725c4e02933dea1ad48d89fd`、`selected-batting-physics-statistics.json`。初期角度と最終fair/foul裁定は区別する。

2026-10-17 追記：Source v4 に対する混合試合を含む7ファイル65件は PASS（`24e48610eca44d4c9eebc046dea507fd`）。この試験では9回完走した。ただし通常HTMLの別seedは86球目・5回表でscope_exhausted。別途16seed探索は **12完走・4失敗**（`47259465d72f4dc48f231d5ac203dadf`）。成功12試合は2928球・1886接触・61複数アウトplay・128HR・2三振・637得点で、現実集団との統計一致を意味しない。特に高接触率と約53得点/試合は、既定 authored SI / 知覚・狙い誤差等が未校正である重要な監査所見として保持する。named NLB/MLB再現や現実成績への適合を主張しない。

当時の4失敗は3件の回収scope枯渇、1件の6.6cm接触重なり。元raw caseを保存し、汎用判断・回収・release制御を修正した。v6では全20原入力を終了まで実再生し、最終HTML9回・101試合も上記で検証した。

**残作業**：通常 HTML の自由な次球・9回完走と101試合の記録整合性は上記範囲で検証済み。個人能力・実際の得点分布への校正、Native連続world全試合、身体/バット連成、未接続の公式ルール・scorer、実機スマートフォンは未完である。`width:390` を実機検証とは呼ばない。

原計画・元の Native raw FAIL/UNKNOWN・承認条件を保持する。本書および部分 PASS を理由に全体 goal を完了扱いにしない。
