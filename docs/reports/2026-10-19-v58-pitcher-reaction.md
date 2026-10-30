# v58 投手が打球を見始めるまでを0.1〜0.25秒へ

最新v57を基準に、投手の打球追尾待機を短縮する。最初の観測済み打球速度から `clamp(7 / speedMps, .1, .25)` 秒。40m/sなら0.175秒、50m/sなら0.14秒。未知の速度は上限0.25秒を使う。従来の速度依存を保ち、下限/上限だけの変更で全て0.25秒になることを避ける。

製品helperの変更は下限.5→.1、上限1.2→.25、速度係数35→7の3定数だけ。追尾開始後180msの混合、同じ現在投手眼、混合完了まで守備視点へ移らないgate、次球resetを継承する。球・身体・守備の動作時刻を遅らせる処理には触れない。打者頭固定、設定B、物理・バット・能力・AI・裁定・22/55ms・4px格子・表示倍率1も継承する。

`build-v58.mjs` はfrozen v57の通常HTMLと調整室から投手helper・版名・metadataだけを交換する。調整室のUI・driver・保存領域はv57を継承する。旧版を上書きしない。

検証:

- REACTIONee78d3f3 PASS0.079秒。3定数以外のhelper全文が旧版と一致。8速度の下限/上限/中間、開始直前・開始・90/180ms混合・守備handoff、同じ移動P眼、Source停止後、prefix・rewind・未知速度・次球/見逃し/bench・最短角を確認。初回67db7d46は検査が完了時刻755msを754msと誤記したFAILで、製品を変えず訂正しPASS。原FAIL保存。
- BUILD4a31b5e4 PASS0.188秒。frozen v57、Core113入力、2つの自己完結HTMLを照合。

- BROWSER680c8bed PASS12.593秒。実3球中2contactをv57と比較しfullSource/frame/play/events/match/bat SHA一致。46.191276m/s→.151543766秒、27.739584m/s→.25秒。1200/390pxで開始前hold/開始/90/180ms、守備handoff gate、現在P眼、次球reset、v57打者頭固定、labの同じ新試合と時刻、113入力/FPS維持、例外/外部通信0を確認。
- PACKAGE9f6d07b5 PASS0.780秒。helper/版名を戻すと通常HTMLがv57にbyte一致、唯一の埋込試合、全113入力、metadataと実HTMLとbrowser報告のSHA、旧配布不変を照合。初回71aab415は検査のPython read_textがCRLFを正規化したFAIL。raw bytes読取へ訂正し製品を変えずPASS。原FAIL保存。

通常HTML SHA `89a0ba3c52bd0299e5b9bb3c853cae48185493d48179339e523c25e0dd1b52ed`、調整室 `92274c68020b260d4333405bfd46d6c4dc1bfac5f829ad9189a136ea9c76f6bf`。[表示報告](../verification/releases/v58/pitcher/pitcher-check.json)、[配布照合](../verification/releases/v58/release-check.json)、[HTML](../demos/releases/v58/README.md)。

元の全計画・未達・FAIL/UNKNOWN/Charter HOLDを保持する。実端末の見やすさや成績校正を今回のPASSへ含めない。
