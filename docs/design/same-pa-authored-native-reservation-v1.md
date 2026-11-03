# 新規Native世界の初回打席予約

`AuthoredNativeReservationV1.ts`は、新規に登録した両チーム18人のPerson・身体・モデル・初期Worldを既存ownerで再読し、明示した疲労/回復baselineを既存workload ownerで保存する。初期打者と守備9人は既存SamePA enrollment ownerが実際に予約する。別の疲労計算や予約テーブルは追加しない。

宣言は18baseline、元genesis pins、元打者の保存済み打撃モデル参照とSHA、enrollment Source識別子、初球識別子を必須とする。値のdefault、旧選手ID置換、時計の倍率推定はしない。人数・所属Person・日付・モデルSHAが違えば新規workload storageを開く前に拒否する。各ownerの受入後の失敗は受入済み行を保全する。

打撃モデル参照は準備時に同じDBの実ownerで検証し、次のdispatchへ渡す。既存enrollment Source自体の契約はモデル中立のまま維持する。enrollmentの保存内容を増やしたり、モデルを選び直したと見せたりしない。

## 確認結果

- 実測打撃モデル、18workload、10participant予約を同じ新規DBに保存。旧二球見送りfixtureやowner mockなし。
- 初期World・Person・身体・モデルの元の全行不変、同じ宣言のretryと新接続再読で全行一致。
- 予約中の選手への外部RECOVERY更新は既存writer guardが拒否し、状態不変。
- 別Person・別player・欠員・改変モデルSHAを拒否。
- 関連5files44PASS/1SKIP、全src型検査PASS。SKIPは旧SP-E00の外部qualified actor入力が未指定のため。この新規Native2試験は実行済み。
- 別processのreadonly owner再読で同DBのモデル/予約/18workloadを検証。39tables/schema/全行/DB bytes不変。閉証拠は`outputs/verification-authored-native-reservation-v2`。v1はモデル参照追加前の予約だけの証拠として保全。

## 初球の未接続部分

`SamePlateAppearanceDispatchSource.ts`の既存`AcceptedSamePaFirstPitchAction`は`variant: declared_take_v1`。一方、観測後に打撃判断する物理・知覚familyは既存SamePA continuationのordinal>=3とretained-take/foul-resetに結びついている。

初球を見送りとして登録してこの条件を通すことはしない。既存take Sourceの意味と旧schema条件を維持し、同じ予約・準備済みSIモデルを使う観測判断用の初球launch/cut/decision採用経路が必要。共通Coreの投球・実測スイング・接触処理を再利用する。投球、知覚記録、emotion判断、Native physical commitment、守備9人の実行はまだ起きていない。

保存された初球slotは`blocked_execution_basis`、consuming Sourceはnull。これは実行権の準備途中の状態で、初球・公式結果・9回完走の成功ではない。混合9回、100試合監査、実機スマホ、本人SI校正など元の受入条件を縮小しない。
