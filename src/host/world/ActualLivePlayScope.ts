import type { DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { ownedScheduledMotionArchiveHash } from './OwnedScheduledMotionArchive';
import { ownedScheduledMotionActionInput } from './OwnedScheduledBattedWorldMotion';
import { ownedScheduledMotionLiveWork } from './OwnedScheduledMotionLiveWork';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { DurablePhysicalPitch } from './SqlitePhysicalPitchProgressStore';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type ActualLivePlayCut = Readonly<{ kind: 'original_pitch' }>
  | Readonly<{ kind: 'field_execution'; baseFieldSourceId: string; executionSourceId: string | null }>;
export type AcceptedActualLivePlayScope = Readonly<{ sourceId: string; sourceVersion: string;
  capability: 'actual_live_play_scope_v1'; physicalPitchSourceId: string; cut: ActualLivePlayCut }>;
export const actualLivePlayId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
export const actualLivePlayFields = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v)
  && JSON.stringify(Object.keys(v).sort()) === JSON.stringify([...keys].sort());
export const actualLivePlayScopeInput = (raw: AcceptedActualLivePlayScope, sourceId?: string): AcceptedActualLivePlayScope => {
  const s = cloneInert(raw), fields = actualLivePlayFields, id = actualLivePlayId;
  if (!fields(s, ['sourceId', 'sourceVersion', 'capability', 'physicalPitchSourceId', 'cut'])
    || sourceId !== undefined && s.sourceId !== sourceId || s.capability !== 'actual_live_play_scope_v1'
    || ![s.sourceId, s.sourceVersion, s.physicalPitchSourceId].every(id)
    || (s.cut?.kind === 'original_pitch' ? !fields(s.cut, ['kind'])
      : s.cut?.kind !== 'field_execution' || !fields(s.cut, ['kind', 'baseFieldSourceId', 'executionSourceId'])
        || !id(s.cut.baseFieldSourceId) || s.cut.executionSourceId !== null && !id(s.cut.executionSourceId))) {
    throw new Error('invalid accepted actual live-play scope Source');
  }
  return freeze(s);
};
export type ActualLivePlayPrefix = Parameters<typeof battedWorldFieldPhysicalPrefix>[0];
/** This version owns a complete domain manifest, not a claim that every generator exists.
 * Adding a runtime event-capable domain requires a new manifest version and its owner.
 * Post-play review/scoring are downstream and do not masquerade as live information. */
const globalDomains = ['pitch_admission', 'bat_ball_field', 'custody_successors', 'physical_rule_consumption',
  'communication_ingress', 'umpire_call', 'operative_offense', 'live_rule_windows', 'event_generation_consumption', 'closure_fence'] as const;
const playerDomains = ['body_motion', 'observation_scheduling', 'observation_samples', 'actor_decision', 'motor_issuance', 'controller_renewal'] as const;
export type ActualLiveProducerDomain = typeof globalDomains[number] | typeof playerDomains[number];
export type ActualLiveProducer = Readonly<{ producerId: string; domain: ActualLiveProducerDomain; playerId: string | null;
  ownership: 'existing_owner_unfenced' | 'missing_generator'; owner: string | null }>;
const roles = ['body', 'glove', 'left_foot', 'right_foot', 'tag_hand'] as const;
/** Reconstructed v2 bridge. Concrete physical replay is the authority; this
 * additional projection guard binds its complete participant and Source identity. */
