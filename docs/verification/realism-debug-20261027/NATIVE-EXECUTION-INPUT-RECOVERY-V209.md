# 保存cut9から校正と入力だけを復旧 V209

2026-10-29 JST / `MB-20261027-REALISM-DEBUG-PLAN`。V208の中断状態から、完了済み工程を再実行せずに正常input受理まで復旧した。`f2977213f9134a6b9dd532aee02c0cd4`はPASS68108ms、実`NR209-S01`は56771ms。元V208のTIMEOUT/FAIL・終了時観測不足は保持し、元runをPASSや完了へ昇格させていない。全goalは進行中。

## 正規経路による復旧

読み取り専用inventoryで正常current cut9・World1・physical decision ordinal3・calibration0・input0を確認した失敗DBから、新owned SQLite backupを作成した。正常OwnerでActor/model/body・fresh field校正・資格2・control・dispatch32・prefix/TOTAL/view9を再認証した。元のexplicit observationは、保存原値と正常cut8 sensory responseへ全値を結合して確認した。

既存calibration Source factoryのmapだけをpure exportへ抽出し、正常dispatch32・正常current view9のmembers・元の命名と順序・observation・provenanceから同じ32 Sourceを宣言した。0件なら正規`acceptCalibrationSet`を1回だけ実行し、32件なら正常再読と期待Source全一致だけで再受理しない。1〜31件の部分状態は既存guardを維持して拒否する。今回は0件だった。

calibration32の正常再読・fullrecord/member/route一致とOwner解放後のcheckpointを保存した。既存generic `resumeInFlightBattingDecisionCut`へ薄いNative contextから接続し、既存のnormal input受理処理を通り、既存`execution-input-ready`でsentinelのオブジェクト同一性だけを捕捉して停止した。advanceは0回。LAN専用経路やfull Fixture castは使わず、他の例外とcleanup失敗は伝播する。

## 二つの差分検証

| 範囲 | 正常に検証した差分 |
| --- | --- |
| 復旧自身 | calibration32＋input1の33行。既存row/rowid/schema/head/CASは全て不変 |
| V208開始前→復旧後 | 元の10table94行、physical head ordinal2→3とWorld revision0→1の対象2 CAS、新emotion2table＋5autoindex。全旧immutable row/rowid/schemaと他scopeのheadsは保持 |

後者は、失敗前に保存したbaselineと復旧後の状態が正常な全区間の差分であることを示す。元の中断runが完了したという主張ではない。失敗DBを含む7つの保存DBのmain/WAL/journalは開始終了で一致した。

最終状態は正常current cut9・HISTORICAL cut9・null AFTER・正常current input・calibration32・World1・12参照・events9件。inputはworkOwnersに含まれず、inputのadvanceやprefix eventを作らない。`executionInputAccepted:true`・`inputAwaitingConsumerContinuation:true`・`normalLifecycleAdvances:0`・`nativePostInputConsumerProven:false`・`nativeResumeAdapterRequired:true`・`resumeReady:false`・`fullContinuationComplete:false`を保存した。commitment/resolution/field/公式終端は未実行。

原seed19と既存導出、NO_SPIN_TARGETと原2資格参照の将来hookを保持した。`h.root`やSeedRoot1、独自RNG/cursorは導入せず、`wholeRngConsumptionProven:false`のまま。正常World1とphysical3を元World0/physical2へ戻していない。

## Sourceと証拠の保持

calibration factoryを元の位置へinline展開すると元Source全bytesと一致し、generic resumeの変更は型注釈1か所だけで出力JavaScriptも一致した。`e286ecb3e1ba4316a7ee721bcf1159da` PASS94ms。親V208のSource pin例外はこの2ファイルだけとし、保存old baseline SHA、factory inline、型以外のbytes、出力JSをdriver自身でも再計算した。旧compiled closureは実行していない。

strict `df87b620879f487f936b8f0b370a5252` PASS9125ms、import-only `06b558d4dea14880b32ed5a14df85c4d` PASS8266ms（actual skip）、旧6 Sourceと新shared2 Sourceのpin `8d36bb35cb9548598175323f7a48411e` PASS156ms。Sourceとdriverを独立reviewし、旧Parent harness pinと新読取pinをmergeで上書きしない別loop照合へ修正。driver最終構文 `acc61f1070194953a3bda300d599ab7f` PASS47ms。

過去のreadonly inventoryにも同じpin集合のmergeがあったため、保存manifestの重複pin値が元Parent値と同一であることと、両集合それぞれの現在fileState全一致を、DBopen0の補足`4e9d3d806978446399f090f6a25e61f2` PASS77msで確認した。旧証拠は上書きしていない。

新実測は実Vitest hostの1caseで、Source closureはpin専用、Nodeで実行したのはdigest Sourceだけ。開始manifestはimport/DBopen前に保存し、全Source/bundle/harness/inputの終了pinが一致した。private DB/raw/manifest/baseline/bundleは公開しない。

凍結SHA-256：Lifecycle helper `c44601b9f9a5f9948729342db3adeb471caca94b7feefe56e8eac6275f534c4d`、InFlight helper `cf2c4c94937e5f57562762cb2f74d7707a763d9eeee78664a447548b22e984ff`、entry `30e37daa3df9cb22f640b52316deae22772f12a545219992d3411f55cd9f1601`、wrapper `cefed65850f62f8ccebe3dbc4b9f6c9aa4fa24f18008e28efe4ac14371bdf3c1`、driver `a7315660a97a371d4ca63efa2e01e2d338904ebd70941ab14830992157888790`。

次はこの正常inputから、既存commitment・resolution tailへNativeの正常再開入口を接続する。World1→2、physical ordinal3→4→5、cut10/11とcal32の各保存境界を検証する。今回の復旧時間をCore単体性能や試合全体の高速化完了とは扱わない。
