import type { Vec3 } from '../../../model/geometry';
import { fail, fraction, integer, list, obj, oneOf, order, readScope, readTime, record, same, text, unique, bool } from '../TraitValidation';
import { findSourceTraitFamily } from '../sources/SourceTraitFamilies';
import { notAfter, readSnapshot } from '../sources/SourceTraitValidation';
import type { MeasuredTraitRequest, MeasurementModel, MeasurementRule, MeasurementEvidence, PlatePoint } from './MeasuredTraitTypes';
export function finite(input: unknown, path: string): number {
  if (typeof input !== 'number' || !Number.isFinite(input)) fail('INVALID_INPUT', path);
  return input === 0 ? 0 : input;
}
const positive = (input: unknown, path: string): number => {
  const x = finite(input, path); if (x <= 0) fail('INVALID_INPUT', path); return x;
};
const positiveFraction = (input: unknown, path: string): number => {
  const x = fraction(input, path); if (x === 0) fail('INVALID_INPUT', path); return x;
};
const angle = (input: unknown, path: string): number => {
  const x = finite(input, path); if (x < -90 || x > 90) fail('INVALID_INPUT', path); return x;
};
export function vector(input: unknown, path: string, nonzero: boolean): Vec3 {
  const r = obj(input, ['x','y','z'], path);
  const v = { x: finite(r.x,path+'.x'), y: finite(r.y,path+'.y'), z: finite(r.z,path+'.z') };
  const length = Math.hypot(v.x,v.y,v.z);
  if (!Number.isFinite(length)) fail('OVERFLOW',path);
  if (nonzero && length === 0) fail('INVALID_INPUT',path);
  return v;
}
function point(input: unknown, path: string): PlatePoint {
  const r = obj(input,['horizontalM','verticalM'],path);
  return { horizontalM:finite(r.horizontalM,path+'.horizontalM'), verticalM:finite(r.verticalM,path+'.verticalM') };
}
function readRule(input: unknown, path: string): MeasurementRule {
  const kind = oneOf(record(input,path).familyId, ['line_drive','pitcher_contact_distribution','gyro_pitch_shape','command_instability','release_miss_pattern'],path+'.familyId');
  if (kind === 'line_drive') {
    const r = obj(input,['familyId','lowerAngleDeg','upperAngleDeg','minimumFraction'],path);
    const lowerAngleDeg=angle(r.lowerAngleDeg,path+'.lowerAngleDeg'),upperAngleDeg=angle(r.upperAngleDeg,path+'.upperAngleDeg');
    if (lowerAngleDeg>=upperAngleDeg) fail('INVALID_INPUT',path+'.angles');
    return { familyId:kind,lowerAngleDeg,upperAngleDeg,minimumFraction:positiveFraction(r.minimumFraction,path+'.minimumFraction') };
  }
  if (kind === 'pitcher_contact_distribution') {
    const r=obj(input,['familyId','groundUpperAngleDeg','flyLowerAngleDeg','minimumGroundFraction','minimumFlyFraction'],path);
    const groundUpperAngleDeg=angle(r.groundUpperAngleDeg,path+'.groundUpperAngleDeg'),flyLowerAngleDeg=angle(r.flyLowerAngleDeg,path+'.flyLowerAngleDeg');
    const minimumGroundFraction=positiveFraction(r.minimumGroundFraction,path+'.minimumGroundFraction'),minimumFlyFraction=positiveFraction(r.minimumFlyFraction,path+'.minimumFlyFraction');
    if (groundUpperAngleDeg>flyLowerAngleDeg || minimumGroundFraction+minimumFlyFraction<=1) fail('INVALID_INPUT',path+'.exclusiveRanges');
    return { familyId:kind,groundUpperAngleDeg,flyLowerAngleDeg,minimumGroundFraction,minimumFlyFraction };
  }
  if (kind === 'gyro_pitch_shape') {
    const r=obj(input,['familyId','minimumAxisAlignment','minimumSpinRpm','highSpinRpm','minimumGyroFraction','minimumHighSpinGyroFraction'],path);
    const minimumSpinRpm=positive(r.minimumSpinRpm,path+'.minimumSpinRpm'),highSpinRpm=positive(r.highSpinRpm,path+'.highSpinRpm');
    const minimumGyroFraction=positiveFraction(r.minimumGyroFraction,path+'.minimumGyroFraction');
    const minimumHighSpinGyroFraction=positiveFraction(r.minimumHighSpinGyroFraction,path+'.minimumHighSpinGyroFraction');
    if (highSpinRpm<=minimumSpinRpm || minimumHighSpinGyroFraction<minimumGyroFraction) fail('INVALID_INPUT',path+'.orderedTiers');
    return { familyId:kind,minimumSpinRpm,highSpinRpm,minimumGyroFraction,minimumHighSpinGyroFraction,
      minimumAxisAlignment:positiveFraction(r.minimumAxisAlignment,path+'.minimumAxisAlignment') };
  }
  if (kind === 'command_instability') {
    const r=obj(input,['familyId','minimumDispersionM'],path);
    return { familyId:kind,minimumDispersionM:positive(r.minimumDispersionM,path+'.minimumDispersionM') };
  }
  const r=obj(input,['familyId','minimumMissM','minimumFailureFraction','minimumDirectionalConcentration','minimumFailedEpisodes'],path);
  return { familyId:kind,minimumMissM:positive(r.minimumMissM,path+'.minimumMissM'),
    minimumFailureFraction:positiveFraction(r.minimumFailureFraction,path+'.minimumFailureFraction'),
    minimumDirectionalConcentration:positiveFraction(r.minimumDirectionalConcentration,path+'.minimumDirectionalConcentration'),
    minimumFailedEpisodes:integer(r.minimumFailedEpisodes,path+'.minimumFailedEpisodes',2) };
}
function readModel(input: unknown,path: string): MeasurementModel {
  const r=obj(input,['modelId','version','minimumEpisodes','minimumDays','windowDays','maximumSourceAgeDays','rule'],path);
  const minimumDays=integer(r.minimumDays,path+'.minimumDays',1),windowDays=integer(r.windowDays,path+'.windowDays',2);
  if (minimumDays>=windowDays) fail('INVALID_INPUT',path+'.windowDays');
  return { modelId:text(r.modelId,path+'.modelId'),version:text(r.version,path+'.version'),minimumEpisodes:integer(r.minimumEpisodes,path+'.minimumEpisodes',2),
    minimumDays,windowDays,maximumSourceAgeDays:integer(r.maximumSourceAgeDays,path+'.maximumSourceAgeDays'),rule:readRule(r.rule,path+'.rule') };
}
/** Reads inert data only; does not invoke callbacks or mutate/freeze caller-owned input. */
export function readMeasuredRequest(input: unknown): MeasuredTraitRequest {
  const r=obj(input,['classificationId','scope','time','source','model','observations'],'request');
  const scope=readScope(r.scope,'request.scope'),time=readTime(r.time,'request.time'),source=readSnapshot(r.source,'request.source'),model=readModel(r.model,'request.model');
  const family=findSourceTraitFamily(model.rule.familyId)!;
  if (source.owner!==family.requirements[0]!.owner) fail('SOURCE_CONFLICT','request.source.owner');
  if (source.careerId!==scope.careerId || source.subjectId!==scope.playerId) fail('SCOPE_MISMATCH','request.source');
  if (!notAfter(source.time,time)) fail('BACKDATED_EVALUATION','request.source.time');
  const baseKeys=['scope','episodeId','eventId','time'];
  const observations=list(r.observations,(input,path) => {
    const kind=model.rule.familyId;
    const extra=kind==='line_drive'||kind==='pitcher_contact_distribution' ? ['exitVelocityMps']
      : kind==='gyro_pitch_shape' ? ['velocityMps','spinRadPerSecond'] : kind==='command_instability' ? ['target','actual'] : ['deliveryFailed','releaseMissM'];
    const o=obj(input,[...baseKeys,...extra],path);
    const evidence:MeasurementEvidence={scope:readScope(o.scope,path+'.scope'),episodeId:text(o.episodeId,path+'.episodeId'),eventId:text(o.eventId,path+'.eventId'),time:readTime(o.time,path+'.time')};
    if (!same(evidence.scope,scope)) fail('SCOPE_MISMATCH',path+'.scope');
    if (!notAfter(evidence.time,source.time)) fail('BACKDATED_EVALUATION',path+'.time');
    if (kind==='line_drive'||kind==='pitcher_contact_distribution') return { ...evidence,exitVelocityMps:vector(o.exitVelocityMps,path+'.exitVelocityMps',true) };
    if (kind==='gyro_pitch_shape') return { ...evidence,velocityMps:vector(o.velocityMps,path+'.velocityMps',true),spinRadPerSecond:vector(o.spinRadPerSecond,path+'.spinRadPerSecond',false) };
    if (kind==='command_instability') return { ...evidence,target:point(o.target,path+'.target'),actual:point(o.actual,path+'.actual') };
    const deliveryFailed=bool(o.deliveryFailed,path+'.deliveryFailed'),releaseMissM=point(o.releaseMissM,path+'.releaseMissM');
    if (!deliveryFailed && (releaseMissM.horizontalM!==0||releaseMissM.verticalM!==0)) fail('SOURCE_CONFLICT',path+'.releaseMissM');
    return { ...evidence,deliveryFailed,releaseMissM };
  },'request.observations');
  unique(observations,o=>o.eventId,'request.observations.eventId');
  // A physical event gets one observation, not many animation frames disguised as episodes.
  unique(observations,o=>JSON.stringify([o.time.day,o.time.sequence]),'request.observations.instant');
  observations.sort((a,b)=>a.time.day-b.time.day||a.time.sequence-b.time.sequence||order(a.eventId,b.eventId));
  for(let i=1;i<observations.length;i++) if(!notAfter(observations[i-1]!.time,observations[i]!.time)) fail('INCONSISTENT_STATE','request.observations.time');
  return { classificationId:text(r.classificationId,'request.classificationId'),scope,time,source,model,observations };
}
