import { createRequire } from 'node:module';
import { battingInvocationTransaction } from './BattingInvocationTransaction';
import { readSamePaSuccessorWorkClaimRows } from './SamePlateAppearanceContinuationClaimGuard';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { SeedRoot } from '../../core/rng/SeedRoot';
import { applyPitchFatigueToExecution } from '../../core/sim/pitch/PitchFatigueExecution';
import { resolveCanonicalPitchDelivery } from '../../core/sim/pitch/CanonicalPitchDelivery';
import { createPitchTrajectoryFromRelease } from '../../core/sim/pitch/CanonicalPitchRelease';
import { resolveAndRecordPitchAgainstBatter } from '../../core/sim/pitching/PitchAgainstBatter';
import { actorHash as hash, actorJson as json, actorFreeze as freeze, assertPhysicalActorOpenFrame } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaReferenceValid, samePaText, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaMetadataClaim as claim } from './SamePlateAppearanceReservationGuard';
import { readCurrentSamePaContinuationViewFromSqlite, readHistoricalSamePaContinuationViewFromSqlite, readSamePaContinuationCalibrationFromSqlite,
  readSamePaContinuationRecordFromSqlite, readSamePaContinuationOriginalPitchFromSqlite, withSamePaContinuationReadPhase } from './SamePlateAppearanceContinuationFromSqlite';
import type { SamePaNonemptyPrefix } from './SamePlateAppearanceContinuation';
import { readSamePaBattingInvocationClaims, readSamePaBattingInvocationFromSqlite } from './SamePlateAppearanceBattingInvocationFromSqlite';
import { deriveSamePaContinuationCalibration } from './SamePlateAppearanceContinuationCalibration';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { readHistoricalSamePaExecutionView } from './SamePlateAppearanceHistoricalExecutionEvidenceFromSqlite';
import { deriveSamePaDispatchRoles, samePaNativeAdapterImplemented } from './SamePlateAppearanceDispatchRoles';
import { readSamePaOriginalParticipants } from './SamePlateAppearanceOriginalParticipants';
import { assertSamePaRegistrationBeforeWork } from './ActualLiveRuntimeRegistration';
import { readPlayerPitchTimingPrefixFromSqlite, selectPlayerPitchTimingProfileFromSqlitePrefix, assertCurrentPlayerPitchTimingPrefixFromSqlite } from './SqlitePlayerPitchTimingStore';
import { readPlayerReleaseGeometryPrefixFromSqlite, assertCurrentPlayerReleaseGeometryPrefixFromSqlite } from './SqlitePlayerReleaseGeometryStore';
import { readPitchFatiguePolicyFromSqlite } from './SqlitePitchFatiguePolicyStore';
import { playerBattingModelEvidenceFromSqlite } from './PlayerBattingModelEvidence';
import { readBattingPerceptionFromSqlite } from './SqliteBattingPerceptionStore';
import { samePaTakeSuccessorSchema, assertSamePaTakeSuccessorStorage } from './SamePlateAppearanceTakeSuccessorStorage';
import { samePaTakeSuccessorSourceInput, type AcceptedSamePaNextTakeAction, type AcceptedSamePaRetainedTakeSetup,
  type AcceptedSamePaSuccessorTakePitch, type SamePaNextTakeAction, type SamePaRetainedTakeSetup,
  type SamePaSuccessorTakePitch, type SamePaSuccessorConsumer, type SamePaSuccessorPitchFrame, type SamePaSuccessorReceipt, type SamePaTakePitchBundle } from './SamePlateAppearanceTakeSuccessor';
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('next TAKE original dependency, current cut or retained body differs'); };
export type SamePaTakePending = Readonly<{ kind: 'pending'; reason: string; missingAcceptedSourceIds: readonly string[] }>;
const pending = (reason: string, ids: readonly string[] = []): SamePaTakePending => freeze({ kind: 'pending', reason, missingAcceptedSourceIds: ids });
export const samePaTakeTables = Object.freeze({ action: 'pa_take_successor_v1_action_plans', setup: 'pa_take_successor_v1_setups',
  consumer: 'pa_take_successor_v1_consumer_actions', pitch: 'pa_take_successor_v1_pitch_actions', head: 'pa_take_successor_v1_pitch_heads',
  consumption: 'pa_take_successor_v1_consumptions', admission: 'pa_take_successor_v1_episode_admissions' } as const);
