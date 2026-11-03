/* Read-only adapter from issued Core pitches to the approved v27/v31 pitch
 * chart and world annotations. It never issues a pitch, judges a result, or
 * substitutes a trajectory. Load after the original history/symbol helpers. */
(function(root){
 'use strict';
 const kinds={fastball:'直球',slider:'スライダー',curve:'カーブ',changeup:'チェンジアップ',cutter:'カットボール',
  sinker:'シンカー',splitter:'スプリット',fork:'フォーク','two-seam':'ツーシーム'};
 const finitePoint=p=>p&&['x','y','z'].every(key=>Number.isFinite(p[key]));
 const point=p=>Object.freeze({x:p.x,y:p.y,z:p.z});
 const pitchId=index=>'live-pitch-'+index;
 const appearanceId=record=>'live-pa-'+record.beforeMatch.playId;
 function assert(value,message){if(!value)throw new Error('Live pitch chart: '+message);}
 function resultDescription(record){
  const play=record.play,kind=play.classification;
  if(kind==='count')return {label:{ball:'ボール',called_strike:'見逃し',swinging_strike:'空振り'}[play.call]??'カウント更新',
   category:play.call==='ball'?'ball':'strike'};
  if(kind==='walk')return {label:'四球',category:'ball'};
  if(kind==='strikeout')return {label:'三振',category:'out'};
  if(kind==='foul')return {label:'ファウル',category:'strike'};
  if(kind==='home_run')return {label:'ホームラン',category:'hit'};
  if(kind==='fly_out')return {label:'フライアウト',category:'out'};
  if(kind==='foul_out')return {label:'ファウルフライアウト',category:'out'};
  if(kind==='ground_rule_double')return {label:'二塁の安全進塁権',category:'in-play'};
  const outs=play.rules.outcomes.length;
  return {label:outs?outs+'アウト':'インプレーの進塁',category:outs?'out':'in-play'};
 }
 function create({canvas,caption,legend,core,onSelect}){
  assert(canvas&&caption,'approved chart canvas and caption required');
  assert(typeof core?.createSourceBallMaterialHistoryV1==='function','original Source observer unavailable');
  const symbols=root.KneekuraPitchSymbols,history=root.KneekuraPitchHistory,cache=new WeakMap();
  assert(typeof symbols?.draw==='function'&&typeof history?.select==='function','approved symbol/history helpers unavailable');
  let current=null,chartMarks=[];
  function locationObservation(record){
   const diagnostic=record.play.diagnostics,descriptor=diagnostic?.sourceDescriptor;
   assert(descriptor?.kind==='aero_ground_continuous_source_kernel_v2','original pitched Source descriptor required');
   const initial=descriptor.initial,tps=diagnostic.sourceClockTicksPerSecond;
   assert(Number.isSafeInteger(tps)&&tps>0&&finitePoint(initial?.ball?.position)&&finitePoint(initial?.ball?.velocity),'invalid original pitch clock or basis');
   const contact=record.play.contactMoment;
   let location,elapsedSeconds,method;
   if(contact){
    assert(finitePoint(contact.ball?.position)&&Number.isFinite(contact.elapsedSeconds),'original contact moment missing');
    location={kind:'contact',position:point(contact.ball.position)};elapsedSeconds=contact.elapsedSeconds;method='CORE_CONTACT_MOMENT';
   }else{
    // Catcher retention is a constraint after first glove contact. Its moving
    // pocket is not part of this free Source and must not become chart data.
    const through=Math.min(descriptor.throughElapsedSeconds,diagnostic.catcherContactElapsedSeconds
     ??(record.play.rules.endedAtTick-initial.originTick)/tps);
    assert(Number.isFinite(through)&&through>=initial.elapsedSeconds,'invalid accepted free pitch scope');
    const observer=core.createSourceBallMaterialHistoryV1({initialMaterialOrientation:{w:1,x:0,y:0,z:0},
     spans:[{descriptor,throughElapsedSeconds:through,side:'incoming'}]});
    const at=seconds=>observer.evaluateAt(seconds,'incoming').moment.ball.position;
    let lo=initial.elapsedSeconds,hi=through;
    assert(at(lo).z>=.15&&at(hi).z<=.15,'accepted free pitch did not cross original plate plane');
    for(let i=0;i<60&&hi-lo>1e-12;i++){
     const middle=(lo+hi)/2;if(at(middle).z<=.15)hi=middle;else lo=middle;
    }
    elapsedSeconds=hi;location={kind:'plate-crossing',position:point(at(hi))};method='ORIGINAL_SOURCE_PLATE_PLANE_Z_0_15';
   }
   assert(elapsedSeconds>=initial.elapsedSeconds&&elapsedSeconds<=descriptor.throughElapsedSeconds,'chart observation outside original Source scope');
   const elapsed=elapsedSeconds-initial.elapsedSeconds,release=initial.ball,gravity=descriptor.profile.air.gravityY;
   assert(Number.isFinite(gravity),'original Source gravity unavailable');
   // Same documented triangle convention, with direction from observed
   // displacement relative to the original gravity-only tangent. This is a
   // direction annotation, not another pitch model or a spin-rate claim.
   const breakVector=point({x:location.position.x-release.position.x-release.velocity.x*elapsed,
    y:location.position.y-release.position.y-release.velocity.y*elapsed-gravity*elapsed*elapsed/2,z:0});
   return Object.freeze({location:Object.freeze(location),breakVector,evidence:Object.freeze({method,elapsedSeconds,
    planeZ:location.kind==='plate-crossing'?.15:null,sourceOriginTick:initial.originTick,
    direction:'ORIGINAL_SOURCE_DISPLACEMENT_MINUS_INITIAL_GRAVITY_TANGENT',interpolated:false,extrapolatedAfterContact:false})});
  }
  function entry(record,index,number){
   let value=cache.get(record);
   if(!value){
    const observed=locationObservation(record),result=resultDescription(record);
    value=Object.freeze({plateAppearanceId:appearanceId(record),pitchId:pitchId(index),number,revision:0,status:'confirmed',
     availableAtMicros:record.play.rules.endedAtTick,location:observed.location,breakVector:observed.breakVector,
     pitchKind:record.pitchType,pitchType:kinds[record.pitchType]??record.pitchType,speedKmh:Number(record.speedKmh.toFixed(1)),
     resultLabel:result.label,category:result.category,count:Object.freeze({balls:record.match.balls,strikes:record.match.strikes}),
     terminal:record.play.rules.batterAdvanced===true,evidence:observed.evidence});
    cache.set(record,value);
   }
   assert(value.pitchId===pitchId(index)&&value.number===number,'issued pitch history reordered');
   return value;
  }
  function observe({records,pitchIndex,atTick,batterHeightMeters,selectedPitchId=null}){
   assert(Array.isArray(records)&&Number.isInteger(pitchIndex)&&Number.isSafeInteger(atTick)&&atTick>=0,'issued records, index and actual clock required');
   assert(Number.isFinite(batterHeightMeters)&&batterHeightMeters>0,'batter height required');
   const record=records[pitchIndex],pa=record?appearanceId(record):'live-pa-ready',eligible=[],locations=[];
   let number=0;
   // Available time is checked before deriving a location or reading result
   // details. Future pitches and other appearances are never chart inputs.
   if(record)for(let index=0;index<records.length;index++){
    const other=records[index];if(appearanceId(other)!==pa)continue;number++;
    if(other.play.rules.endedAtTick>atTick)continue;
    const value=entry(other,index,number);eligible.push(value);locations.push(Object.freeze({pitchId:value.pitchId,index,...value.evidence}));
   }
   const entries=history.select({plateAppearanceId:pa,atMicros:atTick,records:eligible}).entries;
   const selected=entries.find(value=>value.pitchId===selectedPitchId)??entries.at(-1)??null;
   const currentNumber=record?records.slice(0,pitchIndex+1).filter(value=>appearanceId(value)===pa).length:1;
   return Object.freeze({history:entries,selectedPitchId:selected?.pitchId??null,number:currentNumber,
    zone:Object.freeze({halfWidth:.2159,lowerY:batterHeightMeters*.270,upperY:batterHeightMeters*.535}),
    batterHeightMeters,locations:Object.freeze(locations),atTick,plateAppearanceId:pa});
  }
  // Shape, color, numbering, grid, clipping, overlap and caption are the
  // approved v27/v31 drawChart, using only the observed entries above.
  function draw(observation){
   current=observation;
   const c=canvas,ctx=c.getContext('2d'),h=observation.batterHeightMeters;
   const project=p=>({x:160+p.x*290,y:286-p.y*204});
   ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,320,304);ctx.fillStyle='#0c0e0b';ctx.fillRect(0,0,320,304);
   const a=project({x:-.2159,y:h*.535}),b=project({x:.2159,y:h*.270}),w=b.x-a.x,hh=b.y-a.y;
   ctx.fillStyle='#171c13';ctx.fillRect(a.x,a.y,w,hh);ctx.strokeStyle='#566047';ctx.lineWidth=1;
   for(let i=1;i<3;i++){ctx.beginPath();ctx.moveTo(a.x+w*i/3,a.y);ctx.lineTo(a.x+w*i/3,b.y);ctx.moveTo(a.x,a.y+hh*i/3);ctx.lineTo(b.x,a.y+hh*i/3);ctx.stroke();}
   ctx.strokeStyle='#e0b541';ctx.lineWidth=1.5;ctx.strokeRect(a.x,a.y,w,hh);
   ctx.fillStyle='#9ca68f';ctx.font='11px "Kneekura JP", sans-serif';ctx.textAlign='center';ctx.fillText('高め',160,a.y-24);ctx.fillText('低め',160,b.y+45);
   ctx.fillStyle='#a0aa94';ctx.beginPath();ctx.moveTo(151,268);ctx.lineTo(169,268);ctx.lineTo(169,275);ctx.lineTo(160,282);ctx.lineTo(151,275);ctx.closePath();ctx.fill();
   const entries=observation.history,selected=entries.find(e=>e.pitchId===observation.selectedPitchId)||entries.at(-1),chosen=selected?.location&&project(selected.location.position);chartMarks=[];
   for(const e of [...entries.filter(e=>e!==selected),...(selected?[selected]:[])]){
    if(!e.location)continue;const p=project(e.location.position);if(p.x<18||p.x>302||p.y<20||p.y>263)continue;
    if(e!==selected&&chosen&&Math.hypot(chosen.x-p.x,chosen.y-p.y)<27)continue;
    const mark=symbols.draw(ctx,e,project,{radius:14,selected:e===selected,alpha:e===selected?1:.7});if(mark)chartMarks.push(mark);
   }
   if(!entries.length){ctx.fillStyle='#9da591';ctx.textAlign='center';ctx.font='12px "Kneekura JP", sans-serif';ctx.fillText('投球後に記号を表示',160,232);}
   caption.textContent=selected?selected.number+'球目 · '+selected.pitchType+(selected.location?.kind==='contact'?' · 接触位置':''): 'この打席の配球';
   c.setAttribute('aria-label',entries.length?entries.map(e=>e.number+'球目 '+e.pitchType+' '+e.resultLabel).join('、'):'この打席の投球はまだありません');
   return inspect();
  }
  function symbolSvg(kind,angle=0,bars=0){const shape=kind==='circle'?'<circle cx="18" cy="16" r="10"/>':kind==='diamond'?'<path d="M18 5 29 16 18 27 7 16Z"/>':'<path d="M30 16 9 5 9 27Z" transform="rotate('+angle+' 18 16)"/>';return '<svg width="36" height="34" viewBox="0 0 36 34" fill="none" stroke="#dfbc61" stroke-width="1.5" aria-hidden="true">'+shape+Array.from({length:bars},(_,i)=>'<path d="M12 '+(29+i*3)+'H24"/>').join('')+'</svg>';}
  if(legend){
   const legends=[['circle',0,0,'直球'],['triangle',0,0,'スライダー：横方向'],['triangle',45,0,'カーブ：斜め下方向'],['triangle',90,0,'フォーク：下方向'],['circle',0,1,'チェンジアップ'],['triangle',0,1,'カットボール'],['triangle',180,2,'ツーシーム'],['diamond',0,0,'分類・方向が未提供']];
   legend.innerHTML=legends.map(([s,a,b,label])=>'<div class="legend-row">'+symbolSvg(s,a,b)+'<span>'+label+'</span></div>').join('');
  }
  canvas.onclick=event=>{
   const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)*320/rect.width,y=(event.clientY-rect.top)*304/rect.height;
   const mark=[...chartMarks].reverse().find(p=>Math.hypot(p.x-x,p.y-y)<p.r+9);
   if(mark&&typeof onSelect==='function')onSelect(Object.freeze({index:Number(mark.pitchId.slice('live-pitch-'.length)),pitchId:mark.pitchId}));
  };
  function inspect(){return {history:current?.history??[],selectedPitchId:current?.selectedPitchId??null,chartMarks:[...chartMarks],
   locations:current?.locations??[],zone:current?.zone??null};}
  return Object.freeze({observe,draw,inspect});
 }
 root.KneekuraLivePitchChart=Object.freeze({version:1,create,pitchId});
})(typeof globalThis==='object'?globalThis:this);
