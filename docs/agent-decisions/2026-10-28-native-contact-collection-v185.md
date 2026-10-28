# V185: 明示された原接触を同snapshotで測定する

2026-10-28 JST / MB-20261027-REALISM-DEBUG-PLAN Task5 SPIN-03。V182/183/184の3producerを使い、明示された参照集合から同一subjectのraw測定を返す内部read-only入口を追加する。本人の実装再開と通常判断の記録方針の範囲。既存物理・保存形式・DB schema・UIは変更しない。

## 判断と根拠

既存causal ownerを限定調査したが、3owner間の接触fullrefを同一接触へ統合する正規aliasは未確認。SamePAのlineage.firstPhysicalPitchSourceIdは後続ordinal>=3にも継承され、接触IDにはならない。Originalは前投球timelineを継承し、各getterは今回追加eventだけを返す。根拠はSamePlateAppearancePhysicalEpisodeFromSqlite.ts/actionInputs・PhysicalPitchEvidenceFromSqlite.ts/replayPhysicalPitchRows・SqliteInitialJointPhysicalExecutionStore.ts/deriveExecution。別ownerの同tick/同payloadを同一接触と推測しない。

新入口はrequest.scope(careerId/playerId)と明示fullrefsを受ける。全体を既存read snapshotで包み、3つの正規getterへ分岐する。同owner/sourceIdの異なるhashは拒否し、fullref重複は1回だけ認証する。nullはそのrequestの無接触だけを表し、非nullは原actor本人と要求scopeを照合する。異なるfullrefは別raw evidenceとして保持する。

接触のexitVelocity/exitSpinを原値のまま公開し、打上角だけatan2で導く。入力順は時系列ではない。raw evidence数は独立打球population数ではなく、境界・明示refsのみ・owner参照までのidentity・未解決chronology・classificationなしを明記する。TraitTime/production閾値/model/認識/名札/結果補正を作らない。これにより取得から実測値までを接続しつつ、未認識をREADYへ偽装しない。

## 検証と復旧

限定TDDで3分岐、正確な重複除外、矛盾ref/本人不一致拒否、原値・時刻/freeze/detachを検査する。mock/pure入力はNative authorityの証拠ではない。Source確定後だけ全型を一度行う。

Native受入は既存V184の私的準備DBから新しい私的コピーへ、collector固有の重複参照requestで行う。既存helperのcopy/pin/compile/end-checkを再利用し、新API2読取/改変ref/本人不一致拒否/非消費を検査する。旧V184受入の再実行ではなく、新collector契約の新入力検査とする。旧全工程/prepare/accept/キレgridは0。私的payloadは外部非公開。

復旧は新入口を使わず既存3getterへ戻せる。暦/独立接触identity/全件population/集計snapshot/model/表示joinは未完のまま保持する。

## 実行前の検証設計レビュー

check-native-contact-collection-v185.mjsはnode --check成功。独立read-only reviewでも、私的再コピー、Source/DB/harness pin、重複/本人照合とlossless2読取、caller状態保持、pin失敗時PASS撤回の具体的欠陥は未検出。これはNative実行結果や実装中Sourceの認証を代替しない。

## Source確定時の結果

新Source/testをfreeze。d1fda43bは7test/6failのRED、1f2dd126f5be46ec8e66011b16cdbaec PASS7063ms/7test。Native snapshotを使ったreader doubleのdispatch/重複/本人照合/原値保存の試験であり、doubleはNative認証を与えない。Rootによる全型16ecbfcf9f1f484abb03e7300090d4e6 PASS24860ms。既済V182/183/184テストや型検査は反復しなかった。

独立Source reviewでも具体的な欠陥は未検出。owner別正規認証、同snapshot、ref衝突・重複・本人scope、原vector/sub-tick/key順/-0、deep freeze/detachを静的確認した。実Native proofの代替とはせず、Source不変のまま新入力の受入へ進めた。

## Native受入結果

ee5f4e529b094a05b939b3b6636216d4 PASS45217ms。新collector2read全record lossless exact、2request→一意証拠1件、原値/本人/sub-tick保持、改変ref/別subject拒否、caller状態非消費、Source804入力/DB/コピー/bundle等pin一致。今回Nativeで通したproducerはInitialJointのみとし、mock3分岐や既存3getterの当時証拠へ範囲を区別する。NATIVE-CONTACT-COLLECTION-V185.md。全件population/時刻/model/表示joinと全goalは未完。