export const assertActualLiveScheduledIdentity = (value: DurableBattedWorldFieldExecution,
  physicalPitchSourceId: string, participantIds: readonly string[]) => {
  const e = value.execution;
  if (e.kind !== 'owned_motion_v2' && e.kind !== 'owned_acquisition_plan_v1' && e.kind !== 'owned_throw_plan_v1') return;
  if (value.source.action.kind !== e.kind || participantIds.length !== 10 || new Set(participantIds).size !== 10) {
    throw new Error('actual live scheduled Source or participant identity differs');
  }
  const action = ownedScheduledMotionActionInput(value.source.action as Parameters<typeof ownedScheduledMotionActionInput>[0]);
  const complete = (items: readonly { playerId: string }[]) => items.length === participantIds.length
    && new Set(items.map(c => c.playerId)).size === participantIds.length && items.every(c => participantIds.includes(c.playerId));
  if (!complete(action.knownWork)) throw new Error('actual live scheduled known-work participant identity differs');
  if (e.kind !== 'owned_motion_v2') return;
  if (action.kind !== 'owned_motion_v2') throw new Error('actual live scheduled action identity differs');
  const c = e.composition, a = e.adoption;
  if (c.version !== 'owned_motion_composition_v2' || a.version !== 'owned_motion_adoption_v2'
    || c.physicalPitchSourceId !== physicalPitchSourceId || a.physicalPitchSourceId !== physicalPitchSourceId
    || a.executionSourceId !== value.source.sourceId || a.executionRevision !== value.revision
    || a.predecessor.baseFieldSourceId !== value.source.baseFieldSourceId
    || a.predecessor.executionSourceId !== value.source.previousExecutionSourceId
    || a.compositionHash !== hash(c) || json(a.adoptedAt) !== json(c.at)
    || json(c.requestedCheckpoint) !== json(action.checkpoint) || json(a.requestedCheckpoint) !== json(action.checkpoint)
    || a.acceptedCoverageThroughTick !== c.coverageThroughTick
    || a.checkpointThroughElapsedSeconds !== c.checkpointThroughElapsedSeconds
    || !complete(c.contributors) || !complete(c.knownWork) || !complete(a.contributors)
    || c.contributors.some(v => v.roleAuthorities.length !== 5 || v.retainedRoles.length !== 5
      || new Set(v.roleAuthorities.map(r => r.role)).size !== 5 || new Set(v.retainedRoles.map(r => r.role)).size !== 5)) {
    throw new Error('actual live scheduled composition/adoption identity differs');
  }
  const actual = e.operation?.kind === 'acquisition' ? e.operation.progress.world.moment : e.field.motion.world.moment;
  if (json(a.executedThrough) !== json({ originTick: actual.originTick, elapsedSeconds: actual.elapsedSeconds, tick: actual.ball.tick })
    || json(e.liveWork) !== json(ownedScheduledMotionLiveWork(c, a, e.operation))) {
    throw new Error('actual live scheduled executed state or local-work identity differs');
  }
};
export const actualLivePhysicalExecutionReference = (value: DurableBattedWorldFieldExecution) => ({
  owner: 'batted_world_field_executions' as const, sourceId: value.source.sourceId, hash: ownedScheduledMotionArchiveHash(value) });
