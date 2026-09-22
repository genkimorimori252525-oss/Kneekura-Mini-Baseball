import { fail } from '../TraitValidation';
import type { ContactObservation, SpinObservation, CommandObservation, ReleaseObservation, MeasuredTraitRequest, MeasurementMetric } from './MeasuredTraitTypes';
export type MeasuredStatistics = Readonly<{ stateId: string | null; metrics: readonly MeasurementMetric[]; insufficientFailureEpisodes: boolean }>;
/** Validated, nonempty window only. No probabilities, learned skills or physical state are modified. */
export function summarizeMeasurements(r: MeasuredTraitRequest): MeasuredStatistics {
  const rule=r.model.rule;
  if (rule.familyId==='line_drive'||rule.familyId==='pitcher_contact_distribution') {
    const angles=(r.observations as readonly ContactObservation[]).map(o=>Math.atan2(o.exitVelocityMps.y,Math.hypot(o.exitVelocityMps.x,o.exitVelocityMps.z))*180/Math.PI);
    if(rule.familyId==='line_drive') {
      const lineDriveFraction=angles.filter(x=>x>=rule.lowerAngleDeg&&x<rule.upperAngleDeg).length/angles.length;
      return {stateId:lineDriveFraction>=rule.minimumFraction?'LINE_DRIVE':null,metrics:[{key:'lineDriveFraction',value:lineDriveFraction}],insufficientFailureEpisodes:false};
    }
    const groundFraction=angles.filter(x=>x<rule.groundUpperAngleDeg).length/angles.length;
    const flyFraction=angles.filter(x=>x>=rule.flyLowerAngleDeg).length/angles.length;
    return {stateId:groundFraction>=rule.minimumGroundFraction?'GROUND_BALL':flyFraction>=rule.minimumFlyFraction?'FLY_BALL':null,
      metrics:[{key:'groundFraction',value:groundFraction},{key:'flyFraction',value:flyFraction}],insufficientFailureEpisodes:false};
  }
  if (rule.familyId==='gyro_pitch_shape') {
    let gyroCount=0,highCount=0,meanSpinRpm=0;
    const samples=r.observations as readonly SpinObservation[];
    samples.forEach((o,i)=>{
      const v=o.velocityMps,s=o.spinRadPerSecond;
      const speed=Math.hypot(v.x,v.y,v.z),spin=Math.hypot(s.x,s.y,s.z);
      const rpm=checked(spin*30/Math.PI,'spinRpm');
      meanSpinRpm=checked(meanSpinRpm+(rpm-meanSpinRpm)/(i+1),'meanSpinRpm');
      // Normalize components independently to avoid overflow from a raw dot product.
      const alignment=spin===0?0:Math.min(1,Math.abs((v.x/speed)*(s.x/spin)+(v.y/speed)*(s.y/spin)+(v.z/speed)*(s.z/spin)));
      const gyro=alignment>=rule.minimumAxisAlignment&&rpm>=rule.minimumSpinRpm;
      if(gyro)gyroCount++;
      if(gyro&&rpm>=rule.highSpinRpm)highCount++;
    });
    const gyroFraction=gyroCount/samples.length,highSpinGyroFraction=highCount/samples.length;
    return {stateId:highSpinGyroFraction>=rule.minimumHighSpinGyroFraction?'HIGH_SPIN_GYRO'
      :gyroFraction>=rule.minimumGyroFraction?'GYRO':null,
      metrics:[{key:'gyroFraction',value:gyroFraction},{key:'highSpinGyroFraction',value:highSpinGyroFraction},{key:'meanSpinRpm',value:meanSpinRpm}],insufficientFailureEpisodes:false};
  }
  if(rule.familyId==='command_instability') {
    let meanX=0,meanY=0,m2=0;
    const samples=r.observations as readonly CommandObservation[];
    const errors=samples.map(o=>({
      x:checked(o.actual.horizontalM-o.target.horizontalM,'horizontalErrorM'),
      y:checked(o.actual.verticalM-o.target.verticalM,'verticalErrorM'),
    }));
    // Scale small residuals before squaring: representable tiny dispersion must not collapse to zero.
    const largest=errors.reduce((m,e)=>Math.max(m,Math.abs(e.x),Math.abs(e.y)),0);
    const scale=largest>0&&largest<1?largest:1;
    errors.forEach((e,i)=>{
      const x=e.x/scale,y=e.y/scale;
      const dx=checked(x-meanX,'horizontalDelta'),dy=checked(y-meanY,'verticalDelta');
      meanX=checked(meanX+dx/(i+1),'horizontalMean');meanY=checked(meanY+dy/(i+1),'verticalMean');
      m2=checked(m2+dx*(x-meanX)+dy*(y-meanY),'centeredErrorSum');
    });
    const dispersionM=checked(Math.sqrt(Math.max(0,m2/samples.length))*scale,'dispersionM');
    meanX*=scale;meanY*=scale;
    return {stateId:dispersionM>=rule.minimumDispersionM?'UNSTABLE':null,
      metrics:[{key:'dispersionM',value:dispersionM},{key:'biasMagnitudeM',value:checked(Math.hypot(meanX,meanY),'biasMagnitudeM')},
        {key:'horizontalBiasM',value:meanX},{key:'verticalBiasM',value:meanY}],insufficientFailureEpisodes:false};
  }
  const samples=r.observations as readonly ReleaseObservation[];
  let qualifying=0,failed=0,directionX=0,directionY=0;
  const failedEpisodes=new Set<string>();
  for(const o of samples) {
    if(!o.deliveryFailed)continue;
    failed++;
    const miss=o.releaseMissM,len=checked(Math.hypot(miss.horizontalM,miss.verticalM),'releaseMissMagnitudeM');
    if(len<rule.minimumMissM)continue;
    qualifying++;failedEpisodes.add(o.episodeId);
    directionX+=(miss.horizontalM/len-directionX)/qualifying;
    directionY+=(miss.verticalM/len-directionY)/qualifying;
  }
  const qualifyingMissFraction=qualifying/samples.length;
  const concentration=Math.min(1,checked(Math.hypot(directionX,directionY),'directionalConcentration'));
  const enoughRate=qualifyingMissFraction>=rule.minimumFailureFraction;
  const insufficientFailureEpisodes=enoughRate&&failedEpisodes.size<rule.minimumFailedEpisodes;
  return {stateId:enoughRate&&!insufficientFailureEpisodes&&concentration>=rule.minimumDirectionalConcentration?'DIRECTIONAL_MISS':null,
    metrics:[{key:'deliveryFailureFraction',value:failed/samples.length},{key:'qualifyingMissFraction',value:qualifyingMissFraction},
      {key:'failedEpisodeCount',value:failedEpisodes.size},{key:'directionalConcentration',value:concentration}],insufficientFailureEpisodes};
}

function checked(value: number, path: string): number {
  if(!Number.isFinite(value)) fail('OVERFLOW','statistics.'+path);
  return value===0?0:value;
}
