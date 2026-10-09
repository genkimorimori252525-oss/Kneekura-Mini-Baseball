import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { BallWorldMoment } from '../../core/sim/ball/BallWorldContinuation';
import type { BallWorldPlayerBaseContactSegment } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
import { deriveBallWorldPlayerBaseContactHistory } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
import { findBallWorldControlledBaseContacts } from '../../core/sim/ball/BallWorldControlledBaseContacts';
import { prepareBattedWorldScheduledFieldAcquisition, validateBattedWorldScheduledFieldAcquisitionProgress } from '../../core/sim/ball/BattedWorldScheduledFieldAcquisition';
import { validateBattedWorldScheduledFieldThrowProgress } from '../../core/sim/ball/BattedWorldScheduledFieldThrow';
import type { BallWorldFieldTerritoryInput } from '../../core/rules/BallWorldFieldTerritory';
import type { BallWorldBattedRuleContactFrame } from '../../core/rules/BallWorldBattedRuleEvidence';
import { deriveBallWorldFieldFirstBaseRaceWithPossessionEvidence, type PendingFieldPossession } from '../../core/rules/BallWorldFieldFirstBaseRaceWithPossessionEvidence';
import { actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalEpisode';
type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
type Input = Readonly<{ fields: readonly Field[]; batterRunnerId: string; defenderIds: readonly string[]; outsAtStart: number }>;
const fieldReference = (f: Field) => reference(f.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', f);
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('same-PA field-rule original prefix or custody differs'); };

/** Pure projection of already executed original records. Only the SQLite reader
 * authenticates their ownership. No motor, runner route or physical end is created. */
export const deriveSamePaFieldRuleEvidence = (raw: Input) => {
  const input = cloneInert(raw), root = input.fields[0];
  if (!root || root.kind !== 'same_pa_physical_field_root_v1' || root.field.motion.carrierPlayerId !== null
    || !Array.isArray(input.defenderIds) || new Set([input.batterRunnerId, ...input.defenderIds]).size !== input.defenderIds.length + 1)
    throw new Error('same-PA field-rule original root or membership missing');
  const initial = root.response.world.flight.initialBall, p = root.response.world.parameters, originTick = initial.tick;
  const contacts: BallWorldBattedRuleContactFrame[] = [], baseContacts: BallWorldFieldTerritoryInput['baseContacts'][number][] = [];
  const acquisitions: BallWorldFieldTerritoryInput['evidence']['acquisitions'][number][] = [];
  const groundSegments: NonNullable<BallWorldFieldTerritoryInput['groundSegments']>[number][] = [];
  const segments: BallWorldPlayerBaseContactSegment[] = [], controlWindows: { playerId: string; startElapsedSeconds: number; endElapsedSeconds: number; endInclusive: boolean }[] = [];
  const ids = [input.batterRunnerId, ...input.defenderIds], roles = ['body', 'glove', 'tag_hand', 'left_foot', 'right_foot'];
  let horizon: BallWorldMoment = { originTick, elapsedSeconds: 0, ball: initial }, previous: Field | null = null;
  let pending: PendingFieldPossession[] = [];
  const appendContacts = (f: Field, constraint?: Readonly<{ incoming: BallWorldMoment; constrained: BallWorldMoment }>) => {
    const world = f.field.motion.world;
    if (world.kind !== 'boundary') return;
    const normalized = world.contacts.map(c => c.kind === 'actor' ? { kind: c.kind, playerId: c.playerId, role: c.role }
      : c.kind === 'surface' ? { kind: c.kind, surfaceId: c.surfaceId } : { kind: c.kind });
    const prior = contacts.at(-1);
    if (prior?.moment.elapsedSeconds === world.moment.elapsedSeconds) {
      same(prior.moment.ball.position, world.moment.ball.position);
      const extra = normalized.filter(c => !prior.contacts.some(old => json(old) === json(c)));
      if (extra.length && json(prior.moment) !== json(world.moment)) {
        if (!constraint) throw new Error('same-PA field-rule coincident contact needs original constraint');
        same(constraint.incoming, prior.moment); same(constraint.constrained, world.moment);
      }
      contacts[contacts.length - 1] = { moment: prior.moment, contacts: [...prior.contacts, ...extra] };
    } else contacts.push({ moment: world.moment, contacts: normalized });
    for (const contact of f.field.baseContacts) {
      const projected = { ...contact, moment: contacts.at(-1)!.moment };
      const index = baseContacts.findIndex(c => c.baseId === contact.baseId && c.moment.elapsedSeconds === contact.moment.elapsedSeconds), prior = baseContacts[index];
      if (prior) { same({ ...prior, continuing: true }, { ...projected, continuing: true }); if (contact.continuing) baseContacts[index] = projected; }
      else baseContacts.push(projected);
    }
  };
  for (const f of input.fields) {
    const motion = f.field.motion, at = motion.world.moment, result = f.kind === 'same_pa_physical_field_step_v1' ? f.actionResult : undefined;
    if (f.physicalPitchSourceId !== root.physicalPitchSourceId || f.pitchOrdinal !== root.pitchOrdinal || json(f.lineage) !== json(root.lineage)
      || f.evaluationTick !== at.ball.tick || at.originTick !== originTick || at.elapsedSeconds < horizon.elapsedSeconds
      || motion.actors.length !== ids.length * roles.length || ids.some(id => roles.some(role => motion.actors.filter(a => a.playerId === id && a.primitive.role === role).length !== 1)))
      throw new Error('same-PA field-rule physical coverage or membership differs');
    if (previous) {
      if (f.kind !== 'same_pa_physical_field_step_v1' || f.operationOrdinal !== previous.operationOrdinal + 1) throw new Error('same-PA field-rule prefix is not consecutive');
      same(f.source.previousFieldReference, fieldReference(previous)); same(f.source.previousOperationReference, fieldReference(previous));
      same(f.source.fieldRootReference, fieldReference(root));
    }
    segments.push({ originTick, startElapsedSeconds: horizon.elapsedSeconds, endElapsedSeconds: at.elapsedSeconds, actors: motion.actors });
    const start = horizon.elapsedSeconds, priorCarrier = previous?.field.motion.carrierPlayerId ?? null;
    const priorCursor = previous?.field.motion.cursor;
    if (priorCursor && priorCarrier === null && 'phase' in motion.world && motion.world.phase !== 'resting'
      && contacts.some(c => c.contacts.some(c => c.kind === 'ground')) && at.elapsedSeconds > start)
      groundSegments.push({ moment: priorCursor.moment, throughElapsedSeconds: at.elapsedSeconds,
        rollingDecelerationMps2: motion.world.phase === 'airborne' ? 0 : root.source.parameters.groundRollingDecelerationMps2,
        ...(motion.world.phase === 'airborne' ? { gravityY: p.gravityY } : {}) });
    let constraint: Readonly<{ incoming: BallWorldMoment; constrained: BallWorldMoment }> | undefined;
    if (result?.kind === 'capture_checkpoint_v1') {
      const candidate = input.fields.find(c => json(fieldReference(c)) === json(result.candidateReference));
      if (!candidate || candidate.operationOrdinal >= f.operationOrdinal) throw new Error('same-PA field-rule original capture candidate missing');
      const plan = prepareBattedWorldScheduledFieldAcquisition({ response: root.response, geometry: root.geometry, field: candidate.field });
      validateBattedWorldScheduledFieldAcquisitionProgress(plan, result.progress); same(result.progress.world, motion.world);
      constraint = { incoming: plan.contactMoment, constrained: plan.initialConstraintMoment };
      if (result.progress.acquisition) acquisitions.push(result.progress.acquisition);
      if (result.progress.kind === 'secured') {
        if (motion.carrierPlayerId !== plan.acquirerPlayerId) throw new Error('same-PA field-rule secured carrier differs');
        controlWindows.push({ playerId: plan.acquirerPlayerId, startElapsedSeconds: result.progress.acquisition.moment.elapsedSeconds, endElapsedSeconds: at.elapsedSeconds, endInclusive: true });
        pending = [];
      } else {
        if (motion.carrierPlayerId !== null) throw new Error('same-PA field-rule unconfirmed capture grants custody');
        pending = [{ planSourceId: candidate.source.sourceId, playerId: plan.acquirerPlayerId, contactElapsedSeconds: plan.contactMoment.elapsedSeconds,
          phase: result.progress.kind === 'interrupted' ? 'contact_policy_pending' : result.progress.kind === 'fence_pending' ? 'fence_pending' : 'capturing',
          earliestPotentialControlElapsedSeconds: result.progress.kind === 'interrupted' ? Math.min(plan.secureElapsedSeconds, at.elapsedSeconds) : plan.secureElapsedSeconds }];
      }
    } else if (result?.kind === 'throw_checkpoint_v1') {
      const planRecord = input.fields.find(c => c.kind === 'same_pa_physical_field_step_v1' && json(fieldReference(c)) === json(result.planReference));
      if (!previous || !priorCarrier || planRecord?.kind !== 'same_pa_physical_field_step_v1' || planRecord.actionResult?.kind !== 'throw_plan_v1') throw new Error('same-PA field-rule original throw plan missing');
      const plan = planRecord.actionResult.plan; validateBattedWorldScheduledFieldThrowProgress(plan, result.progress);
      same(result.progress.field, f.field); same(plan.input.carrierPlayerId, priorCarrier);
      const inclusive = result.progress.kind === 'transfer';
      if (result.progress.kind === 'released') {
        if (motion.carrierPlayerId !== null) throw new Error('same-PA field-rule released ball retains custody');
        for (const window of controlWindows) if (window.playerId === priorCarrier && window.endElapsedSeconds === at.elapsedSeconds) window.endInclusive = false;
      }
      controlWindows.push({ playerId: priorCarrier, startElapsedSeconds: start, endElapsedSeconds: at.elapsedSeconds, endInclusive: inclusive });
    } else {
      if (motion.carrierPlayerId !== priorCarrier) throw new Error('same-PA field-rule carrier change has no original acquisition/release');
      if (priorCarrier) controlWindows.push({ playerId: priorCarrier, startElapsedSeconds: start, endElapsedSeconds: at.elapsedSeconds, endInclusive: motion.world.kind !== 'boundary' });
      if (motion.response.kind === 'capture_candidate' && pending.length === 0
        && motion.world.kind === 'boundary' && motion.world.contacts.some(c => c.kind === 'actor' && input.defenderIds.includes(c.playerId))) {
        const plan = prepareBattedWorldScheduledFieldAcquisition({ response: root.response, geometry: root.geometry, field: f.field });
        pending = [{ planSourceId: f.source.sourceId, playerId: plan.acquirerPlayerId, contactElapsedSeconds: plan.contactMoment.elapsedSeconds,
          phase: 'capturing', earliestPotentialControlElapsedSeconds: plan.secureElapsedSeconds }];
      }
    }
    appendContacts(f, constraint); horizon = at; previous = f;
  }
  const field: BallWorldFieldTerritoryInput = { evidence: { batterRunnerId: input.batterRunnerId, defenderIds: input.defenderIds,
    field: root.geometry.baseGeometry.field, bases: root.geometry.baseGeometry.gates, ballRadiusMeters: p.ballRadius,
    originTick, ticksPerSecond: p.ticksPerSecond, horizon, contacts, acquisitions }, baseContacts, groundSegments };
  const surface = root.geometry.baseGeometry.bases.first;
  const historyFor = (playerId: string) => {
    const history = deriveBallWorldPlayerBaseContactHistory({ segments, playerId, base: surface.region, baseSurfaceHeightMeters: surface.surfaceHeightMeters });
    return { history, controlledContacts: findBallWorldControlledBaseContacts({ history,
      controlWindows: controlWindows.filter(w => w.playerId === playerId).map(({ playerId: _, ...window }) => window) }) };
  };
  const batterFirstBase = historyFor(input.batterRunnerId), defendersFirstBase = input.defenderIds.map(historyFor);
  const possessionEvidence = { policy: 'scheduled_capture_confirmation_v1' as const, originTick, ticksPerSecond: p.ticksPerSecond,
    throughElapsedSeconds: horizon.elapsedSeconds, pending };
  const rule = deriveBallWorldFieldFirstBaseRaceWithPossessionEvidence({ field, possessionEvidence, race: { outsAtStart: input.outsAtStart,
    batterRunnerId: input.batterRunnerId, defenderIds: input.defenderIds, originTick, ticksPerSecond: p.ticksPerSecond,
    horizonElapsedSeconds: horizon.elapsedSeconds, runnerHistory: batterFirstBase.history, defenders: defendersFirstBase } });
  return freeze({ physical: { field, segments, controlWindows }, batterFirstBase, defendersFirstBase, rule,
    terminal: { kind: 'pending' as const, reason: 'reserved_live_play_end_owner_missing' as const, physicalEnd: null } });
};
