# 観測集合情報付きJSONの生成・メーカー読込

2026-10-30 JST。正常Native snapshotから、対象選手・観測集合のidentityを保持するJSONを生成し、メーカーへ読み込む接続を受け入れた。回転物理制御や現在のcareer日時の証明とは別。

## 利用可能になったこと

- CLI `export ... --envelope` が、従来V191 reportとscope / sourceKey / revision / snapshotId / captured・current inventory hashを別versionのenvelopeへ出力する。既定CLI・旧report形式は維持する。
- `readContactDescriptorEnvelopeV229(raw, expectedScope?)` はversion / boundary / keys / scope / source / 集合hashを検証する。古いcaptureと現在集合が一致しない場合は、新形式で同一集合と認めず再収集が必要になる。未収集・未評価を成功や0件へ補作しない。
- メーカーは新形式と旧V191形式を読み込める。identityはreportと別のreadonly状態。旧形式・クリア時はidentityを解除し、不正入力では双方の以前の状態を維持する。
- 表示は外部記録の参考情報であり、`AS_OF_LATEST_REGISTERED_CONTACT / UNCONFIRMED / physicsEffects:NONE`を保つ。JSONのhashだけでNative認証済み・現在日・選択中選手との対応を推定しない。

## 実装ファイル

新pure schema / parserは `src/integration/traits/ContactDescriptorEnvelopeV229.ts`、正常snapshot読取の追加exportは `tools/native-contact-report-runtime-v192.ts`、CLIは `tools/native-contact-report-v192.mjs`。UIは `docs/demos/baseball-maker-ui-v94.mjs`、builderは `tools/browser-bridge/build-maker.mjs`。新readonly entry / driver、Maker候補prepare / browsercheck、関連testsを追加した。

表示専用parserは独立browser bundleで提供する。今回追加したworkbench exportは除去し、作業開始時のworkbench-index全文SHA `88f84da5c47d87b1bcce4afe1e91f3c8a844548b62d0d90d8998b7de0c06a2be`へ戻した。UIは元untracked全文、builderは共有dirty全文とGit親を別保存して変更範囲を区別する。

## 検証

parser / identity / CLI / 旧default逆変換の関連tests、focused strict `c6c7fa0bc21348a4b2527b4802110b51`、driver / UI / builder / prepare / browsercheckの構文検査を通過。

1. 正常readonly `775d151cd13e46f2941ccd228ea9ed50` PASS / 1,842ms。旧V192保存DBの2観測を再利用し、subjectとsource revision2、captured=current inventory hash `512c3640e3fec24d8c60c86a36ca75554428e947a71653b80a3b26c2aa1149ec`を認証。CLIと正常APIが全値一致。原DB非open・全files・旧row / rowid / catalog / head・caller・終了pins不変。新contact / collection / practiceは0。
2. 通常builder `380398caa9ed4a798981a89a53707122` PASS / 3,562ms。Node VMで実envelopeを検証し、200 Sourceを照合。既存dist `b023e61c…`を全bytes退避し、生成物`c833dfa8…`を別保存した後、生成hashと復旧直前hashが一致した場合だけ元bytesを復旧。最終SHAも開始値に一致。
3. Chrome 156.0.8078.49 `34e260f6699e4bc4bb55739552365abe` PASS / 6,344ms。1200pxで新形式の実file読込・旧形式・不正scope / hashの拒否とatomic保持、物理・選手・roster不変を確認。同じpageを390pxへresizeし表示・identity・状態保持を確認。外部request / pageerrorは0、終了pins一致。方向4選択とV222の練習・region経験入口も保持。主担当は両screenshotを目視した。

## 利用する候補と残ること

[新しいメーカー検証版](candidate-maker-contact-identity-v229-01/maker.html) は受入V222のHTMLを基礎に、UI差替えと独立parserを追加した。これらを逆変換すると元HTMLの全bytesと一致し、既存workbench / 練習 / 投手build stampは不変。検証済みHTMLと配送コピーのSHAは `5227b16a57746496d8e35a143531101c9992ccade071d908ea514ab4ea194bba`。

通常builderの現Sourceによるworkbench `c833dfa8…`は旧受入V222の`e7a5d07…`とは異なる。今回の表示追加による変更ではないが、両者の保存復元互換は未検証。候補の既存Core保持と、最新Sourceの完成3HTML配送は分ける。

現在日の追加調査では、接触calendarのV186・WorldCalendarDate、国内season runtime / advance / scheduleは季節origin・季節変更・caller指定日の照会を扱い、この範囲で現在日を認証するhead / career mappingは確認できなかった。project全体に存在しないとは断定せず、現在日をsystem clockや最大接触日から推定しない。production分類校正・現在時計・全producer人口・同PA複数記録等は未完。

先行strict `179d6e47ac114b3d9036f6d8189b0ac4 / 4342a311f8894d738d994aefbb47ddc2` はNodeアクセス違反・原因UNKNOWNとして保持。後の同対象PASSを原因解消とは扱わない。`231950ed…`は書込encoding失敗後の対象0件で、検証成功に数えない。旧FAIL / TIMEOUT / UNKNOWNも保持する。
