/** Trial preference, not a new shoulder/speed/catch/out probability. The two
 * times must come from the same executable throw and runner predictions.
 * The tolerance is provisional game AI tuning, not an MLB measurement. */
export function decideLiveFirstBaseAttemptV108(input:Readonly<{seed:number;opportunityId:string;pursuitCostWeight:number;
  runnerSeconds:number;receivingSeconds:number;distanceMeters:number;capacityMps:number;runnerSpeedMps:number}>){
  if(!Number.isSafeInteger(input.seed)||input.seed<0||input.seed>0xffffffff||!input.opportunityId
    ||!Number.isFinite(input.pursuitCostWeight)||input.pursuitCostWeight<.25||input.pursuitCostWeight>4
    ||![input.runnerSeconds,input.receivingSeconds,input.distanceMeters].every(x=>Number.isFinite(x)&&x>=0)
    ||![input.capacityMps,input.runnerSpeedMps].every(x=>Number.isFinite(x)&&x>0))throw Error('invalid first-base attempt estimate');
  let hash=(2166136261^input.seed)>>>0;
  for(const c of 'first-base:'+input.opportunityId)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
  hash=Math.imul(hash^(hash>>>16),0x85ebca6b)>>>0;
  const cautious=input.pursuitCostWeight>1,toleranceSeconds=cautious?0:.45/Math.sqrt(input.pursuitCostWeight),
    judgementSeconds=(hash/4294967296*2-1)*.1/Math.sqrt(input.pursuitCostWeight),
    marginSeconds=input.runnerSeconds-input.receivingSeconds,
    attempt=marginSeconds>0||marginSeconds+judgementSeconds>=-toleranceSeconds;
  return {attempt,marginSeconds,toleranceSeconds,judgementSeconds,cautious,
    reason:marginSeconds>0?'WINNING_FIRST_BASE_RACE':attempt?'CLOSE_FIRST_BASE_ATTEMPT':cautious?'CAUTIOUS_HOLD':'FIRST_BASE_TOO_LATE'} as const;
}
