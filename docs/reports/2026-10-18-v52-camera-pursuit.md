# v52 — v49打者視点への復元と追従の余裕

[通常HTMLとメーカー](../demos/releases/v52/README.md)。最新の人間指示で打者視点をv49へ戻し、投球の微小変位に対する密着追従を弱めた。投手には打撃後0.5〜1.2秒の追尾開始待ちを追加した。v51の野手回避を含むCore・実測バット・走者・裁定を変更していない。

## 復元の範囲と根因

v50はv49の単一眼controllerの後からlv27用wrapperを登録し、構図・見逃しの固定・スイング終端+700msの保持を上書きしていた。今回はそのwrapperを登録せず、v49の構図・身体eye・予定打点・スイング後の追尾方針を基準に戻した。700msの保持も撤回する。

v49とv51の実測バット軌道・位置データは同一だった。見え方の差はcamera射影によるもので、旧物理へ戻す必要はない。最新v51のCoreを入れたv49参照HTMLを作り、新HTML／v51との実12球のCore全記録とバット端点・半径profileのSHA一致を確認した。異なる旧v49 Coreの試合結果との一致とは区別する。

v49 controllerは投球位置から求めた角度を、微小変位も含めて追っていた。選球眼の誤差は遅延・応答へ届くが、ミートの位置／時間精度は表示追従へ接続されていなかった。投手rendererもlive打球になった時点で角度と画角を変え、早い捕球・送球のfieldCommitted条件が守備視点へ切り替えた。

## 変更ファイルと挙動

| ファイル | 変更 |
|---|---|
| `tools/browser-bridge/live-soft-pitch-batter-view.js` | v49 controllerを継承。live投球・非保持・スイングbrace以外の時だけ角度誤差へ柔らかい不感帯と有限gainを適用 |
| `tools/browser-bridge/live-pitcher-reaction-view.js` | 観測済み打球速度から待ちを選び、現在P眼を保って180msで既存の角度・画角へ接続 |
| `tools/browser-bridge/v52-live-presentation.mjs` | 待機・補間中のmound維持、既存の後続handoffへのgate、observerとrendererを接続 |
| `tools/browser-bridge/build-v52.mjs` | v49表示を基準に新helperを登録。v50のlv27 wrapperを登録しない |
| `tools/browser-bridge/check-soft-pitch-batter-view.mjs` / `check-pitcher-reaction-view.mjs` / `check-v52-camera.mjs` | 微小変位・能力・時計・実試合・画面の検証 |
| `docs/demos/releases/v52/` / `docs/verification/releases/v52/` | 配布HTML・SHA・原FAIL・比較reference・画像と結果 |

ミートは既存の`aimStdMeters`と`timingStdSeconds`、選球眼は`zoneJudgmentStdMeters`を使う。各精度から0〜1のqualityを作り、投球追従gainを0.55〜0.92、不感帯を0.006〜0.026radへ制限する。角度誤差が帯内ならその微小変位には反応せず、帯外なら連続的に圧縮した誤差を既存の有限角運動へ渡す。高能力もgainが1にならず、低能力も広い変位を追う。新能力やランダム揺れを追加しない。

予定打点へのスイングbrace、身体eye、HR時の前向き、打球／送球の追尾lawはv49を継承する。投球中の初期姿勢が変わるため、通しの全打球後姿勢まで旧版と一致するとは主張しない。打球／送球だけの同一入力では旧v49と姿勢が一致する。

投手の待ちは最初の観測済み打球速度から`clamp(35/speed, .5, 1.2)`秒。将来の打球軌道や試合結果・投球速度で選ばない。追尾開始後180msで向きと画角を混合し、その完了まで守備視点へ移らない。以降は既存の投手／処理者と送球先の切替を使う。投手の身体・球・捕球・送球そのものを遅らせない。

## 検証

