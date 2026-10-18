# 最新の再開入口 — 2026-10-19

現在は **調整室v60／通常試合v60**。既存ブランチ `jolly/tbd-lad-native-browser-core-2026-10-14`、[Draft PR #380](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/380)で継続。main未マージ。

- [通常試合HTML・共通メーカー・保存方法](../demos/releases/v60/README.md)
- [原因・変更・最終検証・限界](../reports/2026-10-19-v60-impact-and-name-controls.md)
- [開発史](../history/README.md) / [原因別事例H33](../history/INCIDENTS.md)
- [元の全要求・計画・受入条件](2026-10-15-mini-baseball/00-START-HERE.md)
- [v50の打者カメラ](../reports/2026-10-18-v50-v27-batter-camera.md) / [v49の守備責任・裁定](../reports/2026-10-18-v49-positional-defense.md) / [v47の中継・旋回](../reports/2026-10-18-v47-relay-rounding.md)

## v60の現在地

v59の打者視点の初期姿勢を維持し、安定開始offset・許容角・角速度をA/B調整できるようにした。早め/遅めのカーブ記録を選び、名前倍率もJSONと再現sessionへ保存する。全視点で名前を投影位置へ重ね、走者を優先し、球は文字/背景枠の上へ。調整室にもDOM名を転記する。[変更と検証](../reports/2026-10-19-v60-impact-and-name-controls.md)。Core113入力・物理/AI/能力/裁定/実測バット・投手100〜250msを継承し、元全計画・未達・原FAIL/UNKNOWN/CharterHOLDは継続する。

## v59の現在地

v57の早い完全固定を置換。振ると決めた後は予測打点へ視線を寄せ、予定インパクト付近で小さな補正を残して安定させる。現在の球の高さを打点へ流用しない。Bの高さ/俯角を再び編集可能にし、画像の7設定と既存打球追尾を継承。投手0.1〜0.25秒も含む。左右・実カーブ・6球の物理/バット不変・1200/390px・22/55ms周期・113入力・配布照合をPASS。[実装と検証](../reports/2026-10-19-v59-impact-gaze.md)。係数は生体校正済みではなく、元全計画・未達・原FAIL/UNKNOWN/Charter HOLDは継続する。

## v58の現在地

投手の打球追尾待機を0.1〜0.25秒へ変更（打球速度依存、係数7）。180ms混合と守備handoff条件、v57打者頭固定と設定B、その他の物理/AI/能力/裁定/バット/UIは継承する。通常/調整室の実2打球、1200/390px、pure境界、v57への全文復元・113入力・旧配布不変を検証。[変更・証拠](../reports/2026-10-19-v58-pitcher-reaction.md)。元全計画・FAIL/UNKNOWN/Charter HOLDを保持する。

## v57の現在地

振るまでは投球を追い、実測バットのreferenceStartTickで頭のyaw/pitchを固定する。through終端まで動かさず、既知の打球認識後300msと終端を満たしてから70msの目標移行で既存の打球追尾へ戻る。身体のeye位置は継承する。画像Bの.30/.20/300/70/.26/.02を採用し、最初2値は新方式では非適用と明示。見逃し/バントは従来、遅いスイングは遅くまで追った向きで固定。A従来モード・旧JSON・v57保存分離・開始markerを用意。

[実装と最終検証](../reports/2026-10-19-v57-swing-head-hold.md)。Unit/1200・390px browser/113入力・12球物理とbat不変/48pixel/22・55ms周期/配布照合PASS。Core・AI・能力・裁定・実測バット・メーカーは変更なし。新9回や原全計画の完了を宣言せず、元の未達・FAIL/UNKNOWN/Charter HOLDを保持する。

## v56の現在地

最新人間訂正: 2.5倍は投球の球のFPS。通常/調整室とも投球22ms・その他55ms、余剰時間持越し。4px格子と球サイズ初期値1を維持する。構え基準の追従率/許容角（A従来1/0、B初期.15/.02rad）、通常/俯瞰別の球表示倍率、ゾーン表示面z=.15、俯瞰で配球図も隠す。旧JSONは従来追従/倍率1へ補完。Core113入力と物理・能力・AI・裁定・実測バット・メーカーは不変。

- [最新HTML・再生成・使い方](../demos/releases/v56/README.md)
- [根因・変更・最終検証・限界](../reports/2026-10-19-v56-pitch-presentation.md)
- [元の計画を保持した実装方針](../plans/2026-10-19-v56-pitch-presentation.md)

60Hz手動時計で両HTML scene18/sample45、保持の高速更新0、短区間loopのA/B始点pixel一致。1200/390pxでUI/旧新JSON/ゾーン/3層pixelと正規12球の物理・bat全hash不変をPASS。実際のFPSと主観的カメラ感は端末/利用者確認が必要。新9回や100試合の実施、元全計画の完了は宣言しない。原FAIL/UNKNOWN/Charter HOLDを保持する。

## v55.1の調整室修正

バットと球のSourceがあっても、親canvasがfield層だけをコピーして表示できていなかった。通常rendererと同じfield→bat-overlay→ball-overlayの3層を合成する。任意の打者視線ガイドの倍率も修正。通常HTMLの内容・カメラ・Core・JSON仕様は変更しない。使うHTMLは `カメラワーク調整室_v55_1.html`。旧v55公開物は原証拠として保持し、再生成時のoutputs/v55は修正版のalias。

## v55の現在地

スイング中は予定打点より0.30m上へ注視目標を置き、下向き目標を0.30radに制限。実打球を観測してから100ms（予定throughが早ければそちら）で保持を解除し100msで追尾へ移る。現在姿勢をresetせず、単眼と従来の角運動制限を維持する。通常HTMLもこのdefaultを使う。

専用調整室は同じCoreの1つの試合をA/Bで描画する。従来設定と改善値、scrub/step/loop/speed、全カメラ、自由な次球、9回の試合、設定JSON／配球再現session、角度グラフ。編集元はcamera-workbench-v55.html/jsとlive-camera-tuning-batter-view.js。v54通常試合とCore113入力を固定したbuilderで生成する。最新検証は[報告](../reports/2026-10-19-v55-camera-workbench.md)、配布と再生成は[v55 README](../demos/releases/v55/README.md)。

以下は各版の経緯・当時のSourceの証拠。原全計画・FAIL/UNKNOWN/Charter HOLDは継続する。

## v54の経緯（実働得能・個人采配は継承）

人間が「通常試合で実働できる得能を接続し、残りをメーカーに未対応と明示」を選択。悪球打ち・送球精度・打撃積極性・走塁積極性・守備積極性・投球配分・スイング方針の7系統を実働Sourceへ接続。監督の明示指示を優先し、個人方針はAUTO時に使う。青・赤・緑・金と中立を表示し、同じSIへの二重適用や反復累積を防ぐ。公開10・詳細44を維持。119項目のうち残112は未対応86／対象外25／仕様確認待ち1として検索・理由を表示する。Native習熟度の認証や不足する独立システムを作ったという意味ではない。

最終41files368tests、globalTSC、通常HTML320球の規定9回、PC1200/390pxの7系統22状態・保存再読込・試合取込、v52カメラと実12球比較をPASS。Core113／maker79入力。HTML SHA `80c68e3ddb5c961ab6f18b325c6f267f883cd02d27381dfa10a9334bf8afae9f`。Maker SHA `f1443bb1c7699ce88249fd4f6f293ec6cd2fd705767b9e1ff04db24e0c62bbd9`。ローカル作成閾値・傾向係数・全体成績は未校正。

再生成は `node tools/browser-bridge/build-v54-artifacts.mjs`。対象試験・通常試合・カメラ・メーカー・配布照合は[報告](../reports/2026-10-19-v54-executable-traits.md)と[配布説明](../demos/releases/v54/README.md)を参照。旧版の試験は当時のSourceの証拠であり、現Sourceの追加検証と区別する。原全計画・FAIL/UNKNOWN/Charter HOLDを保持する。

## v53時点の経緯（範囲の未回答はv54で解消）

落下前に安打性を読み、能力と監督指示で進塁判断する。捕球時は実離塁とfirst-touchを照合し、現在速度から連続制動して逆順帰塁。explicit appealと実支配／タッチを同tick証拠へ拘束する。実reverse homeにより旧得点／占有を訂正し、境界UNKNOWNを保持。bad-ball技術を公開値から得能へ移し、内部値を一度だけ使う。NLB10初期保有、旧JSON未査定を維持。v53時点では全得能の接続は未完で、元システムがないものまで含めるか人間へ確認中だった。v54で実働可能な範囲に確定した。[接続監査](../reports/2026-10-18-v53-trait-source-audit.md)。

最終39files346tests・globalTSC PASS。112 Core入力・通常HTML320球9回・着地前26判断・live終端未帰塁0。野手130play/17169frame重なり0。メーカー20/public10/internal44・oldJSON・download/reload/gameimport・PC1200/390px・v52カメラのbytesと現在12球を確認。全体成績やread誤差は未校正。新100試合や実機は未実施。元全計画・原FAIL/UNKNOWN/HOLDは残す。

## v52の変更と既存検証

最新指示でv50のlv27構図・見逃し固定・700ms保持を撤回し、打者視点はv49へ戻した。その上でlive投球だけに追従の余裕を設け、既存のミート（位置／時間精度）・選球眼（コース判断精度）で有限gainと不感帯を変える。高能力も完全密着せず、低能力も広い動きを追う。投手は打撃後0.5〜1.2秒待ち、180msで同じP眼の向き・画角を接続。その完了まで守備視点の早期切替を防ぐ。

新helperの左右・小変位／大変位・高低能力・prefix・角運動・次球・待機とblendを検証。新HTMLは1200/390pxの実12球で、v49表示＋同じ新Coreの参照／v51とのCore全記録・バットSHA一致、3他視点・配球・zone・保持球・再生巻戻し・例外／外部通信0を確認。初回browserの帯内応答assert誤りは原FAILとして保持した。主観的な快適さや生体校正の保証とは区別する。

v52 HTML SHA `aff78f191ba6f24958403dc51c503e73393b57d495335bc58d32dc2646f9b85b`。[新規検証と変更ファイル](../reports/2026-10-18-v52-camera-pursuit.md)。Core108入力はv51と同一で、下の280テスト・9回証拠は既存の同一Coreの証拠であり、新規rerunではない。

## v51から継承するCoreの範囲

目的地を分けるだけでは交差経路を保護できなかったため、全野手の同時刻の位置・速度から身体指令を調整し、その後にグラブを計画する。既存の個人最高速度・加速度・反応と戦術値を守り、保持／捕球・送球の受け手・処理担当を優先して減速／回避する。脅威のない希望指令を保存する。公開11能力／詳細44は維持し、専用能力を増やさない。

連続区間の最小距離と終端からの最大制動を確認し、実frameの身体重なりを新しい15番目の診断にした。ほぼ静止した身体の微小制動相が浮動小数点で消える誤検査も修正。初回7FAIL・通常5球目停止と先行REDを保存し、最終PASSと区別した。

ローカルHost＋共有Coreの通常試合。v49の位置責任、送球・実捕球・再計画、実触塁・離塁・tag証拠、走者の占有再判断を継承する。Native SQLite認証された全体連続世界の完成とは区別する。

打者のv49身体eye・予定打点と既存の打球追尾、実測バット、v31以来のUI・間・配球・アニメ・4px/55ms・所持球非表示を保持。MMDへ戻らない。メーカーの旧JSONと20選手の編集・取込も維持する。

## 継承したv51 Coreの検証

31ファイル280テスト・全体型検査PASS。正式9位置20局面×3能力段階は15分類の異常0、アウト13/18/20（旧最小アウト数・単調性の条件は変更なし）。通常HTML320球で規定9回終了、130守備プレー・17,820frameで重なり0、最小中心間距離0.500113m。全発行区間・終端制動の最小表面隙間0.0200226m。実試合JSONのSource一致、1200/390px・カメラ・メーカーを新規検証。

v51 HTML SHA `9a2b4761d87b6c908dd51c969d5425a036870caf1f57b474e1113126b409a54e`。Core SHA `01f25940860caff6f9a92a9d8d11d876d87056ed173d8589374226f7c4eccd8f`、108入力。[保存ZIP](../demos/releases/v51/tested-core-inputs.zip)の110エントリは全byte/CRC/SHAを検証。カメラ比較は同一新Coreを入れたv50参照で行い、旧Coreの試合結果を新Sourceの証拠にしない。[receiptと原FAIL](../reports/2026-10-18-v51-fielder-avoidance.md)を参照。

## 元計画の残件

身体は半径0.24mの平面代理で、余裕0.02m／soft0.35m等は暫定制御値。任意の途中時刻からの一律停止保証、有限候補の大域最適性、身体接触後の反発・転倒は未実装。新計画を証明できなければ未確定の停止を残す。初期の重なりを押し出し修復しない。

Native認証された全体連続世界、返球・再整列・全身／バット反動・落下、公式H/E・残規則、全得能、リード／スライディング、共同走塁・中継最適化、実選手SI・成績分布、最新100試合以上、実機スマートフォン。今回の10–46は成績校正の証明ではない。v53から塁disk退出は実経路から記録する。足の完全接地は未実装。

Charter外部承認不足／HOLDと以前のFAIL/UNKNOWNは保持。会話の作業承認と機械的Charter承認は別。元の全目標はIN_PROGRESS。

## 過去v52の再生成・検証

```sh
node tools/browser-bridge/build-v52.mjs ../../outputs/ばせぼーるlv52_TBD_vs_LAD_視点追従調整版.html
node tools/browser-bridge/check-soft-pitch-batter-view.mjs
node tools/browser-bridge/check-continuous-batter-view.mjs tools/browser-bridge/live-soft-pitch-batter-view.js
node tools/browser-bridge/check-pitcher-reaction-view.mjs
node tools/browser-bridge/check-v52-camera.mjs ../../outputs/ばせぼーるlv52_TBD_vs_LAD_視点追従調整版.html outputs/new-v52-camera-proof
```

検証先は新ディレクトリを使う。Coreを変更した場合はv51と同じという前提を破棄し、Core関連試験と新規9回を実行する。Playwright/Chromeパスは現Windows環境用。Native非公開DBは通常HTMLへ不要であり公開しない。
