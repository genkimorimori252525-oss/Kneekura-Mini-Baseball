import {cloneInert} from '../../adjudication/OfficialWindowPolicy';

type Group='PULL'|'CENTER'|'OPPOSITE';
type Candidate=Readonly<{yawDegrees:number;status:'PREDICTED_CONTACT'|'LIMIT_EXCEEDED'|'UNRESOLVED'|'NO_CLOSING_RESPONSE';fieldAngleDegrees:number|null;preparationTransferCostMps:number|null}>;
const order:readonly Group[]=['PULL','CENTER','OPPOSITE'];
const range=0x1_0000_0000;
const fields=(x:unknown,keys:string[])=>!!x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
/** A finite nominal motor selection, not a measured preference or actual batted-ball result.
 * Independence of the one uint32 draw is a caller obligation, not authenticated here. */
export function selectNeutralReactiveDirectionV271(raw:Readonly<{bats:'R'|'L';drawUint32:number;candidates:readonly Candidate[]}>) {
 const input=cloneInert(raw);
 if(!fields(input,['bats','drawUint32','candidates'])||!['R','L'].includes(input.bats)||!Number.isInteger(input.drawUint32)||Object.is(input.drawUint32,-0)||input.drawUint32<0||input.drawUint32>=range||!Array.isArray(input.candidates))throw Error('invalid neutral reactive selection');
 if(!input.candidates.every(c=>fields(c,['yawDegrees','status','fieldAngleDegrees','preparationTransferCostMps'])&&Number.isFinite(c.yawDegrees)&&['PREDICTED_CONTACT','LIMIT_EXCEEDED','UNRESOLVED','NO_CLOSING_RESPONSE'].includes(c.status)&&(c.fieldAngleDegrees===null||Number.isFinite(c.fieldAngleDegrees))&&(c.preparationTransferCostMps===null||Number.isFinite(c.preparationTransferCostMps)&&c.preparationTransferCostMps>=0)))throw Error('invalid neutral reactive candidate');
 const groups:Record<Group,{candidate:Candidate;index:number}[]>={PULL:[],CENTER:[],OPPOSITE:[]};let unresolvedCount=0,incompleteCount=0;
 input.candidates.forEach((candidate,index)=>{
  if(candidate.status==='UNRESOLVED'){unresolvedCount++;return}
  if(candidate.status!=='PREDICTED_CONTACT')return;
  if(candidate.fieldAngleDegrees===null||candidate.preparationTransferCostMps===null){incompleteCount++;return}
  const angle=candidate.fieldAngleDegrees,group:Group=angle===0?'CENTER':angle*(input.bats==='L'?1:-1)>0?'PULL':'OPPOSITE';groups[group].push({candidate,index});
 });
 const available=order.filter(g=>groups[g].length>0),groupCounts=Object.freeze({PULL:groups.PULL.length,CENTER:groups.CENTER.length,OPPOSITE:groups.OPPOSITE.length});
 const base={version:'neutral_reactive_direction_selection_v271' as const,drawAuthority:'CALLER_DECLARED_INDEPENDENCE_NOT_AUTHENTICATED' as const,
  semantics:'FINITE_NOMINAL_MOTOR_GROUP_NOT_ACTUAL_OUTCOME_OR_MEASURED_PREFERENCE' as const,groupCounts,unresolvedCount,incompleteCount,
  emptyGroupMeaning:'NO_ELIGIBLE_CANDIDATE_IN_FINITE_SET_NOT_PROOF_OF_IMPOSSIBILITY' as const};
 if(!available.length)return Object.freeze({...base,status:unresolvedCount||incompleteCount?'UNRESOLVED' as const:'NO_ELIGIBLE_CANDIDATE' as const,
  reason:input.candidates.length===0?'EMPTY_CANDIDATE_SET' as const:unresolvedCount||incompleteCount?'CANDIDATES_UNRESOLVED' as const:'NO_PREDICTED_CONTACT_IN_FINITE_SET' as const,
  selectedGroup:null,selectedIndex:null,selected:null,groupSlots:Object.freeze([])});
 const n=available.length,index=Math.floor(input.drawUint32*n/range),selectedGroup=available[index],group=groups[selectedGroup];let best=group[0];
 // V161: strict minimum cost, then absolute yaw; exact tie keeps original order.
 for(const item of group.slice(1)){const a=item.candidate,b=best.candidate;if(a.preparationTransferCostMps!<b.preparationTransferCostMps!||a.preparationTransferCostMps===b.preparationTransferCostMps&&Math.abs(a.yawDegrees)<Math.abs(b.yawDegrees))best=item}
 const groupSlots=available.map((g,i)=>Object.freeze({group:g,startInclusive:Math.ceil(i*range/n),endExclusive:Math.ceil((i+1)*range/n)}));
 return Object.freeze({...base,status:'SELECTED' as const,reason:'NONEMPTY_NOMINAL_GROUP' as const,selectedGroup,selectedIndex:best.index,selected:Object.freeze({...best.candidate}),groupSlots:Object.freeze(groupSlots)});
}