export const samePaTakeIdentityRow = (db: DatabaseSync, table: string, id: string) => {
  const installed = assertSamePaTakeSuccessorStorage(db);
  const rows = installed ? Object.values(samePaTakeTables).filter(t => t !== samePaTakeTables.head).flatMap(t => db.prepare(`SELECT * FROM main.${t} WHERE source_id=$id
    OR ${claim('source_json', ['sourceId'], '$id')} OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}`).all({ id }).map(row => ({ table: t, row }))) : [];
  if (rows.length > 1 || rows.length === 1 && (rows[0].table !== table || rows[0].row.source_id !== id)) throw new Error('next TAKE raw Source alias differs');
  if (!rows.length) {
    const descendants = db.prepare("SELECT name FROM main.sqlite_master WHERE type='table' AND (name GLOB 'pa_take_successor_v1_*' OR name GLOB 'pa_continuation_v1_*' OR name GLOB 'batting_observation_v1_*' OR name GLOB 'batting_execution_v1_*')").all();
    for (const descendant of descendants) {
      const t = String(descendant.name), columns = db.prepare('PRAGMA main.table_info("' + t.replaceAll('"', '""') + '")').all().map(r => String(r.name));
      for (const column of ['source_json', 'snapshot_json'].filter(c => columns.includes(c))) if (db.prepare(`SELECT 1 FROM main."${t.replaceAll('"', '""')}",json_tree(CASE WHEN json_valid(${column}) THEN ${column} ELSE 'null' END) obj
        WHERE obj.type='object' AND EXISTS(SELECT 1 FROM json_each(obj.value) o WHERE o.key='owner' AND o.atom=$owner)
        AND EXISTS(SELECT 1 FROM json_each(obj.value) i WHERE i.key='sourceId' AND i.atom=$id) LIMIT 1`).get({ owner: table, id })) throw new Error('next TAKE original owner missing with surviving claims; repair forbidden');
    }
  }
  return rows[0]?.row ?? null;
};
type Prepared = SamePaNextTakeAction | SamePaRetainedTakeSetup;
export const samePaTakePreparedRow = (value: Prepared): Record<string, string | number> => {
  const s = value.source, l = value.lineage, view = value.kind === 'next_take_action_prepared' ? value.source.viewReference : value.viewReference;
  const extra: Record<string, string | number> = value.kind === 'next_take_action_prepared' ? { previous_pitch_source_id: value.source.previousPitchReference.sourceId }
    : { action_source_id: value.source.actionReference.sourceId, next_pitch_source_id: value.source.nextPhysicalPitchSourceId };
  return { source_id: s.sourceId, source_version: s.sourceVersion, career_id: l.careerId, game_id: l.gameId, play_id: l.playId,
    enrollment_source_id: l.enrollmentReference.sourceId, actor_source_id: l.actorReference.sourceId, first_pitch_source_id: l.firstPhysicalPitchSourceId,
    view_source_id: view.sourceId, ...extra, source_json: json(s), source_hash: hash(s), snapshot_json: json(value), snapshot_hash: hash(value) };
};
type Mode = 'fresh' | 'historical' | 'owned_append';
/** Every invocation owns this lexical assembly. The staged branch is used only
 * by the closed five-row writer, whose exact row prefix is checked around it. */
