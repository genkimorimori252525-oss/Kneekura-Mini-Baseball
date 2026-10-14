import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createPlayerObservationCalibration, type PlayerObservationCalibration } from '../../core/sim/perception/PlayerObservationCalibration';
import { createPlayerDecisionCalibration, type PlayerDecisionCalibration } from '../../core/sim/fielding/PlayerDecisionCalibration';
import { createPlayerLocomotionCalibration, type PlayerLocomotionCalibration } from '../../core/sim/fielding/PlayerLocomotionCalibration';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields, samePaReferenceValid, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actualFieldObservationEvidenceFromSqlite } from './SqliteActualFieldObservationStore';
import { actualDefensiveDecisionEvidenceFromSqlite } from './SqliteActualDefensiveDecisionStore';
import { actualLocomotionEvidenceFromSqlite } from './SqliteActualLocomotionStore';
import { playerObservationModelEvidenceFromSqlite } from './SqlitePlayerObservationModelStore';
import { playerDecisionModelEvidenceFromSqlite } from './SqlitePlayerDecisionModelStore';
import { playerLocomotionModelEvidenceFromSqlite } from './SqlitePlayerLocomotionModelStore';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite } from './SqliteBattedWorldFieldExecutionStore';
import { actualObservationPhysicalPrefixEvidence } from './ActualObservationPhysicalPrefixHash';
import { battedWorldPhysicalPrefixAndWholePlayHistory } from './WholePlayPhysicalHistoryFromPrefix';
import { actualBattedWorldObservationMoment } from './ActualFieldObservation';
import { battedWorldFieldGeometry } from './BattedWorldFieldRoot';
import { sampleExecutedFieldObservationWithCalibration } from './ExecutedFieldObservation';
import { actualDefensiveBoundary, actualDefensiveContextFromSqlite } from './ActualDefensiveContext';
import { actualDefensivePlanEvidenceFromSqlite } from './SqliteActualDefensivePlanStore';
import { calculateDefensiveExecution } from './DefensiveExecutionCalculation';
import { actualPlayerKinematicsEvidenceFromSqlite } from './SqliteActualPlayerKinematicsReader';
import { actualLocomotionPhysicalAvailabilityFromSqlite } from './ActualLocomotionPhysicalAvailability';
import { deriveActualLocomotionReceiptWithCalibration } from './ActualLocomotion';

/** Exact original-operation references, separate from prepared model bindings.
 * This input carries numerical values, never an admission/calibration proof. */
export type SamePaOriginalConsumerCalculationInput =
  | Readonly<{ route: 'defender_observation'; originalReference: SamePaReference<'actual_field_observations'>; effectiveCalibration: PlayerObservationCalibration }>
  | Readonly<{ route: 'defender_decision'; originalReference: SamePaReference<'actual_defensive_decisions'>; effectiveCalibration: PlayerDecisionCalibration }>
  | Readonly<{ route: 'defender_locomotion'; originalReference: SamePaReference<'actual_locomotion_receipts'>; effectiveCalibration: PlayerLocomotionCalibration }>;
export type SamePaOriginalConsumerReference = { [R in SamePaOriginalConsumerCalculationInput['route']]:
  Pick<Extract<SamePaOriginalConsumerCalculationInput, { route: R }>, 'route' | 'originalReference'>
}[SamePaOriginalConsumerCalculationInput['route']];
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('same-PA original consumer reference or dependency differs'); };
const required = <T>(value: T | null): T => { if (!value) throw new Error('same-PA original consumer owner missing'); return value; };

/** Normal-owner identity read, used by the private dispatch assembly to compare
 * original member/pitch/model scope before any effective Core calculation. */
