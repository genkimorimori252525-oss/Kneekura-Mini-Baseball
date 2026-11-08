# メイン黒stageの拡大・移動 — v69局所検証

変更元は`docs/demos/baseball-maker-ui.mjs`だけ。主stageの最後の画面投影へ倍率と平行移動を適用し、物理・時刻・選手・元軌道を変更しない。倍率は0.25〜12、初期値は`{zoom:1,panX:0,panY:0}`。mini3方向の投影には適用しない。

操作は倍率slider、＋／−、現在のバットを中央へ移すbutton、全体表示reset、mouse drag、wheel、2本指pinch。pan値はcanvas幅／高さに対する割合で、各−10〜10。pinch／wheelは指やmouseの位置を基準に拡大する。

APIは既存`baseballMaker`へ次を追加した。

```js
baseballMaker.getPreviewDisplay()
baseballMaker.setPreviewDisplay({zoom:4})
baseballMaker.centerPreviewOnBat()
baseballMaker.resetPreviewDisplay()
```

非初期値の場合だけ、従来の保存JSONへoptional `previewDisplay:{zoom,panX,panY}`を追加。旧JSONで項目が欠ける場合は初期表示へ戻す。初期状態のJSON形は従来と同じ。入力の未知キー・getter・非有限値・範囲外・不完全な保存値は変更前に拒否する。

## 証拠と限界

`MB-20261019-V69-MAIN-ZOOM_0b8f7673657540c6b97933f3d3e88541.json`は**PASS18.266秒**。UI SHA256 `db71909c29c16f37eb717806da746b0508ed58b3834de3839a85b2913cb238ad`。

`check-maker-zoom-v69.mjs`は凍結v68メーカーのbase UIだけを置換して、別の局所fixture `outputs/v69-main-zoom-fixture.html`を生成する。v69全体成果物の証明ではなく、v68のCore・library・addon・helpを固定した表示変更の局所証明である。

- Chrome1200／390幅×5カメラで、倍率1／移動0のmain／mini pixels、投影値、元world／時刻が凍結v68と完全一致。
- 主stageのバット長が4倍／12倍／0.25倍となり、同じ世界の位置を保つ。中心button／reset／slider／＋−／mouse drag／wheelを確認。
- 390幅で実touch eventによる2本指pinchを実行し、倍率1.625を確認。実スマートフォン試験ではない。
- Core打撃試験／参考バット接触研究でも5倍表示が動き、世界の球・バット・物理結果・Source・revisionは不変。拡大後は範囲外の物体が画面から外れるため、両物体を常に同時表示する保証ではない。
- 実JSON download／新値の再読、旧JSONで初期表示へ戻ること、不正patch原子拒否とgetter呼出0を検査。横overflow／page error／外部通信0。

`zoom-check.json`は全結果。`main-bat-zoom4-{1200,390}.png`、`main-core-zoom5-{1200,390}.png`、`main-reference-experiment-zoom5-{1200,390}.png`は実画面。主stageのバットが拡大されることを目視確認した。

初回receipt `f83ac88cfc274e0fbe4c7aca9b56ea32`は、fixture抽出器が「base UI＋addon＋helpが同じscript」という既存包装を未考慮で元UI SHAを照合できず、ブラウザー実行前に拒否した。旧UIのexact SHAを境界で確認してその部分だけ置換するようcheckerを修正し、pinは緩めていない。原FAIL／logを保持している。
