# V116 実動作・再起と生成待ちの判断

2026-10-24 JST、Task `MB-20261024-V116`。本人の直接依頼と通常判断の記録方針に従い、4動作と再起の実因果、能力・個人・球場差を維持した修正、生成時間の結果示唆を改善する。V115と元JSONは保持し、別名V116を生成する。UI外観の再設計、新公開能力、新依存、ソースpush／merge／deployは行わない。

再起対照の根因と赤／緑・能力／球場差は `docs/verification/releases/v116/athletic-recovery/FINDINGS.md`。実送球には再起guardがあったが、走者の観測が楽観的だった。観測当時の残時間だけをsnapshotへ保存し、準備との並行をmaxで扱う。未観測の未来へアクセスしない。

性能は原raw240を凍結V115でprofileした。throw/relayが主で、完全一致のverificationが32枠からevict後に810回再計算されていた。使用済みincoming評価・boundaryだけをcompact値として128枠にし、総枠2048と原full Source計算・候補順を維持した。単一入力各1回で10.693→8.423秒、全4SHA一致。これは全場面21%の保証ではない。

局所短縮だけでは投球間の主thread停止を解消できないため、同じCoreをBlob Workerへ移し、bounded先読みを使う。V1公開Hostの2method形は維持し、内部worker factoryだけに非永続continuationを追加。seed／count／時計／score／打順／line／H/Eを引継ぎ、累積historyはmainの消費済み列だけで保持する。消費前のsnapshot／成績／season更新を公開しない。Workerは1球ごとcontinuationから再開し、累積historyを二重保持しない。

暫定lookahead12／初回warmup4。攻守交代はcommand・投手menu再評価境界。指示変更と新試合はepochで未消費結果を捨て、同じ確定状態からやり直す。未来のエラーは先行する正常結果を消費するまで出さない。Stopは観測を止める。能力、物理、RNG順、公式facts、PNG・4px・カメラは同じCore/observerのまま。調整室の同期calibration observerは互換維持し、通常HTMLとメーカー内通常runtimeへ先読みを接続する。

既存Solによる独立reviewで、旧finish取消が新試合をfailする経路、未来error優先、攻守交代の無効pitchId持越しを特定し修正。初期module8tests、Host continuation2tests、C2 Chrome両幅で指示／新試合／finish取消・確定frontier・directCore全結果一致・応答heartbeatを確認した。実1倍速の連続再生、9回の頻度、最終配置はまだ進行中であり、この記録だけで完了としない。

原FAILは保持。初期profile toolのWorker停止とNode24 Worker profilerのWindowsパスJSON不良は診断側で、worker内Inspectorへ変更。C1buildのNative marker二重検出はhelper内の検出needleを分割して修正。C2後に小さなsnapshot再利用と追加testがあるため、最終は新候補で全入力を凍結して確認する。

復旧は保持V115を開き、今回の限定hunk／V116生成物だけを戻す。共有workspaceのreset／cleanは行わない。buffer枯渇やCPU不足で残る遅延は計測して報告し、全条件の無待ち・実機スマホFPS・MLB実測動作頻度を主張しない。GitHubへは私的入力・生ログ・個人pathを除いた判断要約のみ既存PR380へ集約する。


## 最終実装・配置結果

最終C3は47file335tests、型、background8tests、両幅Chrome/12守備/通常2/調整室/athletic4/旧JSON/人間AI10control/旧重入力/元4守備がPASS。9回は同一Coreで475球109守備16半回、jump1/dive4/feet73/head22、実1倍速16球5守備のbuffer枯渇0。再起差だけで実3塁進塁に変わる対照もPASS。全Source/原本照合後に3HTML+6付属fileを別名配置、publish5488ef90。RESULTS.mdへ全根拠・限界・既知generic receiver戦術ETAの未実証cornerを記録。最後の独立reviewに重大指摘なし。source push/merge/deployなし。GitHub公開範囲を実確認（public repo、既存PR380同branch/HEAD）し、個人情報を除いた判断要約を同PRへ記録する。


最終readback `34aa838fd43d4387af83a1e9a260ea7f` PASS。全3237 captured inputs、9配置file、9回Coreと公開判断本文を再照合した。判断要約は [既存PR380](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/380#issuecomment-6382611806) に同期済み。Source/HTMLのpush等はしていない。
