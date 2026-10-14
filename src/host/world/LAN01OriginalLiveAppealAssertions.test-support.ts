import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { expect } from 'vitest';
import { REFERENCE_BASEBALL_AERODYNAMICS } from '../../core/sim/ball/BaseballAerodynamics';
import type { SamePaPreparedPhysicalLifecycle } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import { completeSamePaTerminalFixture } from './SamePlateAppearanceTerminalLifecycleFixture.test-support';
import type { SamePaOccupiedPhysicalSuffix } from './SamePlateAppearanceOccupiedPhysicalFixture.test-support';
import { prepareInFlightBattingSwing } from './InFlightBattingLifecycleFixture.test-support';
import { prepareFreshPhysicalFieldFixture } from './SamePlateAppearancePhysicalFieldFixture.test-support';
import { appendNativePhysicalThrowReception } from './SamePlateAppearancePhysicalThrowReception.test-support';
import { appendNativeLiveAppealCatch } from './SamePlateAppearanceLiveAppealCatchNative.test-support';
import { appendNativeLiveAppealJournal, type RetainedNativeLiveAppealSession, type RetainedNativeLiveAppealImport } from './SamePlateAppearanceLiveAppealJournalNative.test-support';
import { liveAppealSceneFixture } from './SamePlateAppearanceLiveAppealScene.test-support';
import { SAME_PA_ACTOR_PRODUCER_POLICY } from './SamePlateAppearanceActorProducerPolicy';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { readSamePaAdmittedLiveWorkFromSqlite } from './SamePlateAppearanceAdmittedLiveWorkFromSqlite';
import { readSamePaFieldRuleEvidenceFromSqlite } from './SamePlateAppearanceFieldRuleEvidenceFromSqlite';
import { readPhysicalClosureScoringHistory } from './PhysicalPlayClosureEvidenceFromSqlite';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import type { AcceptedSamePaLifecycleOutcome } from './SamePlateAppearanceLifecycleOutcome';
import { declareLAN01SwingCalibration } from './LAN01SwingCalibration.test-support';

/** Verbatim original callback remainder after occupied physical preparation.
 * Earlier walk/prefix assertions are historical evidence, never suffix credit. */
export const continueLAN01OriginalLiveAppealAssertions = (
  previous: { f: Pick<SamePaPreparedPhysicalLifecycle['f'], 'actor'>; sceneBodyReferences: SamePaPreparedPhysicalLifecycle['sceneBodyReferences'] },
  h: SamePaOccupiedPhysicalSuffix, scene: ReturnType<typeof liveAppealSceneFixture>, stage: (name: string) => void,
) => {
    expect(h.f.actor.match.bases).toEqual({first:previous.f.actor.binding.playerId,second:null,third:null});
    expect(h.initialPlay?.play.state).toBe('live');expect(h.genesis.scope.playerId).toBe(h.f.actor.binding.playerId);
    expect(h.sceneBodyReferences.filter(p=>p.playerId!==previous.f.actor.binding.playerId)).toEqual(previous.sceneBodyReferences);
    stage('occupied-live-play-and-takes');
    declareLAN01SwingCalibration(h.f);
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
    return continueLAN01OriginalLiveAppealAfterSwingAssertions(previous, h, preparations, swing, stage);
};

/** Original post-swing callback remainder. The preceding four assertions and
 * completed preparation are historical evidence at the retained delivery cut;
 * this shared tail gives fresh callers all twenty assertions in original order. */