const assembly = <T>(db: DatabaseSync, mode: Mode, body: (api: {
  action(source: AcceptedSamePaNextTakeAction): SamePaNextTakeAction;
  setup(source: AcceptedSamePaRetainedTakeSetup): SamePaRetainedTakeSetup | SamePaTakePending;
  readAction(ref: SamePaReference<'pa_take_successor_v1_action_plans'>): SamePaNextTakeAction;
  readSetup(ref: SamePaReference<'pa_take_successor_v1_setups'>): SamePaRetainedTakeSetup;
  pitch(source: AcceptedSamePaSuccessorTakePitch): SamePaTakePitchBundle;
}) => T): T => withSamePaContinuationReadPhase(db, () => {
  type ActionInputs = { result: SamePaNextTakeAction; basis: ReturnType<typeof readCurrentSamePaContinuationViewFromSqlite>;
    original: ReturnType<typeof readSamePaContinuationOriginalPitchFromSqlite>; timing: ReturnType<typeof readPlayerPitchTimingPrefixFromSqlite>;
    timingProfile: ReturnType<typeof selectPlayerPitchTimingProfileFromSqlitePrefix>; geometry: ReturnType<typeof readPlayerReleaseGeometryPrefixFromSqlite>['baseline'];
    policy: ReturnType<typeof readPitchFatiguePolicyFromSqlite>; model: NonNullable<ReturnType<ReturnType<typeof playerBattingModelEvidenceFromSqlite>['read']>>; prefix: SamePaNonemptyPrefix };
  const current = mode !== 'historical', actions = new Map<string, ActionInputs>();
  const authenticateAction = (source: AcceptedSamePaNextTakeAction): ActionInputs => {
    const key = json(source), prior = actions.get(key); if (prior) return prior;
    const basis = (mode === 'fresh' ? readCurrentSamePaContinuationViewFromSqlite : readHistoricalSamePaContinuationViewFromSqlite)(db, source.viewReference);
    const original = readSamePaContinuationOriginalPitchFromSqlite(db, source.previousPitchReference), p = original.pitch, actor = basis.actor;
    same(basis.view.lineage, p.lineage); same(basis.view.physicalCut.pitchReference, source.previousPitchReference);
    if (p.result.resolution.timeline.status.kind !== 'active' || p.result.resolution.physical.kind !== 'taken') throw new Error('next TAKE requires a nonterminal taken predecessor');
    for (const field of ['timingReference', 'releaseReference', 'pitchResponseReference', 'batterModelReference'] as const) same(source[field], original.action.source[field]);
    for (const field of ['matchSeed', 'outingId', 'moundReference'] as const) same(source.nominalPitch.delivery[field], original.action.source.nominalPitch.delivery[field]);
    const prefix = readSamePaContinuationRecordFromSqlite(db, 'prefix', basis.view.source.prefixReference.sourceId) as SamePaNonemptyPrefix;
    // Actual cognitive operations do not imply physical adoption. A batting
    // execution is admitted below only through its explicit no-motion result.
    for (const op of prefix.source.operationReferences.filter(r => r.owner === 'batting_execution_v1_executions')) {
      const record = readSamePaBattingInvocationFromSqlite(db, op).record;
      if (!('physicalEffect' in record) || record.physicalEffect !== 'none') throw new Error('next TAKE requires completed or absent prior physical commitment');
    }
    if (mode === 'owned_append') {
      assertPhysicalActorOpenFrame(db, actor);
      assertSamePaRegistrationBeforeWork(db, { gameId: actor.source.gameId, playId: actor.match.playId, physicalPitchSourceId: p.source.sourceId,
        actorSourceId: actor.source.sourceId, ...('initialWorldSourceId' in actor.source ? { initialWorldSourceId: actor.source.initialWorldSourceId } : { activationApplicationId: actor.source.activationApplicationId }) });
      const bindings = readSamePaOriginalParticipants(db, actor).map(p => p.binding);
      for (const participant of basis.view.participants) { const b = bindings.find(b => b.playerId === participant.playerId)!;
        same(readActualRoleWorkloadState(db, b.careerId, b.playerId, undefined, b.personLinkSourceId), participant.reservedState); }
      same(readSamePaBattingInvocationClaims(db, { enrollmentSourceId: p.lineage.enrollmentReference.sourceId, physicalPitchSourceId: p.source.sourceId }).map(json).sort(), prefix.source.operationReferences.map(json).sort());
    }
    const timing = readPlayerPitchTimingPrefixFromSqlite(db, source.timingReference), timingProfile = selectPlayerPitchTimingProfileFromSqlitePrefix(db, source.timingReference, actor.binding.gameDay);
    const release = readPlayerReleaseGeometryPrefixFromSqlite(db, source.releaseReference), geometry = release.changes.filter(c => c.effectiveDay <= actor.binding.gameDay).at(-1) ?? release.baseline;
    const policy = readPitchFatiguePolicyFromSqlite(db, source.pitchResponseReference), models = playerBattingModelEvidenceFromSqlite(db), model = models.read(source.batterModelReference.sourceId);
    if (!model) throw new Error('next TAKE normal batter model missing'); same(reference('world_player_batting_models', model), source.batterModelReference);
    if (current) { assertCurrentPlayerPitchTimingPrefixFromSqlite(db, source.timingReference, actor.binding.gameDay); assertCurrentPlayerReleaseGeometryPrefixFromSqlite(db, source.releaseReference, actor.binding.gameDay);
      same(models.selectAtDay(actor.binding.careerId, actor.binding.playerId, actor.binding.gameDay), model); }
    if ([...actor.world.runners, ...actor.world.defenders].some(d => d.velocity.x !== 0 || d.velocity.z !== 0)) throw new Error('next TAKE retained body cut requires stationary original participants');
    const completedAtTick = Math.max(p.result.resolution.timeline.lastEventTick, p.result.delivery.timeline.followThroughEndUs, basis.view.evaluationTick);
    if (source.nominalPitch.delivery.readyAtUs < completedAtTick || source.nominalPitch.batter.ballRadiusMeters !== model.equipment.values.ball.radiusM) throw new Error('next TAKE ready time or original equipment differs');
    const bodyCut = { kind: 'retained_stationary_take_body_cut_v1' as const, completedAtTick, previousPhysicalCut: basis.view.physicalCut,
      originalWorld: actor.world, originalWorldHash: hash(actor.world) };
    const result: SamePaNextTakeAction = freeze({ kind: 'next_take_action_prepared', source, lineage: basis.view.lineage, originalActor: actor, bodyCut,
      beforeTimeline: p.result.resolution.timeline, nominalTimingHash: hash(timingProfile), nominalReleaseHash: hash(geometry), nominalBattingModelHash: hash(model) });
    const value = { result, basis, original, timing, timingProfile, geometry, policy, model, prefix }; actions.set(key, value); return value;
  };
  const readAction = (ref: SamePaReference<'pa_take_successor_v1_action_plans'>): SamePaNextTakeAction => {
    const row = samePaTakeIdentityRow(db, samePaTakeTables.action, ref.sourceId); if (!row) throw new Error('next TAKE prepared action missing');
    const source = samePaTakeSuccessorSourceInput(JSON.parse(String(row.source_json)), ref.sourceId); if (source.capability !== 'same_pa_next_take_action_v1') throw new Error('next TAKE action owner differs');
    const value = authenticateAction(source).result; same(reference(samePaTakeTables.action, value), ref); same(row, samePaTakePreparedRow(value)); return value;
  };
  const setup = (source: AcceptedSamePaRetainedTakeSetup): SamePaRetainedTakeSetup | SamePaTakePending => {
    const action = readAction(source.actionReference), input = authenticateAction(action.source), { basis } = input;
    const old = readHistoricalSamePaExecutionView(db, input.original.pitch.viewReference).view, roles = deriveSamePaDispatchRoles(basis.actor, old,
      basis.actor.world.runners.length ? readSamePaOriginalParticipants(db, basis.actor) : undefined);
    if (source.participantInputs.length !== roles.length) throw new Error('next TAKE exact participant input set differs');
    for (const [i, role] of roles.entries()) {
      const participant = source.participantInputs[i], member = basis.members.find(m => m.playerId === role.member.playerId)!;
      same(participant.member, member); same(participant.calibrationReferences.map(c => c.route), role.routes);
      for (const r of participant.calibrationReferences) {
        if (!samePaNativeAdapterImplemented(r.route)) return pending('required_native_adapter_not_implemented');
        const accepted = readSamePaContinuationCalibrationFromSqlite(db, r.calibrationReference);
        same(accepted.source.member, member); same(accepted.source.viewReference, action.source.viewReference); same(accepted.source.route, r.route);
        same(deriveSamePaContinuationCalibration(db, accepted.source, basis, current), accepted);
      }
    }
    if (!db.prepare("SELECT 1 FROM main.sqlite_master WHERE type='table' AND name='batting_observation_v1_postures'").get()
      || !db.prepare('SELECT 1 FROM main.batting_observation_v1_postures WHERE source_id=?').get(source.postureReference.sourceId)) return pending('next_take_posture_missing', [source.postureReference.sourceId]);
    const posture = readBattingPerceptionFromSqlite(db, 'posture', source.postureReference);
    if (posture.kind !== 'batting_invocation_posture' || posture.source.capability !== 'owned_next_take_batting_posture_v1') throw new Error('next TAKE posture owner differs');
    same(posture.source.actionReference, source.actionReference); same(posture.source.viewReference, action.source.viewReference);
    if (!('nextPhysicalPitchSourceId' in posture.source) || posture.source.nextPhysicalPitchSourceId !== source.nextPhysicalPitchSourceId) throw new Error('next TAKE posture prospective pitch identity differs');
    same(posture.source.member, basis.members.find(m => m.playerId === basis.actor.binding.playerId));
    const g = posture.source.geometry, ready = action.source.nominalPitch.delivery.readyAtUs;
    if (g.startedAtTick !== action.bodyCut.completedAtTick || g.bodyReadyTick > ready || ready > g.validUntilTick || g.ticksPerSecond !== 1_000_000) return pending('next_take_body_readiness_unavailable');
    if (source.nextPhysicalPitchSourceId === input.original.pitch.source.sourceId) throw new Error('next TAKE cannot alias its prior physical Source');
    return freeze({ kind: 'retained_take_right_prepared', source, lineage: action.lineage, viewReference: action.source.viewReference, expectedProgressRevision: 1, bodyCut: action.bodyCut });
  };
  const readSetup = (ref: SamePaReference<'pa_take_successor_v1_setups'>): SamePaRetainedTakeSetup => {
    const row = samePaTakeIdentityRow(db, samePaTakeTables.setup, ref.sourceId); if (!row) throw new Error('next TAKE immutable setup/right missing');
    const source = samePaTakeSuccessorSourceInput(JSON.parse(String(row.source_json)), ref.sourceId); if (source.capability !== 'same_pa_retained_take_setup_v1') throw new Error('next TAKE setup owner differs');
    const value = setup(source); if (value.kind === 'pending') throw new Error('next TAKE saved setup prerequisite missing');
    same(reference(samePaTakeTables.setup, value), ref); same(row, samePaTakePreparedRow(value)); return value;
  };
  const derivePitch = (source: AcceptedSamePaSuccessorTakePitch): SamePaTakePitchBundle => {
    const right = readSetup(source.setupReference); same(right.source.actionReference, source.actionReference);
    if (source.sourceId !== right.source.nextPhysicalPitchSourceId) throw new Error('next TAKE physical Source differs from its right');
    const action = readAction(source.actionReference), input = authenticateAction(action.source), actor = input.basis.actor;
    const playerId = actor.world.defenders.find(d => d.registeredPosition === 'P')!.playerId, participant = right.source.participantInputs.find(p => p.member.playerId === playerId)!;
    const calibrationReference = participant.calibrationReferences.find(c => c.route === 'pitch_delivery')!.calibrationReference;
    const calibration = readSamePaContinuationCalibrationFromSqlite(db, calibrationReference);
    if (calibration.source.route !== 'pitch_delivery') throw new Error('next TAKE pitcher calibration route differs');
    same(calibration.source.nominalReference, action.source.timingReference); same(calibration.source.response.policyReference, action.source.pitchResponseReference);
    same(deriveSamePaContinuationCalibration(db, calibration.source, input.basis, current), calibration);
    const state = input.basis.view.participants.find(p => p.playerId === playerId)!, binding = actor.defenderBindings.find(b => b.playerId === playerId)!, person = actor.defenderPersons.find(p => p.playerId === playerId)!;
    const { sourceId: _id, sourceVersion: _version, ...response } = input.policy, nominal = action.source.nominalPitch;
    const effective = applyPitchFatigueToExecution(input.timingProfile, nominal.delivery.physics, state.projectedState.fatigue, response, binding.gameDay);
    const delivery = resolveCanonicalPitchDelivery({ root: new SeedRoot(nominal.delivery.matchSeed), outingId: nominal.delivery.outingId, playId: actor.match.playId, pitchIndex: 1,
      readyAtUs: nominal.delivery.readyAtUs, timingProfile: effective.timingProfile, timingIntent: nominal.delivery.timingIntent,
      body: { ...input.geometry.body, moundReference: nominal.delivery.moundReference }, releaseProfile: input.geometry.profile, physics: effective.physics });
    const trajectory = createPitchTrajectoryFromRelease(delivery.release, nominal.flight.acceleration, delivery.release.releaseAtUs + nominal.flight.durationUs);
    const resolution = resolveAndRecordPitchAgainstBatter(action.beforeTimeline, { ...nominal.batter, trajectory });
    if (resolution.kind !== 'recorded') throw new Error('next TAKE physical result unresolved');
    const posture = readBattingPerceptionFromSqlite(db, 'posture', right.source.postureReference);
    if (posture.kind !== 'batting_invocation_posture' || posture.source.geometry.validUntilTick < Math.max(resolution.timeline.lastEventTick, delivery.timeline.followThroughEndUs)) throw new Error('next TAKE physical duration exceeds accepted body readiness');
    const frame: SamePaSuccessorPitchFrame = { kind: 'nonempty_same_pa_pitch_frame_v1', actorReference: action.lineage.actorReference, viewReference: action.source.viewReference,
      member: participant.member, binding, person, reservedActualState: state.reservedState, projectedExecutionState: state.projectedState,
      nominalTiming: input.timingProfile, nominalRelease: input.geometry, nominalBattingModel: input.model, acceptedPitchResponse: input.policy, bodyCut: action.bodyCut };
    const physicalSourceReference = { sourceId: source.sourceId, sourceVersion: source.sourceVersion, sourceHash: hash(source) }, id = (role: string) => 'pa-take-successor-v1:' + role + ':' + hash(physicalSourceReference);
    const consumer: SamePaSuccessorConsumer = freeze({ kind: 'same_pa_successor_pitch_invoked_v1', source: { sourceId: id('pitch_delivery'), sourceVersion: 'same-pa-successor-v1',
      capability: 'same_pa_successor_pitch_consumer_v1', physicalSourceReference, setupReference: source.setupReference, actionReference: source.actionReference, calibrationReference, member: participant.member },
      lineage: action.lineage, viewReference: action.source.viewReference, frame, beforeTimeline: action.beforeTimeline, calculation: { delivery, trajectory, resolution } });
    const pitch: SamePaSuccessorTakePitch = freeze({ kind: 'same_pa_successor_take_executed_v1', source, lineage: action.lineage, viewReference: action.source.viewReference,
      progressRevision: 2, previousPitchReference: action.source.previousPitchReference, originalActor: actor, frame, beforeTimeline: action.beforeTimeline,
      result: consumer.calculation, consumerReference: reference(samePaTakeTables.consumer, consumer) });
    const receipt = (kind: 'consumption' | 'admission'): SamePaSuccessorReceipt => freeze({ kind: `same_pa_successor_${kind}_v1` as const, source: { sourceId: id(kind), sourceVersion: 'same-pa-successor-v1',
      capability: `same_pa_successor_${kind}_v1` as const, setupReference: source.setupReference, physicalSourceReference }, lineage: action.lineage,
      viewReference: action.source.viewReference, pitchReference: reference(samePaTakeTables.pitch, pitch), consumerReference: pitch.consumerReference });
    return freeze({ action, setup: right, consumer, pitch, consumption: receipt('consumption'), admission: receipt('admission') });
  };
  try { return body({ action: source => authenticateAction(source).result, setup, readAction, readSetup, pitch: derivePitch }); }
  finally { actions.clear(); }
});
export const deriveSamePaNextTakeAction = (db: DatabaseSync, raw: AcceptedSamePaNextTakeAction) => {
  const source = samePaTakeSuccessorSourceInput(raw); if (source.capability !== 'same_pa_next_take_action_v1') throw new Error('invalid next TAKE action Source');
  return assembly(db, 'fresh', own => own.action(source));
};
export const deriveSamePaRetainedTakeSetup = (db: DatabaseSync, raw: AcceptedSamePaRetainedTakeSetup) => {
  const source = samePaTakeSuccessorSourceInput(raw); if (source.capability !== 'same_pa_retained_take_setup_v1') throw new Error('invalid retained TAKE setup Source');
  return assembly(db, 'fresh', own => own.setup(source));
};
export const readSamePaNextTakeActionFromSqlite = (db: DatabaseSync, raw: SamePaReference<'pa_take_successor_v1_action_plans'>) => {
  const ref = cloneInert(raw); if (!samePaReferenceValid(ref, samePaTakeTables.action)) throw new Error('invalid next TAKE action reference'); return assembly(db, 'historical', own => own.readAction(ref));
};
export const readSamePaRetainedTakeSetupFromSqlite = (db: DatabaseSync, raw: SamePaReference<'pa_take_successor_v1_setups'>) => {
  const ref = cloneInert(raw); if (!samePaReferenceValid(ref, samePaTakeTables.setup)) throw new Error('invalid next TAKE setup reference'); return assembly(db, 'historical', own => own.readSetup(ref));
};

