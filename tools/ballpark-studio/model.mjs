import {defaultNiikuraScoreboard} from './niikura-scoreboard.mjs';
import {validateCameraViews} from './camera-presets.mjs';
import {niikuraFoulNodes} from './niikura-infield.mjs';
import {realParkFoulNodes} from './real-park-infield.mjs';
import {paypayFoulNodes} from './paypay-field.mjs';
import {defaultFieldDiagram} from './scoreboard-field.mjs';
// Design-space geometry. Not an admission adapter for the circular Match Core.
import {russianArchitecture,validateArchitecture} from './architecture.mjs';
import {koshienFoulNodes,KOSHIEN_BACKSTOP_METERS} from './koshien-home.mjs';
export const SCHEMA = 'kneekura_ballpark_design_v2';
export const LEGACY_SCHEMA = 'kneekura_ballpark_design_v1';
export const RULES_URL = 'https://mktg.mlbstatic.com/mlb/official-information/2026-official-baseball-rules.pdf';
const freeze = o => {if (o && typeof o === 'object') {Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
export const FIXED = freeze({id: 'professional_fixed_diamond_v1', baseDistanceMeters: 27.432,
  pitcherPlateFrontMeters: 18.4404, pitcherPlateHeightMeters: .254, foulAngleDegrees: 90,
  baseSideMeters: .4572, homePlateWidthMeters: .4318});
export const ANCHORS = freeze([{id:'LF',angleDegrees:-45,label:'左翼'},{id:'LCF',angleDegrees:-22.5,label:'左中間'},
  {id:'CF',angleDegrees:0,label:'中堅'},{id:'RCF',angleDegrees:22.5,label:'右中間'},{id:'RF',angleDegrees:45,label:'右翼'}]);
export const LIMITS = freeze({distanceMin:76.2,distanceMax:220,heightMax:30,maximumPoints:65});
const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
const clone = v => structuredClone(v), circle = freeze({center:{x:0,z:37.5},radiusMeters:72.5,heightMeters:3});
function circleAt(theta) {
  const along=circle.center.x*Math.sin(theta)+circle.center.z*Math.cos(theta);
  return along+Math.sqrt(along*along+circle.radiusMeters*circle.radiusMeters-circle.center.x*circle.center.x-circle.center.z*circle.center.z);
}
export function referenceDesign() {return {schema:SCHEMA,name:'現行球場',mode:'reference_circle',ruleset:'obr_general_2026',
  fencePoints:ANCHORS.map(a=>({id:a.id,angleDegrees:a.angleDegrees,distanceMeters:circleAt(rad(a.angleDegrees)),heightMeters:3})),
  foul:{firstSideMeters:circleAt(Math.PI/2),thirdSideMeters:circleAt(-Math.PI/2),backstopMeters:35,heightMeters:3},trackWidthMeters:3.5};}
export function symmetricDesign() {const d=referenceDesign();d.name='左右対称の寸法例';d.mode='editable';d.ruleset='mlb_new_2026';
  d.fencePoints.forEach((p,i)=>p.distanceMeters=[100,116,122,116,100][i]);return d;}
export function russianDomeDesign(){const d=symmetricDesign();d.name='赤・青・金の開閉式ドーム';d.architecture=russianArchitecture();
 d.foul={firstSideMeters:18.288,thirdSideMeters:18.288,backstopMeters:26,heightMeters:3};
 d.fencePoints=Array.from({length:17},(_,i)=>{const angleDegrees=-45+i*5.625,a=ANCHORS.find(a=>a.angleDegrees===angleDegrees);
  return {id:a?.id??'CURVE_'+i,angleDegrees,distanceMeters:105+23*Math.cos(rad(angleDegrees*2)),heightMeters:1.3};});
 return d;}

export function dodgerStadiumDesign(){const d=symmetricDesign();d.name='ドジャースタジアム';d.ruleset='obr_general_2026';
 d.architecture={...russianArchitecture(),style:'dodger_stadium',capacity:56000,tiers:5,
  colors:{red:'#d4e8ef',blue:'#2464a5',gold:'#f5f2df'},roof:{type:'open',openingPercent:100}};
 d.architecture.logo={...d.architecture.logo,enabled:false};d.architecture.crowd={...d.architecture.crowd,density:.1,brightness:.4,glow:.02};
 d.foul={firstSideMeters:24,thirdSideMeters:24,backstopMeters:23,heightMeters:1.2};d.trackWidthMeters=4.5;
 const distances=[330,385,395,385,330];
 d.fencePoints=Array.from({length:17},(_,i)=>{const angleDegrees=-45+i*5.625,a=ANCHORS.find(a=>a.angleDegrees===angleDegrees),u=i/4,j=Math.min(3,Math.floor(u)),f=u-j;
  return {id:a?.id??'DODGER_'+i,angleDegrees,distanceMeters:(distances[j]*(1-f)+distances[j+1]*f)*.3048,heightMeters:Math.abs(angleDegrees)>=39?1.397:2.4384};});return d;}

export function koshienDesign(){const d=symmetricDesign();d.name='阪神甲子園球場';d.ruleset='obr_general_2026';
 d.architecture={...russianArchitecture(),style:'koshien',capacity:47400,tiers:3,colors:{red:'#e2ddba',blue:'#b9bd9f',gold:'#efefe2'},roof:{type:'open',openingPercent:100}};
 d.architecture.logo={...d.architecture.logo,enabled:false};d.architecture.crowd={...d.architecture.crowd,density:.1,brightness:.35,glow:.02};
 d.architecture.scoreboard.teams[0].name='阪神';d.architecture.scoreboard.teams[1].name='巨人';d.foul={firstSideMeters:28,thirdSideMeters:28,backstopMeters:KOSHIEN_BACKSTOP_METERS,heightMeters:3};d.trackWidthMeters=3.5;
 const distances=[95,118,118,118,95];d.fencePoints=Array.from({length:17},(_,i)=>{const angleDegrees=-45+i*5.625,a=ANCHORS.find(a=>a.angleDegrees===angleDegrees),u=i/4,j=Math.min(3,Math.floor(u)),f=u-j;
  return{id:a?.id??'KOSHIEN_'+i,angleDegrees,distanceMeters:distances[j]*(1-f)+distances[j+1]*f,heightMeters:3};});return d;}

export function fukuokaDomeDesign(){const d=symmetricDesign();d.name='みずほPayPayドーム福岡';d.ruleset='obr_general_2026';
 d.architecture={...russianArchitecture(),style:'fukuoka_dome',capacity:39894,tiers:3,colors:{red:'#f0c43c',blue:'#ecebdb',gold:'#d8dcd2'},roof:{type:'retractable',openingPercent:0}};
 d.architecture.logo={...d.architecture.logo,enabled:false};d.architecture.crowd={...d.architecture.crowd,density:.65,brightness:.8,glow:.12};
 d.architecture.scoreboard.teams[0].name='HAWKS';d.architecture.scoreboard.teams[1].name='VISITOR';
 d.foul={firstSideMeters:32,thirdSideMeters:32,backstopMeters:20,heightMeters:1.2};d.trackWidthMeters=2;
 d.fencePoints=Array.from({length:17},(_,i)=>{const angleDegrees=-45+i*5.625,a=ANCHORS.find(a=>a.angleDegrees===angleDegrees),u=Math.abs(angleDegrees)/22.5,j=Math.min(1,Math.floor(u)),t=u-j,values=[122,110,100],slopes=[0,-11,-10],
  distanceMeters=(2*t**3-3*t*t+1)*values[j]+(t**3-2*t*t+t)*slopes[j]+(-2*t**3+3*t*t)*values[j+1]+(t**3-t*t)*slopes[j+1];return{id:a?.id??'PAYPAY_'+i,angleDegrees,distanceMeters,heightMeters:4.2};});return d;}

export function niikuraDomeDesign(){const d=symmetricDesign();d.name='にーくらドーム';d.ruleset='obr_general_2026';d.architecture={...russianArchitecture(),style:'niikura_dome',capacity:76000,tiers:2,colors:{red:'#12563c',blue:'#e8bf26',gold:'#e8e1ba'},roof:{type:'open',openingPercent:100}};
 d.architecture.logo={...d.architecture.logo,enabled:false};d.architecture.crowd={...d.architecture.crowd,density:1,brightness:.8,glow:.25};d.architecture.scoreboard={...d.architecture.scoreboard,teams:[{name:'KNEEKURA',innings:[0,1,0,2,null,null,null,null,null],hits:6,errors:0},{name:'VISITOR',innings:[1,0,1,0,null,null,null,null,null],hits:5,errors:1}],speedKmh:151,niikura:defaultNiikuraScoreboard(),fieldDiagram:defaultFieldDiagram()};
 const names={P:'佐藤',C:'森田','1B':'山崎','2B':'鈴木','3B':'田中',SS:'加藤',LF:'小川',CF:'中村',RF:'藤原'};d.architecture.scoreboard.fieldDiagram.defenders.forEach(p=>p.label=names[p.role]);d.architecture.scoreboard.fieldDiagram.runners={first:true,second:false,third:true};
 d.foul={firstSideMeters:12,thirdSideMeters:12,backstopMeters:8.2,heightMeters:1.2};d.trackWidthMeters=4;
 d.fencePoints=Array.from({length:17},(_,i)=>{const angleDegrees=-45+i*5.625,a=ANCHORS.find(a=>a.angleDegrees===angleDegrees);return{id:a?.id??'NIIKURA_'+i,angleDegrees,distanceMeters:94.5+47.5*Math.cos(rad(angleDegrees*2)),heightMeters:3};});return d;}

function inert(raw, depth=0) {
  if(depth>10)throw Error('JSONの階層が深すぎます');
  if(raw===null||['string','number','boolean'].includes(typeof raw))return raw;
  if(typeof raw!=='object')throw Error('JSONの値だけを使用してください');
  const array=Array.isArray(raw),proto=Object.getPrototypeOf(raw);
  if(!array&&proto!==Object.prototype&&proto!==null)throw Error('通常のJSONオブジェクトが必要です');
  const result=array?[]:{};
  for(const key of Reflect.ownKeys(raw)) {
    if(array&&key==='length')continue;
    const d=Object.getOwnPropertyDescriptor(raw,key);
    if(typeof key!=='string'||!d.enumerable||!('value' in d)||['__proto__','constructor','prototype'].includes(key))throw Error('特殊なプロパティは使用できません');
    result[key]=inert(d.value,depth+1);
  }
  return result;
}
const polar=(angleDegrees,distanceMeters)=>({x:angleDegrees===0||Math.abs(angleDegrees)===180?0:Math.sin(rad(angleDegrees))*distanceMeters,
  z:Math.abs(angleDegrees)===90?0:Math.cos(rad(angleDegrees))*distanceMeters});
const cross=(a,b)=>a.x*b.z-a.z*b.x;
export function segmentMinimumDistance(a,b) {const dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz,
  t=den?Math.max(0,Math.min(1,-(a.x*dx+a.z*dz)/den)):0;return Math.hypot(a.x+t*dx,a.z+t*dz);}
function compile(d) {
  const points=[...d.fencePoints].sort((a,b)=>a.angleDegrees-b.angleDegrees),
    nodes=[{id:'BACK',angleDegrees:-180,distanceMeters:d.foul.backstopMeters,heightMeters:d.foul.heightMeters},
      {id:'THIRD_SIDE',angleDegrees:-90,distanceMeters:d.foul.thirdSideMeters,heightMeters:d.foul.heightMeters},...points,
      {id:'FIRST_SIDE',angleDegrees:90,distanceMeters:d.foul.firstSideMeters,heightMeters:d.foul.heightMeters},
      {id:'BACK',angleDegrees:180,distanceMeters:d.foul.backstopMeters,heightMeters:d.foul.heightMeters}],
    boundary=d.architecture?.style==='fukuoka_dome'?[...paypayFoulNodes(d.foul,points),...points].sort((a,b)=>a.angleDegrees-b.angleDegrees):d.architecture?.style==='niikura_dome'?[...niikuraFoulNodes(d),...points].sort((a,b)=>a.angleDegrees-b.angleDegrees):d.architecture?.style==='dodger_stadium'?[...realParkFoulNodes(d.foul,points),...points].sort((a,b)=>a.angleDegrees-b.angleDegrees):d.architecture?.style==='koshien'?[...koshienFoulNodes(d.foul,points),...points].sort((a,b)=>a.angleDegrees-b.angleDegrees):nodes,
    vertices=boundary.map(p=>({...p,...polar(p.angleDegrees,p.distanceMeters)}));
  return freeze({version:1,kind:d.mode,fixedLayoutId:FIXED.id,circle,vertices,architecture:d.architecture??null,
    boundaryKey:JSON.stringify([d.mode,d.fencePoints,d.foul,d.trackWidthMeters,...(d.architecture?.style==='fukuoka_dome'?['paypay-field-profile-v1']:d.architecture?.style==='niikura_dome'?['niikura-close-rounded-foul-v1']:d.architecture?.style==='koshien'?['koshien-rounded-foul-v2']:d.architecture?.style==='dodger_stadium'?['dodger-rounded-foul-v1']:[])]),
    surfaceKey:JSON.stringify(d.architecture?.style==='fukuoka_dome'?[d.architecture.details?.logos!==false,'paypay-ground-ads-v1']:d.architecture?.style==='koshien'?[d.architecture.logo??null,d.architecture.surfaceDetail??null,'koshien']:d.architecture?.style==='dodger_stadium'?[d.architecture.logo??null,d.architecture.surfaceDetail??null,d.architecture.style,d.architecture.details?.logos!==false]:[d.architecture?.logo??null,d.architecture?.surfaceDetail??null]),
    fencePoints:points.map(p=>({...p,...polar(p.angleDegrees,p.distanceMeters)})),
    maximumHeightMeters:Math.max(d.foul.heightMeters,...points.map(p=>p.heightMeters)),trackWidthMeters:d.trackWidthMeters});
}
export function wallAt(g,theta) {
  const angle=((deg(theta)+180)%360+360)%360-180;
  if(g.kind==='reference_circle') {const distance=circleAt(theta);return {angleDegrees:angle,distanceMeters:distance,heightMeters:3,position:polar(deg(theta),distance),segmentIndex:null};}
  const v=g.vertices;let lo=0,hi=v.length-2;
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(v[mid].angleDegrees<=angle)lo=mid;else hi=mid-1;}
  const a=v[lo],b=v[lo+1],direction={x:Math.sin(rad(angle)),z:Math.cos(rad(angle))},edge={x:b.x-a.x,z:b.z-a.z},den=cross(direction,edge),
    distance=cross(a,edge)/den,position={x:direction.x*distance,z:direction.z*distance},length2=edge.x*edge.x+edge.z*edge.z,
    t=Math.max(0,Math.min(1,((position.x-a.x)*edge.x+(position.z-a.z)*edge.z)/length2));
  return {angleDegrees:angle,distanceMeters:distance,heightMeters:a.heightMeters+(b.heightMeters-a.heightMeters)*t,position,segmentIndex:lo};
}
export function validateDesign(raw) {
  const errors=[],warnings=[],error=(path,message)=>errors.push({path,message});let d;
  try{d=inert(raw);}catch(e){return {ok:false,errors:[{path:'json',message:e.message}],warnings,geometry:null};}
  const fields=(o,allowed,path)=>{if(!o||typeof o!=='object'||Array.isArray(o)){error(path,'オブジェクトを指定してください');return false;}
    for(const k of Object.keys(o))if(!allowed.includes(k))error(path?path+'.'+k:k,'この項目は編集できません。塁・白線・投手板は共通固定です');return true;},
    number=(n,min,max,path)=>{if(typeof n!=='number'||!Number.isFinite(n)){error(path,'数値を入力してください');return false;}
      if(n<min||n>max){error(path,`${min}〜${max}の範囲で入力してください`);return false;}return true;};
  if(!fields(d,['schema','name','mode','ruleset','fencePoints','foul','trackWidthMeters','architecture','cameraViews'],''))return {ok:false,errors,warnings,geometry:null};
  if(d.cameraViews!==undefined)validateCameraViews(d.cameraViews,error);
  if(![SCHEMA,LEGACY_SCHEMA].includes(d.schema))error('schema','球場設計室v1/v2のJSONではありません');
  if(d.architecture!==undefined){if(d.schema===LEGACY_SCHEMA)error('schema','建築設定を含める場合はv2のschemaを指定してください');validateArchitecture(d.architecture,error);}
  if(typeof d.name!=='string'||!d.name.trim()||d.name.length>80)error('name','球場名を1〜80文字で入力してください');
  if(!['reference_circle','editable'].includes(d.mode))error('mode','形状は reference_circle または editable です');
  if(!['obr_general_2026','mlb_new_2026'].includes(d.ruleset))error('ruleset','確認する規則を選んでください');
  number(d.trackWidthMeters,0,12,'trackWidthMeters');
  if(fields(d.foul,['firstSideMeters','thirdSideMeters','backstopMeters','heightMeters'],'foul')){
    const sideMin=d.architecture?.style==='niikura_dome'?8:18.288;
    number(d.foul.firstSideMeters,sideMin,180,'foul.firstSideMeters');number(d.foul.thirdSideMeters,sideMin,180,'foul.thirdSideMeters');
    if(sideMin===8&&(d.foul.firstSideMeters<18.288||d.foul.thirdSideMeters<18.288))warnings.push('にーくらドームの内野席を近づけた設計です。ファウル側の距離は一般規則の推奨値18.288mより短い設定です。');
    number(d.foul.backstopMeters,8,100,'foul.backstopMeters');number(d.foul.heightMeters,0,LIMITS.heightMax,'foul.heightMeters');
    if(d.foul.backstopMeters<18.288)warnings.push('バックネットまで18.288m以上という推奨値を下回ります（OBR2.01）。');
  }
  if(!Array.isArray(d.fencePoints)||d.fencePoints.length<5||d.fencePoints.length>LIMITS.maximumPoints)error('fencePoints','外野の点は5〜65個にしてください');
  else {
    const ids=new Set(),angles=[];
    d.fencePoints.forEach((p,i)=>{const path='fencePoints.'+i;
      if(!fields(p,['id','angleDegrees','distanceMeters','heightMeters'],path))return;
      if(typeof p.id!=='string'||!/^[_a-zA-Z][_a-zA-Z0-9-]{0,47}$/.test(p.id)||ids.has(p.id))error(path+'.id','点のIDは重複しない英数字にしてください');ids.add(p.id);
      number(p.angleDegrees,-45,45,path+'.angleDegrees');number(p.distanceMeters,76.2,LIMITS.distanceMax,path+'.distanceMeters');number(p.heightMeters,0,LIMITS.heightMax,path+'.heightMeters');angles.push(p.angleDegrees);
    });
    for(const a of ANCHORS){const found=d.fencePoints.find(p=>p?.id===a.id);if(!found||found.angleDegrees!==a.angleDegrees)error('fencePoints',a.label+'の角度と基準点は固定です');}
    angles.sort((a,b)=>a-b);if(angles.some((a,i)=>i>0&&a-angles[i-1]<.001))error('fencePoints','点の角度は0.001度以上離してください');
  }
  if(d.mode==='reference_circle') {const reference=referenceDesign();
    for(const k of ['fencePoints','foul','trackWidthMeters'])if(JSON.stringify(d[k])!==JSON.stringify(reference[k]))error(k,'現行球場は基準専用です。形状を編集する場合は mode を editable にしてください');}
  if(errors.length)return {ok:false,errors,warnings,geometry:null};
  const g=compile(d),point=id=>d.fencePoints.find(p=>p.id===id),fairMin=g.kind==='reference_circle'?Math.min(circleAt(-Math.PI/4),circleAt(Math.PI/4)):
    Math.min(...g.fencePoints.slice(1).map((p,i)=>segmentMinimumDistance(g.fencePoints[i],p)));
  if(fairMin<76.2-1e-9)error('fencePoints','点と点の間のフェンスが本塁から76.2m未満です。浅い角を外へ広げてください');
  if(d.ruleset==='mlb_new_2026'){
    for(const id of ['LF','RF'])if(point(id).distanceMeters<99.06)error('fencePoints.'+d.fencePoints.indexOf(point(id))+'.distanceMeters','MLB新設基準では両翼99.06m以上が必要です');
    if(point('CF').distanceMeters<121.92)error('fencePoints.'+d.fencePoints.indexOf(point('CF'))+'.distanceMeters','MLB新設基準では中堅121.92m以上が必要です');
  } else {
    if(point('LF').distanceMeters<97.536||point('RF').distanceMeters<97.536)warnings.push('両翼97.536m以上という一般規則の推奨値を下回ります。');
    if(point('CF').distanceMeters<121.92)warnings.push('中堅121.92m以上という推奨値を下回ります。');
  }
  return {ok:errors.length===0,errors,warnings,geometry:errors.length?null:g,design:d,fairMinimumDistanceMeters:fairMin};
}
export function outline(g,steps=128) {if(g.kind!=='reference_circle')return g.vertices.map(p=>({x:p.x,z:p.z}));
  return Array.from({length:steps+1},(_,i)=>wallAt(g,-Math.PI+i*2*Math.PI/steps).position);}
export function editableCopy(d) {return {...clone(d),schema:SCHEMA,mode:'editable'};}
export function inspection(d) {const v=validateDesign(d);return {...v,fixed:FIXED,simulationIntegration:'DESIGN_ONLY_NOT_MATCH_CORE_ADMITTED',
  measurements:v.ok?ANCHORS.map(a=>({id:a.id,label:a.label,...wallAt(v.geometry,rad(a.angleDegrees))})):[],source:RULES_URL};}
