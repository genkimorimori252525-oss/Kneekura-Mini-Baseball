/* Read-only learning panels. Input values, drafts, Core and saved packets stay owned by the maker. */
(function(root){
 'use strict';
 function spinGuide({rpm,gyro}={}){
  if(typeof rpm!=='number'||typeof gyro!=='number'||!Number.isFinite(rpm)||!Number.isFinite(gyro)||rpm<0||Math.abs(gyro)>1)return null;
  const active=Math.sqrt(Math.max(0,1-gyro*gyro));
  return Object.freeze({activePercent:100*active,activeRpm:rpm*active,gyroPercent:100*Math.abs(gyro),basis:'SETTINGS_AXIS_ESTIMATE_NOT_MEASURED_ACTIVE_SPIN'});
 }
 const topics={
  pitcher:[
   ['spin','回転と曲がり',`<p><strong>回転数は「回る速さ」、回転軸は「回り方」です。</strong>同じ2400rpmでも、回り方が違えば曲がり方が変わります。</p>
    <table><caption>マグヌス力の押す向きの例</caption><tbody><tr><th>バックスピン</th><td>上へ押され、無回転の球より落ちにくくなります。必ず上昇するという意味ではありません。</td></tr><tr><th>トップスピン</th><td>下へ押されます。カーブの縦変化を作る回り方です。</td></tr><tr><th>横回転</th><td>左右へ押されます。縦回転と混ざると斜めへ変化します。</td></tr></tbody></table>
    <p>「曲がる向き」は捕手から見て0°＝上、90°＝右、180°＝下、270°＝左。重力・初速・縫い目も加わるため、球の最終軌道そのものの角度ではありません。</p><output data-spin-guide-v85></output>`],
   ['gyro','ジャイロとは',`<p><strong>弾丸やアメフトの球のように、進む向きに沿って回る成分</strong>です。通常のマグヌス力で縦横へ曲げる回転は、その分少なくなります。</p>
    <p>入力0＝ジャイロ成分なし、±1＝基準軸に沿う成分のみ。＋と−はねじれる向きで、球が右・左へ曲がる指定ではありません。</p>
    <div class="maker-guide-example-v85"><strong>例：2400rpm、ジャイロ成分0.60</strong><br>設定時の目安は、ジャイロ60%、曲がりに使う回転80%＝1920rpm。二つは直角の成分なので、足して100%にはなりません。</div>
    <p>回転効率はバックスピンだけの割合ではありません。トップスピン・横回転も含みます。効率が高いほど、すべての球種で優秀になるわけでもありません。</p>
    <p class="note">ここは設定用の基準方向での目安です。実投球の進む向きは斜めになるため、正確な実測Active Spin率とは区別します。</p><output data-spin-guide-v85></output>`],
   ['seams','縫い目とは',`<p><strong>ボール表面の縫い目が、周りの空気の流れを偏らせる作用</strong>です。回転数・回転軸が近くても、縫い目の向きで違う変化が出る要素です。</p>
    <table><tbody><tr><th>左右・上下・ひねり</th><td>球を放す瞬間、縫い目の模様をどう向けるか。コースの狙いや回転軸の変更とは別です。</td></tr><tr><th>作用1倍</th><td>このゲームのモデルの基準。実在球の測定値と一致する保証ではありません。</td></tr><tr><th>作用2倍</th><td>モデルの作用係数を2倍にします。到達点のずれまで必ず2倍になるわけではありません。</td></tr></tbody></table>
    <div class="maker-guide-example-v85">例：初速・回転数・回転方向を固定して、縫い目の左右角だけ0°→90°へ変え、試投します。縫い目だけの影響を見比べられますが、必ず右へ曲がる設定ではありません。</div>
    <p class="note">縫い目の特殊空力・ナックルの揺れは実装済みの近似モデルです。実測SSW（縫い目で後流が偏る現象）への定量校正は未完了です。</p>`],
   ['release','投げる位置',`<p><strong>放す高さ・横位置・本塁への伸び</strong>が球の出発点を決めます。上手投げ／横手投げの設定例も、この位置や投球動作をまとめて変えます。</p>
    <div class="maker-guide-example-v85">例：球速と回転を固定し、本塁への伸びを1.5m→2.0mにすると、本塁に近い位置から投げます。飛行距離や打者に届くまでの時間が変わります。</div>
    <p>右投げ／左投げの変更は、腕側のリリース位置を左右へ変えます。保存した球の回転方向は自動反転しないので、方向の矢印も確認してください。</p>
    <p>制球は狙いのばらつき、回転の再現性は回転数の下振れを調整します。別の番号で何球か試すと違いが分かります。</p>
    <p class="note">球種別のリリース差、回転軸・縫い目姿勢・放す位置の個別ばらつきは未対応です。実在投手の完全再現とは区別します。</p>`],
   ['compare','図の読み方',`<p><strong>緑は実投球。灰は回転だけ0にした比較球</strong>です。「無回転の比較線」のOFF／ONで灰の線・点を切り替えます。初期設定はOFFです。</p>
    <p>比較球は、実投球と同じ初期位置・初速度から投げます。ストライクゾーンでの「変化量」は両者の差で、狙ったコースからのずれや、重力込みの総落下量ではありません。</p>
    <div class="maker-guide-example-v85">例：実投球が比較球より20cm上なら、比較球より20cm落ちにくかったという意味です。球が20cm上昇したとは限りません。</div>
    <p>縫い目ONでは、比較球にも縫い目の空力が残ります。実球は回転し比較球は回転しないため、この差をマグヌス力だけの差とは呼べません。</p>
    <p class="note">表示切替は試投や数値を変えません。比較しやすいよう図の拡大範囲も維持します。</p>`]
  ],
  player:[
   ['abilities','公開能力と詳細',`<p><strong>まず公開能力を調整し、必要な部分だけ詳細を開きます。</strong>ミートやパワーなどは、関連する内部の実数値をまとめて調整する入口です。</p>
    <div class="maker-guide-example-v85">例：パワーを上げた後で、詳細の「狙うバット速度」と「出せる速度の上限」を確認すると、どの実数値が変わったか分かります。</div>
    <p>メーカーは100を超える基礎能力も扱います。通常試合でユーザーに見える表示は100まで。選球眼はリーグと独立した絶対値1〜100です。</p>
    <p>リーグ内の参考表示は比較する集団による見え方です。参考リーグを切り替えただけで、保存済みの実数値は変わりません。</p>`],
   ['contact','ミート・選球眼',`<p><strong>ミートは芯に合わせる技術、選球眼は球やコースを見きわめる能力</strong>の大枠です。走力やバットの長さとは別です。</p>
    <div class="maker-guide-example-v85">例：同じ速球・同じフォームで、タイミングの誤差だけを大きくすると、狙った芯の場所へ振れても接触の時刻がずれやすくなります。</div>
    <p>選球眼は打者カメラの追従にも反映されます。基準は45。高い選手は球を追いやすくなりますが、カメラの見え方と、実際の接触結果は別に確認してください。</p>
    <p>悪球を振りやすい傾向と、悪球を打ちこなす「悪球打ち」の得能は別です。</p>`],
   ['power','パワー・弾道',`<p><strong>パワーは打つ強さ、弾道はスイングする弧の傾き</strong>を調整します。弾道4なら必ずホームラン、という結果指定ではありません。</p>
    <div class="maker-guide-example-v85">例：同じ選手・投球・フォームで弾道1〜4を切り替えます。初期角度は−10°／0°／＋10°／＋20°。バット全体の弧が傾き、実際の接触から打球が計算されます。</div>
    <p>打球はバットと球がどこで・いつ・どの向きに当たったかでも変わります。バックスピンや飛距離は衝突後の物理の結果です。</p>
    <p>バットを長くすると見た目と届く範囲が変わります。長さ・重さ・振る速さを一度に変えず、1項目ずつ比べると違いを把握しやすくなります。</p>`],
   ['traits','得能・コース',`<p><strong>基礎能力と得能は独立しています。</strong>得能は場面に応じて動作へ働く追加効果で、付け外しだけで公開能力を書き換えません。</p>
    <div class="maker-guide-example-v85">例：同じ基礎能力のまま「悪球打ち」を付け外しし、ゾーン外の同じ球を比較します。基礎ミートと得能の効果を分けて確認できます。</div>
    <p>先天的な得意コース、今季の成績・練習による変化、公開コース別成績は別管理です。少数の打席だけで長期の得意コースが大きく変わらないようにしています。</p>
    <p>守備の反応時間は小さいほど早く、最高速度は大きいほど速く走れます。判断の早さと足の速さを分けて調整してください。</p>`]
  ],
  bat:[
   ['orbit','軌道の見方',`<p><strong>実測スイングはOpenBiomechanicsのバット軌道です。</strong>実在のフォームの個性を保ち、弧全体の角度を弾道ごとに調整します。</p><p>弾道1＝ダウン−10°、2＝水平0°、3＝アッパー＋10°、4＝強め＋20°が初期値。角度は編集できます。右ドラッグで見る角度を変え、拡大して芯と先端を確認してください。</p>`],
   ['compare','公平な比較',`<p><strong>同じ選手・フォーム・投球のまま、弾道だけを切り替えます。</strong>バットの弧と実際の打球の両方を確認してください。</p><p>例：弾道2と3を同じ再生時刻で見ると、傾きと接触の違いが分かります。再生速度は観察用で、選手のバット速度を変更するものではありません。</p>`],
   ['precision','細かい数字',`<p><strong>説明欄の目安は小数1桁で読みやすく表示します。</strong>入力・保存値・物理計算は元の精度を保ちます。</p><p>例：位置をm単位の小数1桁に切り捨てると10cm刻みです。球とバットの接触には粗すぎます。桁を短くするだけでは、軌道の計算回数やJavaScriptの数値の保存サイズは減りません。</p>`]
  ]
 };
 topics.library=[...topics.pitcher.slice(0,3),['store','保存とコピー',`<p><strong>保管庫は名前付きの球の設定を、版ごとに残す場所です。</strong>編集中の設定は、保存するまで所持球へ反映されません。</p><p>例：最初の版を残したまま回転数を変えて新しい版を保存し、別の選手へコピーできます。コピー後の選手の球は独立した設定です。保管庫を編集しても、配った球が一斉に変わる仕組みではありません。</p><p>保存済みの版、編集中の値、選手が持つ球を区別して確認してください。</p>`]];
 let installed=false,pitcherGuide=null,libraryGuide=null;
 const guides=new Map(),byId=id=>root.document.getElementById(id),oneDecimal=n=>n.toFixed(1);
 function refresh(){
  for(const [guide,prefix]of [[pitcherGuide,'pitcher-pitch'],[libraryGuide,'pitcher-library']]){
  if(!guide)continue;
  const rpm=byId(prefix+'-rpm')?.value,gyro=byId(prefix+'-gyro')?.value,
   current=spinGuide({rpm:rpm?.trim()?Number(rpm):NaN,gyro:gyro?.trim()?Number(gyro):NaN});
  const text=!current?'入力を確定すると、設定の目安を表示します。':Number(rpm)===0
   ?'入力中の目安：回転数0。通常のマグヌス力は生じません。縫い目ONなら空気の偏りは残ります。'
   :'入力中の目安：'+oneDecimal(Number(rpm))+'rpm ／ ジャイロ成分 '+oneDecimal(current.gyroPercent)+'% ／ 縦横へ曲げる成分 '+oneDecimal(current.activePercent)+'%（'+oneDecimal(current.activeRpm)+'rpm）。設定時の目安で、実測値ではありません。';
  for(const output of guide.querySelectorAll('[data-spin-guide-v85]'))output.textContent=text;
  }
 }
 function createGuide(kind,title){
  const document=root.document,node=document.createElement('aside');node.className='maker-guide-card-v85';node.id='maker-guide-'+kind+'-v85';node.setAttribute('aria-label',title);
  const heading=document.createElement('h3');heading.textContent=title;node.append(heading);
  const intro=document.createElement('p');intro.className='maker-guide-intro-v85';intro.textContent='設定に触れると関連する説明が開きます。見出しを選んでも読めます。';node.append(intro);
  const nav=document.createElement('div');nav.className='maker-guide-tabs-v85';nav.setAttribute('role','tablist');nav.setAttribute('aria-label',title+'の項目');node.append(nav);
  const pane=document.createElement('div');pane.setAttribute('role','tabpanel');pane.id=node.id+'-content';pane.className='maker-guide-content-v85';node.append(pane);
  const buttons=[],activate=key=>{const topic=topics[kind].find(t=>t[0]===key);if(!topic)return;
   for(const button of buttons){const on=button.dataset.guideTopic===key;button.setAttribute('aria-selected',String(on));button.tabIndex=on?0:-1;}
   if(pane.dataset.topic!==key){pane.dataset.topic=key;pane.innerHTML=topic[2];pane.setAttribute('aria-labelledby',node.id+'-'+key);}
   refresh();};
  for(const [key,label]of topics[kind]){const button=document.createElement('button');button.type='button';button.id=node.id+'-'+key;button.dataset.guideTopic=key;button.textContent=label;
   button.setAttribute('role','tab');button.setAttribute('aria-controls',pane.id);button.addEventListener('click',()=>activate(key));nav.append(button);buttons.push(button);}
  nav.addEventListener('keydown',event=>{const index=buttons.indexOf(event.target);if(index<0||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   event.preventDefault();event.stopPropagation();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:buttons.length-1))%buttons.length;
   activate(buttons[next].dataset.guideTopic);buttons[next].focus();});
  activate(topics[kind][0][0]);guides.set(kind,{node,activate});return node;
 }
 function topicFor(target){
  const id=target?.id??'';
  if(target?.closest?.('#pitcher-library-pane'))return ['library',/seam/.test(id)?'seams':/gyro/.test(id)?'gyro':/rpm|direction/.test(id)?'spin':'store'];
  if(target?.closest?.('#pitcher-panel'))return ['pitcher',/seam/.test(id)?'seams':/gyro/.test(id)?'gyro':/release|motion|form|repeatability|control/.test(id)?'release':/plot|comparison|fit/.test(id)?'compare':'spin'];
  if(target?.closest?.('#player-panel')){const name=target.dataset?.publicAbility??target.dataset?.rosterPath??id;
   return ['player',/trait|course|spray|season/.test(name)?'traits':/power|trajectory|batLength|batMass/.test(name)?'power':/contact|vision|timing|perception|aim|discipline/.test(name)?'contact':'abilities'];}
  if(target?.closest?.('#bat-panel'))return ['bat',/comparison|ball|batter/.test(id)?'compare':/calibration|experiment/.test(id)?'precision':'orbit'];
  return null;
 }
 function install(){
  if(installed)return root.KneekuraMakerGuidesV85;
  const document=root.document,middle=document.querySelector('#pitcher-tuning-pane .pitcher-lab-grid > section:nth-child(2)'),libraryColumn=document.querySelector('.pitcher-library-grid > section:last-child'),abilities=byId('live-public-abilities'),mode=byId('trajectory-mode');
  if(!middle||!libraryColumn||!abilities||!mode)throw Error('maker guides: expected V84 maker panels are missing');
  pitcherGuide=createGuide('pitcher','投球設定の読み方');middle.append(pitcherGuide);middle.classList.add('maker-pitch-guide-column-v85');
  libraryGuide=createGuide('library','保管庫の設定の読み方');libraryColumn.append(libraryGuide);
  const layout=document.createElement('div');layout.className='maker-public-guide-layout-v85';abilities.before(layout);layout.append(abilities,createGuide('player','選手能力の読み方'));
  // The old trajectory-mode control lives in collapsed legacy research.
  // Keep current help beside the visible tab heading, outside that details.
  byId('bat-panel').querySelector('h2').after(createGuide('bat','打撃・軌道設定の読み方'));
  const descriptions=[
   ['pitcher-pitch-gyro','弾丸のような回転の混ざり具合','0は基準軸方向のジャイロなし、±1は基準軸方向の回転のみ。±はねじれる向きで、曲がる左右ではありません。0.60なら、縦横へ曲げる回転は設定時の目安80%です。実投球では進む向きで変わります。'],
   ['pitcher-library-gyro','弾丸のような回転の混ざり具合','保管する球のジャイロ成分です。0〜±1。0.60なら、曲がりに使う成分は設定時の目安80%。符号は左右の曲がりではありません。'],
   ['pitcher-seam-scale','縫い目による空気の力（倍）','1は作者モデルの基準です。実測値の保証ではありません。2倍にしても、到達点の変化量が必ず2倍になるわけではありません。'],
   ['library-seam-scale','縫い目による空気の力（倍）','保存する球の縫い目モデルの係数です。1はゲームの基準で、実測基準ではありません。']
  ];
  for(const [id,label,help]of descriptions){const control=byId(id);if(control){control.setAttribute('data-help-label',label);control.setAttribute('data-help',help);}}
  let queued=false;
  const queue=()=>{if(queued)return;queued=true;root.queueMicrotask(()=>{queued=false;refresh();});};
  document.addEventListener('focusin',event=>{if(event.target.closest?.('.maker-guide-card-v85')||!event.target.matches?.('input,select,textarea,summary'))return;
   const topic=topicFor(event.target);if(topic)guides.get(topic[0])?.activate(topic[1]);});
  document.addEventListener('input',event=>{if(event.target.closest?.('#pitcher-panel'))queue();});
  document.addEventListener('change',event=>{if(event.target.closest?.('#pitcher-panel'))queue();});
  document.addEventListener('click',event=>{if(event.target.closest?.('#pitcher-panel')&&!event.target.closest?.('.maker-guide-card-v85'))queue();});
  root.KneekuraMakerHelp?.decorate();installed=true;refresh();return root.KneekuraMakerGuidesV85;
 }
 root.KneekuraMakerGuidesV85=Object.freeze({version:85,spinGuide,install,inspect:()=>({installed,topics:Object.fromEntries([...guides].map(([kind,g])=>[kind,g.node.querySelector('[role=tabpanel]').dataset.topic])),authority:'READ_ONLY_HELP_AND_FORMATTED_ESTIMATES'})});
})(globalThis);
