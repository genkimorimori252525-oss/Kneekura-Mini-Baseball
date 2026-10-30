import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';
import { SeedRoot } from '../../core/rng/SeedRoot';
import { multiplyQuaternions, type Quaternion } from '../../core/sim/pitching/BaseballOrientation';
import { validateBaseballSeamForceV1, type BaseballSeamForceV1 } from '../../core/sim/ball/BaseballSeamForceV1';
import { resolvePitcherRepertoireV77, type PitchRepertoireV77 } from './LivePitchAuthoringV77';

export const LIVE_PITCH_TYPES_V78 = ['fastball', 'sinker', 'cutter', 'changeup', 'splitter', 'forkball', 'screwball', 'curve',
  'knuckle_curve', 'slow_curve', 'slider', 'sweeper', 'slurve', 'knuckleball', 'eephus'] as const;
export type LivePitchTypeV78 = typeof LIVE_PITCH_TYPES_V78[number];
export type PitchPhysicalSettingsV78 = Readonly<{ releaseSpeedMps: number; spinRadPerSecond: Vec3;
  releaseOrientation?: Quaternion; seamForce?: BaseballSeamForceV1 }>;
export type PitchSnapshotV78 = PitchPhysicalSettingsV78 & Readonly<{ pitchId: string; name: string; pitchType: LivePitchTypeV78;
  source: Readonly<{ kind: 'preset' | 'original'; id: string; revision: number }> }>;
export type PitchRepertoireV78 = Readonly<{ version: 'pitch_repertoire_v78'; pitches: readonly PitchSnapshotV78[] }>;
export type PitchLibraryRecordV78 = PitchPhysicalSettingsV78 & Readonly<{ originalId: string; revision: number; name: string; pitchType: LivePitchTypeV78 }>;
export type PitchLibraryV78 = Readonly<{ version: 'pitch_library_v78'; records: readonly PitchLibraryRecordV78[] }>;
export type PitchAuthoringPhysicalV78 = Readonly<{ releaseSpeedMps: number; spinRadPerSecond: Vec3; maximumPitchSpeedMps?: number;
  pitchRepertoire?: PitchRepertoireV77; pitchRepertoireV78?: PitchRepertoireV78; minimumSpinRatio?: number }>;
type Preset = Readonly<{ presetId: string; name: string; pitchType: LivePitchTypeV78; speedFactor: number; spinScale: number;
  spinAxis?: Vec3; sourceUrl: string; scope: string; releaseOrientation: Quaternion; seamForce: BaseballSeamForceV1 }>;
const sourceUrl = 'https://www.mlb.com/glossary/pitch-types';
const scope = 'AUTHORED_QUASI_STEADY_SEAM_EXAMPLE_NOT_MEASURED_PLAYER_DATA';
const definitions = [
  ['fastball', 'フォーシーム', 1, 1, null], ['sinker', 'シンカー', .96, 1, [.55,.5,.2]], ['cutter', 'カットボール', .95, 1, [.7,-.45,.25]],
  ['changeup', 'チェンジアップ', .82, .7, [.65,.2,.25]], ['splitter', 'スプリット', .89, 1, [-.15,.15,.3]],
  ['forkball', 'フォーク', .85, .45, [-.1,.1,.3]], ['screwball', 'スクリューボール', .8, 1, [.1,.8,.2]],
  ['curve', 'カーブ', .8, 1, [-1,0,.1]], ['knuckle_curve', 'ナックルカーブ', .82, 1, [-1,-.15,.1]],
  ['slow_curve', 'スローカーブ', .65, .8, [-1,0,.1]], ['slider', 'スライダー', .91, 1, [.25,-.8,.55]],
  ['sweeper', 'スイーパー', .86, 1, [.1,-1,.15]], ['slurve', 'スラーブ', .83, 1, [-.6,-.8,.15]],
  ['knuckleball', 'ナックル', .68, .02, [1,0,0]], ['eephus', 'イーファス', .35, .15, [-1,0,0]],
] as const;
const presets: readonly Preset[] = definitions.map(([id,name,speedFactor,spinScale,axis]) => ({ presetId:id, name, pitchType:id,
  speedFactor, spinScale, ...(axis ? { spinAxis:{x:axis[0],y:axis[1],z:axis[2]} } : {}), sourceUrl, scope,
  releaseOrientation: id === 'sinker' ? {w:Math.cos(Math.PI/8),x:0,y:0,z:Math.sin(Math.PI/8)} : {w:1,x:0,y:0,z:0},
  seamForce:{version:'baseball_seam_force_v1',coefficientScale:1} }));
