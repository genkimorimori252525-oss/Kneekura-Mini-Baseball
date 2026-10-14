# 非デザイン実装の引継ぎ入口

2026-10-14。**元計画の非デザイン接続全体は未完了。現在はコード・証拠・再開入力の契約を保存して引き継ぐ段階であり、実行中の検証はない。** この文書と以下の2冊を順に読めば、以前の会話を参照せずに現在地と次の作業を確認できる。

1. [元9領域、実装場所、source別の証拠、失敗と修正、最適化、未承認仕様](docs/handoff/nonvisual-evidence.md)
2. [LANの保存入力、21操作の残り、依存関係、準備・実行・停止・結果確認](docs/handoff/nonvisual-resume.md)

GitHubのコードだけでは、保存済みLAN履歴からの続行はできない。**所有者が別途提供する監査済みSQLite gzipが必要**。詳細とSHAは下記および再開手順に記載する。DB、非公開ログ、認証情報はこのリポジトリに含めない。

## どのコードを使うか

| 項目 | 固定値・参照 |
|---|---|
| 統合Draft PR | [#374](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/pull/374) |
| 統合branch | `codex/current-nonvisual-owner-integration-2026-10-08` |
| 引継ぎ直前の公開commit | [`731458d6c1ce9eb56220fb16746bb46efd1a4cd9`](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/commit/731458d6c1ce9eb56220fb16746bb46efd1a4cd9) |
| 最新の実装・既存testの `src` tree | `b8e99a25cb5aa9afce821f27071687d13893c225` |
| そのcommitの全tree | `8e3cc66e63455d083740ae215b294418814d26dc` |
| この引継ぎで追加するもの | 文書と再開用の小さな入口。上記 `src` treeは変更しない |

最新branchを取得して、最初に `git rev-parse HEAD` と `git rev-parse HEAD:src` を自分の実行記録へ残す。文書・再開用toolsを含む引継ぎcommitは上記commitの後継であり、同じ全treeではない。**branch名だけで実装sourceを同一とみなさない。** 古いstackを一段ずつ再実装・再マージする必要はない。現統合branchを作業基点とする。

PRはDraftで、merge・現在のCI成功・ゲーム全体完成を示さない。この引継ぎでは新しいNative実行、ベンチマーク、CIを起動していない。引継ぎ用toolsの静的確認を、試合の実証へ数えない。

## 依頼の目的と進め方

目的は**既存の確定計画に含まれる非デザインの全接続実装**。個別APIやテスト件数の増加そのものが完成条件ではない。

- UI・画面・art・Presentationのデザイン接続、新しい球種体系、別の将来構想は今回の範囲外。World/Coreの結果を表示側の都合で変更しない。
- 関連機能を一括実装し、独立レビュー後にまとまった意味のある検証を行う。小変更ごとの巨大な全体検証や長い前半fixtureの再生成を繰り返さない。修正後は影響した範囲だけを再確認する。
- 同じ履歴の再帰復元・整合性読取りの重複を先に改善する方針でA〜Eを実装した。測定済みの改善を使い、未測定の効果は推測で加算しない。
- 完了済みの重い元ケースはsourceを記録して再利用する。最新sourceへの帰属を書き換えるためだけに再実行しない。必要な新しい統合証拠は、残っている実機能と変更の影響から選ぶ。
- 受理済みの正史・Source・journalを改変しない。後からfixtureが矛盾した場合は失敗履歴を保存し、最も近い正規の受理前境界から直す。guardを緩めたり結果を注入したりして通さない。
- 初期認証を省略しない。未返却、timeout、環境中断、機能失敗、部分commit、正式PASSを別々に記録する。
- 新しい有償cloud task・別費用枠への移行は承認されていない。既存環境の無条件再起動ループを行わない。自宅PCのCIは起動しない。

古いstatus文書や `AGENTS.md` の当時の次作業・停止記述より、この後に依頼された「元計画の非デザイン全接続」と本引継ぎの現在地を優先する。設計所有権、Canonical World、Sourceの真正性と永続化規約は維持する。ファイル名の `DRAFT` だけで設計の有効性を決めない。

## 正本と読む順序

1. [元の9領域 §5（固定commit）](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/6509e61f2474cc6bcfadda129f4b3c9621855c2c/docs/project-status/2026-10-04-nonvisual-implementation-checkpoint.md#5-残る確定済み非デザイン計画)。この9領域が対象の分母。各時点の未実装表現は最新コード・証拠と照合する。
2. [FoundationのCanonical設計入口](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/blob/44b9f5de7b9d87e649f12f1af78c202f2b5ab44d/docs/game-design/00-current-design-handoff.md) と、[World-first基盤](https://github.com/genkimorimori252525-oss/Kneekura-Mini-Baseball/tree/4f0a60a3818926327b6bf5877ab3dec456a76530/docs/game-design)。現在Statusと後継Canonicalを読む。Managerの後継は49で、旧39/40/43/45/46/47を新規要件として再実装しない。
3. [この引継ぎの9領域対応表](docs/handoff/nonvisual-evidence.md)。実装、実シナリオ証拠、未定義producerを分けた作業入口。
4. [統合status](docs/project-status/2026-10-09-nonvisual-nine-area-status.md)、[未承認の政策・校正](docs/project-status/2026-10-10-nonvisual-policy-decisions.md)。過去の長い実行記録は必要になった対象だけを読む。

## 現在できていること、できたと言えないこと

通常の試合処理を構成する保存、物理履歴、取得・保持・送受球、走塁・接塁、foul再開、公式記録、負荷、育成、Career側の受理・実行接続は広く実装されている。元Positive、40-piece、FR01はそれぞれの固定sourceでfreshケースを完了した。IFN、National、PL等は記録された正規保存境界から残工程を完了した。**別sourceの部分結果を合算した全体PASSではない。** 正確な違いは[証拠一覧](docs/handoff/nonvisual-evidence.md)にある。

現在の限定コード照合では、仕様が確定していて直ちに実装できる通常APIの接続欠落は見つかっていない。ただし、未定義の自律producer・校正、元LANの最終21操作の実証、全ownerを含むhalf/finalや長い移動走者の合成、実試合・季節・人口規模のreopen/replay・性能証拠は残る。この照合結果を「全計画のコード100%完成」とは扱わない。

遊べる完成品としては、今回対象外のデザイン/UI接続に加え、上記の非デザイン残件がある。P0〜P9、単一の公式結果、近終端fixtureからの季節遷移が成功しても、自律的に全試合・全季節が進む完成品の証明にはならない。確定した機能単位の総分母がないため、現在の正確な進捗率や完了日を提示しない。

## 最初に閉じる未完経路

対象は元LAN複合ケースの同じ後半。実打球接触、捕球・保持、持替え、送球、受球、明示appeal試行、物理境界、裁定journalへのimportは保存済み。appeal試行だけで走者違反OUTは成立しない。最新入力ではreview revision 1、ledger revision 4、event 1、rights pending、Match revision 1 / outs 0。以前のwalkの公式記録は残っており、「このappealの公式適用が未完」と「DBに公式履歴が一切ない」を混同しない。

残りは **journalの4操作とterminalの17操作、計21 owner操作**。これは時間や進捗率ではない。元20 callback assertion本体、元後半の結果確認、独立retry/reopenを保持する。既に済んだimportを再度writerで受理しない。過去ownerのhistorical認証と、新しい受理のcurrent AFTER証明を分ける。

最新入口は `runLAN01RetainedReviewImportSuffix`。cp1専用入口のcompiler・関連23件は過去にPASSしているが、保存されたcp1から最新統合sourceでNative認証・21操作が完了した証拠はまだない。再開コマンドと正確な判定条件は[専用手順](docs/handoff/nonvisual-resume.md)へ。

### 所有者から受領する唯一の再開データ

| 項目 | 値 |
|---|---|
| 意味 | LAN import受理済みの監査済みcheckpoint |
| gzip size | `1402518` bytes |
| gzip SHA-256 | `18605d0643eb51e69c9e290fef93c436a77275c16b172d059ce869dcd83fcd50` |
| 展開後size | `22654976` bytes |
| SQLite SHA-256 | `60b73b1f5f5289cb9c86f128f129bde0d5ea7d8bda4be9805566589198082ee3` |

ファイル名 `000001.sqlite.gz` だけでは識別しない。受領物のgzip SHAを確認し、別コピーへ展開し、raw SHA・SQLite integrity/FK・期待状態を確認する。原本を実行DBとして開かない。提供されなければ保存履歴からの続行はblockedであり、データなしで再開できるとは報告しない。GitHubへDBを追加しない。

## 残る判断は3群。承認済みの1件と分ける

未承認は球場特則、自律Careerのclock/判断producer、因果的育成のappraisal/処方/測定・校正。具体例、既存入力でできること、初期提案は[証拠・判断一覧](docs/handoff/nonvisual-evidence.md)にまとめた。既存Managerは受理候補から判断を生成でき、hidden trajectory/catalyst生成も既にある。未定義部分を理由に、その既存機能を未実装扱いしない。

承認済みの動くプレー終了方針は、残る指示・反応・動作を処理し終えて閉じ、閉じる前の新しい行動情報で再判断すること。[actor producer契約](docs/implementation/2026-10-10-actor-producer-completion-policy.md)に実装済み。actor観測/controllerの終了条件であり、custody/contactや別actorの証明を代替しない。他3群の提案や数値モデルまで承認されたわけではない。

## 最初の作業チェックリスト

- [ ] PR374の最新headと `HEAD:src` を確認し、この引継ぎとの差分を先に読む。別担当の更新を上書きしない。
- [ ] 証拠一覧の各source・成功範囲・失敗を読む。完了済みケースの再実装・不要な再実行を避ける。
- [ ] 所有者から上記gzipを受領し、[再開手順](docs/handoff/nonvisual-resume.md)で元ファイルを変更せず検査する。
- [ ] 指定Node/lockfile/catalog、独立作業DB、有限のwall/RSS/cleanup制御、commit整合checkpointの保存方法を確認する。認証を省略しない。
- [ ] 旧実行が生きていないことを実行環境で確認する。不明ならwriterを重複起動しない。
- [ ] 最新sourceによるcp1の認証から元21操作だけを1本で進める。環境が認証前に再び中断したら、自動再起動せず原因と確定境界を報告する。
- [ ] 各正常commitと正式terminal結果を区別して保存する。制限時間内に完了しなければ、確定済み操作をやり直さず未完からの続行可否を判断する。
- [ ] LANが終わったら元9領域の残件を再照合し、必要な合成証拠と真の未承認仕様をまとめて扱う。新しいvariantや未定義のモデルを自動追加しない。

## 引継ぎの限界

現在の阻害要因は、長いNative認証・残処理に対して実行環境が繰り返し中断したこと。最新2回は正式terminalがなく、通常timeoutや機能失敗へ読み替えない。DBの正式保存境界と公開コードは維持している。短時間の継続確認が通ったことも12時間稼働の保証にはならない。

A〜Cは同一historical readで約61%、Dは別の同一deriveEvent readで約84%の単回短縮を確認した。Eは正しさの43件がPASSしたが速度未測定。これらを全owner・全試合・認証全体の改善率に外挿しない。長い実import受理は旧sourceで約6268秒であり、純read測定とは別の仕事である。その前の初期認証にも約3656秒を要した。後続の最適化済みsourceで認証が中断した時間は、完了時間の比較に使わない。

再開用の文書と小さな入口は、独立した引継ぎレビューで静的整合を確認済み。新しい8ファイルのリンク・anchor、source/dependency pin、既存helperへの呼出、21操作とassertionの対応、公開情報の範囲を確認し、必須修正なしと判定した。追加スクリプトのsyntax確認はNode 24.19.0で行っており、指定Node 26.10.0での実行資格化を意味しない。新しい実行環境の安定性、追加入口の実Native完走、残り全計画の完成を保証するものではない。詳細な確認範囲と必要な実行制御は[再開手順](docs/handoff/nonvisual-resume.md)に明示する。

将来Eの効果を測る場合の任意候補は、同じcp1から独立コピーを作り、terminal transitionのhistorical readとsettlementのrelease readだけを旧・新版で直列比較すること。返却全文・DB/schema不変・guardとwall/CPUを揃える。各版900秒の有限枠という案は完了予測でも実行済み計測でもなく、timeoutや中断なら率を算出せず停止する。この引継ぎを読むこと自体は測定開始の指示ではない。
