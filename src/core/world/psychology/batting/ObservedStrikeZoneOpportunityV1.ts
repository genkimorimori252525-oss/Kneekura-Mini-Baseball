import type { BattingSource } from './BattingTypes';
import type { EmotionResult } from '../EmotionTypes';
import { attempt,obj,integer,fail } from '../EmotionValidation';
import { cloneExecutionData } from '../execution/ExecutionValidation';
import { coreCall,numberValue,readFlight } from './BattingValidation';
import { findAerodynamicPitchPlateCrossing } from '../../../sim/pitching/AerodynamicPitchTrajectory';

/** An explicit geometric AI heuristic, NOT a hit probability or empirical
 * judgment calibration. Only the observer's delivered forecast is allowed. */
export type ObservedStrikeZoneOpportunityV1=Readonly<{
  algorithm:'observed_strike_zone_opportunity_v1';score:0|1;
  reason:'predicted_zone_overlap'|'predicted_outside_zone'|'no_future_plate_crossing';
  crossing:Readonly<{tick:number;elapsedSeconds:number;position:BattingSource['centerOfMass']}>|null;
}>;
export function assessObservedStrikeZoneOpportunityV1(input:unknown):EmotionResult<ObservedStrikeZoneOpportunityV1>{
  return attempt(()=>{
    const p='batting.zoneOpportunity',v=obj(cloneExecutionData(input,p),['evaluatedAtTick','forecast','plateZ','strikeZone','ballRadiusM'],p);
    const now=integer(v.evaluatedAtTick,p+'.evaluatedAtTick'),plateZ=numberValue(v.plateZ,p+'.plateZ'),radius=numberValue(v.ballRadiusM,p+'.ballRadiusM',true);
    const zone=obj(v.strikeZone,['centerX','halfWidth','lowerY','upperY'],p+'.strikeZone');Object.values(zone).forEach(n=>numberValue(n,p+'.strikeZone'));
    if(Number(zone.halfWidth)<=0||Number(zone.upperY)<=Number(zone.lowerY))fail('INVALID_INPUT',p+'.strikeZone');
    const forecast=obj(v.forecast,['observedTick','availableTick','validUntilTick','trajectory'],p+'.forecast');
    const observed=integer(forecast.observedTick,p+'.observedTick'),available=integer(forecast.availableTick,p+'.availableTick'),until=integer(forecast.validUntilTick,p+'.validUntilTick');
    if(observed>available||available>now||until<now)fail('INVALID_INPUT',p+'.unavailableOrExpiredForecast');
    const raw=forecast.trajectory as BattingSource['predictions'][number]['trajectory'];
    const trajectory=readFlight(raw,raw?.parameters?.ticksPerSecond,p+'.forecast.trajectory');
    if(trajectory.start.tick>observed||trajectory.parameters.aerodynamics.ballRadiusM!==radius)fail('INVALID_INPUT',p+'.forecast.identity');
    const crossing=coreCall(p+'.crossing',()=>findAerodynamicPitchPlateCrossing(trajectory,plateZ));
    const algorithm='observed_strike_zone_opportunity_v1' as const;
    if(crossing===null||crossing.tick<now)return {algorithm,score:0 as const,reason:'no_future_plate_crossing' as const,crossing:null};
    const z=zone as BattingSource['strikeZone'],point=crossing.position;
    const overlap=point.x+radius>=z.centerX-z.halfWidth&&point.x-radius<=z.centerX+z.halfWidth
      &&point.y+radius>=z.lowerY&&point.y-radius<=z.upperY;
    return {algorithm,score:overlap?1 as const:0 as const,reason:overlap?'predicted_zone_overlap' as const:'predicted_outside_zone' as const,
      crossing:{tick:crossing.tick,elapsedSeconds:crossing.elapsedSeconds,position:crossing.position}};
  });
}
