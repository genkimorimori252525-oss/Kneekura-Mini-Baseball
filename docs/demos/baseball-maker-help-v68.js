/* Help is presentation only: control IDs, values, events and saved data stay owned by the maker. */
(function (root) {
  'use strict';
  const item = (label, help) => Object.freeze({ label, help });
  const fields = Object.freeze({
    heightMeters: item('身長', '体の大きさ、ストライクゾーン、実測スイングの体格合わせに使います。高くすると必ず強打者になる設定ではありません。'),
    reactionSeconds: item('打球に動き始めるまで', '守備で打球に反応するまでの時間です。小さいほど早く動き始めます。走る速さや、どこへ動くかの判断とは別です。'),
    defensiveDecisionSeconds: item('守備の判断にかかる時間', '捕球・カバーなどの動きを判断するまでの時間です。小さいほど判断が早くなります。走る速さやグラブの届く範囲は変わりません。'),
    baserunningSafetyMarginSeconds: item('進塁するときの慎重さ', '送球よりどれだけ余裕をもって塁へ着けるかを見積もります。大きいほど慎重、小さいほど進塁に積極的になります。走る速さは変わりません。監督の走塁指示も加わります。'),
    fieldingPursuitCostWeight: item('遠くの球を追う慎重さ', '捕球やカバーの担当を決めるとき、移動の負担をどれだけ重く考えるかです。大きいほど慎重、小さいほど遠くの球も積極的に追います。守備位置や到達の可否も考えるため、常に追う設定ではありません。足やグラブの能力は変わりません。'),
    topSpeedMps: item('走る最高速度', '全力で走ったときの速さです。大きいほど走塁や守備で速く移動できます。加速する早さや判断の早さとは別です。'),
    accelerationMps2: item('走り始めの加速', '止まった状態から速くなる強さです。大きいほど短い距離で速度が上がります。走る最高速度は別の項目です。'),
    baserunningTurnRadiusMeters: item('ベースを回る大きさ', '続けて進塁するときに、ベースをどれくらい大きく回るかです。大きいほど外へふくらみます。走る距離も変わるため、大きければ必ず速いわけではありません。'),
    baserunningLateralAccelerationMps2: item('ベースを回る踏ん張り', '走りながら向きを変えられる強さです。大きいほど、同じ回り方でも速度を保ちやすくなります。最高速度や進塁の積極性は変わりません。'),
    gloveSpeedMps: item('グラブを動かす速さ', '体の近くで、グラブを球へ動かせる速さです。大きいほど素早く合わせられます。選手が走る速さとは別です。'),
    gloveReachMeters: item('グラブが届く範囲', '体からグラブを伸ばせる範囲です。大きいほど遠くの球に届きます。グラブの大きさや捕球の確実さとは別です。'),
    gloveRadiusMeters: item('グラブで受ける範囲', '球がグラブに触れたと扱う範囲の大きさです。大きいほど触れやすくなります。触れた球を保持できるかは、衝撃を受け止める能力でも決まります。'),
    retentionCapacityJ: item('球をこぼさず支える強さ', '捕球のときに支えられる衝撃の大きさです。大きいほど強い球を保持しやすくなります。必ず捕れる設定ではありません。'),
    captureDissipationPowerW: item('捕球の衝撃を逃がす速さ', 'グラブへ入った球の勢いを吸収する速さです。大きいほど勢いを早く弱められます。球へ届く速さや、送球の速さとは別です。'),
    transferSeconds: item('捕ってから投げるまで', '捕球後に球を持ち替え、送球へ移るまでの時間です。小さいほど素早く投げられます。投げた球の速度は変わりません。'),
    throwSpeedMps: item('送球の速さ', '野手が投げた直後の球の速度です。大きいほど速い送球になります。狙う方向の正確さは別に設定します。'),
    throwDirectionStdRadians: item('送球の方向のばらつき', '送球を狙った方向からどれくらい外しやすいかです。小さいほど正確、大きいほど方向がばらつきます。毎回同じ方向に外れる設定ではありません。'),
    batLengthM: item('バットの長さ', '使うバットの実際の長さです。見た目と球に触れる範囲が一緒に変わります。バットの重さは別に設定します。'),
    batMassKg: item('バットの重さ', '球とぶつかるバットの重さです。衝突時の打球にも影響します。重くすれば必ず遠くへ飛ぶという設定ではありません。'),
    swingRate: item('実測フォームを振る速さ', '実測スイングの時間の進め方です。大きいほど同じ動きを短い時間で振ります。目標速度や最大速度の制限も受けます。画面の再生速度とは別です。'),
    maximumSweetSpotSpeedMps: item('出せるバット速度の上限', 'バットの芯で出せる速度の上限です。大きいほど速いスイングを許します。実際に狙う速度は別に設定します。'),
    targetSweetSpotSpeedMps: item('狙うバット速度', '球へ当てる付近で狙う、バットの芯の速さです。大きいほど速く振ろうとしますが、選手の上限を超えることはできません。'),
    timingStdSeconds: item('振るタイミングのばらつき', '狙った時刻からどれくらい早く・遅くなりやすいかです。小さいほど安定します。常に早振り、常に遅振りにする補正とは別です。'),
    aimStdMeters: item('芯を合わせる位置のばらつき', '狙った打点からどれくらい位置がずれやすいかです。小さいほど芯を合わせやすくなります。球を振るか見送るかの判断は変わりません。'),
    chaseMarginMeters: item('ゾーンの外まで振る広さ', 'ストライクゾーンからどれくらい外側まで振る候補にするかです。大きいほどボール球にも手を出しやすくなります。悪球をうまく打つ得能とは別です。'),
    motorLatencySeconds: item('振ると決めてからの遅れ', '球を振ると判断してから、実際にスイングを始めるまでの時間です。小さいほど早く動き始められます。目標のバット速度とは別です。'),
    technicalTimingOffsetSeconds: item('早め・遅めに振る補正', '狙う打点の時刻をずらします。負の値は早め、正の値は遅めです。毎回のばらつきとは別なので、安定性を上げる設定ではありません。'),
    sweetSpotT: item('バットの芯の位置', 'グリップの端を0、先端を1とした芯の位置です。大きいほど先端寄りになります。バットの長さや、芯へ合わせる精度は変わりません。'),
    attackAngleDegrees: item('当てるときの振り上げ角', 'バットの芯が進む上下の角度です。正の値は上向き、負の値は下向きです。従来の詳細設定では実測軌道全体の向きを調整します。インパクト付近だけを変える新しい弾道設定とは別です。打球の上がる角度そのものではありません。'),
    pullAngleDegrees: item('引っ張る・流す方向', 'バットの芯が進む左右の向きです。正の値は引っ張り方向、負の値は流し方向です。実際の打球方向は球との当たり方でも変わります。'),
    badBallControl: item('悪球打ちの技術の強さ', '窮屈なコースで、狙う位置が余計にずれるのを抑える強さです。大きいほど抑えやすくなります。得能の悪球打ちを持つときに働きます。悪球を振る積極性とは別です。'),
    preContactSeconds: item('当てる前の動きを使う長さ', '実測フォームから、予定の打点より前の動きを何秒分使うかです。大きいほど早い段階から使います。元データにない動きを作り足す設定ではありません。'),
    followThroughSeconds: item('当てた後の動きを使う長さ', '実測フォームから、予定の打点より後の動きを何秒分使うかです。大きいほど後ろまで使います。元データが終わった後の動きは作り足しません。'),
    contactDepthMeters: item('球を捉える前後の位置', 'ホームベースより投手側へ何mの位置で当てようとするかです。大きいほど前で捉えます。球のコースや、結果の飛距離を直接指定する項目ではありません。'),
    'swingDecision.threshold': item('振ると決める慎重さ', 'コースの見積もりから振ると判断する基準です。大きいほどよい球を待ち、小さいほど振りやすくなります。バットの速さや悪球打ちの技術は変わりません。'),
    'swingDecision.aggressionWeight': item('振る積極性', '同じように見えた球に、どれくらい積極的に振るかです。大きいほど振りやすくなります。球を見分ける正確さとは別です。'),
    'swingDecision.approach': item('振る・見送る方針', '自分の判断で振るか、見送るか、振りにいくかを選びます。監督の試合中の指示も影響します。スイング軌道や打球の結果は固定しません。'),
    pitchReleaseHeightMeters: item('球を離す高さ', 'マウンドの表面から、球を離す位置までの高さです。大きいほど高い位置から投げます。球速は変わりません。'),
    pitchReleaseSideMeters: item('球を離す左右の広さ', '投手板の中心から、利き手側へ球を離す位置までの距離です。大きいほど右投げは右側、左投げは左側になります。コントロールのばらつきとは別です。'),
    pitchReleaseExtensionMeters: item('球を離す前への伸び', '投手板からホーム方向へ何m伸びた位置で球を離すかです。大きいほど打者に近い位置から投げます。投球の初速を直接上げる設定ではありません。'),
    releaseSpeedMps: item('普段の投球速度', '球種ごとの速度を決める基準です。大きいほど速い球になります。球種の違いや、最高速度の制限も受けます。'),
    maximumPitchSpeedMps: item('出せる投球速度の上限', '投球の初速に使う上限です。大きい値にしても、普段の速度が低ければ常に最高速度で投げるわけではありません。'),
    commandStdMeters: item('投球コースのばらつき', '狙ったコースからどれくらい外れやすいかです。小さいほど安定します。球速や球の回転とは別です。'),
    'spinRadPerSecond.x': item('球の回転：横向きの軸', '一塁・三塁を結ぶ方向の軸まわりの回転です。正負で回転の向きが反転し、3つの回転を組み合わせて球の曲がり方が決まります。直球はこの向きも使い、他の球種は主に回転の合計量を使います。'),
    'spinRadPerSecond.y': item('球の回転：縦向きの軸', '地面から上へ伸びる軸まわりの回転です。正負で回転の向きが反転し、3つの回転を組み合わせて球の曲がり方が決まります。直球はこの向きも使い、他の球種は主に回転の合計量を使います。'),
    'spinRadPerSecond.z': item('球の回転：投手と本塁を結ぶ軸', 'ホームから投手へ向かう軸まわりの回転です。正負で回転の向きが反転します。進行方向に近い軸の回転は、横向きの回転と同じ曲がり方にはなりません。球速は直接変わりません。'),
    zoneJudgmentStdMeters: item('コースを見分ける誤差', '打者が予想するコースの位置が、どれくらいずれやすいかです。小さいほど正確になります。選球眼の詳細設定であり、振る積極性とは別です。'),
    plateVision: item('選球眼', '球のコースを見分ける1〜100の絶対能力です。高いほど判断が正確になり、打者視点も球を追いやすくなります。45がカメラ調整の基準です。リーグの平均で値は変わりません。')
  });
  const publicAbilities = Object.freeze({
    contact: item('ミート', '高くすると、芯を合わせる位置と振るタイミングが安定します。振る積極性や球の結果を直接決める設定ではありません。'),
    power: item('パワー', '高くすると、狙うバット速度と出せる速度の上限を一緒に上げます。打球の飛距離は、球との当たり方・回転・空気抵抗でも変わります。'),
    vision: fields.plateVision,
    run: item('走力', '高くすると、走る最高速度と加速を一緒に上げます。進塁の積極性は別に調整します。'),
    arm: item('肩力', '高くすると送球が速くなります。送球の方向の正確さ、捕ってから投げるまでの時間は別です。'),
    field: item('守備力', '高くすると、動き始め・守備の判断・持ち替えが早くなります。走力と捕球は別に調整します。'),
    catching: item('捕球', '高くすると、グラブを動かす速さと球の衝撃を吸収して保持する力を一緒に上げます。届かない球を必ず捕る設定ではありません。'),
    throwingAccuracy: item('送球精度', '高くすると、送球の方向のばらつきを減らします。送球の速さは肩力で調整します。'),
    maxSpeedKmh: item('球速', '投球の最高初速です。変更すると、普段の投球速度との比率を保って調整します。球種ごとに実際の速度は変わります。'),
    control: item('制球', '高くすると、狙った投球コースからのばらつきを減らします。球速や回転の量は変わりません。')
  });
  const ids = Object.freeze({
    'trajectory-mode': item('試す方法', '実測スイングの再生、球を投げて当てる試験、従来の計算用スイングを切り替えます。再生だけの方法では打球は発生しません。'),
    'reference-clip': item('実測スイングを選ぶ', '実際に記録されたバットの動きを選びます。左右の打者は別の実測です。同じ選手の複数の記録が含まれるため、件数と選手人数は異なります。'),
    'reference-compare': item('重ねて比べるスイング', '水色の軌跡で別の実測スイングを重ねます。比較表示を変えても、選んだ球やスイングの計算は変わりません。'),
    'reference-start': item('使い始める元データの時刻', '元データの何秒から使うかです。大きくすると前半を短くします。再生速度や元データの時刻そのものは変えません。'),
    'reference-end': item('使い終わる元データの時刻', '元データの何秒まで使うかです。小さくすると後半を短くします。元データの外へ動きを作り足すことはできません。'),
    'play-speed': item('再生の速さ', '画面で見る再生速度だけを変えます。実際のバット速度・投球速度・接触結果は変わりません。'),
    camera: item('見る方向', '同じ動きを見る方向だけを切り替えます。球やバットの位置、接触結果は変わりません。'),
    scrub: item('再生位置', '見たい時刻へ移動します。同じ計算結果を確認する操作で、球や能力は変更しません。'),
    'swing-speed': fields.targetSweetSpotSpeedMps,
    'attack-angle': fields.attackAngleDegrees,
    'pull-angle': fields.pullAngleDegrees,
    'contact-depth': fields.contactDepthMeters,
    'load-angle': item('構えの角度', '従来の計算用スイングの構えを変えます。実測スイングの構えは元データを使うため、この項目では変わりません。'),
    'finish-angle': item('振り抜きの角度', '従来の計算用スイングの振り抜きを変えます。実測スイングの振り抜きは元データを使います。'),
    'hand-travel': item('手元が動く距離', '従来の計算用スイングで手元を動かす距離です。実測スイングの手元は元データを使います。'),
    'maximum-bat-speed': fields.maximumSweetSpotSpeedMps,
    'run-speed': fields.topSpeedMps,
    'throw-speed': fields.throwSpeedMps,
    'player-pitch-speed': fields.releaseSpeedMps,
    'reaction-time': fields.motorLatencySeconds,
    'position-error': fields.aimStdMeters,
    'timing-error': fields.timingStdSeconds,
    judgment: fields['swingDecision.threshold'],
    aggression: fields['swingDecision.aggressionWeight'],
    approach: fields['swingDecision.approach'],
    'bad-ball-control': fields.badBallControl,
    'technical-timing': fields.technicalTimingOffsetSeconds,
    'bat-mass': fields.batMassKg,
    'bat-length': fields.batLengthM,
    'sweet-spot': fields.sweetSpotT,
    'body-height': fields.heightMeters,
    'body-mass': item('体重', '単体試験用の体重です。実測バットだけの試験では、体重から筋力や打球の飛距離を自動で作りません。'),
    'player-id': item('保存用の選手番号', 'JSONで選手を区別するための名前です。重複を避けて付けます。能力の強さには影響しません。'),
    'pitch-speed': item('試す球の速度', '試験で投げる球の速さです。大きいほど速くなります。選手の保存済み能力とは別の試験条件です。'),
    'pitch-spin': item('試す球の回転数', '試験で投げる球の回転量です。回転の向きと組み合わさって曲がり方が変わります。多ければ必ず大きく曲がるわけではありません。'),
    'spin-axis': item('試す球の回転方向', '試験球の回転の向きを選びます。同じ回転数でも、進む向きに対する回転軸で曲がり方が変わります。'),
    'course-x': item('試す球の左右のコース', '試験球の狙う左右位置です。0が中央です。打者を左右で変えても世界の左右の値を使うため、内角・外角とは別の表し方です。'),
    'course-y': item('試す球の高さ', '試験球の狙う高さです。大きいほど高いコースになります。球のサイズやストライクゾーンの大きさは変わりません。'),
    timing: item('試験で振る早さ・遅さ', '同じ投球に対して振る時刻をずらします。負は早め、正は遅めです。選手の能力を書き換えずに比較できます。'),
    'position-offset': item('試験で芯をずらす距離', '当たり方の違いを調べるため、狙う位置をずらします。0へ戻すと試験用のずらしを取り除きます。選手の精度そのものではありません。'),
    seed: item('同じ試験を再現する番号', '同じ設定と番号なら、同じばらつきで比較できます。番号を変えると別の試行になります。能力の強さを直接変える番号ではありません。'),
    trail: item('軌跡の表示', '動いた跡を表示するか選びます。球やバットの動き、接触結果は変わりません。'),
    'pattern-intent': item('調整の目印', '保存した調整を探しやすくする目印です。ゴロ・ライナー・フライの結果を保証する設定ではありません。'),
    'calibration-world-yaw': item('全体を左右へ向ける角度', '実測バット全体を、上下に伸びる軸のまわりに回します。再生と実測バットの接触試験に使います。元データは書き換えません。'),
    'calibration-flip-x': item('全体の左右を反転', '実測の左右方向を反転する研究用の設定です。実際に記録された左打者の動きへ置き換える操作ではありません。元データは残ります。'),
    'calibration-flip-y': item('全体の上下を反転', '実測の上下を反転する研究用の設定です。通常の打撃姿勢の調整には向きません。元データは残ります。'),
    'calibration-flip-z': item('全体の前後を反転', '実測の投手側・捕手側を反転する研究用の設定です。元データと時刻は変えません。'),
    'calibration-local-x': item('持ち方の回転：X方向', '手元を基準に、バット自体の向きをX方向の軸まわりに変えます。全体を回す設定とは別です。再生と接触試験に反映し、元データは残します。'),
    'calibration-local-y': item('持ち方の回転：Y方向', '手元を基準に、バット自体の向きをY方向の軸まわりに変えます。全体を回す設定とは別です。元データからの調整として扱います。'),
    'calibration-local-z': item('持ち方の回転：Z方向', '手元を基準に、バット自体の向きをZ方向の軸まわりに変えます。全体を回す設定とは別です。元データからの調整として扱います。'),
    'calibration-origin-x': item('持つ位置のずらし：X方向', 'バットと一緒に回る座標で、握る基準位置をずらします。世界全体を左右へ移す設定とは別です。'),
    'calibration-origin-y': item('持つ位置のずらし：Y方向', 'バットと一緒に回る座標で、握る基準位置をずらします。向きによって画面での移動方向も変わります。'),
    'calibration-origin-z': item('持つ位置のずらし：Z方向', 'バットと一緒に回る座標で、握る基準位置をずらします。球のコースやバットの長さは変えません。'),
    'reference-experiment-start': item('投球後に振り始める時刻', '球を投げてから何ミリ秒後に実測スイングを始めるかです。大きいほど遅くなります。画面の再生速度とは別です。'),
    'reference-experiment-rate': item('試験で実際に振る速さ', '実測スイングの時間倍率です。大きいほど短い時間で振り、実際の接触も変わります。見るだけの再生速度とは別です。選手の速度上限を超える設定は使えません。'),
    'reference-experiment-x': item('試験で左右へ動かす距離', '実測スイング全体の試験位置を左右へ動かします。球に合う位置を研究する設定です。元の記録や球の位置は変えません。'),
    'reference-experiment-y': item('試験で上下へ動かす距離', '実測スイング全体の試験位置を上下へ動かします。大きいほど上へ動きます。バットを振り上げる角度とは別です。'),
    'reference-experiment-z': item('試験で前後へ動かす距離', '実測スイング全体の試験位置を前後へ動かします。正の値は投手側です。球の軌道や元の記録は変更しません。'),
    'live-public-league': item('参考にするリーグ', '同じ選手が別のリーグでどう見えるかを表示します。この切り替えで試合用の能力は変わりません。選球眼はリーグに依存しない絶対能力です。'),
    league: item('比べるリーグ', '読み込んだ比較用選手から、リーグ内での見え方を表示します。比較用データがないリーグの評価は作りません。'),
    'live-roster-player': item('編集する試合の選手', 'ここで選んだ選手の能力・得能・フォームを編集します。通常試合へ使うときは、試合用能力JSONを保存して試合へ読み込みます。')
  });

  const selector = '[data-roster-path],[data-public-ability],[data-help],input[id],select[id],textarea[id],button[id]';
  const records = new WeakMap();
  let installed = false, observer = null, scheduled = false, timer = null, active = null, tip = null;
  const delayMs = 1000;
  const tooltipId = 'maker-help-tooltip-v68';
  const described = (element, enabled) => {
    const ids = new Set((element.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    enabled ? ids.add(tooltipId) : ids.delete(tooltipId);
    if (ids.size) element.setAttribute('aria-describedby', [...ids].join(' '));
    else element.removeAttribute('aria-describedby');
  };
  function hide() {
    root.clearTimeout(timer); timer = null;
    if (active) {
      described(active.control, false); described(active.button, false);
      active.button.setAttribute('aria-expanded', 'false');
    }
    active = null;
    if (tip) tip.hidden = true;
  }
  function place(record) {
    const rect = record.button.getBoundingClientRect(), anchor = (record.control.closest('.control') || record.control).getBoundingClientRect(),
      width = document.documentElement.clientWidth || root.innerWidth,
      height = root.innerHeight, box = tip.getBoundingClientRect(), edge = 12;
    const left = Math.max(edge, Math.min(rect.left, width - box.width - edge));
    // Place beyond the whole input row. Covering a hovered input would trigger
    // pointerleave as soon as the tooltip appeared, especially on narrow screens.
    const below = Math.max(anchor.bottom, rect.bottom) + 8, above = Math.min(anchor.top, rect.top) - box.height - 8;
    const top = below + box.height <= height - edge ? below : Math.max(edge, above);
    tip.style.left = left + 'px'; tip.style.top = top + 'px';
  }
  function show(record) {
    hide();
    if (!record.control.isConnected) return;
    active = record; tip.textContent = record.label + '\n' + record.help; tip.hidden = false;
    described(record.control, true); described(record.button, true);
    record.button.setAttribute('aria-expanded', 'true'); place(record);
  }
  function queue(record) {
    hide(); timer = root.setTimeout(() => { timer = null; show(record); }, delayMs);
  }
  function specification(control) {
    const custom = control.getAttribute('data-help'), known = fields[control.dataset.rosterPath]
      || publicAbilities[control.dataset.publicAbility] || ids[control.id];
    if (!custom && !known && !control.title) return null;
    const parentLabel = control.labels?.[0], labelText = parentLabel && [...parentLabel.childNodes]
      .filter(node => node.nodeType === 3).map(node => node.textContent).join(' ').trim();
    const label = control.getAttribute('data-help-label') || known?.label || labelText
      || control.getAttribute('aria-label') || control.textContent.trim() || 'この設定';
    return { label, help: custom || known?.help || control.title, replaceLabel: !!known?.label || control.hasAttribute('data-help-label') };
  }
  function plainLabel(control, spec) {
    const label = control.labels?.[0];
    if (!label || !spec.replaceLabel) return label;
    const text = [...label.childNodes].find(node => node.nodeType === 3 && node.textContent.trim());
    if (text) {
      const unit = text.textContent.match(/\s+\([^)]*\)\s*$/)?.[0] || '';
      const next = spec.label + unit;
      if (text.textContent !== next) text.textContent = next;
    }
    return label;
  }
  function decorateOne(control) {
    if (control.classList.contains('maker-help-button')) return;
    const spec = specification(control); if (!spec) return;
    const label = plainLabel(control, spec), prior = records.get(control);
    if (prior) {
      prior.label = spec.label; prior.help = spec.help;
      prior.button.setAttribute('aria-label', spec.label + 'の説明'); return;
    }
    const button = document.createElement('button'); button.type = 'button'; button.className = 'maker-help-button';
    button.textContent = '?'; button.setAttribute('aria-label', spec.label + 'の説明');
    button.setAttribute('aria-expanded', 'false'); button.setAttribute('aria-controls', tooltipId);
    const wrapper = control.closest('.control');
    if (wrapper && label && wrapper.contains(label)) {
      wrapper.classList.add('maker-help-control'); label.classList.add('maker-help-label');
      button.dataset.makerHelpPlacement = 'control'; label.after(button);
    } else (label || control).after(button);
    const record = { control, button, label: spec.label, help: spec.help }; records.set(control, record);
    control.dataset.makerHelpTarget = 'true';
    if (control.hasAttribute('title')) control.removeAttribute('title');
    for (const target of [control, button, ...(label ? [label] : [])]) {
      target.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') queue(record); });
      target.addEventListener('pointerleave', event => { if (event.pointerType !== 'touch') hide(); });
      target.addEventListener('focus', () => queue(record));
      target.addEventListener('blur', hide);
    }
    button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); active === record ? hide() : show(record); });
  }
  function decorate(container = document) {
    if (container.nodeType === 1 && container.matches(selector)) decorateOne(container);
    for (const control of container.querySelectorAll?.(selector) || []) decorateOne(control);
    return document.querySelectorAll('[data-maker-help-target]').length;
  }
  function install() {
    if (installed) { decorate(); return root.KneekuraMakerHelp; }
    if (!document.body) throw new Error('maker help: install after the document body is ready');
    installed = true; tip = document.createElement('div'); tip.id = tooltipId; tip.className = 'maker-help-tooltip';
    tip.setAttribute('role', 'tooltip'); tip.hidden = true; document.body.append(tip); decorate();
    observer = new MutationObserver(mutations => {
      const relevant = mutations.some(mutation => mutation.type === 'attributes' || [...mutation.addedNodes].some(node =>
        node.nodeType === 1 && (node.matches(selector) || node.querySelector(selector))));
      if (!relevant || scheduled) return;
      scheduled = true; root.queueMicrotask(() => { scheduled = false; decorate(); });
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['data-help', 'data-help-label', 'data-roster-path', 'data-public-ability'] });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
    document.addEventListener('pointerdown', event => {
      if (active && event.target !== active.control && !active.button.contains(event.target) && !tip.contains(event.target)) hide();
    });
    document.addEventListener('scroll', hide, true); root.addEventListener('resize', hide);
    return root.KneekuraMakerHelp;
  }
  root.KneekuraMakerHelp = Object.freeze({ version: 68, install, decorate, hide, delayMs,
    inspect: () => ({ installed, delayMs, controls: document.querySelectorAll('[data-maker-help-target]').length,
      visible: !!tip && !tip.hidden, label: active?.label || null }),
    fieldPaths: Object.freeze(Object.keys(fields)) });
})(typeof globalThis === 'object' ? globalThis : this);
