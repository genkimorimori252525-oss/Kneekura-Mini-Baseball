# v55 カメラワーク調整室とスイング後の追尾

## 依頼と原因

人間はスイング視点が長く打球が見えないこと、低い狙い目で地面を映しすぎることを指摘し、通常試合を使う完全なデバッグUIの専用HTMLを依頼した。[計画](../superpowers/plans/2026-10-19-camera-workbench-v55.md)。最新v54はv53と同じv52カメラhelperであり、配布v54を固定基準に使用する。

v52は予定スイング終端から180msで狙い目の保持を解除し、その後も角運動が収束する。狙い目が予定打点と同じ高さのため、低い球では俯角が大きくなる。これを描画上の設定として切り出し、打球を早めに追い、予定打点より少し上を見るように変更した。

## 変更

新factoryはenabled／aimLiftMeters／swingMaxDownRadians／hitFollowDelayMs／aimReleaseMsを検証して保持する。初期値はtrue／.30m／.30rad／100ms／100ms。実打球を感覚遅延後のprefixから観測してから待機を数え、予定終端が早ければそちらを使う。未来のcontactやfield結果から追尾timerを開始しない。注視目標を上げ、目標俯角を制限し、実姿勢をsnapでresetしない。見逃し、既存の能力依存incoming追従、身体eye、打球／走者の追尾lawと角速度2.5rad/s・角加速度20rad/s²を継承する。

通常HTMLは新default。調整室は非表示iframeの単一Coreと同じ観測を使い、2つの独立camera controllerを同tickで描画する。A初期はenabled:falseの従来制御、B初期は改善値。UIは通常版から独立したHTML/JSで、scrub、55ms step、区間loop、速度、視点、次球、監督指示、規定終了までの生成、角度グラフ、設定／再現sessionの保存再読込を備える。

再現sessionはseed/innings/各球のUI指示と表示位置を保存し、同じCoreで再生成する。Source SHAを照合し、不正JSONは反映前に拒否。レビューで発見したfinish失敗時の指示履歴欠落とsession中断後の古いプレビューを、成功球分の履歴補完・終了時の部分試合同期・エラー時の描画停止とexport拒否で修正した。

変更ファイル: `tools/browser-bridge/live-camera-tuning-batter-view.js`、`camera-workbench-v55.html/js`、`build-v55.mjs`、focused／通常／workbenchのchecker、`package-v55.py`、配布HTML／監査記録。Core・実測バット・既存helper・maker・設定・lockfile・secret・DBは変更しない。カメラの投影が変わってもCore上のバットの位置を変えない。

## 実検証

UNIT `MB-20261019-V55-CAMERA-UNIT_7a61ddcc10c2468ab269ea14ce2bab2d.json` PASS、0.766秒。左右enabled:falseの全pose/regulation/model一致、target lift/早期release、単眼の運動制限、未来payload getter非参照、感覚timer端数／rewind／設定往復、実Core113入力と138framesの実record不変を確認。先行RED ee0a4c9aと端数timerの0da3f3ccは原出力を保持。

BUILD-FINAL `MB-20261019-V55-BUILD-FINAL_32cff110955d4923966b1a4243a79fb8.json` PASS、0.172秒。NORMAL-FINAL `MB-20261019-V55-NORMAL-FINAL_cadde2961c3a4c21b1f2eb899db5be93.json` PASS、21.827秒。PC1200/390pxで実12球のCore／bat全記録一致、左右打球の狙い上げ・早期追尾、身体eye、他4視点、所持球非表示、4pxを確認。各幅2件で従来がまだ狙い解除中の時点にBが打球追尾へ移った。WORKBENCH `MB-20261019-V55-WORKBENCH_4e7ef111e75d41f487eb5956736ef6c4.json` PASS、135.657秒。PC1200/390pxの同tick A/B・従来pose一致、5視点、コマ送り／速度／区間loop、JSON保存／download／LocalStorage、配球session厳密往復、不正packet13件の反映前拒否、生成停止、session中断後の9球の部分再現の同期を確認。独立pageの意図したCoreエラーでは1成功球＝1指示の補完、保存拒否、旧画像clearを確認。通常pageは例外／外部通信0。唯一の規定9回finishは81.454秒・320球・9回表3アウト・away10/home46で終了し、初期12球のCore／bat hash一致。成績校正の証拠には使わない。

配布PACKAGE8243322f（1.391秒）／PACKAGE-RECHECK33854d81（0.343秒）／RELEASE-FINALe00a301f（0.125秒）PASS。126ZIP entries全byte/CRC、23リンク、Core113入力、単一埋込試合を照合。新camera追加と版名metadataを取り除けば通常HTMLがv54のraw bytesへ完全復元することを検査した。[配布照合](../verification/releases/v55/release-check.json)・[browser原結果](../verification/releases/v55/workbench/workbench-check.json)。以前の通常v54の368テスト／型検査は同じCoreの既存証拠であり、新規rerunとは記載しない。

## 継承する限界

視点係数は人間が比較するための暫定設定で、生体の実測校正ではない。全ショットの主観的な見やすさは利用者の調整で確認する。平面身体代理、Native連続世界、返球／全身／バット反動、全規則・公式H/E、残る得能、リード／スライディング、共同AI最適化、実選手SI・成績分布・新100試合・実機等の原残件は完了扱いにしない。原FAIL/UNKNOWN/Charter HOLDを維持する。

## 原FAILの区別

- UNITの先行REDと端数timer REDは製品の設計・境界を検出した記録。
- browser初期FAIL c7aa013cは検証器の1回指定（実際の元UIは3/9回）、d58693a0はready時undefined/null正規化、924b4cecは「defaultで予定throughより早く開始する」という誤った仮定。検証器を訂正し、製品cameraは変えず最終PASS。原run1/2/3のreport・画像とreceiptを保存した。
- 実12球のdefaultでは予定throughを優先し、100ms移行による早期追尾完了を9標本で確認。待機0では実2recordで観測後の早期解除が成立。短いスイングでは待機sliderを変更してもthroughが優先される。診断の観測時刻／releaseAt／throughで区別できる。
- 配布checker初期003168dfはHTMLのCRLFをLFのみで区切った誤検査。両改行へ対応し、製品HTMLを変えずPASS。修正前のZIP／indexをinitial-release-checkへ保全し、同じ製品と全現Sourceを含むZIPを再照合した。

全てのPASS/FAILは `docs/ai-continuity/verification-receipts/MB-20261019-V55-*` の実command/log SHAを参照。GitHubの公開証拠は配布確認後に追記する。
