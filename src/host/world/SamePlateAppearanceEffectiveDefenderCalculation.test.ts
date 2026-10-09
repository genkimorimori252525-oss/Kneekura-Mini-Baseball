import { afterAll, expect, it } from 'vitest';
import { deriveActualLocomotionReceiptWithCalibration } from './ActualLocomotion';
import { actualLocomotionFixture } from './ActualLocomotionFixtures.test-support';
import { effectiveDefenderSourceFixture } from './SamePlateAppearanceEffectiveDefender.test-support';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { playerDecisionModelEvidenceFromSqlite } from './SqlitePlayerDecisionModelStore';
import { actualDefensivePlanEvidenceFromSqlite } from './SqliteActualDefensivePlanStore';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { rawCensus } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { calculateSamePaEffectiveControllerCandidate } from './SamePlateAppearanceEffectiveControllerCalculation';
const modules = import.meta.glob('./SamePlateAppearanceEffectiveDefenderCalculation.ts');
const api = async () => { const load = modules['./SamePlateAppearanceEffectiveDefenderCalculation.ts'];
  expect(load, 'EFFECTIVE_DECISION_COMMAND_COMPOSITION_MISSING').toBeTypeOf('function'); return await load() as any; };
let fixture: ReturnType<typeof actualLocomotionFixture> | undefined;
afterAll(() => fixture?.f.close());
const setup = () => {
  const f = fixture ??= actualLocomotionFixture();
  const read = <T>(body: () => T) => withSqliteReadTransaction(f.f.db, () => withBattedWorldPhysicalReadTraversal(f.f.db, body));
  const decisionModel = read(() => playerDecisionModelEvidenceFromSqlite(f.f.db).read(f.decision.source.decisionModelSourceId)!);
  const observation = f.observations.read(f.observationSource.sourceId)!, plan = read(() => actualDefensivePlanEvidenceFromSqlite(f.f.db).read(f.decision.source.planSourceId)!);
  const source = effectiveDefenderSourceFixture().decision;
  const physical = f.baseField.response.touch.worldContact.flight.physicalPitch.source;
  source.physicalSourceReference = { sourceId: physical.sourceId, sourceVersion: physical.sourceVersion, sourceHash: hash(physical) };
  source.member = { ...source.member, playerId: 'p2', bindingHash: hash(plan.binding), personHash: hash(decisionModel.fieldingModel.person) };
  source.originalInputReferences = { observationReference: reference('actual_field_observations', observation), planReference: reference('actual_defensive_plans', plan),
    nominalDecisionModelReference: reference('world_player_decision_models', decisionModel), baseFieldReference: reference('batted_world_field_actions', f.baseField),
    executionReference: reference('batted_world_field_executions', f.executed) };
  const motionInputs = { nominalLocomotionModelReference: reference('world_player_locomotion_models', f.model),
    baseFieldReference: source.originalInputReferences.baseFieldReference, executionReference: source.originalInputReferences.executionReference };
  return { ...f, read, decisionModel, source, motionInputs };
};
/** Real normal-owner inputs with explicit fixture-only effective values. The
 * deferred right/calibration/member-state fields in the Source are shape data,
 * not accepted dispatch proofs. This produces no accepted consumer row. */
it('EC01 an issued effective hold produces the new command and retains the actual new decision instead of nominal v1', async () => {
  const { calculateSamePaEffectiveDefenderCandidate: calculate } = await api(), f = setup(), before = rawCensus(f.f.db), nominalHash = hash(f.decision);
  expect(f.decision.receipt.selected.intent.kind).toBe('ball_handler');
  const value = f.read(() => calculate(f.f.db, f.source, f.motionInputs,
    { decision: { ...f.decisionModel.source.calibration, minimumCueConfidence: 1 }, locomotion: f.model.source.calibration }));
  expect(value.kind).toBe('same_pa_effective_defender_candidate_pair_v1');
  expect(value.decisionCandidate.kind).toBe('same_pa_effective_defensive_decision_v1');
  expect(value.decisionCandidate.receipt.selected.intent.kind).toBe('hold');
  expect(value.decisionCandidate.receipt.lifecycle).toMatchObject({ status: 'issued', issuedBySourceId: f.source.sourceId });
  expect(value.commandCandidate.kind).toBe('same_pa_effective_defender_command_v1');
  expect(value.commandCandidate.decisionCandidate).toEqual(value.decisionCandidate);
  expect(value.commandCandidate.motion.intent.kind).toBe('hold'); expect(value.commandCandidate.motion.target).toBeNull();
  expect(value.commandCandidate.motion.issuedAt).toEqual(value.decisionCandidate.receipt.lifecycle.issuedAt);
  expect(value.commandCandidate.motion.self.activeCommand).toEqual(value.commandCandidate.motion.retainedRoles[0].command);
  expect(hash(f.decision)).toBe(nominalHash); expect(rawCensus(f.f.db)).toEqual(before);
});
it('EC02 pending effective decision or motor timing produces no command at the owned cut', async () => {
  const { calculateSamePaEffectiveDefenderCandidate: calculate } = await api(), f = setup();
  for (const calibration of [
    { ...f.decisionModel.source.calibration, decisionTimingParameters: { ...f.decisionModel.source.calibration.decisionTimingParameters, fixedProcessingOffsetTicks: 15 } },
    { ...f.decisionModel.source.calibration, firstStepTimingParameters: { ...f.decisionModel.source.calibration.firstStepTimingParameters, fixedMotorOffsetTicks: 12 } },
  ]) {
    const value = f.read(() => calculate(f.f.db, f.source, f.motionInputs, { decision: calibration, locomotion: f.model.source.calibration }));
    expect(value.commandCandidate).toBeNull(); expect(value.decisionCandidate.receipt.lifecycle.issuedAt).toBeNull();
    expect(value.decisionCandidate.receipt.lifecycle.status).toMatch(/^pending_/);
  }
});
it('EC03 command composition rejects foreign self cuts and nominal models without rewriting original commands', async () => {
  const { calculateSamePaEffectiveDefenderCandidate: calculate } = await api(), f = setup(), before = rawCensus(f.f.db);
  const values = { decision: f.decisionModel.source.calibration, locomotion: f.model.source.calibration };
  expect(() => f.read(() => calculate(f.f.db, f.source, { ...f.motionInputs, executionReference: null }, values))).toThrow(/cut|reference|differs/);
  expect(() => f.read(() => calculate(f.f.db, f.source, { ...f.motionInputs, nominalLocomotionModelReference: { ...f.motionInputs.nominalLocomotionModelReference, snapshotHash: hash('foreign') } }, values))).toThrow();
  expect(() => calculate(f.f.db, f.source, f.motionInputs, values)).toThrow(/read-only|transaction/);
  expect(rawCensus(f.f.db)).toEqual(before);
});

