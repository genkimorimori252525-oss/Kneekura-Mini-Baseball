import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createPlayerDecisionCalibration, type PlayerDecisionCalibration } from '../../core/sim/fielding/PlayerDecisionCalibration';
import { createPlayerLocomotionCalibration, type PlayerLocomotionCalibration } from '../../core/sim/fielding/PlayerLocomotionCalibration';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaEffectiveDefenderSourceInput, samePaEffectiveMotionInputsInput, type SamePaEffectiveDecisionSource } from './SamePlateAppearanceEffectiveDefenderSource';
import { actualDefensiveBoundary, actualDefensiveContextFromSqlite } from './ActualDefensiveContext';
import { actualDefensivePlanEvidenceFromSqlite } from './SqliteActualDefensivePlanStore';
import { playerDecisionModelEvidenceFromSqlite } from './SqlitePlayerDecisionModelStore';
import { playerLocomotionModelEvidenceFromSqlite } from './SqlitePlayerLocomotionModelStore';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite } from './SqliteBattedWorldFieldExecutionStore';
import { calculateDefensiveExecution } from './DefensiveExecutionCalculation';
import { actualPlayerKinematicsEvidenceFromSqlite } from './SqliteActualPlayerKinematicsReader';
import { actualLocomotionPhysicalAvailabilityFromSqlite } from './ActualLocomotionPhysicalAvailability';
import { deriveIssuedDefenderMotionReceipt, type IssuedDefenderMotionDecision } from './ActualLocomotion';
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('effective defender original reference or cut differs'); };
const required = <T>(v: T | null): T => { if (!v) throw new Error('effective defender original owner missing'); return v; };

/** Real original-owner composition with explicit numerical execution values.
 * Right/calibration/view acceptance is deliberately not claimed here; the private
 * owner must authenticate that complete graph before use. These candidate data
 * grant no write/admission authority and are never accepted as caller proof. No
 * caller-supplied decision result enters the command calculation. */
