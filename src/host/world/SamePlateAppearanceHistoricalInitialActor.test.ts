import { expect,it,vi } from 'vitest';
import { physicalPlateAppearanceActorFixture } from './PhysicalPlateAppearanceActorFixtures.test-support';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import { openSqliteSamePlateAppearanceEnrollmentStore } from './SqliteSamePlateAppearanceEnrollmentStore';
import { openSqliteSamePlateAppearanceExecutionStore } from './SqliteSamePlateAppearanceExecutionStore';
import { openSqliteSamePlateAppearanceHistoricalViewReader } from './SqliteSamePlateAppearanceHistoricalViewReader';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { actorHash as hash,actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import * as actorOwner from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import * as physicalOwner from './PhysicalPitchEvidenceFromSqlite';
import { reference } from './SamePlateAppearanceExecutionView.test-support';
import { rawCensus,schemaCensus } from './ActualFoulTerminalAcknowledgementCutover.test-support';

it('HI09 real initial actor ancestry replays its reserved view after current match and physical descendants move',()=>{
  const a=physicalPlateAppearanceActorFixture(),f=a.f;
  try{
    const actor=a.actors.accept(a.source.sourceId),bindings=[actor.binding,...actor.defenderBindings];
    for(const binding of bindings){
      if(readActualRoleWorkloadState(f.db,binding.careerId,binding.playerId))continue;
      // Reuse the existing explicit synthetic fixture recipe unchanged. This
      // is a small real-actor test, not the retained genuine away-2 donor.
      const baseline={...f.baseline,sourceId:'historical-baseline-'+binding.playerId,playerId:binding.playerId,personLinkSourceId:binding.personLinkSourceId};
      f.track(openSqlitePlayerWorkloadRecoveryStore(f.path,f.links,{readAcceptedBaseline:()=>baseline,readAcceptedActivity:()=>null})).initialize(baseline.sourceId);
    }
    const source={sourceId:'historical-enrollment',sourceVersion:'fixture-v1',capability:'reserved_same_pa_enrollment_v1' as const,
      actorReference:{...reference('physical_plate_appearance_actors',actor),owner:'physical_plate_appearance_actors' as const},firstPhysicalPitchSourceId:'pitch-0',executionBasis:'reserved_cumulative_actual_role_total_v1' as const,
      participantBaselineReferences:bindings.map(b=>{const state=readActualRoleWorkloadState(f.db,b.careerId,b.playerId)!;
        const baseline=f.db.prepare('SELECT source_id FROM world_player_workload_baselines WHERE career_id=? AND player_id=?').get(b.careerId,b.playerId)!;
        return {playerId:b.playerId,baselineSourceId:String(baseline.source_id),revision:state.revision,stateHash:hash(state)};})};
    const enrollment=f.track(openSqliteSamePlateAppearanceEnrollmentStore(f.path,{readAcceptedEnrollment:()=>source})).accept(source.sourceId);
    if(enrollment.kind!=='reserved')throw new Error('real fixture enrollment missing');
    const prefixSource={sourceId:'historical-prefix',sourceVersion:'fixture-v1',capability:'reserved_same_pa_empty_prefix_v1',enrollmentReference:reference('same_pa_enrollments',enrollment)};
    const totals=new Map<string,unknown>(),views=new Map<string,unknown>();
    const owner=f.track(openSqliteSamePlateAppearanceExecutionStore(f.path,{readAcceptedPrefix:()=>prefixSource,readAcceptedTotal:id=>totals.get(id)??null,readAcceptedView:id=>views.get(id)??null}));
    const prefix=owner.acceptPrefix(prefixSource.sourceId);if(prefix.kind!=='empty_prefix')throw new Error('real fixture prefix missing');
    const assessments=enrollment.participants.map(p=>{
      const total={sourceId:'historical-total-'+p.binding.playerId,sourceVersion:'fixture-v1',capability:'reserved_same_pa_cumulative_total_v1',
        enrollmentReference:prefixSource.enrollmentReference,prefixReference:reference('reserved_pa_work_prefixes',prefix),
        participantReference:prefix.lineage.participantReferences.find(r=>r.playerId===p.binding.playerId)!,effortUnits:0,
        provenance:{assessmentSourceId:'historical-assessment-'+p.binding.playerId,assessmentVersion:'fixture-only-zero-total-v1',calibrationSourceId:'explicit-empty-fixture',calibrationVersion:'fixture-only-zero-total-v1'}};
      totals.set(total.sourceId,total);const saved=owner.acceptTotal(total.sourceId);if(saved.kind!=='cumulative_total')throw new Error('real fixture TOTAL missing');return saved;
    });
    const viewSource={sourceId:'historical-view',sourceVersion:'fixture-v1',capability:'reserved_same_pa_cumulative_view_v1',enrollmentReference:prefixSource.enrollmentReference,
      prefixReference:reference('reserved_pa_work_prefixes',prefix),participantTotalReferences:assessments.map(t=>({playerId:t.source.participantReference.playerId,assessmentReference:reference('reserved_pa_total_assessments',t)}))};
    views.set(viewSource.sourceId,viewSource);const view=owner.acceptView(viewSource.sourceId);if(view.kind!=='basis_prepared')throw new Error('real fixture view missing');
    f.db.prepare('UPDATE matches SET durable_revision=99,state_json=?,activation_json=? WHERE match_id=?').run(json('opaque future match'),json('opaque future activation'),'game-1');
    f.db.prepare('INSERT INTO physical_pitch_progress_actions VALUES(?,?,?,?,?,?,?,?)').run('pitch-0','game-1',actor.match.playId,1,json({sourceId:'pitch-0',gameId:'game-1'}),'f'.repeat(64),json('opaque future physical'),'f'.repeat(64));
    expect(()=>owner.readView(viewSource.sourceId)).toThrow();
    const current=vi.spyOn(actorOwner,'assertPhysicalActorOpenFrame').mockImplementation(()=>{throw new Error('current frame must stay opaque');});
    const future=vi.spyOn(physicalOwner,'readPhysicalPitchProgressFromSqlite').mockImplementation(()=>{throw new Error('future physical payload must stay opaque');});
    const before=rawCensus(f.db),schema=schemaCensus(f.db),ref=reference('reserved_pa_execution_views',view);
    const reader=f.track(openSqliteSamePlateAppearanceHistoricalViewReader(f.path));expect(reader.read(ref).view).toEqual(view);reader.close();
    expect(f.track(openSqliteSamePlateAppearanceHistoricalViewReader(f.path)).read(ref).view).toEqual(view);
    expect(current).not.toHaveBeenCalled();expect(future).not.toHaveBeenCalled();expect(rawCensus(f.db)).toEqual(before);expect(schemaCensus(f.db)).toEqual(schema);
  }finally{vi.restoreAllMocks();f.close();}
});
