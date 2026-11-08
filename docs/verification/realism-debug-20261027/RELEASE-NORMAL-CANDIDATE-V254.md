# 新Source構成の通常試合候補

2026-10-31。未採用V247/V248/V251のruntime importを含めないr5 Source snapshotから、固定tsconfig・onLoad実読取bytes照合付きで生成したNativeを通常HTMLの唯一の実行Coreに組み込んだ。V250方向おまかせ、V252打球表示、V253自己申告ファイルの保存・再表示を適用。元の673試技・92,201キーのlibrary、match-dataとdecoderを保持。詳細な入力・Sourceのpinと変換逆証明はローカルmanifestに記録。

候補 `work/release-normal-v254-01/game.html` SHA-256 `716b1105ea8683df869ec071ac517a1c55344ca382e490ccdd10793d61df2dda`、生成 `182eae72fec44fce8c2af4c2ac58a083` PASS。元roster氏名等を含むためローカル検証用。本人raw JSONはbuildに使用せず、外部公開範囲は未確認。

Chrome 156.0.8078.76で固定seed、V250 OFF→試合中ON→次試合ONを操作。ONで17球（先攻16・後攻１）全てにAUTOが届き、５接触・12非接触を含めMainと実Workerのrecord/continuationが完全一致。V252打球角度・分母、V253保存→新試合→読込/再読・不正file時保持・解除、既存summaryの主要キーと390px表示を確認。receipt `e8834dda5733459e98b321a6e59b3207` PASS、48.312秒、report SHA-256 `9c2f5a6e6faad998b58de977d838486320fa4c842024761746e172dea3ecc8a0`、27 artifactsとreceipt/logを照合。

先行 `55d8f3ee0b38430fb36ef755d2e8b70f` FAIL は角度表示照合にNodeとChromeのatan2最終桁差が現れたため停止。同じChrome内で独立計算へ修正し、値は未丸めで比較、Nodeとの差も別artifactに保存した。Main/Worker比較や分類閾値は変更していない。

これは通常HTMLだけの限定検証であり、Maker・調整室の新構成、本人データの新構成実証、全９回、試合全体の速度、キレ物理、４回転、Native能力、完成版配送を証明しない。snapshot内に未追跡69 Sourceがあり採用未確定、共有node_modulesによるbuildでfresh installも未証明。

## メーカーと同じ r6 Core の通常候補

メーカーと通常の実行Coreを揃えるため、旧候補を保持し、r6 Native `b664cc5c3b3a9146b1f19107ccd8a30600d3df6bd08e9228693ad8a577d589aa` を唯一の実行slotへ全文組み込んだ別の候補 `work/release-normal-r6-v259-01/game.html` SHA-256 `d4dde4f5615b2d3d66cee8775a1697b2f767f32f1100d5853804bc6055465273` を作成。生成 `3c20521c4d054471963a059708e47ff2` PASS、Maker両埋込ゲームとのNative全文一致を静的に照合。V248は明示opt-in対応でありdefault採用ではない。

この新構成をChrome 156.0.8078.76で再検証し、固定17球・両軍AUTO、５接触／12非接触、Main／実Workerのfullrecord・continuation一致、記録保存・再読／不正入力保持・解除・390px・endpinsを確認。receipt `536b64a68e3d43218326ca787c5d6ed5` PASS、47.640秒、report SHA-256 `550129f6cdf1a356df9505e6c40ed87c133e0416c62c2394453a82fe23b91416`、27 artifactを照合。旧SourceのPASSを移転したものではない。固定17球の局所結果であり全９回・性能・完成３HTML配送は未証明。
