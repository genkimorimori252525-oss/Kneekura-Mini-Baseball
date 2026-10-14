import { expect } from 'vitest';
import { getOfficialPlayClosure } from '../../core/adjudication/PlayAdjudicationLedger';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { readSamePaLifecycleNextPitchBasisFromSqlite } from './SamePlateAppearanceLifecycleFromSqlite';
import { openSqliteSamePlateAppearanceLifecycleOutcomeStore } from './SamePlateAppearanceLifecycleOutcomeFromSqlite';
import { openSqliteSamePlateAppearancePhysicalEpisodeStore } from './SqliteSamePlateAppearancePhysicalEpisodeStore';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import type { AcceptedSamePaLifecycleOutcome, AcceptedSamePaLifecycleReset } from './SamePlateAppearanceLifecycleOutcome';
import type { SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import type { samePaPhysicalLifecycleFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import type { prepareFreshPhysicalFieldFixture } from './SamePlateAppearancePhysicalFieldFixture.test-support';

type Fixture = ReturnType<typeof samePaPhysicalLifecycleFixture>;
type Field = ReturnType<ReturnType<typeof prepareFreshPhysicalFieldFixture>['appendField']>;
/** Continue one actual stationary field chain. Source horizons and the finite
 * loop budget are queries, never evidence of contact, territory, or a stop. */
export const completeSamePaFoulResetFixture = (h: Fixture, field: Field, label: string) => {
  const { f } = h, track = f.x.f.track;
  const beforeHeads = f.db.prepare('SELECT * FROM world_player_workload_heads ORDER BY career_id,player_id').all();
  const beforeMatch = f.x.f.official.getMatch(f.actor.source.gameId);
  const worldControl = h.worldOwner.readHead(f.actor.binding.careerId);
  const status = field.step.timeline.status;
  if (status.kind !== 'batted_ball_pending') throw new Error('foul fixture requires original unresolved batted timeline');
  const oldCount = status.count;
  const throughTick = Math.min(...field.root.field.motion.actors.map(a => a.primitive.endTick));
  const steps: SamePaPhysicalFieldStep[] = [field.step];
  let stop = field.step;
  for (let ordinal = 0; ordinal < 16; ordinal++) {
    const world = stop.field.motion.world;
    if (world.kind === 'boundary' && world.contacts.length === 1 && world.contacts[0].kind === 'rolling_stop') break;
    expect(world.kind).toBe('boundary');
    if (world.kind !== 'boundary') throw new Error('foul fixture did not reach a physical boundary');
    expect(world.contacts.map(c => c.kind)).toEqual(['ground']);
    expect(stop.field.baseContacts).toEqual([]); expect(stop.field.motion.carrierPlayerId).toBeNull();
    if (!stop.field.motion.cursor) throw new Error('foul fixture needs a concrete contact/custody owner');
    const previousReference = reference('pa_physical_v1_field_steps', stop);
    const source: SamePaPhysicalFieldStepSource = {
      sourceId: label + ':field:' + ordinal, sourceVersion: 'fixture-only-v1', capability: 'same_pa_physical_field_step_v1',
      viewReference: h.current().viewReference, launchReference: field.root.source.launchReference,
      previousOperationReference: previousReference, fieldRootReference: field.rootReference, previousFieldReference: previousReference, throughTick,
    };
    h.save(source); const next = h.physical.acceptOperation(source.sourceId);
    if (next.kind !== 'same_pa_physical_field_step_v1') throw new Error('real retained foul field step pending');
    expect(next.field.motion.world.moment.elapsedSeconds).toBeGreaterThan(world.moment.elapsedSeconds);
    h.advance(reference('pa_physical_v1_field_steps', next)); stop = next; steps.push(next);
  }
  const stopped = stop.field.motion.world;
  expect(stopped.kind).toBe('boundary');
  if (stopped.kind !== 'boundary' || stopped.contacts.length !== 1 || stopped.contacts[0].kind !== 'rolling_stop') throw new Error('bounded foul fixture did not own its stop');
  expect(stopped.moment.ball.velocity).toEqual({ x: 0, y: 0, z: 0 });
  expect(stop.field.baseContacts).toEqual([]); expect(stop.field.motion.carrierPlayerId).toBeNull();
  const fieldView = h.current(), stopReference = reference('pa_physical_v1_field_steps', stop);
  const source: AcceptedSamePaLifecycleOutcome = {
    sourceId: label + ':outcome', sourceVersion: 'fixture-only-v1', capability: 'same_pa_lifecycle_outcome_v1',
    enrollmentReference: h.original.enrollmentReference, viewReference: fieldView.viewReference, physicalOperationReference: stopReference,
    kind: 'untouched_foul', rulePolicy: { version: 'untouched_settled_foul_dead_v1', ruleProfileId: NPB_2026_RULE_PROFILE.id, rulesRevision: NPB_2026_RULE_PROFILE.rulesRevision },
    officialPolicy: { sourceId: label + ':window-policy', sourceVersion: 'explicit-fixture-v1', ruleProfileId: NPB_2026_RULE_PROFILE.id,
      officialWindows: { appeal: { available: true }, review: { available: false }, challenge: { available: false } } },
    official: {
      assignment: { sourceId: label + ':assignment', sourceVersion: 'fixture-only-v1', gameId: f.actor.source.gameId,
        playId: f.actor.match.playId, physicalPitchSourceId: field.root.physicalPitchSourceId,
        officialIds: ['explicit-fixture-umpire'], schedulerId: 'explicit-fixture-scheduler' },
      call: { sourceId: label + ':call', sourceVersion: 'fixture-only-v1', assignmentSourceId: label + ':assignment', officialId: 'explicit-fixture-umpire', judgment: 'foul' },
      events: [
        { sourceId: label + ':advance', sourceVersion: 'fixture-only-v1', schedulerId: 'explicit-fixture-scheduler', kind: 'advance_tick' },
        { sourceId: label + ':fence', sourceVersion: 'fixture-only-v1', schedulerId: 'explicit-fixture-scheduler', kind: 'next_pitch_fence' },
      ],
    },
  };
  h.save(source);
  const outcomes = track(openSqliteSamePlateAppearanceLifecycleOutcomeStore(f.path, { readAcceptedOutcome: id => h.accepted.get(id), readAcceptedReset: id => h.accepted.get(id) }));
  const noFence = h.save({ ...source, sourceId: label + ':no-fence', official: { ...source.official, events: source.official.events.slice(0, 1) } });
  expect(outcomes.acceptOutcome(noFence.sourceId)).toMatchObject({ kind: 'pending', reason: 'official_next_pitch_fence_required' });
  expect(outcomes.readOutcome(noFence.sourceId)).toBeNull();
  const outcome = outcomes.acceptOutcome(source.sourceId);
  if (outcome.kind !== 'same_pa_lifecycle_outcome') throw new Error('actual settled foul official outcome pending: ' + JSON.stringify(outcome));
  expect(outcome.disposition).toBe('ordinary_foul'); expect(outcome.physicalEnd).toEqual({ kind: 'play_end', tick: stop.evaluationTick, reason: 'dead_ball' });
  expect(outcome.timeline.status).toMatchObject({ kind: 'active', count: { balls: oldCount.balls, strikes: Math.min(2, oldCount.strikes + 1) } });
  expect(outcome.physicalCompletedAtTick).toBe(stop.evaluationTick); expect(getOfficialPlayClosure(outcome.officialLedger)).not.toBeNull();
  expect(outcome.controllerRetirementBasis.participants).toHaveLength(10);
  const ownedCommands = outcome.controllerRetirementBasis.participants.flatMap(p => p.ownedCommands);
  expect(ownedCommands.filter(c => c.kind === 'field_primitive')).toHaveLength(50);
  expect(ownedCommands.filter(c => c.kind === 'pitch_delivery')).toHaveLength(1);
  expect(ownedCommands.filter(c => c.kind === 'batting_motor')).toHaveLength(1);
  const outcomeReference = reference('pa_lifecycle_v1_outcomes', outcome); h.advance(outcomeReference);
  expect(withSqliteReadTransaction(f.db, () => readSamePaLifecycleNextPitchBasisFromSqlite(f.db, h.current().viewReference, 'current')))
    .toMatchObject({ kind: 'pending', reason: 'same_pa_physical_or_official_closure_pending' });
  // A completed official outcome cannot reopen its old field before reset.
  const late = h.save({ ...stop.source, sourceId: label + ':after-outcome-work', viewReference: h.current().viewReference,
    previousOperationReference: stopReference, previousFieldReference: stopReference, throughTick: stop.evaluationTick + 1 });
  expect(() => h.physical.acceptOperation(late.sourceId)).toThrow('physical continuation cannot reopen an owned outcome or reset');
  expect(f.db.prepare('SELECT 1 FROM pa_physical_v1_field_steps WHERE source_id=?').get(late.sourceId)).toBeUndefined();
  const resetSource: AcceptedSamePaLifecycleReset = {
    sourceId: label + ':reset', sourceVersion: 'fixture-only-v1', capability: 'same_pa_lifecycle_reset_v1',
    enrollmentReference: h.original.enrollmentReference, viewReference: h.current().viewReference, outcomeReference,
    controllerReset: 'rule_system_retire_same_pa_episode_v1', nextStartedAtTick: outcome.evaluationTick,
    // Independently declared initial fixture positions, not an inferred posture
    // or Career control revision. The owner authenticates actor/venue identity.
    worldSetup: f.x.f.firstInput.worldSetup,
  };
  const backdated = h.save({ ...resetSource, sourceId: label + ':backdated-reset', nextStartedAtTick: stop.evaluationTick - 1 });
  expect(() => outcomes.acceptReset(backdated.sourceId)).toThrow('backdates');
  h.save(resetSource); const reset = outcomes.acceptReset(resetSource.sourceId);
  if (reset.kind !== 'same_pa_lifecycle_reset') throw new Error('actual ordinary foul reset pending');
  expect(reset.retirement.basis).toEqual(outcome.controllerRetirementBasis);
  expect(reset.retirement.atTick).toBe(resetSource.nextStartedAtTick);
  expect(ownedCommands.some(c => c.validThroughTick > reset.retirement.atTick)).toBe(true);
  expect(reset.resetWorld.ball).toBeNull(); expect(reset.resetWorld.defenders).toHaveLength(9);
  const resetReference = reference('pa_lifecycle_v1_resets', reset); h.advance(resetReference);
  const nextBasis = withSqliteReadTransaction(f.db, () => readSamePaLifecycleNextPitchBasisFromSqlite(f.db, h.current().viewReference, 'current'));
  if (nextBasis.kind !== 'ready') throw new Error('reset did not expose next physical action');
  expect(nextBasis.nextPitchOrdinal).toBe(4); expect(nextBasis.bodyCut.origin).toBe('foul_reset');
  expect(nextBasis.bodyCut.worldReference).toEqual(resetReference); expect(nextBasis.physicalWorld).toEqual(reset.resetWorld);
  const readyAtUs = nextBasis.bodyCut.completedAtTick;
  const planned = h.prepareAction(label + ':pitch4', 'declared_take', { ...h.original.nominalPitch, delivery: { ...h.original.nominalPitch.delivery, readyAtUs,
    physics: { ...h.original.nominalPitch.delivery.physics, velocity: { ...h.original.nominalPitch.delivery.physics.velocity, x: 2 } } } });
  expect(planned.action.timeline).toEqual(reset.timeline); expect(planned.action.physicalWorld).toEqual(reset.resetWorld);
  const posture = h.preparePosture(label + ':pitch4', planned, { ...h.geometry, startedAtTick: readyAtUs,
    attention: { target: { kind: 'ball' }, focusedSinceTick: readyAtUs }, bodyReadyTick: readyAtUs, latestMotorStartTick: readyAtUs, validUntilTick: readyAtUs + 20_000_000 });
  const launch = h.launch(h.prepareRight(planned, posture.postureReference)), launchReference = reference('pa_physical_v1_launches', launch);
  const resolutionSource = h.save({ sourceId: label + ':pitch4-resolution', sourceVersion: 'fixture-only-v1', capability: 'same_pa_physical_resolution_v1',
    viewReference: h.current().viewReference, launchReference, previousOperationReference: launchReference, commitmentReference: null, throughTick: launch.trajectory.endTick });
  const resolution = h.physical.acceptOperation(resolutionSource.sourceId);
  if (resolution.kind !== 'same_pa_physical_resolution_v1') throw new Error('post-foul ordinary TAKE pending');
  expect(resolution.pitchOrdinal).toBe(4); expect(resolution.resolution.kind).toBe('recorded_take'); expect(resolution.contact).toBeNull();
  expect(resolution.timeline.status).toMatchObject({ kind: 'active', count: { balls: oldCount.balls + 1, strikes: Math.min(2, oldCount.strikes + 1) } });
  h.advance(reference('pa_physical_v1_resolutions', resolution));
  expect(h.current().view.cut.stage).toBe('retained_take');
  expect(f.db.prepare('SELECT * FROM world_player_workload_heads ORDER BY career_id,player_id').all()).toEqual(beforeHeads);
  expect(f.x.f.official.getMatch(f.actor.source.gameId)).toEqual(beforeMatch); expect(h.worldOwner.readHead(f.actor.binding.careerId)).toEqual(worldControl);
  expect(f.db.prepare('SELECT count(*) n FROM same_pa_participant_reservations').get()!.n).toBe(10);
  const bytes = () => json(['pa_lifecycle_v1_outcomes', 'pa_lifecycle_v1_resets', 'pa_physical_v1_launches', 'pa_physical_v1_field_steps', 'pa_physical_v1_heads']
    .map(table => f.db.prepare('SELECT * FROM main.' + table + ' ORDER BY rowid').all()));
  const saved = bytes(); outcomes.close();
  const reopened = track(openSqliteSamePlateAppearanceLifecycleOutcomeStore(f.path));
  const reopenedPhysical = track(openSqliteSamePlateAppearancePhysicalEpisodeStore(f.path));
  expect(reopened.acceptOutcome(source.sourceId)).toEqual(outcome); expect(reopened.acceptReset(resetSource.sourceId)).toEqual(reset);
  expect(reopenedPhysical.readOperation(stopReference).record).toEqual(stop);
  expect(reopenedPhysical.acceptOperation(launch.source.sourceId)).toEqual(launch); expect(bytes()).toBe(saved);
  return { steps, stop, outcome, reset, launch, resolution };
};
