# V192: 通常Native DBからの観測収集とレポート書出し

2026-10-29 JST / MB-20261027-REALISM-DEBUG-PLAN Task5 SPIN-03。本人の既存Goal・実装再開指示に基づき、V191の表示用report生成をfixtureの試験modelから独立させた。新しい依存・既存保存形式の変更・数値model既定値は追加していない。

## 通常の入口

```text
node tools/native-contact-report-v192.mjs collect --database=world.sqlite --career=career-id --player=player-id --calendar-edition=existing-edition-id
node tools/native-contact-report-v192.mjs export --database=world.sqlite --career=career-id --player=player-id --output=report.json
```

対象は明示された既存のregular Native DBだけで、誤ったpathから新DBを作らない。career/playerはperson-linkのsource_idをlocatorとして取得し、正規readerでaccepted intake・roster・scopeを同snapshotで再認証する。Actor/contactがなくても既知subjectを認証でき、不明・破損・曖昧namespaceはNoContact/0件へ落とさず失敗する。

`collect`は既存V188 Ownerで対応producerの接触を収集し、観測metadataを更新する。既知subjectのread-only preflightとwriterは別connectionで、writerが原contact/calendarを再認証する。最初のopenで2 metadata tableのDDLが独立commitされるため、後のcapture失敗時にも空tableは残り得る。captureのreceipt/head更新はrollbackされる。元の物理・calendar・roster行を更新する操作ではない。

`export`はOS read-only SQLite connectionを使い、同snapshotのsubject→V189→V191から新規JSONを排他的に作る。schemaを設置せず、収集を自動実行しない。未収集はNO_REGISTERED_CONTACTS、既存Sourceがあってもmodel未指定ならNO_MEASUREMENT_MODELの未評価reportとなる。不明の件数はnullを保持する。既存の出力fileは開く前に拒否する。

明示callerが提供する場合だけ`--model=MODEL.json`・`--policy=POLICY.json`を受ける。校正済みとは扱わず、reportのmodelCalibrationはUNCONFIRMEDのまま。`--projection-revision=N`はcaller metadataで、career時計・日付・観測順の代用ではない。正式calendar参照も推測・作成しない。

実行時は通常runtimeを既存esbuildで一時bundle化し、全load/終了Source SHAを照合する。fixture/test importを拒否し、終了後はその呼出しが作ったbundle1fileと空directoryだけを非再帰で片付ける。通常runtimeの827inputsにfixtureは含まれない。

復旧は新tool/runtimeを外す範囲で可能。収集済みmetadata・原DB・出力reportを自動削除しない。read-only SQLiteでも空WAL/SHMが残る場合があり、これをcheckpointや手動削除で隠さない。今回のexportでは主DBの全bytesと既存rows/schemaが不変だった。

## 検証

- runtime新19件: RED `fd81bd712ed443ab9a45f6c2cf6e4fc6`→`31fdddf7581b4a5da6336be3c38d8616` PASS9375ms。実Nativeの2contact収集/retry、モデルなし、Actor/contactなしの既知subject、不明/破損/namespace拒否、未存在DB、capture失敗後のDDL/空receiptと元rows/catalog保持、caller q1/transaction/savepoint/authorizerを確認。mock認証ではない。
- CLI/parser/filesystem新14件: module欠落 `3269e6eb`、Viteのsqlite直import停止 `d2470503`を保持し、既存Nativeと同じcreateRequireに合わせた `c59715bca3b64b5db8bafd34fd8b24fc` PASS625ms。明示入力・引数誤り・未知file未作成・既存output保護を確認した。
- toolsのTSは通常tsconfigのinclude外なので、同じstrict/lib/module条件で新runtime/testと依存を明示検査した。`a04cc1df9cb54615b03a351aa09b1aff` PASS9328ms。未変更の全src再検査はしていない。
- CLI実受入最終out02 `b10820039a81434aacf77354b67435f7` PASS10188ms。Native fresh fixtureは準備だけに使い、通常commandを9 child processで実行した。全成功childは開始時に別途pinした通常runtime SHA/input827と一致、全依存load/終了SHAを照合した。
- 未収集のread-only export・不明scope拒否/出力なし・正式career起点未指定のcapture失敗/DDL2tableのみ・正式参照による2件収集・retry同一・モデルなしexport・明示caller model/policy・既存output拒否を確認。明示試験modelは17–23°/.8で、runtime既定値にはしない。元41tableの全rowsと全既存catalog、主DBのexport前後bytes、原DB、cache後片付けも一致した。
- 初期CLI受入 `2c8046a1` PASS10343ms後、独立reviewでdist不存在時のENOENTとchild間runtime pin不足を指摘。harnessを修正し、実domain失敗理由もgateへ追加したのが上記out02。Source/CLI本体の欠陥指摘はなく、修正後の独立静的reviewも追加欠陥なし。
- 生成された通常のno-model.json→Makerの実handoff `5307d42bdadb4b62846673800674315b` PASS14485ms。Chrome156.0.8078.49、1200/390pxで未設定・未集計・scope分離・読込/閉じる・実接触と801flight frameの名称変更不変を確認した。既存V191 QAをモデルなし入力へ対応させ、旧入力の成功再runはしていない。

## 残件

レポートの通常生成と保存観測の表示は接続済み。production判定基準・現在career時計・全producer人口・同PA複数記録identity・自然cohortは未完。共有UI/barrel/builderの先行する未公開差分、最終同版3HTML配送、SPINの4技術/Gold・SIGN今回基盤・キレなど全Goalの他残件を維持する。私的DB/bundle/raw/HTML/画像・本人入力は公開しない。
