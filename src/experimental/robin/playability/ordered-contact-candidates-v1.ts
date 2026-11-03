export type OrderedContactCandidateV1=Readonly<{id:string;kind:string;from:number;at:number;ambiguous:boolean}>;
/** Caller owns collider enumeration and proves coverage through the winner.
 * Disjoint continuous-time intervals remain ordered even within one tick. */
export function selectOrderedContactV1(input:{candidates:readonly OrderedContactCandidateV1[];notBefore:number;coveredThrough:number;searchThrough:number}){
 if(!Number.isFinite(input.notBefore)||input.notBefore<0||!Number.isFinite(input.coveredThrough)||input.coveredThrough<input.notBefore||!Number.isFinite(input.searchThrough)||input.searchThrough<input.notBefore)throw Error('invalid candidate coverage');
 for(const c of input.candidates)if(!c.id||!c.kind||!Number.isFinite(c.from)||!Number.isFinite(c.at)||c.from<0||c.at<c.from||typeof c.ambiguous!=='boolean')throw Error('invalid contact candidate');
 if(input.candidates.some(c=>c.from<input.notBefore))return {status:'HOLD' as const,reason:'CANDIDATE_BEFORE_CUT' as const};
 if(!input.candidates.length)return input.coveredThrough>=input.searchThrough?{status:'NONE' as const}:{status:'HOLD' as const,reason:'INCOMPLETE_COVERAGE' as const};
 const sorted=[...input.candidates].sort((a,b)=>a.at-b.at||a.from-b.from),winner=sorted[0];
 if(input.coveredThrough<winner.at)return {status:'HOLD' as const,reason:'INCOMPLETE_COVERAGE' as const};
 if(winner.ambiguous)return {status:'HOLD' as const,reason:'WINNER_UNRESOLVED' as const};
 const overlap=sorted.slice(1).find(c=>c.id!==winner.id&&c.from<=winner.at&&winner.from<=c.at);
 if(overlap)return {status:'HOLD' as const,reason:'OVERLAPPING_CONTACT_INTERVALS' as const,first:winner,other:overlap};
 return {status:'SELECTED' as const,candidate:winner,next:'REQUERY_AFTER_RESPONSE' as const};
}