const executionRow = (value: SamePaSuccessorConsumer | SamePaSuccessorTakePitch | SamePaSuccessorReceipt): Record<string, string | number> => {
  const s = value.source, l = value.lineage;
  const extra: Record<string, string | number> = value.kind === 'same_pa_successor_pitch_invoked_v1' ? { setup_source_id: value.source.setupReference.sourceId,
    physical_source_id: value.source.physicalSourceReference.sourceId, player_id: value.source.member.playerId }
    : value.kind === 'same_pa_successor_take_executed_v1' ? { setup_source_id: value.source.setupReference.sourceId, progress_revision: 2 }
      : { setup_source_id: value.source.setupReference.sourceId, pitch_source_id: value.pitchReference.sourceId };
  return { source_id: s.sourceId, source_version: s.sourceVersion, career_id: l.careerId, game_id: l.gameId, play_id: l.playId,
    enrollment_source_id: l.enrollmentReference.sourceId, actor_source_id: l.actorReference.sourceId, first_pitch_source_id: l.firstPhysicalPitchSourceId,
    view_source_id: value.viewReference.sourceId, ...extra, source_json: json(s), source_hash: hash(s), snapshot_json: json(value), snapshot_hash: hash(value) };
};
const bundleRows = (bundle: SamePaTakePitchBundle) => {
  const p = bundle.pitch, l = p.lineage;
  return [{ table: samePaTakeTables.consumer, row: executionRow(bundle.consumer) }, { table: samePaTakeTables.pitch, row: executionRow(p) },
    { table: samePaTakeTables.head, row: { enrollment_source_id: l.enrollmentReference.sourceId, career_id: l.careerId, game_id: l.gameId, play_id: l.playId,
      first_pitch_source_id: l.firstPhysicalPitchSourceId, progress_revision: 2, last_source_id: p.source.sourceId, snapshot_hash: hash(p) } as Record<string, string | number> },
    { table: samePaTakeTables.consumption, row: executionRow(bundle.consumption) }, { table: samePaTakeTables.admission, row: executionRow(bundle.admission) }];
};
const sorted = (rows: readonly { table: string; row: unknown }[]) => rows.map(r => json([r.table, r.row])).sort();
const readCompletedPitch = (db: DatabaseSync, id: string) => withSamePaContinuationReadPhase(db, () => {
  const row = samePaTakeIdentityRow(db, samePaTakeTables.pitch, id);
  if (!row) {
    if (readSamePaSuccessorWorkClaimRows(db, { physicalPitchSourceId: id }).length) throw new Error('partial next TAKE append cannot be repaired'); return null;
  }
  const source = samePaTakeSuccessorSourceInput(JSON.parse(String(row.source_json)), id);
  if (source.capability !== 'same_pa_successor_take_pitch_v1') throw new Error('next TAKE physical owner differs');
  const bundle = assembly(db, 'historical', own => own.pitch(source)), expected = bundleRows(bundle);
  same(row, executionRow(bundle.pitch));
  same(sorted(readSamePaSuccessorWorkClaimRows(db, { enrollmentSourceId: bundle.pitch.lineage.enrollmentReference.sourceId })), sorted(expected));
  for (const entry of expected.filter(e => e.table !== samePaTakeTables.head)) same(samePaTakeIdentityRow(db, entry.table, String(entry.row.source_id)), entry.row);
  return bundle;
});
export const readSamePaSuccessorTakePitchFromSqlite = (db: DatabaseSync, raw: SamePaReference<'pa_take_successor_v1_pitch_actions'>) => {
  const ref = cloneInert(raw); if (!samePaReferenceValid(ref, samePaTakeTables.pitch)) throw new Error('invalid successor TAKE pitch reference');
  const value = readCompletedPitch(db, ref.sourceId); if (!value) throw new Error('successor TAKE pitch missing'); same(reference(samePaTakeTables.pitch, value.pitch), ref); return value;
};

