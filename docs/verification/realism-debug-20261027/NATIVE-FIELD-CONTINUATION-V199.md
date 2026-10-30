# 準備済みNative状態からのcapture checkpoint V199

2026-10-29 JST / `MB-20261027-REALISM-DEBUG-PLAN`。正常capture checkpointの限定Native実証は完了。field-rootまでの全continuationと全goalは進行中。

V198の受理済みコピーを新owned SQLite backupへ移し、正常right→launch→元prefixのadvance1回→capture-cutを受理し、既存resumeの正式入口で止めるSourceを追加した。正常current capture ownerと直前のhistorical lifecycleを認証し、未admissionのcapture fullrefとresume pinsを保存する。元practice/2TAKE/body/model/field校正を再受理しない。field-root・resolution・全continuationの完了とは扱わない。

field-rootまでのSourceも別の入口に保持するが、今回の限定実行では呼ばない。後続の元2資格・NO_SPIN_TARGET・selectedAtTick・pure v1厳密比較と、V198の事前固定profile/元fresh-calibration条件を保持する。fixture値をproduction校正・自然AI・希少性の証明へ拡張しない。

## 型と実行環境

既存`resumeInFlightBattingSwing`とその前半のh引数型2箇所だけを、既存のthin contextに合わせた。偽のfull Fixture castや未使用依存の捏造は行わない。型消去後のhelper JavaScript全文一致を確認した。旧default・runtime処理・負例検査は保持する。

初期限定strict`fc681f11ecd34dd990f8cbb317286312`は未使用type importとrightのunion narrowingでFAIL。未使用import削除と正常right kindの境界確認後`098ba63a99ef4782a0b45214515f4183` PASS2578ms、wrapperを含む最終strict`63ce6d4908ba42a6ba18d4552f10dfe2` PASS2781ms。

直接Node importのpreflight`fdf96972f7644872b1424daaeaf5bc3d`はVitest internal state未初期化でFAIL。Native関数は呼び出していない。元の検査を削除・置換せず、実Vitest hostで新入口だけを呼ぶ方法を採用した。closure bundleはSource pin用に保存し、実行しない。digest bundleだけをNodeで実行する。この実行環境を`VITEST_ORIGINAL_SOURCE_ENTRY`と明記する。

host import-only `NF199-S00`とhelper JavaScript一致の`045ee719ade64022b19ee90ab3bd7228`はPASS8828ms。843 Source/endpinと元DB全files一致、Native関数呼出し0。helper JS SHA-256は`5de00ff0487dd527f8d985be8a7d2f59526dfb3ad1dce05722506d612201d276`。capture分岐追加後のstrict`2fe589573e3246fab6c708a5f64c6d64` PASS2687ms、driver最終構文`7a9283c7d3ae44a2bade7dbda3f0bc07` PASS46ms。

独立静的reviewで、launchに必須のpitch-consumer/consumption/admissionの3tableをdriverがimmutable扱いする事前欠陥を検出した。本体を起動せず修正し、正常Ownerの各1行追加だけを許可した。current capture＋直前historical view/refの境界は既存resume前提と整合している。

## 実行・保全条件

driverは実行前に全Source pin・入力・profile・許可変更table・固定commands方針をwx保存し、V198元コピーをreadonlyでSQLite backupする。元DBの非空WALをraw copyしない。

新コピーでは9 append tableとphysical headだけを許可する。追加行数はprefix1/TOTAL10/view1/calibration32/cut1/launch1/pitch-consumer1/consumption1/admission1。全旧immutable row/rowid/schema、他head、V198 body/model/calibration3tableを保持し、許可外の変更を拒否する。current physical captureと直前historical lifecycleを区別し、未admission状態を最新lifecycle完了と主張しない。元DB・Source/bundle/harnessの終了pinを確認し、実行失敗時も原結果を保持する。

## 正常captureの実証

`3a97a0aca808447399763a05e6e9aa61`はPASS72078ms。実Vitest hostの`NF199-S02`を1回実行し、launchと最初のadvance、current capture、直前historical lifecycleを正常認証した。captureは未admissionのまま、既存`resumeInFlightBattingSwing`が要求する4 fullrefsを保存した。

許可9tableの追加行数は上記の値に一致し、physical headだけが正常更新された。他の旧immutable行/rowid/schema/headとV198 body/model/校正3table、元DBのmain/WAL/journalは不変。843 Sourceのclosureはpin専用で実行0、1 Sourceのdigest bundleだけをNodeで実行し、全Source/bundle/harnessの開始終了pinが一致した。原input/profile/正常Gold2 inventoryとrefをlossless保存した。private DB・records・manifest・bundleは公開しない。

`fullContinuationComplete:false`、`fieldRootAccepted:false`、`resolutionAccepted:false`を明示する。新practice/TAKEは0。72秒は限定checkpoint準備の実測で、速度改善達成・第二Native対照・通常AI・公式終端の証明ではない。

## 次の実作業

V195のcut11受理部分は88.474秒（prefix6.070/TOTAL24.320/view24.595/current6.348/calibration32 27.140秒）、前後の準備・再認証込みで103953msだった。旧V193のadvance5〜10だけでも373.780秒で、全tail180秒の根拠はなかった。全tailは起動せず、正常capture checkpointまでに限定した1回を180秒枠で検証する。

速度改善は別の新測定として、保存V195 normal current getter1回のCPU profileを取得した。`2a649a8434c448d8a726273a602aa701` PASS8313ms、getter自体7103.5292ms、全row/rowid/data/callerと792 Sourceの開始終了pinが一致した。これは新しい性能帰属の測定で、過去の成功caseの再資格化ではない。

既存physical traversal/lifecycle phase/shared memoは既に存在するため、同じwrapperを追加する修正を行わない。準備・DBopen・raw digestを測定区間から除いたprofileをofflineで分析し、次の改善を決める。総性能PASS・全tail・第二対照・公式終端は未証明。
