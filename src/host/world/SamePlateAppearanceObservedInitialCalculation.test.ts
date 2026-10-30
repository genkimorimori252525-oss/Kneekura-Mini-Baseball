import { expect, it } from 'vitest';
import { directNativeDispatchFixture } from './SamePlateAppearanceDirectNative.test-support';
import { readSamePaFirstPitchCalculation, openSqliteSamePlateAppearanceDispatchStore } from './SqliteSamePlateAppearanceDispatchStore';
import { samePaDispatchSourceInput } from './SamePlateAppearanceDispatchSource';
import type { SamePaNativeObservedLaunchCalculation } from './SamePlateAppearanceDispatchExecution';
import { REFERENCE_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { sampleAerodynamicPitchTrajectory } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import { rawCensus } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { deriveSamePaDispatchRoles } from './SamePlateAppearanceDispatchRoles';
const parameters={ticksPerSecond:1_000_000,integrationStepTicks:2_000,gravityY:-9.81,aerodynamics:REFERENCE_BASEBALL_AERODYNAMICS};

it('prepares an observer-owned first pitch from genuine reserved Native models/calibrations with no count or physical admission',()=>{
  const f=directNativeDispatchFixture({},parameters);
  try{
    expect(f.db.prepare('SELECT * FROM physical_pitch_progress_actions').all()).toEqual([]);
    const source=f.acceptedAction.source,before=rawCensus(f.db),r=readSamePaFirstPitchCalculation(f.path,f.request) as SamePaNativeObservedLaunchCalculation;
    expect(r.kind).toBe('native_observed_launch_calculation_only');expect(r.beforeTimeline.events).toEqual([]);
    expect(r.beforeTimeline.status).toEqual({kind:'active',count:{balls:0,strikes:0}});
    expect(r.calculation).not.toHaveProperty('resolution');expect(source.nominalPitch.batter).not.toHaveProperty('action');
    expect(source.nominalPitch.flight).not.toHaveProperty('acceleration');
    expect(r.calculation.delivery.release.velocity.z).toBeCloseTo(-27);
    const trajectory=r.calculation.trajectory,release=sampleAerodynamicPitchTrajectory(trajectory,trajectory.start.tick),later=sampleAerodynamicPitchTrajectory(trajectory,trajectory.start.tick+100_000);
    expect(release.velocity).toEqual(r.calculation.delivery.release.velocity);
    expect(later.position.y).toBeLessThan(release.position.y);expect(later.position.z).toBeLessThan(release.position.z);
    expect(later.velocity.z).not.toBe(release.velocity.z);expect(trajectory.parameters).toEqual(parameters);
    expect(readSamePaFirstPitchCalculation(f.path,f.request)).toEqual(r);expect(rawCensus(f.db)).toEqual(before);
    const roles=deriveSamePaDispatchRoles(f.actor,f.view),base={sourceVersion:'observed-test-v1',enrollmentReference:source.enrollmentReference,
      viewReference:source.viewReference,firstPhysicalPitchSourceId:source.firstPhysicalPitchSourceId};
    const consumer={...base,sourceId:'observed:consumers',capability:'same_pa_consumer_set_v1',actionReference:f.request.actionReference,
      participantInputs:roles.map(role=>({member:role.member,calibrationReferences:role.routes.map(route=>({route,
        calibrationReference:reference('pa_dispatch_v1_execution_calibrations',f.acceptedCalibrations.calibrations.find(c=>c.source.member.playerId===role.member.playerId&&c.source.route===route)!)}))}))};
    const sources=new Map<string,unknown>([[consumer.sourceId,consumer]]);
    const owner=openSqliteSamePlateAppearanceDispatchStore(f.path,{readAcceptedConsumerSet:id=>sources.get(id),readAcceptedEpisode:id=>sources.get(id),
      readAcceptedRight:id=>sources.get(id),readAcceptedPhysicalPitch:id=>sources.get(id)});
    try{
      const consumers=owner.acceptConsumerSet(consumer.sourceId);if(consumers.kind!=='consumer_set_prepared')throw new Error('actual consumers required');
      const episode={...base,sourceId:'observed:episode',capability:'same_pa_first_pitch_episode_v1',actionReference:f.request.actionReference,
        consumerSetReference:reference('pa_dispatch_v1_consumer_sets',consumers)};sources.set(episode.sourceId,episode);
      const prepared=owner.acceptEpisode(episode.sourceId);if(prepared.kind!=='prospective_episode_prepared')throw new Error('actual episode required');
      const right={...base,sourceId:'observed:right',capability:'same_pa_first_pitch_right_v1',actionReference:f.request.actionReference,
        consumerSetReference:episode.consumerSetReference,episodeReference:reference('pa_dispatch_v1_episodes',prepared),prefixReference:f.view.source.prefixReference};
      sources.set(right.sourceId,right);const ready=owner.acceptRight(right.sourceId);if(ready.kind!=='immutable_right_prepared')throw new Error('actual right required');
      const physical={sourceId:source.firstPhysicalPitchSourceId,sourceVersion:'rejected-legacy-adoption-v1',capability:'same_pa_physical_pitch_v1',
        rightReference:reference('pa_dispatch_v1_rights',ready),actionReference:f.request.actionReference};sources.set(physical.sourceId,physical);
      const preparedRows=rawCensus(f.db);expect(()=>owner.acceptPhysicalPitch(physical.sourceId)).toThrow(/calculation route/);
      expect(rawCensus(f.db)).toEqual(preparedRows);
    }finally{owner.close();}
    for(const edit of [(s:any)=>s.nominalPitch.batter.action={kind:'take'},(s:any)=>s.nominalPitch.flight.acceleration={x:0,y:0,z:0},
      (s:any)=>delete s.actualFlightParameters,(s:any)=>s.actualFlightParameters.ticksPerSecond=1000,
      (s:any)=>s.geometryReference.kind='action_source_take_geometry_v1']){
      const bad=structuredClone(source);edit(bad);expect(()=>samePaDispatchSourceInput(bad)).toThrow();
    }
  }finally{f.close();}
},120_000);
