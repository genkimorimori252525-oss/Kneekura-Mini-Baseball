# V159 実装前固定：通常投球入力とメーカーの時間分布比較

2026-10-28 JST / root / MB-20261027-REALISM-DEBUG-PLAN。V158は既存Sourceの64条件で近量/近方向かつ時間形状差のある1対を実証したprogress。全goalは維持し、今回はその物理入力を通常Makerへ接続する可逆な局所変更を行う。

## 対象と判断

1. V158のA=spin倍率.02/gyro30/phase0、B=.1/gyro30/phase270を固定する。seed3/公開curve4/保存PV・origin等を再利用し、通常nominal5000tickで2候補だけ追試。1083tickのlabとの差は別の宣言入力の差として全値を残す。新候補/seed/閾値を選び直さない。
2. V78の保存正本はworld `spinRadPerSecond` / `releaseOrientation` / `seamForce`。相対風速からのlab gyro30度を、UIのgyro値へ直接代入しない。新authoring操作は現在のworld spin軸の左乗算による材料phase変更だけ。既存V78 schema/速さ/spin/係数/provenanceを保持する。
3. 現UIは元qをEuler表示へ変換して12桁表示し、無編集の保存でも再びqへ変換する。raw q/-qを保持する既存spin同様の経路をpitch/libraryへ入れる。角度を実際に変更した場合のみ再計算する。この不整合は、保存入力と実Sourceの再現を求める本人指示に反するため局所修正する。
4. 既存 `comparePitchReleaseV155` のAPI/全result shapeは維持する。新しいread-only `comparePitchTimeShapeV159` から既存比較を呼び、referenceの実PV・本塁到達時刻を共有する2球を正規kernelで測る。共通のairless-gravity基準、ground境界/非単調/微小/未到達を保持。UIは能力があれば新版を使用し、旧Coreへは既存比較で対応する。通常の狙い補正3列表示も保持。

本人の既存goal/Task4の投球比較・材料姿勢・保存再計算の範囲内の判断として記録し、通常変更の都度承認は求めない。新しいsolver/力law/時間gate/得能Buff、既定物理profileや選手値、Native権限、保存schemaは追加変更しない。新規公開exportはread-only helper2つで、既存省略入力の結果を変えない。

## 所有と検証

rootは新helper/比較/test/exportsと限定verificationを担当。既存UI担当は `docs/demos/baseball-maker-pitcher-v92.js` のみ、別担当はphase helper先行testのみを所有する。共有workspaceの他者変更を戻さない。新依存なし。

phase0のq完全保持、非identity材料のworld左積、入力不変/owned freeze/拒否境界を先行RED→GREEN。新比較は既存2通常試投の値を保ち、実Sourceの全共通時計sample、共有PV/重力、標本間ground/非単調null・JSON再読を検証する。既存V155比較/時系列/Workbenchと全型、PC1200/390の実UI保存/回転軸phase/保管庫/比較再読/通常描画を実行する。

新Coreは独立folderへbuildし、Main/実Worker/保存入力再計算を全値比較。旧V155 Core artifactは保持し、既存entryファイルへの追加export2点だけを予定差分として区別し、物理Source全bytes不変と旧省略入力の全record同値を確認する。本人JSON・原スイング・旧Maker/通常HTML・共有distは保持。復旧は新helper/export/UI局所差分と新候補を外すことで行える。

候補の通常入力化や操作UIを、実測校正/人体知覚/Native認証へ昇格しない。Task2/3・初球固定仮説・V154・SPIN/Native・旧残件、性能B/9回/同版配送、SIGN自動認定/命名のペナント延期は未完として全goal ACTIVEを保持する。

## 初回の実検証で分かった差

初回V159-01はreceipt4820c353のFAIL。Aの直descriptorと既存V155固定release比較のdescriptorで、`throughElapsedSeconds`だけが.9208557437882325対.9209225794803594だった。既存比較はreference/variantのhorizonのmaxを取る設計で、共通Tref約.52秒より後の宣言終端が異なる。全161観測値と他の同値検証は一致していた。旧FAIL/両descriptorを保持し、全descriptorが同じと書き換えない。

対応は、raw descriptor exact=false/firstdiff/両horizonを診断として残し、through以外の全field・既存max-horizon式・共通161sampleを独立に厳密検証する。球を切り詰めたりhorizonを揃えて結果を変えたり、数値tolで差を隠したりしない。これは比較対象範囲の明示で、物理lawや元profileを変更する判断ではない。

また研究aux JSの保存helperが末尾改行を加え、宣言entry hashと実ファイルのhashを違える実装を発見した。raw bytesで保存し、runtime code/保存ファイル/manifestのpin一致をassertして修正する。ゲームSourceの変更は不要。

本人のgoal追記により、最終完了条件へ最新設計本文のGitHub反映・本文再取得照合を追加した。`docs/ai-continuity/AMENDMENTS/2026-10-28-latest-design-github-completion.md`を正本とし、PR進捗commentだけで達成としない。
