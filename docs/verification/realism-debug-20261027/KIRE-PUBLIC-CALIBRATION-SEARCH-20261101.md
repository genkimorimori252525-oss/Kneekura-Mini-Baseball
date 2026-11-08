# キレ3段階：新しい公開校正 source の探索

2026-11-01 / read-only探索。目的は元球種の回転を保ち、変化開始と終盤集中を3段階で扱える実測根拠を見つけること。V180はslider/splitter各3360役割列で条件同時成立0、p10は力・視認の開始ではない。旧V177の低spin/gyro置換は撤回済み。同じgrid、既存403だったSmith thesis・Garrett/Smith datasetのfile再取得、旧実験の再実行はしていない。既存記録 `KIRE-CALIBRATION-SOURCE-RECONCILIATION.md` / `KIRE-BASE-PRESERVING-V180.md` / `EMPIRICAL-PHASE-DATA-V157.md` を先に読んだ。

## 判定

**新たに公開CSVの取得と列を確認できたが、元球種を維持する時間形状3段階の校正には不足。** 本探索の範囲で、通常の変化球の同一投球について材料姿勢・3D角速度・相対風と独立の時系列PVまたは横力を同期して取得できる再利用可能datasetは未発見。全世界に存在しないとまでは言えない。高回転域の公開force/modelの校正・3段階の実用差と適用範囲はUNKNOWN。仮係数、力のタイマー、低回転化、推測値の実測登録は行わない。

## 新たな一次資料と得られたもの

### 1. Pifer 2024：大学試合のpitch-level data（実ファイル読取）

