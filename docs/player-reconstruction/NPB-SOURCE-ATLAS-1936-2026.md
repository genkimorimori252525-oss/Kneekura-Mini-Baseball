# NPB 1936–2026 史実資料アトラス — 選手再現部

> **Research date:** 2026-10-16 JST. **STATUS:** SOURCE INVENTORY / CROSS-CHECKED SAMPLES / NOT A COMPLETE IMPORT. 対象: NPB一軍の1936年開始から2025年完了年度まで。**2026年度は進行中/公開データの確定状況を確認してスナップショット化**。1945年に通常の公式リーグ戦は存在しない。将来NPBの全選手を自動再現するための資料探索マップであって、全データ取得・利用許諾・真能力校正完了を意味しない。
>
> **Read with:** [AI reconstruction runbook](AI-RECONSTRUCTION-RUNBOOK.md), [capability/trait atlas](PLAYER-CAPABILITY-TRAIT-ATLAS.md), [historical environment model](NPB-HISTORICAL-ENVIRONMENT-MODEL.md), [OB principles](PRINCIPLES.md).

## 1. 第一次ソース — 公式記録はまずここ

| ID / 優先順位 | 公式資料 / URL | 検証した対象と使える事項 | 欠ける・注意事項 |
| --- | --- | --- | --- |
| **NPB-YEARLY / P0** | [日本野球機構 年度別成績](https://npb.jp/bis/yearly/) | **1936〜1949 日本野球連盟期、1950〜2026 セ・パ両リーグ**の年度別索引。年度/チーム勝敗/打撃・投手成績、リーダーズ、個人年度成績。1936年の初期大会と秋季、1937–38春/秋は別単位。 | 2026は当日時点の最新更新を要確認。戦前の一部統計の欠損に注意。年度集計から個人の球種・タイミング・バット軌跡は分からない。 |
| **NPB-YEARLY-1936** | [1936年初期大会](https://npb.jp/bis/yearly/yakyuremmei_1936s.html) / [1936年秋](https://npb.jp/bis/yearly/yakyuremmei_1936f.html) | 初期春季相当の大会別成績と秋季の選手/チーム別成績が同じ通年SeasonIDではないこと。 | 1936春相当は通常の通年総当り形式と同一視しない。 |
| **NPB-YEARLY-EXAMPLES** | [1937春](https://npb.jp/bis/yearly/yakyuremmei_1937s.html) / [1937秋](https://npb.jp/bis/yearly/yakyuremmei_1937f.html) / [1940](https://npb.jp/bis/yearly/yakyuremmei_1940.html) / [1946](https://npb.jp/bis/yearly/yakyuremmei_1946.html) / [1949](https://npb.jp/bis/yearly/yakyuremmei_1949.html) / [1950パ](https://npb.jp/bis/yearly/pacificleague_1950.html) / [1970セ](https://npb.jp/bis/yearly/centralleague_1970.html) | 早期の大会、戦後復活、1950二リーグ、王・長嶋期への段階的なサンプル照合。 | インデックスの季節符号、チームID/名称は年度によって異なる。 |
| **NPB-PLAYER / P0** | [個人年度別成績検索](https://npb.jp/bis/players/all/) | 現役・OBの個人通算/年度別、年度別球団一覧。**1936年球団7チームの表示**を確認。NPB公式戦出場者を検索。 | 公式戦不出場の引退者は一覧に含まれない旨が明記。名寄せは同姓同名・登録名変更・移籍に注意。 |
| **NPB-TEAM / P0** | [読売ジャイアンツ年度別成績](https://npb.jp/bis/teams/yearly_g.html) | チームの戦績・監督・得点/打率/HR/ERA等の連年照合例。 | 1チームのページを全リーグの代表値にしない。 |
| **NPB-STADIUM / P0** | [公式戦開催全球場](https://npb.jp/stadium/) / [球跡巡り](https://npb.jp/stadium/column.html) | 球場の名称・開催記録、歴史的球場の開閉/改修情報を照合。 | 現在の寸法を開場時まで遡及しない。球場一覧だけで当日の風・使用球・対戦球団まで再現できるわけではない。 |
| **NPB-HISTORY / P0** | [NPB公式 日本野球の歴史](https://npb.jp/archives/japanesebaseball150th/history/) / [セ・リーグ略史](https://npb.jp/cl/history.html) / [パ・リーグ略史](https://npb.jp/pl/history.html) | 1936創設、1944中断/1946復活、1950二リーグ、1965ドラフト、1973–82パ2シーズン制、1975パDH、1988東京ドーム、1993FA、2005交流戦、2011統一球等。 | 変更の適用対象・有効日・細則は各年のRuleProfileと原典で別途検証。 |
| **NPB-PARK-CASE / P0** | [NPB球跡巡り: 後楽園](https://npb.jp/news/detail/20180518_01.html) / [甲子園100周年](https://npb.jp/news/detail/20240920_02.html) | **後楽園は1937年9月開場**、当初両翼78m、1958年拡張90m、1949年ネット等、設備の変化が本塁打環境へ影響。戦前の特定本拠地固定仮定の危険性を確認。 | 歴史的寸法/改修は年・試合・文脈別。年代ごと単一ParkFactor=1.0を実物サイズの代わりにしない。 |
| **NPB-RULE / P0** | [公式記録・約款などのNPB入口](https://npb.jp/) / [レギュラーシーズン年度索引](https://npb.jp/bis/yearly/) | 正史規則・記録の参照入口。 | 1960年規則へ現代の判定/指名打者を無条件適用しない。 |

**収集上の重要事項:** NPBサイトはページ末尾で掲載情報・画像・映像の二次利用/無断転載を禁止している。ここでは**参照リンク・ページ構造・事実確認メモ**に留める。非公認大量クローリング、全選手データ転載、画像・動画再配布をAIが勝手に実行しない。規模の大きな保管/再配布が必要なら利用条件・許諾を確認した出所、合法的に利用できる別ソース、または権利を確認した独立の収集方法を優先。

## 2. 第二次ソース — 補完・独立照合・現代指標

| ID | URL | 確認事項 | 使用する層 / 利用上の注意 |
| --- | --- | --- | --- |
| **2689-ALL-GAMES** | [日本プロ野球記録](https://www.2689web.com/) / [全公式戦](https://2689web.com/games.html) | サイトは**1936〜2025一軍公式戦の全試合ボックススコア**、2025年終了時点で7,539選手の年度別成績を掲載すると説明。 | 大変有用な**照合と試合ごとの球場・相手・選手利用**の探索源。ただし実際の全ページ取得/データ権利は未検証。NPBの数字とサンプル監査し、構造化大量転用を無断でしない。 |
| **2689-PLAYER-TEAM** | [個人年度成績](https://www.2689web.com/ind/ind.html) / [球団変遷](https://2689web.com/tm/tm.html) / [サイトマップ](https://www.2689web.com/sitemap/map1.html) | 1936以降の年度選手検索、球団名変更/対戦成績、年度記録の案内。 | 歴史的人物・チームIDを再構築する補助。現行契約/利用許諾は確認が必要。 |
| **BASEBALL-REFERENCE-JPBL** | [Japanese Baseball League 1936–49](https://www.baseball-reference.com/register/league.cgi?class=Fgn&code=JPBL) / [Register入口](https://www.baseball-reference.com/register/index.fcgi) | 国際データのJPBL・日本セ/パリーグ、戦前の春秋を区別した選手/球団索引。 | 名寄せ・第三者照合。データは24-7 Baseball/Chadwick等のライセンス由来。自由再配布可能なOSSではない。 |
| **BASEBALL-CHRONICLE-PARK** | [2025パークファクター](https://baseball-chronicle.jp/stadium/2025) / [2024](https://baseball-chronicle.jp/stadium/2024) | 各球場のHR PF、得点PF、ホーム/ビジター実測、交流戦含む/同一リーグのみの区別を掲載。 | 現代の球場・年度の外部検証。PFは観測された環境差の統計要約であり、正史Ball Physicsへ直接後付けの「HR確率Buff」にしない。年・方法による変動が大きい。 |
| **DELTA-1.02** | [1.02 Player Stats](https://1point02.jp/) / [2025年集計改訂](https://1point02.jp/op/gnav/column/bs/column.aspx?cid=54015) | wRC+/WAR/UZR、打球/球種/スイング/選球など、高度な現代指標。2025-03-15にPF補正式含む集計更新を公表。 | 有料/権利・定義・モデル改訂/計測対象を確認。古いOBへ指標を史実として捏造しない。分析方式の学習・個別照合に有用。 |
| **NPB-PITCH-STRATEGY-ACADEMIC** | [Nakahara et al., 2022](https://arxiv.org/abs/2208.03492) | 2014–2019日本プロ野球の捕手要求位置を含む一球データを使用した配球分析。 | **データセットが一般公開・再利用可能だとは論文本文からは確認できない**。捕手AI向けの利用可能な特徴量設計の根拠。 |
| **PARK-ESTIMATION-ACADEMIC** | [Konaka 2021 park factor推定](https://arxiv.org/abs/2109.09287) | 球場要因を他要因から分離するモデル比較。MLBの打席を用いた研究。 | 推定手法の参考、NPB・戦前の具体PFを直接与える資料ではない。 |

### 「再現できる」粒度を明確にする

- 年次**打撃・投手成績**は1936〜2025に公式索引が存在。球団・本拠/対戦の変遷もかなり追える。
- **全試合スコア/box**は2689webの公開説明上カバーするが、全行利用権と全件検算が済んだわけではない。
- **昔の打球速度・回転・捕手サイン・球種・バット軌道**は、資料にないなら**記録なし**。現代計測値からそのまま埋めない。
- 守備Rng/DRS/UZRや方向Preferenceと実打球の関係は**真の内部技術を直接観測できない**。現代でも代理指標・動画分析・不確実性が必要。

## 3. GitHub / 公開リポジトリの実物監査

### OSS/公開リポジトリ A — OOTP_NPB_Historical（最大の網羅性候補）

- URL: [lebronisbest/OOTP_NPB_Historical](https://github.com/lebronisbest/OOTP_NPB_Historical)。
- READMEの**自己申告**: 1936–2025、8,165 Players、54,266 Batting Records、24,951 Pitching Records、1,032 Team-Seasons、349 Pitch Repertoires、2008–2025二軍データ、球場/球団/守備/パーク補正。
- 実リポジトリで**存在確認**: `stats/Teams.csv`、`stats/Master.csv`、`stats/EOSRosters.csv`、`stats/ODRosters.csv`、`database/era_ballparks.txt`、`database/era_stats.txt`、`database/era_modifiers.txt`、1936–2025の多数の`schedules/NPB_YYYY_...G.lsdl`、球場ディレクトリ。
- **READMEとリポジトリの差**: READMEは独立した `Batting.csv / Pitching.csv / Fielding.csv` を説明するが、監査した`stats/`直下にはその名称のファイルがなく、`historical_database.odb` などの大容量OOTPファイルが存在。一般的なCSVだけで全打者を簡単に取得できると断定しない。
- **史実との具体的な矛盾**: `stats/Teams.csv` では1936年の東京巨人/東京セネタース等のparkが `Korakuen Stadium` とされるが、NPB公式による後楽園の開場は**1937年9月**。よって球場/球団の配置は少なくとも一部が当時の実物と合致しない。`database/era_ballparks.txt` の初期値・機材・PFはモデル近似と疑う。
- `database/era_stats.txt` に重複ヘッダーと「estimated 1871–1987」等の推定項目が存在。`database/era_modifiers.txt` のContact/HR Power等はOOTPゲーム内パラメータで、NPBで実測された「能力値」ではない。
- 球場ビジュアルのCREDITSに複数外部作者の素材が混在。対象データのライセンスを素材全般へ自動適用しない。
- **再利用条件**: READMEは明確に **“personal, non-commercial use with OOTP Baseball”**。一般的なMIT/CC0の自由な再利用許諾ではない。**Mini Baseballへの全面インポート/コピー/改変配布を勝手に行わない。** 権利確認・許可が得られる範囲のみ利用。現時点は資料構造の参考・独立の事実確認に限定。
- **リスク区分**: HIGH-COVERAGE / PROVENANCE-GAPS / **LICENSE RESTRICTED / NOT APPROVED FOR DIRECT INGESTION**。
- **AIへ**: 8,165人という数字と、別サイトの公式戦出場者7,539人は母集団とバージョンも違う。統合前に、登録だけ・出場者のみ・育成/二軍・同一人物重複・歴史的年度区切りのどれが差分原因か検証せよ。「8156人＝全員再現完了」とは宣言しない。

### リポジトリ B — dentearl/npb-data

- URL: [dentearl/npb-data](https://github.com/dentearl/npb-data)。
- READMEの範囲: **2021–2026の一軍12球団の公式戦スケジュール・試合結果** JSONを定期生成するETL。所属リーグ・試合/引分・スコアの近代照合に使える。
- 歴代1936〜全選手の打撃/投球技能データベースではない。2026の途中経過はスナップショット時刻と未消化試合の区別が必要。
- GitHub公開であることはデータライセンス自由を意味しない。転載/再公開する前にLICENSE・出典・サイト条件を調べる。
- **位置づけ**: RECENT-GAME SCHEDULE SUPPORT / **NOT HISTORICAL PLAYER CORE**。

### リポジトリ C — armstjc/Nippon-Baseball-Data-Repository

- URL: [armstjc/Nippon-Baseball-Data-Repository](https://github.com/armstjc/Nippon-Baseball-Data-Repository)。
- READMEはSPAIA等由来の試合・選手stats用Python取得コードとGitHub Releasesを説明。
- 1936〜2025全年度カバーは未検証。SPAIA側の第三者配信条件と、repo自身のライセンスを別々に確認。安易に全選手の史実sourceとして扱わない。
- **位置づけ**: API/ETL-PATTERN REFERENCE / RIGHTS AND COVERAGE UNVERIFIED。

## 4. データの信用度・使用境界

| 値 | 意味 |
| --- | --- |
| `OFFICIAL_OBSERVED` | 公式記録を確かに示す。該当URL/年度と数値の単位が確認済み。 |
| `SECONDARY_CORROBORATED` | 独立した二次資料の記述・集計が一次資料と整合。 |
| `HISTORICAL_ESTIMATE` | 史料にないため、時代・人物・他記録から推定。分布/不確実性が必要。 |
| `MODEL_CALIBRATED` | 史実を再現するために物理・知覚などのSourceを推計したモデル値。**史実の実測値ではない**。 |
| `UNKNOWN` | 必要な資料がなく断定不可。0と混同しない。 |
| `CONFLICTED` | 公式歴史とOOTP球場記述のような食い違い。解消前は採用不可。 |
| `LICENSE_BLOCKED` | 技術的には参照できても素材/データ転用が許可されていない。データをコピーしない。 |

**sourceSnapshot**（URL、取得時点、出典、権利、ライセンス、参照可能フィールド、改訂、原本Hashを取得可能な範囲で）と **factProvenance**（original datum / derived inference / translated identifier / mismatch）を別々に保存し、リポジトリに資料の全文・多量レコードを無断再配布しない。年次の小さな独立Factsも出所と用途を保存。

## 5. 初期AI検証タスク（史実を先に、補完は後）

1. **Official-index availability test**: [NPB年度索引](https://npb.jp/bis/yearly/)の1936形式・1950二リーグ・2025完了・2026当日時点を、個々のURLで検証。作成済み[year/league index manifest](sources/npb-official-season-index.json)の推定URLを後追いで検査（生成URLは全件アクセス確認済みではない）。
2. **Person linking**: 王貞治、長嶋茂雄、1936年出場者、戦後の復活選手、近年の同姓同名等についてNPB player ID / 年度 / 球団を突き合わせる。参加しなかった登録選手は「公式戦出場記録あり」としない。
3. **Box and venue**: NPB公式チーム勝敗/成績と2689webの同年度/同球団/数試合を比較。開催球場・ホーム/ビジターと球団名を別IDにする。
4. **Park historical regression**: 後楽園1936（ありえない）→1937開場、1949ネット、1958両翼拡張、1988東京ドーム等の不変的な時代境界テスト。遠征/地方開催を含め年度内の複数球場を許す。
5. **Era rules**: DH 1975パのみ等の版管理、1973–82パ二期制、2020日程例外、1945公式戦なしを検証。
6. **Blind source audit**: OOTP側の球場/球団CSVが公式と相反するとき、出典順位だけでなく「年度・リーグ・本拠固定仮定・実際の開催地」の相違をレポート。
7. **Rights review**: Raw Dataをどの出所からどこまで取り込めるかを文書化する。許可がない場合はリンク/メタデータ/独立集計手順だけを維持し、強引に大量保存しない。

## 6. 達成可能性の判定（誇張禁止）

- **史実の一軍在籍選手と年度記録の検索環境**: 高い達成可能性。NPB公式と2689web等に広い射程。
- **球団・シーズン・対戦条件の再現**: 高～中。戦前の開催球場/複数大会・球団変遷・年次規則に複雑性。多資料照合が不可欠。
- **球場の3D実形状・当日の天候・ボール規格**: 中～低。実物資料がない箇所は近似・unknownを維持。
- **全文字通りの球種/回転/打点/守備足運び/打球速度**: 戦前・中期は一般に低い。史料にない計測を事実として追加しない。
- **全選手のGreen/Gold/Redや隠し認知/人格**: 自動的に全員を完全再現できるとは証明されていない。**観測記録から推定できる範囲、Unknown、モデル校正を分ける。**
- **完成OBペナント**: 現在の文書はデータ源/設計整備まで。全年度データの利用許諾・収集・試合Coreへの統合・長期多seed検証は**NOT RUN**。

参考資料の広さを「精密な史実の隠し能力すべての測定が既にある」という誤読へ繋げないこと。根拠がない部分を慎重に推定するのがAI主役の研究品質である。
