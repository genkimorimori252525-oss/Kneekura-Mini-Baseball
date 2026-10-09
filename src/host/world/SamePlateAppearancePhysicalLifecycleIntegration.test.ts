import { expect, it } from 'vitest';
import { samePaPhysicalLifecycleFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { openSqliteSamePlateAppearancePhysicalEpisodeStore } from './SqliteSamePlateAppearancePhysicalEpisodeStore';
import { readCurrentSamePaLifecycleViewFromSqlite, readHistoricalSamePaLifecycleViewFromSqlite } from './SamePlateAppearanceLifecycleFromSqlite';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { physicalEpisodeTables } from './SamePlateAppearancePhysicalEpisodeStorage';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { completeSamePaTerminalFixture } from './SamePlateAppearanceTerminalLifecycleFixture.test-support';

/** Real Native original-owner scenario, collected for the one consolidated
 * integrated verification. Synthetic Sources remain explicit and accepted by
 * normal owners. No transformed module, prior-view mock, or row transplantation. */
it('PL01 one owned TAKE chain reaches a terminal walk, settles all ten participants, completes the official transition and releases after reopen',()=>{
  const h=samePaPhysicalLifecycleFixture(),{f}=h;
  try{
    const originalHeads=f.db.prepare('SELECT * FROM world_player_workload_heads ORDER BY career_id,player_id').all();
    for(const [ordinal,lateral]of [[3,2],[4,-2],[5,2],[6,-2]] as const){
      const before=h.current(),readyAtUs=Math.max(before.view.cut.evaluationTick,before.view.cut.bodyCut.completedAtTick);
      // Finite, explicitly declared lateral alternatives to the existing
      // ContinuousPitch fixture. They test real balls after two prior strikes;
      // no count event, calibration value, or outcome is supplied to Native.
      const nominalPitch={...h.original.nominalPitch,delivery:{...h.original.nominalPitch.delivery,readyAtUs,
        physics:{...h.original.nominalPitch.delivery.physics,velocity:{...h.original.nominalPitch.delivery.physics.velocity,x:lateral}}}};
      const planned=h.prepareAction('physical-fixture:pitch'+ordinal,'declared_take',nominalPitch);
      const pose=h.preparePosture('physical-fixture:pitch'+ordinal,planned,{...h.geometry,startedAtTick:planned.action.bodyCut.completedAtTick,
        attention:{target:{kind:'ball'},focusedSinceTick:planned.action.bodyCut.completedAtTick},bodyReadyTick:readyAtUs,latestMotorStartTick:readyAtUs});
      const prepared=h.prepareRight(planned,pose.postureReference);
      expect(prepared.action.pitchOrdinal).toBe(ordinal);expect(prepared.right.source.participantInputs).toHaveLength(10);
      expect(prepared.right.source.participantInputs.flatMap(p=>p.calibrationReferences)).toHaveLength(32);
      if(ordinal===3){
        const rows=()=>Object.values(physicalEpisodeTables).map(t=>f.db.prepare('SELECT * FROM '+t+' ORDER BY rowid').all()),beforeRows=json(rows());
        for(const table of ['pa_physical_v1_pitch_consumers','pa_physical_v1_launches','pa_physical_v1_heads','pa_physical_v1_consumptions','pa_physical_v1_admissions']){
          let reached=false;const witness=witnessSqliteWrite(new RegExp('^INSERT INTO main\\.'+table+'(?:\\(| )'),()=>{reached=true;throw new Error('reached physical atomic effect '+table);});
          try{expect(()=>h.launch(prepared)).toThrow('reached physical atomic effect');}finally{witness.close();}
          expect(reached).toBe(true);expect(json(rows())).toBe(beforeRows);
        }
      }
      const launch=h.launch(prepared),launchReference=reference('pa_physical_v1_launches',launch);
      expect(launch.evaluationTick).toBe(launch.delivery.release.releaseAtUs);expect(launch.timeline).toEqual(prepared.action.timeline);
      expect(()=>withSqliteReadTransaction(f.db,()=>readCurrentSamePaLifecycleViewFromSqlite(f.db,before.viewReference))).toThrow();
      expect(withSqliteReadTransaction(f.db,()=>readHistoricalSamePaLifecycleViewFromSqlite(f.db,before.viewReference)).view).toEqual(before.view);
      const s=h.save({sourceId:'physical-fixture:pitch'+ordinal+':resolution',sourceVersion:'fixture-only-v1',capability:'same_pa_physical_resolution_v1',
        viewReference:h.current().viewReference,launchReference,previousOperationReference:launchReference,commitmentReference:null,throughTick:launch.trajectory.endTick});
      const resolved=h.physical.acceptOperation(s.sourceId);if(resolved.kind!=='same_pa_physical_resolution_v1')throw new Error('real later TAKE resolution pending');
      expect(resolved.pitchOrdinal).toBe(ordinal);expect(resolved.resolution.kind).toBe('recorded_take');expect(resolved.contact).toBeNull();
      expect(resolved.evaluationTick).toBeLessThanOrEqual(s.throughTick);
      if(ordinal<6)expect(resolved.timeline.status).toMatchObject({kind:'active',count:{balls:ordinal-2,strikes:2}});
      else expect(resolved.timeline.status.kind).toBe('walk');
      h.advance(reference('pa_physical_v1_resolutions',resolved));
      if(ordinal<6)expect(h.current().view.cut.bodyCut.completedAtTick).toBeGreaterThanOrEqual(launch.delivery.timeline.followThroughEndUs);
    }
    expect(f.db.prepare('SELECT * FROM world_player_workload_heads ORDER BY career_id,player_id').all()).toEqual(originalHeads);
    const allRows=()=>['pa_physical_v1_launches','pa_physical_v1_pitch_consumers','pa_physical_v1_consumptions','pa_physical_v1_admissions'].map(t=>f.db.prepare('SELECT * FROM '+t+' ORDER BY rowid').all());
    const saved=json(allRows());expect(h.physical.acceptOperation('physical-fixture:pitch4:launch').kind).toBe('same_pa_physical_launch_v1');expect(json(allRows())).toBe(saved);
    for(const name of ['pa_physical_v1_launches','pa_physical_v1_pitch_consumers','pa_physical_v1_consumptions','pa_physical_v1_admissions'])expect(f.db.prepare('SELECT count(*) n FROM '+name).get()!.n).toBe(4);
    const completed=completeSamePaTerminalFixture(h,'physical-fixture:terminal');
    expect(completed.endpoint.timeline.status.kind).toBe('walk');
    expect(completed.transition.official.receipt.appliedMatchState.outs).toBe(f.actor.match.outs);
    expect(completed.transition.official.receipt.appliedMatchState.bases.first).toBe(f.actor.binding.playerId);
    expect(completed.release.memberRows).toHaveLength(10);
    const reopened=f.x.f.track(openSqliteSamePlateAppearancePhysicalEpisodeStore(f.path));
    expect(reopened.acceptOperation('physical-fixture:pitch3:launch').kind).toBe('same_pa_physical_launch_v1');
    expect(reopened.acceptOperation('physical-fixture:pitch6:resolution').kind).toBe('same_pa_physical_resolution_v1');
    expect(json(allRows())).toBe(saved);
  }finally{h.close();}
},1_200_000);
