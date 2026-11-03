# 元の技術別運動目標を正規Readerから取得

2026-10-30 JST。SPINの資格が参照する元練習のplanとreleaseを、旧contact DTOを変えず別versionのread-only Readerへ公開した。技術別目標がconsumerへ渡らない不足を直すための根拠取得であり、次球への適用や新資格登録の完成ではない。

## 追加した境界

`readNativeStandaloneBattingMotorEvidenceV224` は既存native snapshot / byEvent / learningGuardを通し、元command・model / repertoire / equipment・plannedDelivery・正規consumed release・contact / ball・実装familyと元proof hashを返す。cloneInert / deepfreezeでdetachし、旧DTO / Mastery derive / writer / registryは変更しない。`originalContactNativeAdmission:true`は元接触の受理だけを指す。

既存Storeの作業開始時34584 bytes / SHA `4fbf10071eac9ca959ec0e69e3d8e4698738fa33692c3a70c4f38e66d88cdcd3` を全bytes保存した。新exportは2000 bytesの追記だけで、除去すると元全文に一致する。Git親30919 bytes / `1428c286…`とは別に扱い、共有dirtyをGit親へ戻していない。

## 実際に取得できた証拠

readonly ONE gate `d6cc23733bcd47b6be14cdc4eff79a10` PASS7093ms。保存BACK / TOPの2資格と各3元contactについて、event / proof / person / day / repertoireを正規snapshotで1:1結合した。6件とも `COURSE_AWARE_V1` / `explicit-test-course/v1`。

| 保存値 | BACKSPIN3件 | TOPSPIN3件 |
| --- | --- | --- |
| plate target | (0.08000000000000002, 1.50, 0) | (0.08000000000000002, 1.54, 0) |
| planned release position | (0.08000000000000002, 1.52, 17.84) | 同左 |
| targetBallCenterAtContact | 無し | 無し |
| handedness / center | R / (-.72, .95, 0) | 同左 |
| zone | centerX .08000000000000002 / halfWidth .22 / lower .5 / upper 1.8 | 同左 |

clock / contactTick、速度・spin・固定physicsは認証したlossless artifactへ保存した。原plan自体には相対変換規則と次球適用域が無く、`NOT_ESTABLISHED_FROM_PERSISTED_COMMAND` / `futurePitchBindingProven:false`を保持した。

元producerのpin済みSourceは、実行前にplanned release由来のneutral目標から技術別の目標を固定している。認証DTOと当時producer規則の対応により、元6planの事前基準を新sidecarへ固定することは可能というAstraの新証拠差分判断を得た。ただし、観測forecastをanchorにする次球への移替えは別の適用契約。旧DTOのfalseや旧資格hashは書き換えない。

## 保全と検証

元DB / baseline非open、新paired copyだけRO / query_onlyで読んだ。全rowid / schema / heads / data、caller / authorizer / savepoint、Source / bundle / retained artifactsの開始終了pinsは保持。新practice / contact / writesは0、旧suffix endpins UNKNOWNも保持した。

最終new5 tests `7d9bf9ca`、focused strict `f629737c`、driver構文 `c92b3b97` PASS。genuine SQLiteの元plan / release、欠落・wrong family / profile / hash改竄、旧DTO全値不変、detach / freezeと全digestを確認した。旧DTO直結2件 `0d6db5c9`は改行復元前の意味同一Sourceで通過し、最終new testでも旧DTO一致を確認した。初期RED `ca0f8389`、test import FAIL `ebb824a7`、型FAIL `bc97b96f`を保存した。改行正規化によるprefix差は検知し、元全bytes＋追加exportへ復旧してから最終検証した。

Sol独立reviewは5 filesとprefix / appendを実hash照合し、旧DTO保持・正常認証・資格結合・Source例外に重大問題なしと判断した。

| Source | SHA-256 |
| --- | --- |
| Store | `492027b0ac855de442d037558029992c60b5c73779b05da82fa42bb3502974af` |
| native test | `8e1c1245bb08631f1777f673d02f8bff25a420765ba04997c219908ddb2659cb` |
| gate entry | `187b1a44b31d3c308ba5173510bd161d00e5be48bbf43269b445fd65cf313428` |
| gate test | `b503c687ba4195b0f3a217714de2123177c853a1216bb367b2b6f1b3005ab54b` |
| driver | `ca4cdbd59708d79a22a2540cbbd1aaea510fb6c8ecd2e5ea5dc30c53df0a08ba` |

Source差は旧Lifecycle Readerの既承認1pathと、Storeの旧prefix全bytes一致の追加exportだけに限定した。他旧closure pinsは一致を要求し、旧bundleの証拠と新runtime再認証を区別した。

## 次の利用動作

新Owner sidecarで元資格・3contact・producer証拠・運動目標・適用域をimmutableに結ぶ。観測anchorへの適用では、配達済み観測ID / cutoff / neutral予測 / relative goal / plane-depth / clock規則を実行前に固定し、新しい適用条件のactual contact → exit spin → 既存空力を検証する。元6contactを再生成する必要はない。

BACK / TOPの証拠をSLICE / HOOKへ転用せず、未検証域は未適用。相対規則・次球移替え・技術制御・4技術全体・自然Gold・性能・最終配送は未完として保持する。private原本 / lossless evidence / DB / baseline / artifactsは公開しない。