- [旧v49の微小追従を検出したRED](../ai-continuity/verification-receipts/MB-20261018-V52-SOFT-PURSUIT-RED_361815f0d0794aaf90eed041dd17fdd3.json) → [新helper GREEN](../ai-continuity/verification-receipts/MB-20261018-V52-SOFT-PURSUIT-GREEN_3e2865013fb54fad94ade8cc3606868a.json)。左右の微小角刺激で旧版の総移動約0.002605radから0へ。大きい刺激には高低能力とも追従し、ミート・選球眼を個別に変えて差を確認。
- [既存の連続視点試験を新helperで実行](../ai-continuity/verification-receipts/MB-20261018-V52-CONTINUITY_3ea929dc9b3c42ceadd902e960ec928e.json)。8ms／不規則55ms・角速度／加速度・prefix・巻戻し・未来値非参照・能力・所持を確認。
- [投手の純粋試験15分類](../ai-continuity/verification-receipts/MB-20261018-V52-PITCHER-REACTION-PURE_8f50e7d9fa3b4e52bbab98a1658ad3d1.json)。0.5〜1.2秒境界、180ms混合、同一P眼・最短角・画角・早期切替gate、Source時計停止、準備／次球／見逃し／HR／bench、prefixと再読を確認。
- [実HTML browser PASS](../ai-continuity/verification-receipts/MB-20261018-V52-CAMERA_20c18bedb105438792fa744e92d694ee.json)（24.452秒）／[全結果](../verification/releases/v52/cameras/v52-camera-check.json)。1200px／390px、実12球のCore・バット一致、左右v49眼・光学・brace、lv27／700msなし、3他camera12時点、保持球5camera、配球4stage・zone・4px／55ms、実再生・巻戻し・例外と外部通信0。
- 実投球系列の高低profileはgain0.906607／0.603598、帯0.006724／0.023103rad。角移動は0.180190／0.052472radで双方が追従。帯内はゼロ、帯外は正の圧縮を確認。実打球では投手が0.757719秒待ち、180ms混合して既存条件の守備視点へ移行。次球は投手視点へ戻る。
- 最初のbrowser FAILはcheckerが帯内にも正の応答を要求したQA条件の誤り。帯内ゼロ／帯外の正応答／両profileの帯外サンプルと実角変位を別々に要求して修正。製品は変更せず、[原FAIL](../ai-continuity/verification-receipts/MB-20261018-V52-CAMERA_2028d04750dc4f5594e0d02e346b28ec.json)と原出力を保持した。

[build receipt](../ai-continuity/verification-receipts/MB-20261018-V52-BUILD_323526a634aa40f89515689841463fb3.json)、[包装receipt](../ai-continuity/verification-receipts/MB-20261018-V52-PACKAGE_a926d09c93a24ab0a8071540f0105306.json)。HTML SHA `aff78f191ba6f24958403dc51c503e73393b57d495335bc58d32dc2646f9b85b`。Core SHA `01f25940860caff6f9a92a9d8d11d876d87056ed173d8589374226f7c4eccd8f`、108入力すべてv51と同一。旧helperと旧版HTML、メーカーを保持した。代表PC／390px画像を視認した。

## 証拠の限界と元計画

係数はユーザーの表示意図に合わせた暫定制御値で、生体計測された眼球／頭部や実選手の校正ではない。P本人が処理し続ける専用の実試合場面は新prefix12球で別途生成していない。本人を別選手へ切り替えない既存分岐と、今回の純粋試験の証拠を分ける。

今回は表示のみ。v51の280テスト・60局面15分類0・通常320球の規定9回は、同じCoreの既存証拠として継続し、v52で新規再実行したとは扱わない。元の全目標はIN_PROGRESS。Native認証された全体連続世界、返球／再整列、身体接触後の応答・全身／バット反動、公式H/Eと残規則、全得能、共同走塁と中継最適化、実選手SI・成績分布・最新100試合以上・実機の残件、原FAIL/UNKNOWN・外部Charter承認HOLDを保持する。
