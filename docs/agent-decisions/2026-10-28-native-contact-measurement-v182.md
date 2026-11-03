# V182: 採用済み実接触から測定の入口を作る

Task MB-20261027-REALISM-DEBUG-PLAN / Task5 SPIN-03。本人のコンテキスト上限調整後に実装を再開する指示に従う。キレV180の追加grid停止とUNKNOWNは維持する。

line_driveのclassifier/projectionは実接触データのproduction consumerを持たず、時点/集計Source/model Ownerも未接続だった。最初の実装は既存SamePAの正規resolution readerを利用したread-only adapterとする。既存calendarや閾値が揃ったと推定せず、ここでTraitTime/認識Source/LINE_DRIVE名札を生成しない。

- 新しいhost/world/NativeMeasuredBattingContactV182.tsと関連testだけを変更する。既存SamePaPhysicalOperationReferenceのresolutionを入力にし、正規Ownerで原record/actor/lineageを再認証する。launchを使って当該投球で追加されたBatBallContactを選び、以前のファウル等を再計数しない。
- 原contact/本人binding/Source reference/元game-play-pitch-eventのidentityを、detached/frozenな測定入口へ渡す。ゼロ接触の正規resolutionはnull。壊れたref/別owner/改変archiveは既存認証を通過させない。新しい技能/結果補正/物理入力を作らない。
- 同じSQLite read snapshot内で解決する既存Ownerの仕組みを再利用する。再読は非消費で、元DB/Source/乱数/疲労を変えない。日内PA sequenceやdecision revisionをcareer時刻へ読み替えず、raw時刻とscopeの意味を保持する。
- 先に欠落を示す限定テストをFAILさせ、その後最小実装で通す。既存Native fixtureを再利用し、改変ref拒否/再読非消費/原vector一致/前投球のcontact再計数防止を対象にする。テストfixtureを実在選手/正式calendar/自然cohortの証拠としない。
- 保存済みNative試験のresolution reference1件はread-onlyの実接続対照に使える。旧V147全工程の再実行やDB全列挙はしない。私的locator/生payloadは外部公開しない。

これは未接続の最初の境界を実装する工程で、production認識model・career暦対応・集計snapshot owner・表示joinの完成ではない。実装後の具体的な不足を同じTask5へ残す。新しいpublic save形式/物理モデル/既存Core/DB schemaの変更はない。新ファイルを不採用にすれば既存経路へ影響しない。

## 私的コピーの入口条件を具体化

初回probe 3eaf5ff4はWAL存在だけで停止した（109ms、コピー/DB open/API0）。実際はWALが0 bytes、journalなし、元main/WAL/SHMすべて開始/終了hash不変だった。これはNative認証のFAILではなく、Rootが事前に指定した過度に広い停止条件によるもの。

次回はWAL不存在または厳密な0 bytes（空のSHA256も一致）だけを認め、非空WAL/rollback journalは従来どおり停止する。SQLiteの[WAL形式](https://www.sqlite.org/fileformat2.html#walformat)ではWALはheader/framesで構成され、0 bytesはframeを含まない。コピー中/終了時の元main/WAL/SHM/journal全状態pin、コピーmain=元mainのhash一致は保持する。元DBはopen/PRAGMAせず、新private copyだけでAPIを実行する。この通常の技術判断は本人の実装再開/依頼範囲の判断記録方針に基づき、認証を緩めたりSourceを変更したりする許可へ拡張しない。元FAILと未実行を保持し、新out02で一度だけ再開する。
