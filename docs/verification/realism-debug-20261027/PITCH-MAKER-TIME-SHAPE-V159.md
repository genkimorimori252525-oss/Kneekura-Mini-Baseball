# V159 メーカーの材料位相と共通時刻比較

2026-10-28 JST / MB-20261027-REALISM-DEBUG-PLAN。V158は既存Source内の時間形状差の実証が進んだprogress。本工程では通常nominal5000tickとV78保存入力で再構成し、メーカーの操作・保存・比較へ接続した。全goal/step-007 ACTIVE。

## 実装

`PitchMaterialPhaseV159.ts`は保存world spin軸のまわりへ材料qを左乗算する。phase0は全値を保持し、既存V78 validator/schemaで保存する。速さ/spin/係数/source/historyは変更しない。

`PitchTimeShapeComparisonV159.ts`は既存V155比較を保持し、referenceの実PV・本塁到達時刻を共有する2球を正規kernelで観測する。共通airless-gravity基準、10/50/90%時刻、終盤20%をread-onlyで出力。標本間ground境界・非単調・微小量はnull/未分類を保持する。2browser entryへ2exportを追加したが、既存V155 API shape/力学/既定profileは不変。

実UIでは、pitch/libraryのEuler欄が未編集ならraw q/-qをそのまま保存する。実編集時だけ変換する。回転軸まわりの材料位相操作を追加し、未保存入力/無効角/ゼロ回転/姿勢不足を扱う。狙い補正3列比較に共通時計の時間分布2列を追加。保存summaryは採用せず入力から再計算する。

候補生成も、既存の独立practice scriptを新buildへ差し替えられるようにした。他UI・隣接script・両embedded gameは保持。[実装前判断と差の扱い](../../agent-decisions/2026-10-28-pitch-maker-time-shape-v159.md)。新solver/力のtimer/結果Buff/保存schema/Native権限は追加していない。

## 通常設定での固定追試

元のA=.02/gyro30/phase0、B=.1/gyro30/phase270だけを、同じ元PV/Trefで追試した。新seed/候補/閾値は選んでいない。lab1083と通常5000は別入力で、微小差もrawで保持した。

| 同じ元PV/Trefでの指標 | A | B |
| --- | ---: | ---: |
| 共通時計の重力基準量 | .117832605013m | .122954337183m |
| 各球の同z量 | .179751134295m | .184937586639m |
| p50/Tref | .788174044061 | .681680909604 |
| late20 | .478898503117 | .345202828265 |
| 宣言/初期実効step | 5000/5000tick | 5000/5000tick |

V78保存spin/q/seamからの実Sourceと、元reference→各候補のPV固定161状態が厳密一致した。他の投手入力は保持し、手動編集となる古いmovement履歴だけ明示削除。lab gyro30度をUIのgyroFractionへ直接代入していない。

Aだけdescriptor horizonが.9208557437882325対.9209225794803594と異なる。既存V155比較が両通常試投のmax-horizonを採るためで、full descriptor exact=false/firstdiffを保持した。through以外全field、max式、共通Trefが両horizon内、全161状態を別々に検証。旧期待のFAIL4820c353/候補01を保持する。

lab→通常の最大位置component差はA1.36882e-8m/B1.56233e-6m、速度component差はA1.36915e-7m/s/B5.74974e-6m/s。小さくてもexact=falseで保存し、tolで一致へ変えない。単位が混在するrecord全体の最大数値差は物理距離と解釈しない。

新APIで通常AのPVをBへ固定すると、元reference PVと異なりTref=.520893293999秒、量.102801171628/.112743252322m、late20=.544125964710/.349875930380だった。この量差は元V158の相対5%条件と同一ではない。狙い補正でPVが変わる効果を明示し、近量条件に戻すための狙い/seed再選択はしていない。別の公開選手fixtureによるUI試投も元V158実験とは別条件である。

## 実検証

