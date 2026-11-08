# Lifecycle identity候補取得の適用 V202

2026-10-29 JST / `MB-20261027-REALISM-DEBUG-PLAN`。正常current getterの旧新版同値を実証。全goal・試合全体の性能・後続field/公式処理は未完。

保存V195 resolved cut11の正常currentを、V200の凍結旧bundleと新Sourceから各1回読んだ。`7b16b92db7ef4ddbad8f517c31d0e9b9` PASS14875ms。全normal recordは相互にもV200保存recordにもlosslessで厳密一致した。

| 同一条件の正常getter | 各1回の実測 |
| --- | ---: |
| 凍結旧Source | 7750.7751ms |
| 新Source | 5658.2382ms |

この1組では約27%短縮。Inspectorを使わず、fresh connectionごとにraw digest後に計測した。同じprocessで旧→新の固定順なのでpage cache・順序biasを含み、cold/複数run/試合全体の改善には換算しない。

## 変更と保持条件

production変更は`SamePlateAppearanceLifecycleFromSqlite.ts`と新`SamePaLifecycleIdentityCandidatesV202.ts`だけ。既知TOTAL/calibration cohortの候補取得を既存phase内でまとめる。prefix/total/view/calibration/outcome/resetの6tableをfresh SQLで走査し、rowid TEXTとNative matched input positionsだけを保存する。

全列は現在要求されているIDだけをfresh hydrateする。後続IDの範囲外INTEGERが先頭IDのSource拒否より先行することを避け、元のschema/index・alias・missing/surviving claims・Source parse・通常deriveを続ける。single ID/unsupportedは旧scalar経路を保持する。ROWID追加READをcallerが明示拒否する場合だけ、Native`ERR_SQLITE_ERROR`・`errcode=23`・ROWID限定messageの全一致で旧scalarへ戻す。他エラーは伝播する。

候補contextは既存phaseの署名・poison・終了に従属し、nested cohortは親へ復元する。statement cacheや新phase wrapperを追加していない。四つの検証境界・savepoint・continuation memoの既存処理は保持した。publicデータ形式や物理計算は変更していない。

## 検証

新18 Native境界tests`93e737b953fd41b980289924b376f41a` PASS11218ms。singleton保持と本物Native auth限定への最終変更は影響6caseだけ`e5bd053921144a489539f461652e00bd` PASS7438ms、他16caseはskip。最終strict`6949d90a10c347aca86cc5a871d6af71` PASS8734ms、比較driver構文`98c1ff3676a44d25a8071238f2e2c159` PASS46ms。初期RED40cb0810/5de645ba・型FAILf5d33589と当時の各結果を保持する。productionとdriverを別々に静的reviewし、最終差分に具体的な重大欠陥なし。

正常Native比較では新793 Sourceの開始終了pinが一致し、旧bundle bytesもV200 pinに一致した。Source差は上記2pathのみ。旧版・新版とも全row/rowid/schema/head、caller transaction/query_only/savepoint/authorizerと元main/WAL/journalを保持した。新Writer/physics/practice/TAKEは0。旧全シナリオ・V200 profileを再実行したものではなく、Source変更後の新しい正常Owner互換比較である。

driver reviewで、parse対象とinput pinを同一Bufferへ固定し、失敗時digest検査から独立してrollback/closeするよう修正した。比較は新out01で一度だけ実行。private DB/raw/manifest/bundle/baseline payloadは公開しない。

## 次の一件

保存済みV199 current captureから、capture admissionと元observation受理/advanceだけを正常Ownerで進め、既存post-observationの正式cut4入口を保存する。launch/練習/TAKEを再生成しない。後続のdelivery/commitment/resolution/field/公式処理は別工程として保持する。
