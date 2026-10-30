# 旧Sourceの測定原記録

v50と同じv49 Coreを測定した保存結果。現在のv51のPASSではない。`canonical-spacing-summary.json`のsourcesに測定時のraw Source SHAがある。旧bundleはv49配布のtested-core-inputs.zipに保存されている。

3局面はinput・result・frameを含む原JSONと近接frameを保存した。normal-game-final-spacing.jsonはv49通常試合の最終frameだけを対象とする。元probeをbaseline-probe.test.ts.txtとして保存した（元位置work/v51-spacing-baseline.test.ts）。これは旧treeで実行した記録であり、現在のSourceで原出力へ上書き実行しない。

元のworkspace出力は../../outputs/verification-v51-baseline。新Sourceの回帰はsrc/core/sim/fielding/LiveFieldAvoidanceV51.test.tsと最終machine receiptを参照する。
