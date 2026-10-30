# 技術保有とmotor適用資格を分ける

2026-10-30 JST。V227の保存試行証拠から通常consumerへ進む次の単位。全Goal、4技術、反復・適用域、Gold、最終配送の条件は維持する。現在のTOP1件に資格を発行しない。

## 判断・根拠・影響

旧Masteryは`UNIQUE(career_id,player_id,technique,accepted_at_day)`を持ち、`selectAtDay()`は技術ごとのlatest1件だけを選ぶ。同技術の新domainを後日追加するだけでは、旧資格が選択上で置き換わる。V225も`mastery_source_id UNIQUE`で、記述専用・future=falseの意味を変更すべきではない。

SolがDDL・alias・選択コードを確認し、Astraがこの新しい共有契約だけを審査した。新motor適用資格Owner / tableを1つ追加する分離を採用する。旧Masteryは本人の技術保有、V225は元target/anchorの記述、新Ownerは特定motor実装・aim・domainで実行してよい根拠を持つ。新しいBlue/Gold族やregistry連鎖は作らない。新consumerだけが技術保有AND適用資格を要求し、旧consumer・NO_TARGET・旧hash・acceptedDayを保つ。

本人の最新指示「確認待ちを増やさず、依頼範囲内で判断して実装と検証を続ける」に基づく、今回の回転機能内での可逆な追加。既存データの移行・削除・旧選択契約変更は伴わない。新DBへの適用・復旧は、型と受入を確定した後の実装単位で限定する。

## 集計前に固定するもの

本人、技術、aim実装版、model / equipment / profile、座標・handedness、観測方式・遅延、clock / physics、対象条件からgroup / domainを明示する。異条件を自動統合せず、実行時もcurrent inputがdomain内か検査する。

Sourceは旧Mastery / V225のfullrefs、V227の正常trial証拠、明示されたproject評価基準と反復基準、成功・miss・未解決の扱いを持つ。既存の正規Source受理入口を使い、selfhashや`MODEL_VERIFIED`の自己申告だけで受理しない。旧Standaloneの検証状態を新domainへ継承しない。

事前宣言されたproject基準は使用可能だが、人間校正済みとはしない。既存calibrationRefを数値の出典にする場合も、新domainでの採用と適合性を別に評価する。根拠不明の数値を補作せず、未確定は評価待ちにする。

## 成功だけの選別を防ぐ

成功trialのrefs列挙を、そのまま完全な試行集合とは扱わない。cohortの対象scopeと終了境界を固定し、正常Owner inventoryから全対象のtrial commitment / resolutionを照合する。missは分母、未解決・欠落はHOLD。同じphysical pitchのcopy枝・別inputは反復へ加算せず、同identityで異hashはCONFLICT。

資格は同じ基準・同じ全対象集合から正常再導出する。保存済みTOP1件はV227で再利用し、元4分試行・旧6練習・2TAKEの再生成、旧資格への付け替えは行わない。

将来のWorld revisionが増えただけでは失効させない。固定範囲のimmutable event / prefix / fullrefsとscoped member hashを再認証し、正常な範囲外追加を許容する。全namespace censusを完全性確認に使う場合も、whole-census hash一致を実行資格の条件にしてはならない。範囲内の後着・差異・未解決はHOLD。開始境界も成功だけを選ぶ任意値にせず、技術保有やexperiment開始の正規根拠へ結ぶ。

## 現在の具体操作・未決

V228で全commitment / resolutionを正常physical Readerへ通し、World event / prefixと全対象の閉集合を認証するAPIを実装した。V230で独立Owner / table1つを追加し、真正1件の診断評価を保存・再読した。既存Mastery変更や資格発行は0。提供refsだけで集合を完全と推定せず、旧MODEL_VERIFIEDを新domainへ継承していない。

group分離、取りこぼし・未解決・miss、重複・異hash、再導出・rollbackはunit / SQLite＋代替censusの範囲で確認した。真正DBは1件の不足評価のみで、将来eventや合格資格の実証とは別。診断基準と意味差は `../../agent-decisions/2026-10-30-spin-application-diagnostic-criterion.md`、結果は `../../verification/realism-debug-20261027/SPIN-APPLICATION-EVALUATION-OWNER-V230.md`。

次は計画時の正常precommit inputからdomainを得るseamと新consumer。posttrial resolution依存のdomain Readerを計画に使わず、偽commitmentや未来の球情報を渡さない。元技能保有AND現在のproject適用資格が揃うときだけ同じaim計算へ接続し、真正反復・通常AI・4技術の受入を閉じる。過去の成功は再演しない。

## consumerの因果境界

V231で正常historical precommit条件とposttrial条件の全値一致を実証した。V232ではcanonicalな全commitment metadataとWorld eventの一対一所属を先に認証し、固定prefix内だけをfull再導出する。capabilityや未認証row revisionで先に除外せず、World全payload hash、career / Source ID / fullref / before-after / actionKeyを照合する。

resolutionはWorld位置を持たないためcandidateであり、対応する正常commitmentとSource固定fullrefsを別の閉鎖証拠にする。新qualified consumerは、再入前に資格end<=commitment.beforeを検査し、依存するWorld位置を厳密に減らす。未確定資格の仮信用やcacheによる検証省略は行わない。新arm・実consumer・真資格成立はまだ未実証。

V233では新armと因果rank / 現在適用 / precommit条件のコードを追加し、正常保存データの不足fallback・未来資格拒否と旧Core通常計算一致を実証した。実Producer採用と真正なqualified成功は未実証。新branchの保存ではWorld eventが揃った後に完全再認証する限定stagingを追加したが、実PhysicalOwnerのpositiveとpoison rollback / reopenが通るまでは採用保留。COMMIT後の検証失敗は既存Owner retireで取消不能、全失敗rollbackとは呼ばない。
