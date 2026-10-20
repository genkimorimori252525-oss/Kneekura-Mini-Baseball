# 観測で判断する初球のNative実採用

後続の物理cut・観測・配信・予測は[初球cutの接続](same-pa-observed-initial-cut-v1.md)を参照する。

`same_pa_observed_physical_pitch_v1`は、結果を決めずに初球を発行する別Sourceである。既存の`declared_take_v1`と旧physical Source、旧第三球以降の記録形式は変更しない。`acceptObservedPitch`は既存dispatch ownerの原action・32calibration・consumer set・episode・immutable rightを再読し、consumer/pitch/head/consumption/admissionの5行を同じトランザクションで採用する。各INSERT前後の原入力再計算、正確な行数、部分記録からの修復拒否を維持する。

返却値は`same_pa_first_pitch_launched_v1`。原カウント・イベントを保持し、`resolution`や見送り結果を生成しない。旧take用の採用口・readerは新Sourceを拒否する。保存後は権限callbackなしで同じ5行を再計算し、再採用しても行を増やさない。

## 初期保持からリリースまで

原打者actor、10人のbody materialization、元の身体姿勢、投手release geometry、初期球のsecure custody、投手板接触、審判Person・assignment・Play宣言を既存ownerで照合する。初期保持は明示した`tag_hand`だけを扱う。gloveから手への移動を補完しない。

`controlled_held_pitch_v1`は、手の位置・速度と球の相対位置・速度を有限期間のHermite制御として明示する。開始時は元の手・球の位置/速度/回転、終了時は正式Coreが計算したreleaseの時刻/位置/速度/回転と完全一致しなければ拒否する。follow-throughも同じ位置/速度で接続し、原姿勢の有効期限を超えない。球の位置や時計を調整しない。

手の全制御包は元の肩からの到達範囲内、保持球の相対制御包は保持範囲内であることを確認する。手の全軌道と保持球の軌道を、同じ原姿勢に属する残り49個の身体primitiveに対して保守的に検査する。保持者自身の手は保持制約として扱う。衝突・判定不能・計算予算超過は拒否する。

releaseでは現在の手との接触面、相対法線速度または相対法線加速度による分離を確認する。過去の接触witnessを転用しない。固定軸区間の実回転を積分してreleaseの球の材質姿勢を保存し、その姿勢を正式な空力軌道へ接続する。

これは明示した**合成の運動制御**である。実測投球、筋力/トルク校正、全身の関節運動を再現したという主張はしない。球速・回転へのリーグ補正や結果加点は加えない。

## 検証と残作業

合成Native fixtureで、投球履歴0件から初期保持・審判Play・初球の実発行・5行保存・権限callbackなし再採用を確認する。元のカウントは0/0、結果イベントなし。破損したreleaseは書込前に拒否する。別プロセスはproduction readerを使い、readonlyで全記録を再計算し、71tableのschema/全行/DBのファイルSHA不変を照合する。Source、原失敗、各command/log/SHAは`outputs/verification-observed-initial-adoption-v*`とCCG receiptsに保存する。

この初球は既存の合成Native fixture上の証拠であり、新規18人genesisと実測打撃モデルを同じ試合の初球まで統合した証拠ではない。MMDを再導入しない。

次はrelease後の球と動く手/身体のCCD、および元の世界時計に属する初球cut・知覚・配信・予測・判断・実測スイングcommitmentの実採用へ接続する。手の制御は`ownedHandControlThroughTick`で終了するため、その先への外挿や旧姿勢への復帰は禁止する。旧第三球以降のordinal制約を緩めたり、架空の見送り2球を挿入したりしない。

汎用9人守備の再観測/指示保持、捕球/持ち替え/送球、走者、公式裁定、混合9回完走、100試合監査、実機検証は引き続き未完了。全goalは継続する。既存HTMLと2タブメーカーはこの工程では変更しない。
