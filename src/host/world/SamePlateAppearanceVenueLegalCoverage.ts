import type { Vec3 } from '../../core/model/geometry';
import { deriveBallWorldVenueLegalCoverage, type BallWorldVenueLegalCoverageInput, type BallWorldVenueLegalSegment } from '../../core/rules/BallWorldVenueLegalCoverage';
import { getRuleProfile } from '../../core/rules/RuleProfile';
import type { BallWorldMoment, BallWorldMotionActor } from '../../core/sim/ball/BallWorldContinuation';
import { prepareBattedWorldScheduledFieldAcquisition } from '../../core/sim/ball/BattedWorldScheduledFieldAcquisition';
import { samplePiecewiseFieldActor } from '../../core/sim/ball/BattedWorldPiecewiseFieldMotion';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { battedVenueLegalCoveragePolicyInput } from './BattedVenueLegalCoveragePolicy';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import type { readSamePaFieldRuleEvidenceWithInputsFromSqlite } from './SamePlateAppearanceFieldRuleEvidenceFromSqlite';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalEpisode';
import { samePaFields as fields, samePaHash, type SamePaReference } from './SamePlateAppearanceWorkPrefix';

type Pair = Extract<ReturnType<typeof readSamePaFieldRuleEvidenceWithInputsFromSqlite>, { kind: 'same_pa_field_rule_read_pair_v1' }>;
type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
type FieldReference = SamePaReference<'pa_physical_v1_field_roots' | 'pa_physical_v1_field_steps'>;
const ref = (f: Field): FieldReference => reference(f.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', f);
const zero = Object.freeze({ x: 0, y: 0, z: 0 });
const pending = (reason: 'original_venue_legal_coverage_policy_required') => freeze({ kind: 'pending' as const, reason });
const actorMoment = (actor: BallWorldMotionActor, originTick: number, elapsedSeconds: number): BallWorldMoment => {
  const s = actor.primitive;
  if (elapsedSeconds > (s.endTick - originTick) / s.ticksPerSecond) throw new Error('venue legal original carrier curve coverage differs');
  const at = { originTick, elapsedSeconds, ball: { tick: quantizeEventTick(originTick, elapsedSeconds, s.ticksPerSecond),
    position: zero, velocity: zero, spin: zero } };
  const sampled = samplePiecewiseFieldActor(actor, at);
  return { ...at, ball: { ...at.ball, position: sampled.center, velocity: sampled.velocity } };
};

/** Immediate dependency seam for the authenticated SQLite pair. Selection is
 * an exact owned row, never a caller-supplied timestamp or rewritten prefix.
 * No schema, physical state, official result, or old archive shape is changed. */
export const readSamePaVenueLegalCoverageFromPair = (pair: Pair, throughReference?: FieldReference) => {
  const root = pair.fields[0], { actor, value } = pair;
  if (pair.kind !== 'same_pa_field_rule_read_pair_v1' || root?.kind !== 'same_pa_physical_field_root_v1'
    || pair.fields.length !== value.fieldReferences.length || json(root.lineage) !== json(pair.view.lineage))
    throw new Error('venue legal original authenticated field pair required');
  const references = pair.fields.map(ref);
  if (json(references) !== json(value.fieldReferences) || json(references.at(-1)) !== json(value.physicalOperationReference))
    throw new Error('venue legal original complete field prefix differs');
  const through = throughReference === undefined ? pair.fields.length - 1 : references.findIndex(r => json(r) === json(throughReference));
  if (through < 0) throw new Error('venue legal selected cut is outside original field prefix');
  if (!('venueLegalCoveragePolicy' in root.source) && !('venueLegalCoveragePolicyBinding' in root)) return pending('original_venue_legal_coverage_policy_required');
  const policy = battedVenueLegalCoveragePolicyInput(root.source.venueLegalCoveragePolicy!), binding = root.venueLegalCoveragePolicyBinding;
  if (!binding || !fields(binding, ['policyHash', 'fixtureHash', 'worldModelHash', 'responseModelHash', 'ruleProfileHash', 'geometryBindingHash'])
    || !Object.values(binding).every(samePaHash) || binding.policyHash !== hash(policy) || binding.fixtureHash !== actor.fixtureHash
    || binding.ruleProfileHash !== hash(getRuleProfile(policy.rulePolicy.ruleProfileId)) || binding.geometryBindingHash !== root.geometryBindingHash
    || policy.geometryBindingHash !== root.geometryBindingHash || policy.baseFieldSourceId !== root.source.sourceId
    || policy.physicalPitchSourceId !== root.physicalPitchSourceId || policy.gameId !== actor.source.gameId
    || policy.careerId !== actor.binding.careerId || policy.fixtureEventId !== actor.binding.fixtureEventId
    || policy.playId !== actor.match.playId || policy.rulePolicy.ruleProfileId !== actor.match.ruleProfileId
    || policy.availableAtDay > actor.binding.gameDay) throw new Error('venue legal original accepted policy binding differs');
  const selected = pair.fields.slice(0, through + 1), initial = root.response.world.flight.initialBall, p = root.response.world.parameters;
  const segments: BallWorldVenueLegalSegment[] = [];
  const fieldSegments: { fieldReference: FieldReference; segmentIndex: number; carrierPlayerId: string | null;
    constraint: 'free' | 'carried' | 'glove_constraint' }[] = [];
  const carrierCoverage: Readonly<{ fieldReference: FieldReference; segmentIndex: number; playerId: string;
    role: 'body' | 'left_foot' | 'right_foot'; input: BallWorldVenueLegalCoverageInput; coverage: ReturnType<typeof deriveBallWorldVenueLegalCoverage> }>[] = [];
  const unresolvedCarrierSpans: { fieldReference: FieldReference; segmentIndex: number; playerId: string;
    startElapsedSeconds: number; endElapsedSeconds: number; reason: 'original_carrier_primitive_coverage_required' }[] = [];
  let prior: Field | null = null;
  for (const [index, f] of selected.entries()) {
    const endpoint = f.field.motion.world.moment, start = prior?.field.motion.world.moment.elapsedSeconds ?? 0;
    const result = f.kind === 'same_pa_physical_field_step_v1' ? f.actionResult : undefined;
    let basis: BallWorldMoment = prior?.field.motion.cursor?.moment ?? prior?.field.motion.world.moment
      ?? { originTick: initial.tick, elapsedSeconds: 0, ball: initial };
    let carrier = prior?.field.motion.carrierPlayerId ?? null, actors = f.field.motion.actors;
    let acceleration: Vec3 | null = null;
    if (result?.kind === 'throw_checkpoint_v1') {
      const planRow = selected.find((_candidate, i) => i < index && json(references[i]) === json(result.planReference));
      if (planRow?.kind !== 'same_pa_physical_field_step_v1' || planRow.actionResult?.kind !== 'throw_plan_v1') throw new Error('venue legal original throw plan missing');
      const plan = planRow.actionResult.plan;
      // Its physical owner evaluated this original basis, including after a pause.
      basis = plan.input.cursor.moment; carrier = plan.input.carrierPlayerId; actors = plan.actors;
    } else if (result?.kind === 'capture_checkpoint_v1') {
      const candidate = selected.find((_row, i) => i < index && json(references[i]) === json(result.candidateReference));
      if (!candidate) throw new Error('venue legal original capture candidate missing');
      const plan = prepareBattedWorldScheduledFieldAcquisition({ response: root.response, geometry: root.geometry, field: candidate.field });
      basis = plan.initialConstraintMoment; carrier = plan.acquirerPlayerId; actors = candidate.field.motion.actors;
    }
    if (carrier) acceleration = actors.find(a => a.playerId === carrier && a.primitive.role === 'glove')?.primitive.acceleration ?? null;
    else if (!prior || prior.field.motion.cursor) {
      const world = f.field.motion.world;
      if ('phase' in world && world.phase === 'airborne') acceleration = { x: 0, y: p.gravityY, z: 0 };
      else if ('phase' in world && world.phase === 'resting') acceleration = zero;
      // Rolling curves retain explicit uncertainty here. Their friction/stop
      // partitions must come from a future dedicated physical projection.
    }
    const segment = { startElapsedSeconds: start, endElapsedSeconds: endpoint.elapsedSeconds, basis, endpoint, acceleration };
    segments.push(segment);
    fieldSegments.push({ fieldReference: references[index], segmentIndex: index, carrierPlayerId: carrier,
      constraint: result?.kind === 'capture_checkpoint_v1' ? 'glove_constraint' : carrier ? 'carried' : 'free' });
    if (carrier) {
      for (const role of ['body', 'left_foot', 'right_foot'] as const) {
        const matches = actors.filter(a => a.playerId === carrier && a.primitive.role === role), part = matches[0];
        if (matches.length !== 1) {
          unresolvedCarrierSpans.push({ fieldReference: references[index], segmentIndex: index, playerId: carrier,
            startElapsedSeconds: start, endElapsedSeconds: endpoint.elapsedSeconds, reason: 'original_carrier_primitive_coverage_required' });
          continue;
        }
        const partBasis = (part.primitive.startTick - initial.tick) / p.ticksPerSecond + (part.startElapsedSeconds ?? 0);
        if (partBasis < 0 || partBasis > start) throw new Error('venue legal original carrier primitive basis differs');
        const input: BallWorldVenueLegalCoverageInput = { policy: policy.rulePolicy, originTick: initial.tick, ticksPerSecond: p.ticksPerSecond,
          ballRadiusMeters: part.primitive.radius, segments: [{ startElapsedSeconds: start, endElapsedSeconds: endpoint.elapsedSeconds,
            basis: actorMoment(part, initial.tick, partBasis), endpoint: actorMoment(part, initial.tick, endpoint.elapsedSeconds), acceleration: part.primitive.acceleration }] };
        carrierCoverage.push({ fieldReference: references[index], segmentIndex: index, playerId: carrier, role,
          input, coverage: deriveBallWorldVenueLegalCoverage(input) });
      }
    }
    prior = f;
  }
  const input: BallWorldVenueLegalCoverageInput = { policy: policy.rulePolicy, originTick: initial.tick, ticksPerSecond: p.ticksPerSecond,
    ballRadiusMeters: p.ballRadius, segments };
  const coverage = deriveBallWorldVenueLegalCoverage(input);
  const appealThrows = selected.flatMap((f, index) => {
    if (f.kind !== 'same_pa_physical_field_step_v1' || f.actionResult?.kind !== 'throw_plan_v1' || !f.actionResult.appealIndicationReference) return [];
    const planReference = references[index], next = selected.findIndex((row, i) => i > index && row.kind === 'same_pa_physical_field_step_v1' && row.actionResult?.kind === 'throw_plan_v1');
    const stop = next < 0 ? selected.length : next;
    const releaseRow = selected.find((row, i) => i > index && i < stop && row.kind === 'same_pa_physical_field_step_v1'
      && row.actionResult?.kind === 'throw_checkpoint_v1' && json(row.actionResult.planReference) === json(planReference) && row.actionResult.progress.kind === 'released');
    const release = releaseRow?.kind === 'same_pa_physical_field_step_v1' && releaseRow.actionResult?.kind === 'throw_checkpoint_v1'
      && releaseRow.actionResult.progress.kind === 'released' ? { moment: releaseRow.actionResult.progress.releaseCursor.moment, fieldReference: ref(releaseRow) } : undefined;
    // An unconfirmed glove constraint can fail without ending this throw's
    // purpose. Preserve its contiguous history through the first secured
    // reception; consumers qualify free intervals through fieldSegments before
    // treating out-of-play evidence as a failed unheld throw. Transfer before
    // release and carrying after reception do not belong to this history.
    const releaseIndex = releaseRow ? selected.indexOf(releaseRow) : -1, segmentIndexes: number[] = [];
    if (release) for (let i = releaseIndex + 1; i < stop; i++) {
      segmentIndexes.push(i);
      const row = selected[i];
      if (row.kind === 'same_pa_physical_field_step_v1' && row.actionResult?.kind === 'capture_checkpoint_v1'
        && row.actionResult.progress.kind === 'secured') break;
    }
    const releasePoint = release ? { startElapsedSeconds: release.moment.elapsedSeconds, endElapsedSeconds: release.moment.elapsedSeconds,
      basis: release.moment, endpoint: release.moment, acceleration: zero } : null;
    const throwInput = releasePoint ? { ...input, segments: [releasePoint, ...segmentIndexes.map(i => segments[i])] } : null;
    return [{ planReference, indicationReference: f.actionResult.appealIndicationReference, ...(release ? { release } : {}),
      segmentIndexes, input: throwInput, coverage: throwInput ? deriveBallWorldVenueLegalCoverage(throwInput) : null }];
  });
  return freeze({ kind: 'same_pa_venue_legal_coverage_v1' as const,
    policyReference: { sourceId: policy.sourceId, sourceVersion: policy.sourceVersion, ...binding, fieldRootReference: references[0], throughReference: references[through] },
    ...(policy.pitcherPlate ? { pitcherPlate: policy.pitcherPlate } : {}), input, coverage,
    fieldSegments, carrierCoverage, unresolvedCarrierSpans, appealThrows });
};
export const deriveSamePaVenueLegalCoverageFromPair = readSamePaVenueLegalCoverageFromPair;