export const continueLAN01OriginalLiveAppealAfterSwingAssertions = (
  previous: { f: Pick<SamePaPreparedPhysicalLifecycle['f'], 'actor'> },
  h: SamePaPreparedPhysicalLifecycle & { occupied: Pick<SamePaOccupiedPhysicalSuffix['occupied'], 'hold'> },
  preparations: readonly Pick<ReturnType<typeof prepareFreshPhysicalFieldFixture>, 'model' | 'appendField'>[],
  swing: Pick<ReturnType<typeof prepareInFlightBattingSwing>, 'posture' | 'resolution' | 'resolutionReference'>,
  stage: (name: string) => void,
) => {
    const preparation=preparations[0];expect(preparations).toHaveLength(1);expect(preparation.model.actors).toHaveLength(11);
    expect(preparation.model.actors).toEqual([swing.posture.model.bodyMaterialization,...swing.posture.sceneBodies].map(b=>b.actor));
    expect(swing.posture.source.occupiedRunnerHoldReferences).toEqual(h.original.occupiedRunnerHoldReferences);
    expect(swing.posture.source.geometry.validUntilTick).toBeLessThanOrEqual(h.occupied.hold.source.coverageThroughTick);
    const field=preparation.appendField(swing.resolution,swing.resolutionReference);
    stage('occupied-field-original-model-bound');
    let caught:ReturnType<typeof appendNativeLiveAppealCatch>|undefined;
    const thrown=appendNativePhysicalThrowReception(h,field,'lan01:appeal-throw',{appealRunnerId:previous.f.actor.binding.playerId,
      onSecured:secured=>{caught=appendNativeLiveAppealCatch(h,secured,'lan01:caught');}});
    return continueLAN01OriginalLiveAppealAfterThrowAssertions(h, field, caught, thrown, stage);
};

/** The first four and next five callback assertions are historical at R9.
 * These eleven original post-throw assertions remain pending in the same order. */
export const continueLAN01OriginalLiveAppealAfterThrowAssertions = (
  h: SamePaPreparedPhysicalLifecycle,
  field: ReturnType<ReturnType<typeof prepareFreshPhysicalFieldFixture>['appendField']>,
  caught: Pick<ReturnType<typeof appendNativeLiveAppealCatch>, 'refresh'> | undefined,
  thrown: Pick<ReturnType<typeof appendNativePhysicalThrowReception>, 'released' | 'appealed'>,
  stage: (name: string) => void,
) => {
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
    const finalCall=caught.refresh();
    return continueLAN01OriginalLiveAppealSealedAssertions(h, finalCall, thrown.appealed.operationReference, stage);
};

/** Original post-seal reads, journal, terminal closure and readbacks. cp16 has
 * already passed the first three assertions; they remain current revalidation,
 * while only the final four callback assertions count as new suffix evidence. */
export const continueLAN01OriginalLiveAppealSealedAssertions = (
  h: SamePaPreparedPhysicalLifecycle,
  finalCall: Pick<ReturnType<typeof appendNativeLiveAppealCatch>, 'workReference'>,
  executionReference: NonNullable<ReturnType<typeof appendNativePhysicalThrowReception>['appealed']>['operationReference'],
  stage: (name: string) => void, retainedSession?: RetainedNativeLiveAppealSession | RetainedNativeLiveAppealImport,
) => {
    const current=h.current();
    const live=withSqliteReadTransaction(h.f.db,()=>readSamePaAdmittedLiveWorkFromSqlite(h.f.db,current.viewReference,'current'));
    if(live.kind!=='same_pa_live_work_read_v1')throw new Error('LAN01 admitted original work missing');
    expect(live.actorProducerWork?.actors).toHaveLength(11);
    expect(live.actorProducerWork?.actors.every(a=>a.hold?.basis==='original_stationary_command'&&a.observationScheduling.complete&&a.controllerRenewal.complete)).toBe(true);
    const rule=withSqliteReadTransaction(h.f.db,()=>readSamePaFieldRuleEvidenceFromSqlite(h.f.db,current.viewReference,'current'));
    if(rule.kind!=='same_pa_field_rule_evidence_v1'||rule.fairCatch.kind!=='same_pa_fair_catch_rule_basis_v1')throw new Error('LAN01 complete occupied rule result missing');
    expect(rule.fairCatch.correctRuling).toEqual({outsAfter:h.f.actor.match.outs+1,basesAfter:h.f.actor.match.bases,scoredRunnerIds:[]});
    const officialPolicy={sourceId:'lan01:window-policy',sourceVersion:'fixture-only-v1',ruleProfileId:NPB_2026_RULE_PROFILE.id,
      officialWindows:{appeal:{available:true},review:{available:true},challenge:{available:false}}};
    const journal=appendNativeLiveAppealJournal(h,finalCall.workReference,executionReference,officialPolicy,'lan01:journal','lan01:scheduler',retainedSession);
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
};
