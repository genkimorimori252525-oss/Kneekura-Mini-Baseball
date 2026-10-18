# v57 振り始めた向きで打者の頭を固定する

人間の要求は、振るまでは投球を追い、振り始めた瞬間に頭のカメラ移動を止めること。遅く振れば、それまで投球を追った姿勢で固定する。添付の設定B（高さ.30m・俯角上限.20rad・待機300ms・移行70ms・追従率.26・許容範囲.02rad）を初期値に採用する。

## 根因と変更

v56は投球追従と予定打点への注視をスイング中も混ぜており、目標へ向けた頭の回転を止めていなかった。旧aimの取得は `max(decision+sensorDelay, contact-.23)` から始まり、実測バットの動作開始とも一致しない。原因は継続する注視目標の混合と角運動にあり、頭を固定する状態を追加する。

Coreの `referenceStartTick` はmotor latency適用後の実測バット実行開始、`referenceThroughTick` は最終キーの実行終端。開始に球の感覚遅延を加算しない。11msのframeで最初の変化を探す方法も採らず、正確なmotor時刻で8ms積分を分割する。その時点のyaw/pitchを記録し、スイング中は同じ角度を維持する。固定開始で角速度を0にするのは今回の要求に従う明示的な停止で、角度を別の目へ切り替えるものではない。身体に付いたeye位置は従来の移動を継承する。

対象は `swingOffered === true && !bunt`。take/buntにもstart/endのdiagnosticsが存在するので、時刻だけで判定しない。R/L、空振りにも同じmotor契約を使う。開始前は従来の投球追従率・許容範囲と既存ミート/選球眼を使い、予定打点への先行した向け直しを行わない。見逃し、バント、投手/捕手/守備のカメラは継承する。

固定を解く時刻は、スイング終端と、既に認識した打球から300msの両方を満たした時点。解除開始を一度記録し、後から遅い打球認識が届いても頭を再固定しない。その後70msで注視目標を既存の打球追尾へ戻し、実際の首の回転には従来の速度・加速度制限が働く。

頭の固定中に予定打点の高さへ向け直すと要求と矛盾するため、.30/.20の2値は旧JSONとの互換値として保存する。v57調整室では非適用の説明と無効表示を付ける。残りの待機・移行・追従率・許容角は調整できる。Aの従来モードと旧JSONを保ち、Bのリセット値を添付設定にする。別のv57保存領域にして旧v56のブラウザ保存が採用値を上書きしないようにする。比較用の「スイング開始」マーカーも追加する。

## 検証

- HEAD-LOCK-UNIT8f1cb8d0 PASS、5.328秒。R/L、grid外の正確な開始/終端、遅いスイングで別の追従姿勢を保持、ミット捕球中、take/bunt/whiff、遅延hitと解除latch、seek/rewind、設定の原子的拒否、未来payload/collision不参照。実Core12球8hit8swingのSource/バット不変。
- BUILD9d6e23f2 PASS、0.140秒。frozen v56から新helperと表示版名だけを交換。Core113入力、球の22/55ms・4px格子・表示倍率1を保持。
- CADENCE17dbd2a3 PASS、8.889秒。v57両HTMLで60Hz手動時計のscene18/sample45、非投球高速更新0、A/B短区間loopの始点球とpixel一致。初回abd2da3aは検査の起動待ちがversion56を固定していたためtimeout。製品を変えず、引数で別HTMLを検査できるようcadence契約55/22で起動を確認する検査へ訂正。原FAILを保持。

- BROWSERaf435d80 PASS、65.422秒。1200/390px、通常/labの12球full Source/frame/play/events/match/batがv56と全SHA一致。R/Lのonset前追従、開始/中間/終端のyaw/pitch固定、A従来動作、take対象外、解除と既存打球追尾再開、7既定値と保存分離、5カメラ、停止48枚の3層RGBA一致。例外/外部通信0。
- PACKAGE0b36f1c9 PASS、0.858秒。2つの自己完結HTMLと埋込試合、各helper/driver/template/builder、全113入力、各最終browser報告のSHAと旧v54〜v56配布不変を照合。初回f7397dd9は配布検査に旧版のversion56 assertionが残ったためFAIL。57へ訂正し製品bytesを変えずPASS。原FAILを保持。

通常HTML SHA `238fce33e1e7087ecc5b08f1a8a1487c1f65d92e6a6dbd718dbf8ddb6d068d0f`、調整室 `82532cb37e4420785913686633d0d5e37e8ea4d80a0119566f99066dc222fd90`。[ブラウザ報告](../verification/releases/v57/head-lock/head-lock-check.json)、[周期報告](../verification/releases/v57/cadence/cadence-check.json)、[配布照合](../verification/releases/v57/release-check.json)、[配布と操作](../demos/releases/v57/README.md)。

## 範囲と残件

物理・スピン・実測バット・能力・AI・裁定・メーカーは変更していない。Coreは引き続き `4a581b262a71530ef67503ba76e71849d52c394a2b7c113852a461b423486279`、113入力。今回のカメラ係数・頭の停止は人間の指示に基づく表現であり、生体力学の実測校正ではない。新9回や100試合を実施したとは扱わない。既存の原全計画・FAIL/UNKNOWN/Charter HOLDを継承し、main未マージを維持する。

編集元: `live-camera-tuning-batter-view-v57.js`、`camera-workbench-v57.js/html`、`build-v57.mjs`。再生成は `node tools/browser-bridge/build-v57.mjs`。旧配布・旧helperは保全する。