| 検証 | 結果 / receipt |
| --- | --- |
| 材料phase先行4件 | RED3cc43147→GREENdf427181 |
| 比較先行3件 | 未実装RED3eabd942を保持 |
| phase/比較/旧V155/時系列/Workbench 6files | 36件 PASS f5c10f36556b44b9911b0907e07c417e |
| 追加ground・異gravity境界を含む最終新2files | 9件 PASS 74b441e803eb4e7f88bde8e1b4110ace |
| 全型（追加境界test後） | PASS 539633aaf5494ae0998faff32fa8c66b |
| practice script差替えNode5件 | RED0a74e3e2→PASS55c158072434467f8b80cf98f6c118c6 |
| 新Native/WB build、Maker生成 | bb46b19a / 87a1667e / 2c4c2e43 PASS |
| 同Chromeの2Core×Main/実Worker/保存再計算 | 81check/48capture PASS c2063b1ab3bd4131a9477f3b17f95765、23.766秒 |
| PC1200/390・保存実file再読込・偽summary破棄 | PASS 99df94f4b86b48e29361016fc6135369、44.031秒 |
| 方向4選択/AUTO復帰・旧省略入力2球全record | PASS 97361588bcbc45a691f816d3109a8cc8 |
| 全pin/48capture/HTML再構成/元JSON | PASS 92647cd09ba0450c81cabf8df68b9d4d |

[Core report](pitch-maker-time-shape-v159-02/report.json) / [最終UI report](pitcher-ui-v159-02/report.json) / [整合](source-audit-v159.json)。Native/WBのbrowser bundleでの同値であり、SQLite Native初期cutの材料位相保存・技能認証の完了ではない。

48captureは関数pathを明示して除外し、他の全serial dataを比較。基準側8capture合計21,004,932bytes、最大4,931,989bytes、順序付きSHA `2ee2d9e5c937a7c7e1bb52e9db6505f3478acfda51d116fbe11a626c91661773`。負の0/undefined等は既存codecで保持した。

UIはq/-qの球名だけの保存・library capture/新revision、phase270/Core全row一致・他のroster全設定不変・0reset、pending/無効角拒否、ゼロ回転/無姿勢disabled、実Euler編集、元2候補のspin/qコピー、digest/DOM照合、偽summary付き実file再読込を検証。通常物理/renderer/editor/rosterと通知所有/復旧も保持した。

初回UI85e2b32fは当時harnessでPASSしたが、最終診断追加後にharness SHAが変わったため最終版で再実行した。最終harnessをoutputへarchiveしcurrent bytesと照合。旧結果は付け替えていない。aux保存の余分な改行も直し、runtime/file/manifestのpinを照合した。

## 限定候補と残件

最新の限定候補は [V159 Maker](candidate-maker-time-shape-v159-01/maker.html)。HTML SHA `493aba72d8c276037bf5e2ac2debb3f02dfc00210f087dcf5d771c467968e375`、UI `ba9c9038dbff7541a261b2eb11109e65147e52f57c02820d2528d881c8dbcddb`。Native212inputs/entry `f3cc74fc9bf7c4dacad2d9bce67a890a1751542219cb836804410f9eab4152e9`、WB189inputs/entry `c6288bc8c6a148616f5cb01d4558323d82350efecb54ded5bf379036577c1c6f`。

旧Coreとの差は2entryの2exportと新read-only module2つだけ。力学Sourceは不変。旧V155 HTMLf447fa1bと本人JSON59,857bytes/e0123a57・原素材/スイング・共有distを保持。所有module更新以外の全HTML bytesも再構成一致。実装codeは未commit/pushで、正式同版3HTML配送や9回最終受入ではない。

次はTask2の「ニッチローは初球だけ流し固定か」を、保存方針・count・配達済み観測・投球連番・判断/誤差key・名目Intentと実行/接触結果に分け、実連続Host/Makerで閉じる。独立単球seed+1と連続状態を混同しない。

キレの実測校正・高回転のフォーク等への一般化、Task2分類/人的校正/通常戦術・Task3/V154証明/人体/再構築性能・SPIN4技術/複数Gold/希少性・Native・旧V122/V148・性能B/9回/同版配送、SIGN命名のペナント延期は未完。本人のgoal追記で最新設計本文のGitHub反映/再取得照合も最終完了条件へ追加した。進捗commentだけで代替しない。全goal/step-007 ACTIVE。