const variants = [
  ['two_seam','ツーシーム','sinker'], ['shuto','シュート','sinker'], ['sff','SFF','splitter'], ['circle_change','サークルチェンジ','changeup'],
  ['split_change','スプリットチェンジ','splitter'], ['vertical_slider','縦スライダー','slider'], ['gyro_slider','ジャイロスライダー','slider'],
  ['hard_slider','高速スライダー','slider'], ['vertical_curve','縦カーブ','curve'],
] as const;
const freeze = <T>(value:T):T => { if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value; };
const catalog = freeze({ version:'pitch_catalog_v78' as const, types:definitions.map(([pitchType,name])=>({pitchType,name,sourceUrl,scope})),
  presets:[...presets,...variants.map(([presetId,name,type])=>({...presets.find(p=>p.pitchType===type)!,presetId,name,
    ...(presetId==='gyro_slider'?{spinAxis:{x:.1,y:-.15,z:1}}:{}),...(presetId==='vertical_slider'?{spinAxis:{x:-.8,y:-.3,z:.25}}:{}),
    ...(presetId==='hard_slider'?{speedFactor:.96}:{}),...(presetId==='vertical_curve'?{spinAxis:{x:-1,y:0,z:0}}:{})}))] });
export const getLivePitchCatalogV78 = () => catalog;
function assert(value:unknown,message:string):asserts value {if(!value)throw Error('pitch authoring v78: '+message);}
const bounded=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const validId=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,95}$/.test(v);
const validName=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=80&&v.trim()===v&&!/[\u0000-\u001f\u007f]/.test(v);
function fields(raw:unknown,required:readonly string[],optional:readonly string[]=[]):asserts raw is Record<string,unknown>{
  assert(raw&&typeof raw==='object'&&!Array.isArray(raw)&&required.every(k=>Object.hasOwn(raw,k))&&Object.keys(raw).every(k=>required.includes(k)||optional.includes(k)),'unknown or missing fields');
}
const physicalRequired=['releaseSpeedMps','spinRadPerSecond'],physicalOptional=['releaseOrientation','seamForce'];
function physical(raw:Record<string,unknown>,maximumPitchSpeedMps?:number){
  assert(maximumPitchSpeedMps===undefined||bounded(maximumPitchSpeedMps,15,85),'invalid maximum pitch speed');
  assert(bounded(raw.releaseSpeedMps,5,85)&&raw.releaseSpeedMps<=(maximumPitchSpeedMps??85),'invalid V78 pitch speed or individual limit');
  fields(raw.spinRadPerSecond,['x','y','z']); const spin=raw.spinRadPerSecond;
  assert(Object.values(spin).every(v=>typeof v==='number'&&Number.isFinite(v))&&Math.hypot(spin.x as number,spin.y as number,spin.z as number)<=1200,'invalid spin vector');
  if(Object.hasOwn(raw,'releaseOrientation')){
    fields(raw.releaseOrientation,['w','x','y','z']); const q=raw.releaseOrientation;
    assert(Object.values(q).every(v=>bounded(v,-1,1))&&Math.abs(Math.hypot(q.w as number,q.x as number,q.y as number,q.z as number)-1)<=1e-8,'unit material orientation required');
  }
  if(Object.hasOwn(raw,'seamForce')){const seam=validateBaseballSeamForceV1(raw.seamForce);assert(seam.coefficientScale===0||raw.releaseOrientation!==undefined,'seam force requires an explicit material orientation');}
}
function classified(raw:Record<string,unknown>){assert(validName(raw.name)&&(LIVE_PITCH_TYPES_V78 as readonly unknown[]).includes(raw.pitchType),'invalid name or pitch classification');}
export function validatePitchSnapshotV78(raw:unknown,maximumPitchSpeedMps?:number):PitchSnapshotV78{
  const row=cloneInert(raw);fields(row,['pitchId','name','pitchType','source',...physicalRequired],physicalOptional);classified(row);physical(row,maximumPitchSpeedMps);
  assert(validId(row.pitchId),'invalid stable pitch ID');fields(row.source,['kind','id','revision']);
  assert(['preset','original'].includes(row.source.kind as string)&&validId(row.source.id)&&Number.isSafeInteger(row.source.revision)&&bounded(row.source.revision,1,1_000_000),'invalid source provenance');
  const provenance=row.source;
  if(provenance.kind==='preset')assert(catalog.presets.some(p=>p.presetId===provenance.id)&&provenance.revision===1,'unknown preset provenance');
  return freeze(row as unknown as PitchSnapshotV78);
}
export function validatePitchRepertoireV78(raw:unknown,maximumPitchSpeedMps?:number):PitchRepertoireV78{
  const value=cloneInert(raw);fields(value,['version','pitches']);assert(value.version==='pitch_repertoire_v78'&&Array.isArray(value.pitches)&&value.pitches.length>=1&&value.pitches.length<=32,'one to 32 owned pitches required');
  const seen=new Set<string>();for(const row of value.pitches){const pitch=validatePitchSnapshotV78(row,maximumPitchSpeedMps);assert(!seen.has(pitch.pitchId),'duplicate stable pitch ID');seen.add(pitch.pitchId);}
  return freeze(value as unknown as PitchRepertoireV78);
}
export function validatePitchLibraryV78(raw:unknown):PitchLibraryV78{
  const value=cloneInert(raw);fields(value,['version','records']);assert(value.version==='pitch_library_v78'&&Array.isArray(value.records)&&value.records.length<=1024,'bounded pitch library required');
  const seen=new Map<string,Set<number>>();for(const row of value.records){fields(row,['originalId','revision','name','pitchType',...physicalRequired],physicalOptional);classified(row);physical(row);
    assert(validId(row.originalId)&&Number.isSafeInteger(row.revision)&&bounded(row.revision,1,1_000_000),'invalid original ID or revision');
    const versions=seen.get(row.originalId)??new Set<number>();assert(!versions.has(row.revision),'duplicate immutable revision');versions.add(row.revision);seen.set(row.originalId,versions);}
  for(const versions of seen.values())assert([...versions].every(v=>v<=versions.size),'revision history must start at one without gaps');
  return freeze(value as unknown as PitchLibraryV78);
}
export function appendPitchLibraryRevisionV78(raw:Readonly<{library:PitchLibraryV78;originalId:string;name:string;pitchType:LivePitchTypeV78}> & PitchPhysicalSettingsV78){
  const request=cloneInert(raw);fields(request,['library','originalId','name','pitchType',...physicalRequired],physicalOptional);
  const library=validatePitchLibraryV78(request.library),{library:_prior,...draft}=request,
    revision=1+library.records.filter(r=>r.originalId===request.originalId).reduce((n,r)=>Math.max(n,r.revision),0),record={...draft,revision};
  const next=validatePitchLibraryV78({version:'pitch_library_v78',records:[...library.records,record]});
  return freeze({library:next,record:next.records.at(-1)!});
}
export function createPitchSnapshotFromLibraryV78(raw:Readonly<{library:PitchLibraryV78;originalId:string;revision:number;pitchId:string}>):PitchSnapshotV78{
  const request=cloneInert(raw);fields(request,['library','originalId','revision','pitchId']);const library=validatePitchLibraryV78(request.library),
    row=library.records.find(r=>r.originalId===request.originalId&&r.revision===request.revision);assert(row,'unknown original pitch revision');
  const{originalId,revision,...settings}=row;return validatePitchSnapshotV78({...settings,pitchId:request.pitchId,source:{kind:'original',id:originalId,revision}});
}
export function createPitchSnapshotFromPresetV78(raw:Readonly<{presetId:string;pitchId:string;physical:PitchAuthoringPhysicalV78;throws?:'R'|'L'}>):PitchSnapshotV78{
  const request=cloneInert(raw);fields(request,['presetId','pitchId','physical'],['throws']);const preset=catalog.presets.find(p=>p.presetId===request.presetId);assert(preset,'unknown pitch preset');
  assert(request.throws===undefined||request.throws==='R'||request.throws==='L','invalid throwing side');
  const p=request.physical,baseline=resolvePitcherRepertoireV77({releaseSpeedMps:p.releaseSpeedMps,spinRadPerSecond:p.spinRadPerSecond,
    ...(p.maximumPitchSpeedMps===undefined?{}:{maximumPitchSpeedMps:p.maximumPitchSpeedMps})}).find(row=>row.pitchType==='fastball')!,
    axis=preset.spinAxis??p.spinRadPerSecond,length=Math.hypot(axis.x,axis.y,axis.z),magnitude=Math.hypot(p.spinRadPerSecond.x,p.spinRadPerSecond.y,p.spinRadPerSecond.z),
    rightSpin={x:axis.x/(length||1)*magnitude*preset.spinScale,y:axis.y/(length||1)*magnitude*preset.spinScale,z:axis.z/(length||1)*magnitude*preset.spinScale},
    q=preset.releaseOrientation,left=request.throws==='L',
    // Axial spin reflects as det(S)*S*omega. The authored seam curve is
    // invariant under body x/y exchange B, so its proper mirrored rotation
    // is S*R*B = (S*R*S)*Rz(pi/2), rather than S*R*S alone.
    orientation=left?multiplyQuaternions({w:q.w,x:q.x,y:-q.y,z:-q.z},{w:Math.SQRT1_2,x:0,y:0,z:Math.SQRT1_2}):q,
    settings={releaseSpeedMps:baseline.releaseSpeedMps*preset.speedFactor,
      spinRadPerSecond:left?{x:rightSpin.x,y:-rightSpin.y,z:-rightSpin.z}:rightSpin};
  return validatePitchSnapshotV78({pitchId:request.pitchId,name:preset.name,pitchType:preset.pitchType,...settings,
    releaseOrientation:orientation,seamForce:preset.seamForce,source:{kind:'preset',id:preset.presetId,revision:1}},p.maximumPitchSpeedMps);
}
export function migratePitchRepertoireV77ToV78(physical:PitchAuthoringPhysicalV78):PitchRepertoireV78{
  const p=cloneInert(physical);assert(p.pitchRepertoireV78===undefined,'V78 repertoire is already authored');
  return validatePitchRepertoireV78({version:'pitch_repertoire_v78',pitches:resolvePitcherRepertoireV77(p).map(row=>({
    pitchId:row.pitchType,name:catalog.types.find(t=>t.pitchType===row.pitchType)!.name,pitchType:row.pitchType,
    releaseSpeedMps:row.releaseSpeedMps,spinRadPerSecond:row.spinRadPerSecond,source:{kind:'preset',id:row.pitchType,revision:1}}))},p.maximumPitchSpeedMps);
}
export function resolvePitcherRepertoireV78(physical:PitchAuthoringPhysicalV78):readonly(PitchSnapshotV78&Readonly<{authored:boolean}>)[]{
  const p=cloneInert(physical);assert(!(p.pitchRepertoire&&p.pitchRepertoireV78),'ambiguous V77 and V78 pitch ownership');
  if(p.pitchRepertoireV78)return freeze(validatePitchRepertoireV78(p.pitchRepertoireV78,p.maximumPitchSpeedMps).pitches.map(row=>({...row,authored:true})));
  const migrated=migratePitchRepertoireV77ToV78(p);return freeze(migrated.pitches.map(row=>({...row,authored:p.pitchRepertoire?.some(r=>r.pitchType===row.pitchType)??false})));
}
export function samplePitchSpinExecutionV78(raw:Readonly<{seed:number;nominalSpin:Vec3;minimumSpinRatio?:number}>){
  const request=cloneInert(raw);fields(request,['seed','nominalSpin'],['minimumSpinRatio']);
  assert(Number.isSafeInteger(request.seed)&&bounded(request.seed,0,0xffffffff),'invalid spin execution seed');
  fields(request.nominalSpin,['x','y','z']);assert(Object.values(request.nominalSpin).every(Number.isFinite)&&Math.hypot(request.nominalSpin.x,request.nominalSpin.y,request.nominalSpin.z)<=1200,'invalid nominal spin');
  const minimum=request.minimumSpinRatio??1;assert(bounded(minimum,0,1),'invalid minimum spin ratio');
  if(minimum===1||Math.hypot(request.nominalSpin.x,request.nominalSpin.y,request.nominalSpin.z)===0)return Object.freeze({active:false,ratio:1,minimumSpinRatio:minimum,spin:raw.nominalSpin});
  const draw=new SeedRoot(request.seed).streamRng(0,'pitch','spin-reproduction-v1').nextFloat(),ratio=minimum+(1-minimum)*draw;
  return freeze({active:true,ratio,minimumSpinRatio:minimum,spin:{x:request.nominalSpin.x*ratio,y:request.nominalSpin.y*ratio,z:request.nominalSpin.z*ratio}});
}