it('EC04 the v1 projection cannot replace original Source identity with unrelated receipt fields', () => {
  const f = setup(), self = f.locomotion.accept(f.locomotionSource.sourceId).receipt.self;
  const original = deriveActualLocomotionReceiptWithCalibration(f.decision, f.model, self, f.model.source.calibration);
  const extra = { ...f.decision, receipt: { ...f.decision.receipt, sourceId: 'unrelated-receipt-id', playerId: 'foreign', physicalPitchSourceId: 'foreign' } };
  expect(() => deriveActualLocomotionReceiptWithCalibration(extra, f.model, self, f.model.source.calibration), 'V1_SOURCE_IDENTITY_MUST_REMAIN_ORIGINAL').not.toThrow();
  expect(deriveActualLocomotionReceiptWithCalibration(extra, f.model, self, f.model.source.calibration)).toEqual(original);
});

it('EC05 original-owner controller composition retains all ten commands and applies the actual effective issued result', async () => {
  const { calculateSamePaEffectiveDefenderCandidate: calculate } = await api(), f = setup(), before = rawCensus(f.f.db);
  const values = { decision: { ...f.decisionModel.source.calibration, minimumCueConfidence: 1 }, locomotion: f.model.source.calibration };
  const pair = f.read(() => calculate(f.f.db, f.source, f.motionInputs, values));
  const throughTick = pair.commandCandidate.motion.coverageEndTick;
  const result = f.read(() => calculateSamePaEffectiveControllerCandidate(f.f.db, [{ source: f.source as any, motionInputs: f.motionInputs, values }], throughTick));
  expect(result.kind).toBe('same_pa_effective_controller_calculated_v1'); expect(result.physicalEffect).toBe('none');
  const controller = result.controllerCandidate!;
  expect(controller.contributors).toHaveLength(10); expect(new Set(controller.contributors.map(c => c.playerId)).size).toBe(10);
  const selected = controller.contributors.find(c => c.playerId === f.source.member.playerId)!;
  expect(selected.effectiveCommand).toEqual(pair.commandCandidate); expect(selected.command).toEqual(pair.commandCandidate.motion.command);
  expect(selected.effectiveCommand!.decisionCandidate.receipt.lifecycle.issuedBySourceId).toBe(f.source.sourceId);
  expect(controller.contributors.filter(c => c.effectiveCommand === null)).toHaveLength(9);
  expect(controller.field.motion.world.moment.ball.tick).toBeLessThanOrEqual(throughTick);
  expect(controller.checkpointThroughTick).toBeLessThanOrEqual(controller.coverageThroughTick);
  expect(rawCensus(f.f.db)).toEqual(before);
});

it('EC06 pending effective decisions produce no controller or field advance', () => {
  const f = setup(), before = rawCensus(f.f.db), values = {
    decision: { ...f.decisionModel.source.calibration, decisionTimingParameters: {
      ...f.decisionModel.source.calibration.decisionTimingParameters, fixedProcessingOffsetTicks: 15 } }, locomotion: f.model.source.calibration };
  const result = f.read(() => calculateSamePaEffectiveControllerCandidate(f.f.db, [{ source: f.source as any, motionInputs: f.motionInputs, values }], 1000));
  expect(result.kind).toBe('same_pa_effective_controller_pending_v1'); expect(result.controllerCandidate).toBeNull();
  expect(result.decisions[0].commandCandidate).toBeNull(); expect(rawCensus(f.f.db)).toEqual(before);
});