type TakeAuthority = Readonly<{ readAcceptedAction?(id: string): unknown; readAcceptedSetup?(id: string): unknown; readAcceptedPhysicalPitch?(id: string): unknown }>;
/** The complete bounded second-pitch owner. Stage selection is lexical to this
 * writer; public operations accept Source identities only. */
export const openSqliteSamePlateAppearanceTakeSuccessorStore = (path: string, authority?: TakeAuthority) => {
  if (!samePaText(path) || authority && Object.values(authority).some(v => typeof v !== 'function')) throw new Error('invalid next TAKE owner');
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new Native(path);
  const tx = battingInvocationTransaction(db, () => assertSamePaTakeSuccessorStorage(db)), names = Object.values(samePaTakeTables);
  const allRows = () => assertSamePaTakeSuccessorStorage(db) ? names.map(t => db.prepare('SELECT * FROM main.' + t + ' ORDER BY rowid').all()) : names.map(() => []);
  const readPrepared = (kind: 'action' | 'setup', id: string): Prepared | null => {
    const row = samePaTakeIdentityRow(db, samePaTakeTables[kind], id); if (!row) return null;
    const ref = { owner: samePaTakeTables[kind], sourceId: id, sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) };
    return kind === 'action' ? readSamePaNextTakeActionFromSqlite(db, { ...ref, owner: samePaTakeTables.action })
      : readSamePaRetainedTakeSetupFromSqlite(db, { ...ref, owner: samePaTakeTables.setup });
  };
  const read = (kind: 'action' | 'setup', id: string) => {
    if (!samePaText(id)) throw new Error('invalid next TAKE identity'); return tx.run(false, proof => proof(() => readPrepared(kind, id)), () => {});
  };
  const accept = (kind: 'action' | 'setup', id: string): Prepared | SamePaTakePending => {
    if (!samePaText(id)) throw new Error('invalid next TAKE identity');
    const raw = (kind === 'action' ? authority?.readAcceptedAction : authority?.readAcceptedSetup)?.(id) ?? null;
    const source = raw === null ? null : samePaTakeSuccessorSourceInput(raw, id), prior = read(kind, id);
    if (source && (kind === 'action' ? source.capability !== 'same_pa_next_take_action_v1' : source.capability !== 'same_pa_retained_take_setup_v1')) throw new Error('next TAKE Source belongs to another owner');
    if (prior) { if (source) same(source, prior.source); return prior; } if (!source) return pending('accepted_source_missing', [id]);
    const derive = () => source.capability === 'same_pa_next_take_action_v1' ? deriveSamePaNextTakeAction(db, source)
      : source.capability === 'same_pa_retained_take_setup_v1' ? deriveSamePaRetainedTakeSetup(db, source) : (() => { throw new Error('invalid next TAKE preparation'); })();
    const preflight = tx.run(false, proof => proof(() => ({ value: derive(), rows: allRows() })), () => {});
    if (preflight.value.kind === 'pending') return preflight.value;
    const row = samePaTakePreparedRow(preflight.value), expected = preflight.rows.map(r => [...r]); expected[names.indexOf(samePaTakeTables[kind])].push(row);
    return tx.run(true, (proof, step) => {
      same(proof(() => ({ value: derive(), rows: allRows() })), preflight);
      if (!assertSamePaTakeSuccessorStorage(db)) { if (kind !== 'action') throw new Error('next TAKE action namespace missing');
        for (const sql of Object.values(samePaTakeSuccessorSchema)) step(() => db.exec(sql), 0, 1); same(proof(derive), preflight.value); }
      const canonical = db.prepare(`SELECT source_id FROM main.${samePaTakeTables[kind]} WHERE enrollment_source_id=? AND view_source_id=?`).get(row.enrollment_source_id, row.view_source_id);
      if (canonical) throw new Error('next TAKE canonical preparation already owned');
      step(() => { const changed = db.prepare(`INSERT INTO main.${samePaTakeTables[kind]} VALUES(${Object.keys(row).map(() => '?').join(',')})`).run(...Object.values(row));
        if (changed.changes !== 1) throw new Error('next TAKE exact prepared delta differs'); }, 1);
      proof(() => { same(derive(), preflight.value); same(readPrepared(kind, id), preflight.value); same(allRows(), expected); }); return preflight.value as Prepared;
    }, value => { same(readPrepared(kind, id), value); same(allRows(), expected); });
  };
  const readPitch = (id: string) => {
    if (!samePaText(id)) throw new Error('invalid successor pitch identity'); return tx.run(false, proof => proof(() => readCompletedPitch(db, id)), () => {})?.pitch ?? null;
  };
  const acceptPitch = (id: string): SamePaSuccessorTakePitch | SamePaTakePending => {
    if (!samePaText(id)) throw new Error('invalid successor pitch identity');
    const raw = authority?.readAcceptedPhysicalPitch?.(id) ?? null, source = raw === null ? null : samePaTakeSuccessorSourceInput(raw, id), prior = readPitch(id);
    if (source && source.capability !== 'same_pa_successor_take_pitch_v1') throw new Error('invalid successor physical Source');
    if (prior) { if (source) same(prior.source, source); return prior; } if (!source) return pending('accepted_source_missing', [id]);
    const preflight = tx.run(false, proof => proof(() => ({ bundle: assembly(db, 'fresh', own => own.pitch(source)), rows: allRows() })), () => {});
    const plan = bundleRows(preflight.bundle), expected = preflight.rows.map(r => [...r]);
    return tx.run(true, (proof, step) => {
      same(proof(() => ({ bundle: assembly(db, 'fresh', own => own.pitch(source)), rows: allRows() })), preflight);
      for (const [index, entry] of plan.entries()) {
        step(() => { const changed = db.prepare(`INSERT INTO main.${entry.table} VALUES(${Object.keys(entry.row).map(() => '?').join(',')})`).run(...Object.values(entry.row));
          if (changed.changes !== 1) throw new Error('next TAKE exact physical row delta differs'); }, 1);
        expected[names.indexOf(entry.table)].push(entry.row);
        proof(() => { same(allRows(), expected); const value = assembly(db, 'owned_append', own => own.pitch(source)); same(value, preflight.bundle);
          same(sorted(readSamePaSuccessorWorkClaimRows(db, { enrollmentSourceId: value.pitch.lineage.enrollmentReference.sourceId })), sorted(bundleRows(value).slice(0, index + 1))); });
      }
      return preflight.bundle.pitch;
    }, value => { const completed = readCompletedPitch(db, id); if (!completed) throw new Error('next TAKE committed pitch missing'); same(completed.pitch, value); same(allRows(), expected); });
  };
  return Object.freeze({ acceptAction: (id: string) => accept('action', id) as SamePaNextTakeAction | SamePaTakePending,
    acceptSetup: (id: string) => accept('setup', id) as SamePaRetainedTakeSetup | SamePaTakePending,
    readAction: (id: string) => read('action', id) as SamePaNextTakeAction | null, readSetup: (id: string) => read('setup', id) as SamePaRetainedTakeSetup | null,
    acceptPhysicalPitch: acceptPitch, readPhysicalPitch: readPitch, close: tx.close });
};