export const calculateSamePaEffectiveDefenderCandidate = (db: DatabaseSync, rawSource: SamePaEffectiveDecisionSource, rawMotionInputs: unknown,
  rawValues: Readonly<{ decision: PlayerDecisionCalibration; locomotion: PlayerLocomotionCalibration }>) => {
  const state = () => json({ transaction: db.isTransaction, query: db.prepare('PRAGMA query_only').get()!.query_only,
    changes: db.prepare('SELECT total_changes() AS n').get()!.n, main: db.prepare('PRAGMA main.schema_version').get()!.schema_version,
    temp: db.prepare('PRAGMA temp.schema_version').get()!.schema_version });
  if (!db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 1) throw new Error('effective defender composition requires read-only transaction');
  const before = state(), source = samePaEffectiveDefenderSourceInput(rawSource), motionInputs = samePaEffectiveMotionInputsInput(rawMotionInputs), values = cloneInert(rawValues);
  if (source.route !== 'defender_decision' || !samePaFields(values, ['decision', 'locomotion'])) throw new Error('invalid effective defender calculation inputs');
  const decisionCalibration = createPlayerDecisionCalibration(values.decision), motionCalibration = createPlayerLocomotionCalibration(values.locomotion);
  const inputs = source.originalInputReferences;
  same(motionInputs.baseFieldReference, inputs.baseFieldReference); same(motionInputs.executionReference, inputs.executionReference);
  const context = actualDefensiveContextFromSqlite(db).read(inputs.observationReference.sourceId, source.physicalSourceReference.sourceId, source.member.playerId);
  const observation = context.observation, b = context.binding, at = observation.receipt.at;
  same(reference('actual_field_observations', observation), inputs.observationReference);
  same(observation.source.baseFieldSourceId, inputs.baseFieldReference.sourceId); same(observation.source.executionSourceId, inputs.executionReference?.sourceId ?? null);
  const field = required(battedWorldFieldEvidenceFromSqlite(db).read(inputs.baseFieldReference.sourceId));
  same(reference('batted_world_field_actions', field), inputs.baseFieldReference);
  const physical = field.response.touch.worldContact.flight.physicalPitch.source;
  same(source.physicalSourceReference, { sourceId: physical.sourceId, sourceVersion: physical.sourceVersion, sourceHash: hash(physical) });
  if (inputs.executionReference) {
    const execution = required(battedWorldFieldExecutionEvidenceFromSqlite(db).read(inputs.executionReference.sourceId));
    same(reference('batted_world_field_executions', execution), inputs.executionReference);
  }
  const nominal = required(playerDecisionModelEvidenceFromSqlite(db).read(inputs.nominalDecisionModelReference.sourceId));
  const plan = required(actualDefensivePlanEvidenceFromSqlite(db).read(inputs.planReference.sourceId));
  same(reference('world_player_decision_models', nominal), inputs.nominalDecisionModelReference); same(reference('actual_defensive_plans', plan), inputs.planReference);
  same(nominal.fieldingModel, context.fieldingModel); same(plan.binding, b);
  if (nominal.source.careerId !== b.careerId || nominal.source.playerId !== b.playerId || nominal.source.personLinkSourceId !== b.personLinkSourceId
    || nominal.source.acceptedAtDay > b.gameDay || plan.source.physicalPitchSourceId !== source.physicalSourceReference.sourceId
    || plan.source.playerId !== b.playerId || plan.source.fieldingModelSourceId !== context.fieldingModel.source.sourceId
    || plan.availability.originTick !== at.originTick || plan.availability.elapsedSeconds > at.elapsedSeconds
    || !observation.history.some(s => s.sourceId === plan.source.observationSourceId)) throw new Error('effective defender original model or plan scope differs');
  same(source.member.bindingHash, hash(b)); same(source.member.personHash, hash(nominal.fieldingModel.person));
  const perceived = observation.receipt.perceived;
  if (perceived.communications.length || perceived.knownContext !== null) throw new Error('effective defender unsupported original semantic context');
  const calculated = calculateDefensiveExecution({ decision: { perceivedWorld: perceived, self: { playerId: b.playerId }, prePlayPlan: plan.source.priorities, perceivedCues: [] },
    startedAtTick: actualDefensiveBoundary(at, context.ticksPerSecond), ratings: context.fieldingModel.source.ratings }, decisionCalibration);
  if (calculated.selected.intent.kind !== 'ball_handler' && calculated.selected.intent.kind !== 'hold') throw new Error('effective defender unsupported intent');
  const reached = (tick: number) => at.elapsedSeconds >= (tick - at.originTick) / context.ticksPerSecond;
  const status = reached(calculated.scheduling.movementStartTick) ? 'issued' : reached(calculated.scheduling.decisionTick) ? 'pending_first_step' : 'pending_decision';
  const ball = calculated.selected.intent.kind === 'ball_handler' ? observation.receipt.samples.ball : null;
  if (ball && (ball.at.originTick !== at.originTick || ball.at.elapsedSeconds > at.elapsedSeconds)) throw new Error('effective defender original ball evidence is future');
  const lifecycle: IssuedDefenderMotionDecision['lifecycle'] = { status, issuedAt: status === 'issued' ? at : null, issuedBySourceId: status === 'issued' ? source.sourceId : null };
  const receipt = { self: context.self, availability: at, observedThrough: at, ticksPerSecond: context.ticksPerSecond,
    selected: { ...calculated.selected, evidenceKinds: calculated.selected.evidenceKinds.map(k => k === 'pre_play_plan' ? 'accepted_contextual_priorities' : k) },
    target: calculated.selected.intent.kind === 'ball_handler' ? { x: perceived.ball!.estimate.position.x, z: perceived.ball!.estimate.position.z } : null,
    evidence: ball ? { captureAt: ball.at, confidence: perceived.ball!.confidence } : null, scheduling: calculated.scheduling,
    lifecycle };
  const decisionCandidate = freeze(cloneInert({ kind: 'same_pa_effective_defensive_decision_v1' as const, source,
    nominalModelHash: hash(nominal), effectiveValuesHash: hash(decisionCalibration), receipt }));
  const finish = <T>(commandCandidate: T) => { same(state(), before); return freeze({ kind: 'same_pa_effective_defender_candidate_pair_v1' as const, decisionCandidate, commandCandidate }); };
  if (status !== 'issued') return finish(null);
  const model = required(playerLocomotionModelEvidenceFromSqlite(db).read(motionInputs.nominalLocomotionModelReference.sourceId));
  same(reference('world_player_locomotion_models', model), motionInputs.nominalLocomotionModelReference); same(model.fieldingModel, context.fieldingModel);
  const cut = { physicalPitchSourceId: source.physicalSourceReference.sourceId, playerId: source.member.playerId,
    baseFieldSourceId: motionInputs.baseFieldReference.sourceId, executionSourceId: motionInputs.executionReference?.sourceId ?? null, mode: 'original' as const };
  const self = actualPlayerKinematicsEvidenceFromSqlite(db).read(cut);
  same(self.at, at);
  if (self.gameId !== b.gameId || self.gameDay !== b.gameDay || self.personId !== b.personId || self.personLinkSourceId !== b.personLinkSourceId
    || model.source.careerId !== b.careerId || model.source.playerId !== b.playerId || model.source.personLinkSourceId !== b.personLinkSourceId) throw new Error('effective command original self/model scope differs');
  const availability = actualLocomotionPhysicalAvailabilityFromSqlite(db, cut, self);
  const d = decisionCandidate.receipt;
  const issued: IssuedDefenderMotionDecision = { sourceId: source.sourceId, playerId: b.playerId, physicalPitchSourceId: source.physicalSourceReference.sourceId,
    lifecycle: d.lifecycle, ticksPerSecond: d.ticksPerSecond, availability: d.availability, scheduling: d.scheduling, selected: d.selected, target: d.target };
  const motion = deriveIssuedDefenderMotionReceipt(issued, model, self, motionCalibration);
  return finish({ kind: 'same_pa_effective_defender_command_v1' as const, decisionCandidate, originalInputReferences: motionInputs,
    nominalModelHash: hash(model), effectiveValuesHash: hash(motionCalibration), physicalAvailability: availability, motion });
};
