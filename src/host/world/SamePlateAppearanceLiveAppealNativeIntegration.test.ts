import { appendFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { REFERENCE_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import { samePaPhysicalLifecycleFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import { completeSamePaTerminalFixture } from './SamePlateAppearanceTerminalLifecycleFixture.test-support';
import { prepareSamePaOccupiedPhysicalFixture } from './SamePlateAppearanceOccupiedPhysicalFixture.test-support';
import { prepareInFlightBattingSwing } from './InFlightBattingLifecycleFixture.test-support';
import { prepareFreshPhysicalFieldFixture } from './SamePlateAppearancePhysicalFieldFixture.test-support';
import { appendNativePhysicalThrowReception } from './SamePlateAppearancePhysicalThrowReception.test-support';
import { appendNativeLiveAppealCatch } from './SamePlateAppearanceLiveAppealCatchNative.test-support';
import { appendNativeLiveAppealJournal } from './SamePlateAppearanceLiveAppealJournalNative.test-support';
import { liveAppealSceneFixture } from './SamePlateAppearanceLiveAppealScene.test-support';
import { dispatchCalibrationValues } from './SamePlateAppearanceDispatchCalibration.test-support';
import { SAME_PA_ACTOR_PRODUCER_POLICY } from './SamePlateAppearanceActorProducerPolicy';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { readSamePaAdmittedLiveWorkFromSqlite } from './SamePlateAppearanceAdmittedLiveWorkFromSqlite';
import { readSamePaFieldRuleEvidenceFromSqlite } from './SamePlateAppearanceFieldRuleEvidenceFromSqlite';
import { readPhysicalClosureScoringHistory } from './PhysicalPlayClosureEvidenceFromSqlite';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import type { AcceptedSamePaLifecycleOutcome } from './SamePlateAppearanceLifecycleOutcome';

/** One genuine Native route. No physical reader is replaced and no execution
 * row is supplied. This new geometry-qualified scenario has its own proof label;
 * it does not extend the historical PL01/IFN01 result. Run only after batch review. */
it('LAN01 original occupied live appeal reaches explicit official acceptance, closure and Match application',()=>{
  const stage=(name:string)=>{const log=process.env.BASEBALL_GATE_ERRORS;
    if(log)appendFileSync(log+'.LAN01-stages.jsonl',JSON.stringify({name,at:Date.now(),rss:process.memoryUsage().rss})+'\n');};
  const scene=liveAppealSceneFixture(),declared=dispatchCalibrationValues().batter_observation;
  const explicitBatterObservation={...declared,calibration:{...declared.calibration,errorParameters:{...declared.calibration.errorParameters,
    minimumPositionErrorMeters:0,maximumPositionErrorMeters:0,minimumVelocityErrorMps:0,maximumVelocityErrorMps:0}}};
  stage('walk-prefix-start');
  const previous=samePaPhysicalLifecycleFixture({profile:{ruleProfileId:NPB_2026_RULE_PROFILE.id},originalBaseCenters:scene.originalBaseCenters,
    explicitDefenderGloveOffsets:scene.throwScene.gloveOffsets});
  try{
    // Reuse PL01's four finite lateral TAKE inputs and actual terminal owners.
    // This minimal prefix omits PL01's independent atomic-write fault matrix.
    for(const [ordinal,lateral]of [[3,2],[4,-2],[5,2],[6,-2]] as const){
      const before=previous.current(),readyAtUs=Math.max(before.view.cut.evaluationTick,before.view.cut.bodyCut.completedAtTick);
      const planned=previous.prepareAction('lan01:walk:pitch'+ordinal,'declared_take',{...previous.original.nominalPitch,
        delivery:{...previous.original.nominalPitch.delivery,readyAtUs,physics:{...previous.original.nominalPitch.delivery.physics,
          velocity:{...previous.original.nominalPitch.delivery.physics.velocity,x:lateral}}}});
      const posture=previous.preparePosture('lan01:walk:pitch'+ordinal,planned,{...previous.geometry,startedAtTick:planned.action.bodyCut.completedAtTick,
        attention:{target:{kind:'ball'},focusedSinceTick:planned.action.bodyCut.completedAtTick},bodyReadyTick:readyAtUs,latestMotorStartTick:readyAtUs,validUntilTick:readyAtUs+20_000_000});
      const launch=previous.launch(previous.prepareRight(planned,posture.postureReference)),launchReference=reference('pa_physical_v1_launches',launch);
      const source=previous.save({sourceId:'lan01:walk:pitch'+ordinal+':resolution',sourceVersion:'fixture-only-v1',capability:'same_pa_physical_resolution_v1',
        viewReference:previous.current().viewReference,launchReference,previousOperationReference:launchReference,commitmentReference:null,throughTick:launch.trajectory.endTick});
      const resolved=previous.physical.acceptOperation(source.sourceId);
      if(resolved.kind!=='same_pa_physical_resolution_v1')throw new Error('LAN01 genuine walk TAKE pending');
      expect(resolved.resolution.kind).toBe('recorded_take');expect(resolved.contact).toBeNull();
      previous.advance(reference('pa_physical_v1_resolutions',resolved));
    }
    const walked=completeSamePaTerminalFixture(previous,'lan01:walk:terminal');
    expect(walked.endpoint.timeline.status.kind).toBe('walk');expect(walked.release.memberRows).toHaveLength(10);
    stage('walk-applied-checkpoint');
    const h=prepareSamePaOccupiedPhysicalFixture(previous,walked,'lan01:occupied',{
      explicitBatterObservation,initialPlay:{venue:{pitcherPlate:scene.pitcherPlate,rulePolicy:scene.rulePolicy},
        officialPerson:{sourceId:'lan01:initial-person',sourceVersion:'fixture-only-v1',capability:'accepted_original_umpire_person_v1',
          careerId:previous.f.actor.binding.careerId,officialId:'lan01:plate-umpire',personId:'lan01:plate-umpire-person'},
        assignmentPolicy:{sourceId:'lan01:initial-policy',sourceVersion:'fixture-only-v1',ruleProfileId:NPB_2026_RULE_PROFILE.id,kind:'accepted_original_live_ball_action_v1'}}});
    expect(h.f.actor.match.bases).toEqual({first:previous.f.actor.binding.playerId,second:null,third:null});
    expect(h.initialPlay?.play.state).toBe('live');expect(h.genesis.scope.playerId).toBe(h.f.actor.binding.playerId);
    expect(h.sceneBodyReferences.filter(p=>p.playerId!==previous.f.actor.binding.playerId)).toEqual(previous.sceneBodyReferences);
    stage('occupied-live-play-and-takes');
    const before=h.current(),readyAtUs=Math.max(before.view.cut.evaluationTick,before.view.cut.bodyCut.completedAtTick);
    const action=h.prepareAction('lan01:swing','observer_decision',{...h.original.nominalPitch,
      delivery:{...h.original.nominalPitch.delivery,readyAtUs,physics:{velocity:{x:0,y:3.5,z:-40},spin:{x:0,y:0,z:0}}}},
      {ticksPerSecond:1_000_000,integrationStepTicks:2_000,gravityY:-9.81,aerodynamics:REFERENCE_BASEBALL_AERODYNAMICS});
    const preparations:ReturnType<typeof prepareFreshPhysicalFieldFixture>[]=[];
    const swing=prepareInFlightBattingSwing(h,action,'lan01:swing',owned=>{
      preparations.push(prepareFreshPhysicalFieldFixture(h,action,owned.posture,owned.postureReference,'lan01:field',{
        liveProducerProfile:'same_pa_stationary_occupied_catch_v1',bags:scene.bags,legalVenue:scene,
        actorProducerPolicies:h.current().basis.members.map(m=>({playerId:m.playerId,policy:SAME_PA_ACTOR_PRODUCER_POLICY}))}));
    });
    const preparation=preparations[0];expect(preparations).toHaveLength(1);expect(preparation.model.actors).toHaveLength(11);
    expect(preparation.model.actors).toEqual([swing.posture.model.bodyMaterialization,...swing.posture.sceneBodies].map(b=>b.actor));
    expect(swing.posture.source.occupiedRunnerHoldReferences).toEqual(h.original.occupiedRunnerHoldReferences);
    expect(swing.posture.source.geometry.validUntilTick).toBeLessThanOrEqual(h.occupied.hold.source.coverageThroughTick);
    const field=preparation.appendField(swing.resolution,swing.resolutionReference);
    stage('occupied-field-original-model-bound');
    let caught:ReturnType<typeof appendNativeLiveAppealCatch>|undefined;
    const thrown=appendNativePhysicalThrowReception(h,field,'lan01:appeal-throw',{appealRunnerId:previous.f.actor.binding.playerId,
      onSecured:secured=>{caught=appendNativeLiveAppealCatch(h,secured,'lan01:caught');}});
    if(!caught||!thrown.appealed||thrown.appealed.value.actionResult?.kind!=='appeal_contact_v1')throw new Error('LAN01 original appeal receipt missing');
    expect(thrown.appealed.value.actionResult.execution.kind).toBe('executed');
    expect(thrown.appealed.value.field.motion.carrierPlayerId).toBe('home-1');
    expect(thrown.released.value.actionResult?.kind).toBe('throw_checkpoint_v1');
    stage('actual-linked-throw-reception-and-appeal');
    const previousReference=thrown.appealed.operationReference;
    const sealSource=h.save({sourceId:'lan01:seal',sourceVersion:'fixture-only-v1',capability:'same_pa_physical_field_step_v1',
      viewReference:h.current().viewReference,launchReference:field.root.source.launchReference,fieldRootReference:field.rootReference,
      previousOperationReference:previousReference,previousFieldReference:previousReference,throughTick:thrown.appealed.value.evaluationTick,
      action:{kind:'retained_quantizer_checkpoint_v1'}});
    const sealed=h.physical.acceptOperation(sealSource.sourceId);
    if(sealed.kind!=='same_pa_physical_field_step_v1'||sealed.actionResult?.kind!=='retained_quantizer_checkpoint_v1')throw new Error('LAN01 retained seal missing');
    expect(sealed.actionResult.status).toBe('checkpoint_reached');h.advance(reference('pa_physical_v1_field_steps',sealed));
    const finalCall=caught.refresh(),current=h.current();
    const live=withSqliteReadTransaction(h.f.db,()=>readSamePaAdmittedLiveWorkFromSqlite(h.f.db,current.viewReference,'current'));
    if(live.kind!=='same_pa_live_work_read_v1')throw new Error('LAN01 admitted original work missing');
    expect(live.actorProducerWork?.actors).toHaveLength(11);
    expect(live.actorProducerWork?.actors.every(a=>a.hold?.basis==='original_stationary_command'&&a.observationScheduling.complete&&a.controllerRenewal.complete)).toBe(true);
    const rule=withSqliteReadTransaction(h.f.db,()=>readSamePaFieldRuleEvidenceFromSqlite(h.f.db,current.viewReference,'current'));
    if(rule.kind!=='same_pa_field_rule_evidence_v1'||rule.fairCatch.kind!=='same_pa_fair_catch_rule_basis_v1')throw new Error('LAN01 complete occupied rule result missing');
    expect(rule.fairCatch.correctRuling).toEqual({outsAfter:h.f.actor.match.outs+1,basesAfter:h.f.actor.match.bases,scoredRunnerIds:[]});
    const officialPolicy={sourceId:'lan01:window-policy',sourceVersion:'fixture-only-v1',ruleProfileId:NPB_2026_RULE_PROFILE.id,
      officialWindows:{appeal:{available:true},review:{available:true},challenge:{available:false}}};
    const journal=appendNativeLiveAppealJournal(h,finalCall.workReference,thrown.appealed.operationReference,officialPolicy,'lan01:journal','lan01:scheduler');
    stage('original-rights-and-explicit-official-acceptance');
    const source:Extract<AcceptedSamePaLifecycleOutcome,{kind:'fair_catch'}>={sourceId:'lan01:terminal:outcome',sourceVersion:'fixture-only-v1',
      capability:'same_pa_lifecycle_outcome_v1',enrollmentReference:current.view.lineage.enrollmentReference,viewReference:current.viewReference,
      physicalOperationReference:current.view.cut.physicalOperationReference,kind:'fair_catch',rulePolicy:null,catchWorkReference:finalCall.workReference,
      officialPolicy,postPlayReviewReference:journal.pin,official:{sourceId:'lan01:terminal:scheduler',sourceVersion:'fixture-only-v1',schedulerId:'lan01:scheduler',
        events:[{sourceId:'lan01:terminal:advance',sourceVersion:'fixture-only-v1',schedulerId:'lan01:scheduler',kind:'advance_tick'},
          {sourceId:'lan01:terminal:fence',sourceVersion:'fixture-only-v1',schedulerId:'lan01:scheduler',kind:'next_play_fence'}]}};
    const completed=completeSamePaTerminalFixture(h,'lan01:terminal',source);
    expect(completed.release.memberRows).toHaveLength(11);expect(completed.transition.official.receipt.appliedMatchState.bases).toEqual(h.f.actor.match.bases);
    expect(completed.transition.scoring.record).toMatchObject({classification:'fly_out',runsScored:0});
    const history=withSqliteReadTransaction(h.f.db,()=>readPhysicalClosureScoringHistory(h.f.db,{gameId:h.f.actor.source.gameId,
      officialRevision:completed.transition.official.receipt.durableRevision}));
    expect(history.at(-1)?.scoring).toEqual(completed.transition.scoring);journal.assertHistoricalReplay();
    stage('closure-total-scoring-match-and-reopen');
  }finally{previous.close();}
},1_800_000);
