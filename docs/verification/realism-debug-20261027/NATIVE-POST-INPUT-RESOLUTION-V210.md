# 保存入力からcommitment・resolutionまで V210

2026-10-29 JST / `MB-20261027-REALISM-DEBUG-PLAN`。保存current cut9から正常commitment・resolutionを受理し、cut11の正常currentとcalibration32まで進めた。`5512921515fa408d956bcd16e0ba463c`はPASS274125ms、実`NP210-S01`は263284ms。打撃suffixの解決は実証したが、field root・公式終端・通常consumerへの採用・全goalは進行中。

## 正常に進めた経路

既存Native exportへ12参照のpost-input経路を追加した。正常current cut9・generic decision graph・physical decision ordinal3・正常current input・calibration32全record/member/route・World1・null AFTERを同じreadonly phase内で認証した。phase閉鎖後の新authstageを通り、同じ実caseのまま既存private `completeInFlightBattingInput`へ続行した。別のauth-only実測は挟んでいない。

既存tailのままcommitment ordinal4を受理しWorld1→2を進め、正常prepare全体でcut10へadmitした。次にresolution ordinal5を受理し、正常prepare全体でcut11へadmitした。各工程は全TOTAL・view・calibration32を完了し、Owner解放後にfresh current、全calibration、current member/route、World2、generic physical recordと最新head全列を正常再読してからfullrefs checkpointを保存した。

commitment後のinputは過去World1の入力として正常historical readerで読み、原本との全値一致を各checkpoint・最終状態で確認した。resolved cut11へin-flight専用getterを使っていない。正常physical replayから実bat-ball result・contact・canonical timelineと全Source provenanceを保存した。新RNG、SeedRoot1、`h.root`、caller booleanによる省略、LAN専用経路、full Fixture castは導入していない。

## 追記と保全

| table | 追加行 |
| --- | ---: |
| lifecycle prefixes | 2 |
| lifecycle TOTAL | 20 |
| lifecycle views | 2 |
| lifecycle calibrations | 64 |
| physical commitments | 1 |
| physical resolutions | 1 |
| World revision events | 1 |

合計91行で、新table/indexは0。physical headの同じrowidはordinal3→4→5の2 CAS、World headの同じrowidはrevision1→2の1 CASだけ変化した。最新physical参照3列と上記ordinal/revision以外の全列、他scopeのheads、全旧immutable row/rowid/schemaを保持した。launch companions・batting invocation行は増えていない。8つの保存DBのmain/WAL/journalも開始終了で一致した。

最終状態は正常resolved cut11・World2・14参照・events11件・calibration32。`nativeBattingSuffixResolved:true`・`lifecycleResolvedProven:true`・`commitmentAccepted:true`・`resolutionAccepted:true`。post-resolved consumerは未認証で、`resumeReady:false`・`nativeResumeAdapterRequired:true`・`fullContinuationComplete:false`・`fieldRootAccepted:false`・`officialTerminalProven:false`・`wholeRngConsumptionProven:false`・`performancePass:false`を維持した。元V208のTIMEOUT/FAILと終了時UNKNOWNを変更していない。

## Sourceと検証

親shared helperの旧baseline SHA `cf2c4c94937e5f57562762cb2f74d7707a763d9eeee78664a447548b22e984ff`を保存し、4つの追加置換を逆変換すると全UTF-8 bytesが旧baselineへ一致することを`162898504cfa4ca8bf5a4400f9b5970a` PASS93msで確認した。旧7/8参照経路・Owner順・LAN guard・既存tail bodyを保持している。driverも親pinとproof実物、各置換の一意性、逆変換後の全bytesを再計算した。

strict `cc737b84afdf436ebe4b704a80b37398` PASS9125ms、import-only `5ad87fb69b874a6aa9c6fccf4d4ae8bb` PASS7641ms（actual skip）、旧9 Sourceと新shared hash `299f93858a3a48b2a9086a994d88e896` PASS108ms、driver構文 `2222235ce0d2432dbc3eb39f3162c72e` PASS47ms。shared helper・新tools・driverとbaseline proofを独立reviewし、具体的な重大欠陥なし。

Source closureはpin専用で実行せず、実Vitest hostの1caseを実行した。Nodeで実行したのはdigest Sourceだけ。開始manifestはimport/DBopen前に保存し、子のclose後に全Source/bundle/harness/inputの終了pinを確認した。Parent harnessと新pinsは別々に照合し、親開始pinを上書きしていない。private DB/raw/manifest/baseline/bundleは公開しない。

凍結SHA-256：shared `5b2e4cf1b1f9fe7a4f04d9a3753e0eefd7e62c4b78c45b84ac2a2b8be583a3f0`、entry `c99b122ef718b627f3d7d077bbefa57ec20a3eb9383b047e5832210911935a29`、wrapper `09384a9ba0f1a374df327e3ed39e75471018ea941d530496da2886bd5f52a007`、driver `63a7307756a0ad2a17543f5da54240ecb318128155f30b7683d64da5876334e7`。

前の2 advanceが180秒で中断した実測を根拠に、開始前に外側300秒・内側285秒を設定した。Owner検証・物理計算・精度を省略した結果ではない。274秒をCore単体性能や高速検証環境の完成値として扱わない。検証コストは残る課題である。

次はこのresolved/contact状態から、V198の歴史的field calibrationと保持済みescape-v3 profileを正常に再利用してfield rootへ進む。prelaunch view0をcurrentへ偽装せず、fixture用continuous-v2へ置換せず、Actor/geometry/profileを結果に合わせて調整しない。未提供のOriginal Person・policy・assignmentを製造しない。