[Mendeley Data V3](https://data.mendeley.com/datasets/xfnz6mkdzm/3)、[データ論文](https://pmc.ncbi.nlm.nih.gov/articles/PMC11547889/)、[TrackMan公式の列・単位](https://support.trackmanbaseball.com/hc/en-us/articles/5089413493787-Radar-Glossary-Of-V3-Terms)。提供ページは CC BY 4.0。技術的に公開GET可能な [dataset metadata API](https://data.mendeley.com/public-api/datasets/xfnz6mkdzm) がversion 3、[Track_Combo.csv](https://data.mendeley.com/public-files/datasets/xfnz6mkdzm/files/0d5fcc5a-1429-4a46-ad9c-33160faca6eb/file_downloaded) のサイズ2,209,410 bytes / SHA256 `7b7b8974107be6181dcf1880d609034ef9f7556f9fb13aec021a52d37cd0c190`を示す。2026-11-01に公開GETで同一bytes/hashをメモリ内で確認し、CSVのheaderと行数だけ集計した。データ本体を本workspaceへ保存・再配布していない。利用時はCC BYの表示・変更明示等、および第三者コンテンツの別権利に注意する。

- 実headerは141列、3,344投球行。`SpinRate`、`SpinAxis`、`ZoneTime`、`PitchTrajectoryXc0..2`、`PitchTrajectoryYc0..2`、`PitchTrajectoryZc0..2` がある。`SpinRate` はrpm、`SpinAxis` は度のtilt、`ZoneTime` は秒。公式glossaryでは投球軌道係数c0をfeetまたはmetres、c1をft/sまたはm/s、c2をft/s²またはm/s²と記載する。論文の例はrelease速度mph・break inches・release位置feet。CSVの個々の係数がどの単位系で出力されたかはfile設定・寸法検算をまだ実施していない。
- 1行は1投球であり、9係数は軌道の**二次多項式**であって観測時刻ごとのPV点列ではない。係数から生成した時系列はそのモデルの出力で、終盤に力が増えた独立観測ではない。c2をそのまま加速度値と読み替えない（多項式係数・時間原点・符号規約の確認が必要）。
- headerを `spin`, `seam`, `orient`, `quaternion`, `wind`, `trajectory`, `time` 等で走査した範囲で、材料姿勢quaternion／縫い目配置／同一球の相対風／時系列横力は見つからない。`SpinAxis` の2D tiltは完全な3D角速度や材料姿勢ではない。別名列の意味・欠損率は未精査。公開datasetがあることと必要な同期実測を得たことは別。
- 実用可能性：独立した**終点・球速・pitch-level分布**の後続参考にはなり得るが、本依頼の開始時刻/終盤集中や姿勢依存forceを校正する根拠にはしない。学習/最適化・新3段階の採用は未実施。

### 2. Fong 2019：低回転の自由飛行姿勢と軌道

[Washington State Universityの論文記録](https://rex.libraries.wsu.edu/esploro/outputs/graduate/Lift-force-on-sports-balls-with/99900525082901842) は公開学位論文PDF 1件（38.58 MB）を案内。閲覧可能な論文本文の検索可能テキストを確認し、CSVや同期生dataの公開は今回見つからなかった。PDFの公開閲覧と数値dataや派生物の再配布許諾は別で、明示licenseは未確認。

屋外で60 ft、室内で約27–28 ftの試験を実施し、レーダーと動画またはステレオ動画で位置・材料姿勢を扱う。論文本文は室内の約70 mph条件で位置を600 Hz取得し、姿勢を軸ベクトル `kx,ky,kz` と角度 `q`（度）、揚力係数 `CLY` / `CLZ`（無次元）で図示する。軌道距離はft、力係数は位置の平滑・微分等から計算した量で、独立した直接force sensor系列ではない。各図で対象trialと座標・時計の対応、風の実測、画像から得た角速度の不確かさは個別検証していない。データfileの列、同期精度、再利用licenseはUNKNOWN。

試験には無回転と約50 rpmが含まれ、ナックル球の実験である。**通常slider/splitterのspinを50 rpmに変更する根拠ではない。** 図の読取値を本番係数に昇格せず、将来rawと許諾が確認できた場合でも低回転域の限定検証にとどめる。元球種を保つ高回転3段階は未解決。

### 3. Wang 2025：公開論文の座標変換と平均力の分解

[UC Irvineの博士論文](https://escholarship.org/content/qt10w3s7p8/qt10w3s7p8.pdf) は、センサー由来の球の局所3軸とworld spin vectorを使って縫い目基準へ変換する方法、およびHawk-Eye/TrackManからの側力分解を示す。論文はTrackManの投球軌道を一定加速度の9パラメータmodelとし、公開spin軸投影からの3D推定には投球群の仮定・最適化を使う。局所3軸とworld spinが実測できる場合の座標変換の検証参考にはなるが、局所3軸が欠ける公開CSVからそれを測定済みとして復元する根拠にはならない。

本文は公開閲覧できたが、同一投球ごとの同期orientation/PV/force raw fileと再利用条件は見つけていない。論文PDFの利用と元datasetの利用許可も別。モデルは群平均・仮定付き推定であり、時間ごとのSSW forceや本機能の3段階の実証ではない。

### 4. Jennings 2019 / UMBA：追加研究・公開コードの境界

[Bucknell大学 Jennings thesis](https://digitalcommons.bucknell.edu/masters_theses/221/) の公開abstractは、spin rate、sting角、縫い目Y/Z角、風速の5入力と3軸forceを用いた実験・CFD・機械学習を記載する。素材・角度・力の単位、測定点一覧、raw file、検証誤差、licenseはabstractだけでは未確認。本文リンクは今回403だったため再試行せず、適用可としない。

[UMBA作者の公開repository](https://github.com/AndRoo88/Baseball-Flight-Calculator) はMIT license、位置ft・速度mph・spin rpm・角度degreeの入力を説明し、[作者のUMBA記録](https://baseballaero.com/category/umba/) はSSWモデルを含むバージョンと実験点の不足を説明する。作者READMEでは球ロゴに対する追加2角を未使用と記す。具体的な現commitの式、実験calibration、外部独立validation、任意回転軸や実球種に対する妥当性は今回確認していない。実行・係数のコピー・Core導入はしておらず、実証済み3段階modelではない。

## 次の具体的操作

1. **source確保の探索を継続:** Fong研究を引用する後続の大学・著者公開datasetを対象に、同一trial ID・物体座標定義・姿勢/3D spin・相対風・時刻付きPVまたは3軸force・units・clock同期・licenseの有無をmetadataから探す。Fongの低回転図を高回転の代理にせず、新dataがなければUNKNOWNを維持。Fong/Jenningsへの連絡や認証/購入は行わない。
2. **公開CSVは別の補助検証として隔離:** 元球種別の終点とrelease/速度分布を将来の外部妥当性確認に使う場合のみ、V3のhash・単位・係数の時間原点/符号・欠損率を先に固定し、時系列forceの実測やキレ技能認定には使わない。今回のfileは未保存なので再現時は記載SHAに照合する。
3. 適合する新sourceが得られた場合はsource/license・各列units・時刻同期/不確かさ・対象spin/球種の適用域を先に記録し、元球種のPV/全spin不変、Main/Worker同一と独立実測に対する検証を計画する。現UI表示・旧PASS・p10を物理受入の代用にしない。source不足の間も他の独立した元goalを進める。

## 検証と境界

文献本文/公開metadataを読取、公開CSVを一回GETして全bytesのSHAとheader/行数のみ確認した。旧403対象の再取得0、write/投稿/連絡0、コード/既存source/本人JSON変更0、旧grid再実行0。今回得た公開sourceは物理採用に至らず、元goal・過去FAIL・UNKNOWNを維持する。
