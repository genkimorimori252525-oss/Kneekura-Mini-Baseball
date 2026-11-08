# V177: キレ3選択から名目release入力を自動生成する

2026-10-28 JST / `MB-20261027-REALISM-DEBUG-PLAN` Task4 Step7。本人の3選択・手入力不要・保存/通常試合まで同じ実Sourceという依頼に基づく通常の実装判断。V176の固定3入力/通常Owner実証f90c5070を再計算せず利用する。全goal/3選択UI/全球種の完成はまだ主張しない。

## 変更と所有

- 新pure `LivePitchQualityRecipeV177.ts` と対応testはworker。元snapshot・version付き選択request・既存plannerの基準名目velocity・wind・throws・実際の元seam設定から、V168の名目spin/q planを生成する。既存Sourceやball profileを変更しない。
- Rootは `LivePitchV1.ts` と新統合test。`pitchQualityV177?: {version:'live_pitch_quality_request_v177',qualityState} | null` を追加。未指定/nullは既存経路をそのまま使う。既存明示V168 planとの同時有効指定は曖昧なので拒否する。
- catalog/UI/選手保存/Hostへの接続は後続の最小差分。pure helperや投球入口だけでユーザー機能完成とはしない。共有dirty treeの他者変更/本人原本/旧候補を戻さず、Source commit/push/merge/deployをしない。

接続工程ではV2 catalogに専用PITCH_QUALITY editorとrecipeVersionだけのsourceを追加し、既存execution resolverの一時返値へpitchQualityV177 requestを渡す。元physical/repertoireへeffective spin/qを書き戻さず、既存Workbench/Hostのpp spreadで同じrelease ownerへ届く。トップレベルの一球指定が優先し、nullでその一球だけprofile指定を抑止できる。既存catalog回帰の17件固定/全familyにeffectScaleを要求する仮定は本人依頼の新familyと衝突するため、V2だけ18件へ更新し、新familyはrecipeVersion、従来familyは元の0/1/2倍率全検証を保つ。V1の7/13件と旧保存形は変更しない。これは合格条件を下げる変更ではなく新しい保存契約への対応。

## 名目処理と不変条件

requestは正確な3state（KIRE_CIRCLE/KIRE_DOUBLE_CIRCLE/THREATENING_DOUBLE_CIRCLE）だけを受ける。表示は本人指定のキレ○/キレ◎/驚異の切れ味。recipe versionは `kire_release_recipe_v177`。scale/gyro/phaseは順に .04/30/225、.02/30/0、.1/30/270。数値は実モデル入力であり、結果倍率/知覚校正/Native習得状態ではない。

spinと投げ出し方向の循環を避け、品質指定時だけ元snapshotのspin/qで既存mean逆算を一度行い基準名目velocityを確定→pure leafで回転入力を生成→元の幾何初期値から既存逆算をrecipe spin/qで行う。既存command/RNG drawは増やさず、最終名目plan後に従来のspin再現誤差/workloadを適用する。実future ballや打者観測をrecipeへ渡さない。既存mean逆算はseamを予見しないまま保つ。

leafの横成分基底は `s-perp = s - vHat*(s dot vHat)`、relative airは既存基準velocity-wind。右は+vHatのgyro成分、左は-vHatのgyro成分とし、既に左投げ化されたspin/qを二重にmirrorしない。phase0のq/符号は元byte相当値を保持し、非zero phaseは既存Quaternion演算だけを使う。名札を変え同じ名目入力にした対照の物理不変は既存V168/V176証拠を保持する。

## 不足データと適用域

非有限値/不正version/unknown field等の不正入力は境界で拒否する。合法だがspin0/relative air0/横成分退化/元material q欠如/有効seamなしでは、任意axis・表示identity・球の係数を発明せずNOT_APPLICABLEと理由を返す。Sourceの表示orientationとmaterial basisを混同しない。この中間境界を、利用者への手入力要求や今回要件の縮小で解決しない。旧保存の不足情報を自動authoringできる根拠/Sourceを次の接続工程で扱う。

V176は元curve prototype/右投げ/固定ball profileでの実証。新leafの入力一般化や左の数理対称だけで、任意球種/球速/利き手の3段階順序が実証済みとはしない。球別の適用と副作用を追加受入へ残す。

## 検証・復旧

workerは新leafの境界/不変/右の既存factory一致/左鏡映/phase0 raw q/呼出元非破壊をRED→GREEN。Rootは実投球の自動recipeと同じ明示V168 planのSource/sample一致、null/省略の旧結果、誤差/workloadの順序、同時指定拒否/不適用理由を新統合testで検証する。全Source安定後に必要な関連回帰と全型をまとめ、新Core/Chromeの必要範囲へ進む。旧V170/V176manifestを変更後のcurrent版と称さない。復旧は新optional指定を外すことで旧経路へ戻れる。
