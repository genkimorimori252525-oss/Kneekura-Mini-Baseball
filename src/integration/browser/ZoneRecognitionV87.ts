import {cloneInert} from '../../core/adjudication/OfficialWindowPolicy';
import {SeedRoot} from '../../core/rng/SeedRoot';
import {classifyBatterCourseV79,type BatterCourseZoneV79} from './BatterCourseProfileV79';

export type ZoneRecognitionRoleV87='batter'|'pitcher'|'catcher';
export type ZoneRecognitionCellV87=Readonly<{biasXM:number;biasYM:number;uncertaintyScale:number;targetWeight:number}>;
export type ZoneRecognitionV87=Readonly<{version:'zone_recognition_v87';batter?:Readonly<{cells:readonly ZoneRecognitionCellV87[]}>;pitcher?:Readonly<{cells:readonly ZoneRecognitionCellV87[]}>;catcher?:Readonly<{cells:readonly ZoneRecognitionCellV87[]}>}>;
type Position=Readonly<{x:number;y:number}>;
const roles:readonly ZoneRecognitionRoleV87[]=['batter','pitcher','catcher'];
const neutral:ZoneRecognitionCellV87=Object.freeze({biasXM:0,biasYM:0,uncertaintyScale:1,targetWeight:1});
function assert(value:unknown,message:string):asserts value{if(!value)throw Error('zone recognition v87: '+message);}
const bounded=(value:unknown,min:number,max:number):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
const fields=(value:unknown,keys:readonly string[])=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
function freeze<T>(value:T):T{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
export function createNeutralZoneRecognitionV87():ZoneRecognitionV87{return freeze({version:'zone_recognition_v87',...Object.fromEntries(roles.map(role=>[role,{cells:Array.from({length:63},()=>({...neutral}))}]))}) as ZoneRecognitionV87;}
export function validateZoneRecognitionV87(raw:unknown):ZoneRecognitionV87{
 const value=cloneInert(raw) as ZoneRecognitionV87;
 assert(value&&typeof value==='object'&&!Array.isArray(value)&&value.version==='zone_recognition_v87'&&Object.keys(value).every(key=>key==='version'||roles.includes(key as ZoneRecognitionRoleV87)),'invalid profile');
 for(const role of roles){const profile=value[role];if(profile===undefined)continue;
  assert(fields(profile,['cells'])&&Array.isArray(profile.cells)&&profile.cells.length===63&&Array.from({length:63},(_,index)=>Object.hasOwn(profile.cells,index)).every(Boolean),'dense 63 cells required');
  for(const cell of profile.cells)assert(fields(cell,['biasXM','biasYM','uncertaintyScale','targetWeight'])&&bounded(cell.biasXM,-.5,.5)&&bounded(cell.biasYM,-.5,.5)&&bounded(cell.uncertaintyScale,0,3)&&bounded(cell.targetWeight,0,4),'invalid bounded cell');
 }return freeze(value);
}
type Common=Readonly<{role:ZoneRecognitionRoleV87;profile?:ZoneRecognitionV87;position:Position;zone:BatterCourseZoneV79;seed:number}>;
function classification(input:Common){assert(roles.includes(input.role)&&Number.isSafeInteger(input.seed),'invalid role or seed');if(input.profile!==undefined)validateZoneRecognitionV87(input.profile);return classifyBatterCourseV79(input);}
export function recognizeZoneV87(input:Common&Readonly<{sourceTick:number;observationTick:number;planeZ:number;standardDeviationMeters:number;baselineErrorMeters?:Position;abilityBasis:string;reason?:string}>){
 const category=classification(input);assert(Number.isSafeInteger(input.sourceTick)&&input.sourceTick>=0&&Number.isSafeInteger(input.observationTick)&&input.sourceTick<=input.observationTick,'future or invalid source observation');
 assert(Number.isFinite(input.planeZ)&&bounded(input.standardDeviationMeters,0,2)&&typeof input.abilityBasis==='string','invalid observation');
 const edited=input.profile?.[input.role],cell=category.courseIndex===null?neutral:edited?.cells[category.courseIndex]??neutral,
  stream='zone-recognition-v87-'+input.role,rng=new SeedRoot(input.seed).streamRng(0,'recognition',stream),normal=()=>Math.sqrt(-2*Math.log(1-rng.nextFloat()))*Math.cos(2*Math.PI*rng.nextFloat()),
  baseline=input.baselineErrorMeters?{x:input.baselineErrorMeters.x,y:input.baselineErrorMeters.y}:edited?{x:normal()*input.standardDeviationMeters,y:normal()*input.standardDeviationMeters}:{x:0,y:0};
 assert(Number.isFinite(baseline.x)&&Number.isFinite(baseline.y),'invalid baseline error');
 const errorMeters=edited?{x:cell.biasXM+baseline.x*cell.uncertaintyScale,y:cell.biasYM+baseline.y*cell.uncertaintyScale}:baseline,
  position=errorMeters.x===0&&errorMeters.y===0?{x:input.position.x,y:input.position.y}:{x:input.position.x+errorMeters.x,y:input.position.y+errorMeters.y},recognized=classifyBatterCourseV79({...input,position}),
  uncertaintyMeters=input.standardDeviationMeters*(edited?cell.uncertaintyScale:1),width=2*input.zone.halfWidth/5;
 return freeze({position,diagnostics:{role:input.role,sourceTick:input.sourceTick,observationTick:input.observationTick,planeZ:input.planeZ,
  predictedPosition:{x:input.position.x,y:input.position.y},perceivedPosition:position,predictedCourseId:category.courseId,courseId:recognized.courseId,courseIndex:recognized.courseIndex,
  errorMeters,baselineErrorMeters:baseline,biasMeters:{x:edited?cell.biasXM:0,y:edited?cell.biasYM:0},uncertaintyScale:edited?cell.uncertaintyScale:1,
  baseUncertaintyMeters:input.standardDeviationMeters,uncertaintyMeters,confidence:1/(1+uncertaintyMeters/width),abilityBasis:input.abilityBasis,seed:input.seed,stream,
  errorStream:input.baselineErrorMeters?'existing_'+input.role+'_error_stream':stream,calibration:'AUTHORED_NOT_MEASURED_VISUAL_ACCURACY' as const,edited:!!edited,
  targetWeight:cell.targetWeight,reason:input.reason??'current_observed_forecast',futureSourceUsed:false as const}});
}
export function selectZoneTargetV87(input:Common&Readonly<{allowRetarget:boolean;allowedCourseIds?:readonly number[]}>){
 const category=classification(input),profile=input.profile?.[input.role],unchanged={position:{x:input.position.x,y:input.position.y},courseId:category.courseId,reason:input.allowRetarget?'legacy_or_uniform_target_weights':'manual_or_manager_location_retained'};
 if(!input.allowRetarget||!profile||profile.cells.every(cell=>cell.targetWeight===1))return freeze(unchanged);
 const width=2*input.zone.halfWidth/5,height=(input.zone.upperY-input.zone.lowerY)/5,candidates=profile.cells.map((cell,index)=>{
  const column=Math.floor(index/7),row=index%7;return {courseId:(column+1)*10+row,weight:cell.targetWeight,position:{x:(input.zone.centerX??0)-input.zone.halfWidth+(column-1.5)*width,y:input.zone.lowerY+(row-.5)*height}};
 }).filter(cell=>!input.allowedCourseIds||input.allowedCourseIds.includes(cell.courseId)),total=candidates.reduce((sum,cell)=>sum+cell.weight,0);
 if(total===0)return freeze({...unchanged,reason:'zero_allowed_weight_keeps_request'});
 const draw=new SeedRoot(input.seed).streamRng(0,'recognition','zone-target-v87-'+input.role).nextFloat();let threshold=draw*total;
 const selected=candidates.find(cell=>(threshold-=cell.weight)<0)??candidates[candidates.length-1];
 return freeze({position:selected.position,courseId:selected.courseId,reason:'explicit_role_target_weights'});
}
