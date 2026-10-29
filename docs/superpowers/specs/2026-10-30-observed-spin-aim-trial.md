# 観測から運動へ接続する明示的な回転試行

2026-10-30 JST。全Goal・4技術・希少Gold・通常試合採用・最終配送の受入条件は維持する。この単位は未校正の試行controlであり、技術習得ではない。

## 判断と根拠

V225は元練習のtarget / anchor対を保存・正常再読できる。次球へ適用する権限は持たず、`futureTransferProven:false`を保つ。元の0g / air0 / Rでの成功を通常重力へ一般化しない。

新しい物理判断として、Astraは明示translationとdepth / clockの計算順を審査し、未校正試行として採用可と判断した。原pairの同一planeから得る差はx/yのみ、Δz=0が必要。V225は差の由来、新Sourceは試行許可、新actual evidenceは適用結果と分離する。

既存StandalonePracticeはrelease消費前にfresh controlを登録する契約であり、samePAの配達済みforecastを別standalone球の観測根拠にできない。予約guardも緩めない。新しいforecast Ownerを作らず、既存samePAの正常input / intent / 配達済み観測を用いる別versionの明示trial commitmentを追加する。

## 運動計算

1. 未変更の配達済みforecastからneutral plate crossingを得る。
2. 元のexact target / anchor対からx/y差を得てaimed plate targetへ適用する。技術名の定数を使わない。
3. aimed plateと既存profileからcontact depthを決める。
4. 同じ未変更forecastから、そのdepthのneutral crossingとtickを得る。
5. 同じx/y差をneutral contact位置へ適用し、既存course-aware motorへ渡す。contact targetからdepthを再計算する循環は作らない。
6. 既存technical timing / latency / motor window / speed envelopeを通す。遅延後の再照準はせず、missを結果として保持する。

交差無し、過去、定義域外、未配達、未知transform、Δz、非有限値を拒否する。初期の座標域は右打者のみ、measured profileは未対応として拒否する。元drillのcontactTick、未来の実球、実接触から逆算した目標は入力にしない。

## Nativeでの試行許可と保存

新capability `same_pa_physical_observed_spin_aim_trial_v226` を、既存physical commitment tableの別armとして追加する方針。既存v1 / v123 / NO_TARGETの省略形、返値keys、値、drawを維持する。CoreからHostへのimportは作らない。

Sourceは正常view / launch / previous operation / input / intent、V225 description / 対応mastery、正常prediction / capture / deliveryのfullrefと、cutoff / selectedAtTick / 有効期限 / model / equipment / clock / 座標域 / transformを事前固定する。正常Ownerが同snapshotで再読し、neutral / aimed targets / contact tick / commandを再導出する。caller宣言のIDsやtargetsを認証済みと呼ばない。実際に必要なfieldsとnormalDTOの対応は実装前の型提案で確定する。

既存PhysicalOwnerのaccepted Sourceが`EXPLICIT_UNCALIBRATED_CONTROL`を許可する。通常のearned spin consumerは変更しない。新しい実接触を元の3件の資格へ付け替えず、新しい反復・適用域・技術別spin / aero結果から後続の資格を判断する。

元drillとcurrentでは姿勢・zoneが異なる。初期候補は同じ右打者・world x/y軸・plate plane・clockに限定し、元/currentのgeometry全値を別々に保存してdomain差と`qualifiedTransferProven:false`を示す。元とcurrentの数値一致を成功域の証明にせず、現在の正規姿勢・zone・重力・予測条件を変えない。今回の明示Sourceが許可するのは、この新しい条件での試行である。

## 検証・復旧

pure seamではzero差と現行motor全出力一致、非zero差の運動差、同forecastのdepth crossing / tick、入力不変、拒否条件、既存timing / latency / window / speedを確認する。既存motorのfinalizer抽出前全文とGit親を別保存し、逆変換で作業前全文と一致させる。

Nativeでは正常input / 元観測 / subject / model / equipment / clockの一致、別球・別人・未配達・期限外等の拒否、正規replay、旧省略互換を確認する。その後、保存済み未commit状態の所有コピーから新trialを受理し、既存resolutionの実接触 → exit spin → 既存continuous aeroへ進める。既commit行の削除・head巻戻しで分岐させない。元練習と前2TAKEは再生成しない。

既存Sourceは編集直前の全bytes baselineを保存し、変更を逆変換できる単位に保つ。原DB・旧Owner・旧flags・失敗記録を保持する。局所計算成功やtrialを選べたことを、4技術の完成・通常試合採用・性能・配送の完了へ昇格しない。