export const deriveActualLivePlayScope = (raw: AcceptedActualLivePlayScope, pitch: DurablePhysicalPitch, prefix: ActualLivePlayPrefix | null) => {
  const source = actualLivePlayScopeInput(raw), frame = pitch.frame, batter = frame.batterActor;
  if (pitch.source.sourceId !== source.physicalPitchSourceId || !batter || frame.bindings.length !== 9
    || frame.world.defenders.length !== 9 || json(frame.bindings) !== json(batter.defenderBindings)
    || frame.gameId !== batter.binding.gameId || frame.match.playId !== batter.match.playId
    || new Set(frame.world.defenders.map(d => d.playerId)).size !== 9
    || frame.bindings.some(b => !frame.world.defenders.some(d => d.playerId === b.playerId))) {
    throw new Error('actual live-play original participant bindings differ');
  }
  const bindings = [batter.binding, ...batter.defenderBindings].sort((a, b) => a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0);
  if (new Set(bindings.map(b => b.playerId)).size !== 10 || new Set(bindings.map(b => b.personId)).size !== 10
    || bindings.some(b => b.gameId !== frame.gameId || b.fixtureEventId !== batter.binding.fixtureEventId
      || b.careerId !== batter.binding.careerId || b.gameDay !== batter.binding.gameDay || !actualLivePlayId(b.personLinkSourceId))) {
    throw new Error('actual live-play original participant identity differs');
  }
  const unsupported = frame.world.runners.length > 0 || Object.values(frame.match.bases).some(v => v !== null);
  if (source.cut.kind === 'original_pitch' ? prefix !== null : prefix === null) throw new Error('actual live-play cut kind differs');
  if (unsupported && prefix !== null) throw new Error('unsupported original participation cannot have fabricated field bodies');
  const world = prefix?.baseField.response.touch.worldContact;
  if (prefix && source.cut.kind === 'field_execution' && (!world || prefix.baseField.source.sourceId !== source.cut.baseFieldSourceId
    || (prefix.executions.at(-1)?.source.sourceId ?? null) !== source.cut.executionSourceId
    || json(world.flight.physicalPitch) !== json(pitch) || world.actors.length !== 50
    || world.actors.some(a => !bindings.some(b => b.playerId === a.playerId)))) {
    throw new Error('actual live-play original participant/physical cut differs');
  }
  const scopeId = json(['actual_live_play_scope_v1', frame.gameId, frame.match.playId, source.physicalPitchSourceId]);
  const participants = bindings.map(binding => {
    const person = binding.playerId === batter.binding.playerId ? batter.person
      : batter.defenderPersons.find(p => p.playerId === binding.playerId);
    if (!person || person.personId !== binding.personId || person.sourceId !== binding.personLinkSourceId) {
      throw new Error('actual live-play participant Person link differs');
    }
    const model = world?.model.actors.find(a => a.playerId === binding.playerId);
    if (world && (!model || model.personId !== binding.personId
      || json(world.modelActorEvidence.find(a => a.binding.playerId === binding.playerId)) !== json({ binding, person })
      || world.actors.filter(a => a.playerId === binding.playerId).map(a => a.primitive.role).sort().join('|') !== roles.join('|')
      || model.primitives.map(p => p.role).sort().join('|') !== roles.join('|'))) {
      throw new Error('actual live-play participant primitive/model coverage differs');
    }
    return { playerId: binding.playerId, personId: binding.personId, personLinkSourceId: binding.personLinkSourceId,
      personHash: hash(person), bindingHash: hash(binding), role: binding.playerId === batter.binding.playerId ? 'batter' as const : 'defender' as const,
      bodyModel: world && model ? { sourceId: world.model.sourceId, sourceVersion: world.model.sourceVersion,
        modelHash: hash(world.model), actorHash: hash(model), primitiveRoles: [...roles] } : null };
  });
  const producer = (domain: ActualLiveProducerDomain, playerId: string | null, owner: string | null): ActualLiveProducer => ({
    producerId: json(['actual_live_play_producer_v1', scopeId, domain, playerId]), domain, playerId,
    ownership: owner === null ? 'missing_generator' : 'existing_owner_unfenced', owner });
  const globalOwner = { pitch_admission: 'physical_pitch_progress_actions', bat_ball_field: 'batted_world_field_actions',
    custody_successors: 'batted_world_field_executions' } as const;
  const producers = globalDomains.map(domain => producer(domain, null, domain in globalOwner ? globalOwner[domain as keyof typeof globalOwner] : null));
  for (const p of participants) for (const domain of playerDomains) {
    const owner = domain === 'body_motion' ? 'batted_world_field_executions'
      : domain === 'observation_samples' ? 'actual_field_observations'
      : domain === 'actor_decision' && p.role === 'defender' ? 'actual_defensive_decisions'
      : domain === 'motor_issuance' && p.role === 'defender' ? 'actual_locomotion_receipts' : null;
    producers.push(producer(domain, p.playerId, owner));
  }
  for (const value of prefix?.executions ?? []) assertActualLiveScheduledIdentity(value, pitch.source.sourceId, bindings.map(b => b.playerId));
  const physical = prefix ? battedWorldFieldPhysicalPrefix(prefix) : null;
  const horizon = physical ? physical.segments.at(-1)! : null;
  const at = horizon ? { originTick: horizon.originTick, elapsedSeconds: horizon.endElapsedSeconds,
    tick: quantizeEventTick(horizon.originTick, horizon.endElapsedSeconds, world!.flight.source.execution.ballFlightParameters.ticksPerSecond) } : { originTick: pitch.result.pitch.resolution.timeline.lastEventTick, elapsedSeconds: 0,
    tick: pitch.result.pitch.resolution.timeline.lastEventTick };
  return freeze({ version: 'actual_live_play_scope_v1' as const, runtimeContract: 'original_live_play_runtime_domains_v1' as const,
    scopeId, gameId: frame.gameId, playId: frame.match.playId, physicalPitchSourceId: pitch.source.sourceId,
    careerId: batter.binding.careerId, fixtureEventId: batter.binding.fixtureEventId, gameDay: batter.binding.gameDay,
    participation: unsupported ? 'unsupported_pre_pitch_participation' as const : world ? 'supported_empty_base' as const : 'physical_model_pending' as const,
    originalPitchHash: hash(pitch), cut: source.cut, at, participants, producers,
    unsupportedParticipantIds: [...new Set([...frame.world.runners.map(r => r.playerId), ...Object.values(frame.match.bases).filter((p): p is string => p !== null)])].sort(),
    physicalReferences: prefix ? [
      { owner: 'batted_world_contacts', sourceId: world!.source.sourceId, hash: hash(world!) },
      ...prefix.fields.map(v => ({ owner: 'batted_world_field_actions', sourceId: v.source.sourceId, hash: hash(v) })),
      ...prefix.executions.map(actualLivePhysicalExecutionReference),
    ] : [],
  });
};
export type ActualLivePlayScope = ReturnType<typeof deriveActualLivePlayScope>;
export type ActualLivePhysicalLocalWork = Readonly<{ owner: 'batted_world_field_executions'; sourceId: string; revision: number;
  work: Extract<DurableBattedWorldFieldExecution['execution'], { liveWork: unknown }>['liveWork'] }>;
export type DurableActualLivePlayScope = Readonly<{ physicalLocalHistory: readonly ActualLivePhysicalLocalWork[]; source: AcceptedActualLivePlayScope; revision: 1;
  history: readonly AcceptedActualLivePlayScope[]; scope: ActualLivePlayScope }>;