export const readSamePaOriginalConsumerIdentityFromSqlite = (db: DatabaseSync, input: SamePaOriginalConsumerReference) => {
  if (!db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 1) throw new Error('same-PA original consumer requires read-only transaction');
  if (!samePaFields(input, ['route', 'originalReference'])) throw new Error('invalid same-PA original consumer identity input');
  switch (input.route) {
    case 'defender_observation': {
      if (!samePaReferenceValid(input.originalReference, 'actual_field_observations')) throw new Error('invalid observation original reference');
      const original = required(actualFieldObservationEvidenceFromSqlite(db).read(input.originalReference.sourceId));
      same(reference('actual_field_observations', original), input.originalReference);
      const nominal = required(playerObservationModelEvidenceFromSqlite(db).read(original.source.observationModelSourceId));
      same(hash(nominal), original.observationModelHash); return { route: input.route, original, nominal };
    }
    case 'defender_decision': {
      if (!samePaReferenceValid(input.originalReference, 'actual_defensive_decisions')) throw new Error('invalid decision original reference');
      const original = required(actualDefensiveDecisionEvidenceFromSqlite(db).read(input.originalReference.sourceId));
      same(reference('actual_defensive_decisions', original), input.originalReference);
      const nominal = required(playerDecisionModelEvidenceFromSqlite(db).read(original.source.decisionModelSourceId));
      same(hash(nominal), original.decisionModelHash); return { route: input.route, original, nominal };
    }
    case 'defender_locomotion': {
      if (!samePaReferenceValid(input.originalReference, 'actual_locomotion_receipts')) throw new Error('invalid locomotion original reference');
      const original = required(actualLocomotionEvidenceFromSqlite(db).read(input.originalReference.sourceId));
      same(reference('actual_locomotion_receipts', original), input.originalReference);
      const nominal = required(playerLocomotionModelEvidenceFromSqlite(db).read(original.source.locomotionModelSourceId));
      same(hash(nominal), original.locomotionModelHash); return { route: input.route, original, nominal };
    }
    default: throw new Error('invalid same-PA original consumer identity route');
  }
};

/** Same-connection original-owner reconstruction and calculation only. The
 * dispatch owner's lexical assembly separately authenticates accepted effective
 * rows, member/view scope and current-cut coverage. This function issues no
 * command, creates no durable v1 owner and grants no execution authority. */
export const calculateSamePaOriginalConsumerFromSqlite = (db: DatabaseSync, raw: SamePaOriginalConsumerCalculationInput) => {
  const state = () => json({ transaction: db.isTransaction, query: db.prepare('PRAGMA query_only').get()!.query_only,
    changes: db.prepare('SELECT total_changes() AS n').get()!.n, main: db.prepare('PRAGMA main.schema_version').get()!.schema_version,
    temp: db.prepare('PRAGMA temp.schema_version').get()!.schema_version });
  if (!db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 1) throw new Error('same-PA original consumer requires read-only transaction');
  const before = state(), input = cloneInert(raw);
  if (!samePaFields(input, ['route', 'originalReference', 'effectiveCalibration'])) throw new Error('invalid same-PA original consumer input fields');
  const finish = <T>(value: T): T => { same(state(), before); return freeze(value); };
  switch (input.route) {
    case 'defender_observation': {
      if (!samePaReferenceValid(input.originalReference, 'actual_field_observations')) throw new Error('invalid observation original reference');
      const effective = createPlayerObservationCalibration(input.effectiveCalibration), observations = actualFieldObservationEvidenceFromSqlite(db);
      const original = required(observations.read(input.originalReference.sourceId)); same(reference('actual_field_observations', original), input.originalReference);
      const source = original.source, nominal = required(playerObservationModelEvidenceFromSqlite(db).read(source.observationModelSourceId));
      same(hash(nominal), original.observationModelHash);
      const fields = battedWorldFieldEvidenceFromSqlite(db), baseField = required(fields.read(source.baseFieldSourceId));
      const count = db.prepare("SELECT count(*) AS n FROM main.sqlite_master WHERE type='table' AND name IN ('batted_world_field_executions','batted_world_field_execution_heads')").get()!.n;
      if (count !== 0 && count !== 2) throw new Error('same-PA observation original execution namespace differs');
      const prefix = { baseField, fields: fields.scope(baseField, source.baseFieldSourceId),
        executions: count === 2 ? battedWorldFieldExecutionEvidenceFromSqlite(db).scope(baseField, source.executionSourceId) : [] };
      if ((prefix.executions.at(-1)?.source.sourceId ?? null) !== source.executionSourceId) throw new Error('same-PA observation original execution cut differs');
      const evidence = actualObservationPhysicalPrefixEvidence(prefix);
      same(evidence.physicalPrefixHash, original.physicalPrefixHash); same(evidence.physicalPrefixHashConvention ?? null, original.physicalPrefixHashConvention ?? null);
      const previous = source.previousObservationSourceId === null ? null : required(observations.read(source.previousObservationSourceId));
      const { physical, history } = battedWorldPhysicalPrefixAndWholePlayHistory(prefix), frame = baseField.response.touch.worldContact.flight.physicalPitch.frame;
      const at = { originTick: history.horizon.originTick, elapsedSeconds: history.horizon.elapsedSeconds, tick: history.horizon.ball.tick };
      const calculation = sampleExecutedFieldObservationWithCalibration(source, { at, ticksPerSecond: history.origin.ticksPerSecond,
        matchSeed: frame.matchSeed, playId: frame.match.playId, playerIds: [history.origin.batterRunnerId, ...history.origin.defenderIds],
        actors: physical.segments.at(-1)!.actors, surfaces: baseField.response.touch.worldContact.model.surfaces,
        bases: Object.values(battedWorldFieldGeometry(baseField).bases), ballMoment: actualBattedWorldObservationMoment(history) }, effective, previous, original.receipt.communicationEvidence);
      return finish({ route: input.route, original, nominal, calculation });
    }
    case 'defender_decision': {
      if (!samePaReferenceValid(input.originalReference, 'actual_defensive_decisions')) throw new Error('invalid decision original reference');
      const effective = createPlayerDecisionCalibration(input.effectiveCalibration), decisions = actualDefensiveDecisionEvidenceFromSqlite(db);
      const original = required(decisions.read(input.originalReference.sourceId)); same(reference('actual_defensive_decisions', original), input.originalReference);
      // A later observation advances availability; it must not replace the
      // original delivered perception that actually selected this decision.
      const origin = original.receipt.originDecisionSourceId === original.source.sourceId ? original : required(decisions.read(original.receipt.originDecisionSourceId));
      const source = origin.source, context = actualDefensiveContextFromSqlite(db).read(source.observationSourceId, source.physicalPitchSourceId, source.playerId);
      const nominal = required(playerDecisionModelEvidenceFromSqlite(db).read(source.decisionModelSourceId));
      const plan = required(actualDefensivePlanEvidenceFromSqlite(db).read(source.planSourceId));
      same(hash(nominal), original.decisionModelHash); same(hash(plan), original.planHash); same(nominal.fieldingModel, context.fieldingModel);
      same(hash(context.observation), origin.observationHash); same(context.observation.receipt.at, original.receipt.availability);
      const perceived = context.observation.receipt.perceived;
      if (perceived.communications.length || perceived.knownContext !== null) throw new Error('same-PA original decision semantic context is unsupported');
      const calculation = calculateDefensiveExecution({ decision: { perceivedWorld: perceived, self: { playerId: source.playerId },
        prePlayPlan: plan.source.priorities, perceivedCues: [] }, startedAtTick: actualDefensiveBoundary(context.observation.receipt.at, context.ticksPerSecond),
        ratings: context.fieldingModel.source.ratings }, effective);
      return finish({ route: input.route, original, nominal, calculation });
    }
    case 'defender_locomotion': {
      if (!samePaReferenceValid(input.originalReference, 'actual_locomotion_receipts')) throw new Error('invalid locomotion original reference');
      const effective = createPlayerLocomotionCalibration(input.effectiveCalibration);
      const original = required(actualLocomotionEvidenceFromSqlite(db).read(input.originalReference.sourceId)); same(reference('actual_locomotion_receipts', original), input.originalReference);
      const source = original.source, nominal = required(playerLocomotionModelEvidenceFromSqlite(db).read(source.locomotionModelSourceId));
      const decision = required(actualDefensiveDecisionEvidenceFromSqlite(db).read(source.decisionSourceId));
      const cut = { physicalPitchSourceId: source.physicalPitchSourceId, playerId: source.playerId, baseFieldSourceId: source.baseFieldSourceId,
        executionSourceId: source.executionSourceId, mode: 'original' as const };
      const self = actualPlayerKinematicsEvidenceFromSqlite(db).read(cut);
      same(hash(nominal), original.locomotionModelHash); same(hash(decision), original.decisionHash); same(hash(self), original.selfHash);
      same(actualLocomotionPhysicalAvailabilityFromSqlite(db, cut, self), original.receipt.physicalAvailability);
      const calculation = deriveActualLocomotionReceiptWithCalibration(decision, nominal, self, effective);
      return finish({ route: input.route, original, nominal, calculation });
    }
    default: throw new Error('invalid same-PA original consumer input route');
  }
};
