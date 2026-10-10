import { afterEach, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { readNonPitchRepetitionFrame, readNonPitchRepetitionCompletion } from './NonPitchRepetitionEvidenceFromSqlite';
import type { NonPitchRepetitionExercise, NonPitchRepetitionOpportunity } from './NonPitchDevelopmentRepetition';
import * as actors from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import * as originals from './SamePlateAppearanceOriginalParticipants';
import * as endpoints from './SamePlateAppearanceTerminalEndpointFromSqlite';
import * as totals from './SamePlateAppearanceTerminalSettlementFromSqlite';
import * as outcomes from './SamePlateAppearanceLifecycleOutcomeFromSqlite';
import * as fields from './SamePlateAppearanceFieldRuleEvidenceFromSqlite';
import * as operations from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import * as roles from './ActualRoleWorkloadEvidenceFromSqlite';
import * as closures from './ActualLivePlayClosureEvidenceFromSqlite';
import * as adjudications from './ActualLiveAdjudicationFromSqlite';
import * as prefixes from './BattedWorldFieldPhysicalPrefix';
import * as bindings from './SqliteBattedEpisodeFieldBindingStore';
const { actorJson: json, actorHash: hash } = actors;
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const cleanup: (() => void)[] = [];
afterEach(() => { try { while (cleanup.length) cleanup.pop()!(); } finally { vi.restoreAllMocks(); } });
const ref = (owner: string, sourceId = owner) => ({ owner, sourceId, sourceHash: hash(sourceId), snapshotHash: hash([sourceId]) });

// Small adapter-only Native tests. Physical, endpoint and workload owners are
// explicitly substituted; these fixtures never qualify a physical game.
const fixture = (reserved = true, occupied = false) => {
  const db = new DatabaseSync(':memory:'); cleanup.push(() => db.close());
  const participant = (playerId: string) => ({ binding: { careerId: 'career', gameId: 'game', playId: 7, playerId,
    personId: 'person-' + playerId, personLinkSourceId: 'intake-' + playerId, gameDay: 12 },
    person: { sourceId: 'intake-' + playerId, careerId: 'career', playerId, personId: 'person-' + playerId } });
  const batter = participant('batter'), defender = participant('defender'), runner = participant('runner');
  const actor = { source: { sourceId: 'actor', sourceVersion: 'v1', gameId: 'game', initialWorldSourceId: 'initial' },
    binding: batter.binding, person: batter.person, defenderBindings: [defender.binding], defenderPersons: [defender.person],
    match: { playId: 7, outs: 0, bases: { first: occupied ? 'runner' : null, second: null, third: null } },
    world: { runners: occupied ? [{ playerId: 'runner' }] : [] } };
  db.exec('CREATE TABLE physical_plate_appearance_actors(source_id TEXT,source_json TEXT,snapshot_json TEXT)');
  db.prepare('INSERT INTO physical_plate_appearance_actors VALUES(?,?,?)').run('actor', json(actor.source), json(actor));
  vi.spyOn(actors, 'readPhysicalPlateAppearanceActorFromSqlite').mockReturnValue(actor as never);
  vi.spyOn(actors, 'readPhysicalActorForPlayFromSqlite').mockReturnValue(actor as never);
  vi.spyOn(actors, 'assertPhysicalActorOpenFrame').mockImplementation(() => {});
  vi.spyOn(originals, 'readSamePaOriginalParticipants').mockReturnValue([
    { ...batter, role: 'batter', startingBase: null }, { ...defender, role: 'defender', startingBase: null },
    ...(occupied ? [{ ...runner, role: 'runner', startingBase: 1 }] : []),
  ] as never);
  const read = <T>(body: () => T) => { db.exec('BEGIN'); try { return body(); } finally { db.exec('ROLLBACK'); } };
  const source = (exercise: NonPitchRepetitionExercise, playerId: string): NonPitchRepetitionOpportunity => ({ sourceId: 'intention',
    sourceVersion: 'v1', opportunityId: 'intention', actorSourceId: 'actor', playerId, personLinkSourceId: 'intake-' + playerId,
    episodeId: 'learning', episodeRevision: 2, domain: 'TECHNICAL', exercise });
  const frame = (exercise: NonPitchRepetitionExercise, playerId: string) => read(() => readNonPitchRepetitionFrame(db, source(exercise, playerId), false));
  const body = (playerId: string, speed: number) => ({ playerId, primitive: { role: 'body', startTick: 100,
    ticksPerSecond: 1000, startVelocity: { x: speed, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } } });
  const physical = { field: { evidence: { batterRunnerId: 'batter', defenderIds: ['defender'], originTick: 100,
    horizon: { originTick: 100, elapsedSeconds: 1, ball: { tick: 1100 } }, contacts: [{ moment: { originTick: 100, elapsedSeconds: 0.5 },
      contacts: [{ kind: 'actor', playerId: 'defender', role: 'glove' }] }] } },
    segments: [{ originTick: 100, startElapsedSeconds: 0, endElapsedSeconds: 1,
      actors: [body('batter', 1), body('defender', 0), ...(occupied ? [body('runner', 0)] : [])] }] };
  const contact = { tick: 100 }, event = { kind: 'BatBallContact', tick: 100, sequence: 2, payload: { contact } };
  const workload = (playerId: string) => ({ activity: { kind: 'MATCH', careerId: 'career', playerId, atDay: 12,
    sourceEventId: 'total-' + playerId, effortUnits: 2 }, before: { revision: 2, fatigue: 0.25 }, after: { revision: 3, fatigue: 0.45 } });
  const participants = [batter, defender, ...(occupied ? [runner] : [])];
  const launchReference = ref('pa_physical_v1_launches', 'launch'), operationReference = ref('pa_physical_v1_field_steps', 'seal');
  const enrollmentReference = ref('same_pa_enrollments', 'enrollment'), viewReference = ref('pa_lifecycle_v1_execution_views', 'live');
  const lineage = { careerId: 'career', gameId: 'game', playId: 7, enrollmentReference, actorReference: ref('physical_plate_appearance_actors', 'actor') };
  const fieldReferences = [ref('pa_physical_v1_field_roots', 'root'), operationReference];
  const root = { kind: 'same_pa_physical_field_root_v1', source: { resolutionReference: ref('pa_physical_v1_resolutions', 'resolution'), launchReference },
    physicalPitchSourceId: 'pitch', response: { world: { flight: { initialBall: { tick: 100 } } } } };
  const fairCatch = { physicalPitchReference: launchReference, physicalOperationReference: operationReference,
    exactEnd: { originTick: 100, elapsedSeconds: 1, tick: 1100 }, generation: { completeCoverageHash: 'live-coverage',
      ruleConsumption: { fieldReferences, ruleEvidenceHash: hash({ physical }) } } };
  const endpoint = { kind: 'same_pa_terminal_endpoint_v1', source: { sourceId: 'terminal' }, actor, lineage, enrollmentReference,
    finalViewReference: ref('pa_lifecycle_v1_execution_views', 'final'), outcomeReference: ref('pa_lifecycle_v1_outcomes', 'outcome'),
    gameDay: 12, coverageHash: 'final-coverage', fairCatch };
  const terminalReference = { owner: 'pa_terminal_v1_endpoints', sourceId: 'terminal', sourceHash: hash(endpoint.source), snapshotHash: hash(endpoint) };
  const release = { terminalReference, enrollmentReference, settlementReference: ref('pa_settlement_v1_plans', 'settlement'),
    transitionReference: ref('pa_terminal_v1_transitions', 'transition') };
  const settlement = { kind: 'settled', plan: { lineage, enrollmentReference, finalViewReference: endpoint.finalViewReference,
    coverageHash: endpoint.coverageHash }, participants: participants.map(p => ({ playerId: p.binding.playerId, applied: true,
      activity: workload(p.binding.playerId).activity, reservedState: workload(p.binding.playerId).before, projectedState: workload(p.binding.playerId).after })) };
  const pair = { kind: 'same_pa_field_rule_read_pair_v1', actor, view: { lineage, coverageHash: 'live-coverage' }, fields: [root],
    value: { viewReference, physicalPitchReference: launchReference, physicalOperationReference: operationReference,
      fieldReferences, evidenceHash: hash({ physical }), evidence: { physical } } };
  const resolution = { kind: 'same_pa_physical_resolution_v1', source: { commitmentReference: ref('pa_physical_v1_commitments', 'commitment') },
    contact, timeline: { events: [event] } };
  const commitment = { kind: 'same_pa_physical_commitment_v1', commitment: { action: 'SWING' } };
  const physicalSpy = vi.spyOn(operations, 'readSamePaPhysicalOperationFromSqlite').mockImplementation((_db, r) => ({
    actor, lineage, physicalPitchReference: launchReference,
    record: r.sourceId === 'resolution' ? resolution : r.sourceId === 'commitment' ? commitment : { kind: 'same_pa_physical_launch_v1', timeline: { events: [] } },
  }) as never);
  vi.spyOn(endpoints, 'readSamePaTerminalEndpointFromSqlite').mockReturnValue(endpoint as never);
  const releaseSpy = vi.spyOn(totals, 'readSamePaTerminalReleaseFromSqlite').mockReturnValue(release as never);
  vi.spyOn(totals, 'readSamePaTerminalSettlementFromSqlite').mockReturnValue(settlement as never);
  vi.spyOn(outcomes, 'readSamePaLifecycleOutcomeFromSqlite').mockReturnValue({ source: { kind: 'fair_catch', viewReference }, lineage, actor, fairCatch } as never);
  vi.spyOn(fields, 'readSamePaFieldRuleEvidenceWithInputsFromSqlite').mockReturnValue(pair as never);
  if (reserved) {
    db.exec('CREATE TABLE pa_terminal_v1_endpoints(source_id TEXT,source_hash TEXT,snapshot_hash TEXT,source_json TEXT,snapshot_json TEXT)');
    db.prepare('INSERT INTO pa_terminal_v1_endpoints VALUES(?,?,?,?,?)').run('terminal', terminalReference.sourceHash, terminalReference.snapshotHash, json(endpoint.source), json(endpoint));
  }
  const pitch = { source: { sourceId: 'pitch', request: { batter: { action: { kind: 'swing' } } } },
    frame: { batterActor: actor, gameId: 'game', match: { playId: 7 } }, beforeTimeline: { events: [] },
    result: { pitch: { resolution: { timeline: { events: [event] } } } } };
  const ordinary = { status: 'OFFICIAL_APPLIED', officialApplied: true, source: { adjudicationSourceId: 'adjudication' },
    proposal: { gameId: 'game', playId: 7, actors: participants, physicalEndReference: ref('ordinary-end'), wholeHistoryReference: ref('ordinary-history') } };
  const ordinaryPair = { value: { gameId: 'game', playId: 7, endReference: ordinary.proposal.physicalEndReference,
    wholeHistoryReference: ordinary.proposal.wholeHistoryReference }, end: { physicalPitchSourceId: 'pitch', physicalPrefixReference: ref('ordinary-prefix') },
    prefix: { baseField: { response: { touch: { worldContact: { flight: { physicalPitch: pitch } } } } } } };
  vi.spyOn(roles, 'actualRoleWorkloadEvidenceFromSqlite').mockReturnValue({ readWithClosure: (_id: string, gate: (v: unknown) => boolean) => {
    gate(ordinary); return { closure: ordinary, settlement: { kind: 'complete', participants: participants.map(p => ({
      playerId: p.binding.playerId, personId: p.person.personId, applied: true, ...workload(p.binding.playerId) })) } };
  } } as never);
  vi.spyOn(closures, 'assertActualLiveClosureStage').mockReturnValue(true);
  vi.spyOn(adjudications, 'actualLiveAdjudicationEvidenceFromSqlite').mockReturnValue({ readWithClosureInputs: () => ordinaryPair } as never);
  vi.spyOn(prefixes, 'battedWorldFieldPhysicalPrefix').mockReturnValue(physical as never);
  const complete = (exercise: NonPitchRepetitionExercise, playerId: string) => {
    const original = frame(exercise, playerId);
    return read(() => readNonPitchRepetitionCompletion(db, original, exercise, reserved ? 'terminal' : 'ordinary'));
  };
  return { db, actor, physical, endpoint, release, settlement, pair, resolution, commitment, ordinary, ordinaryPair,
    pitch, complete, frame, source, read, releaseSpy, physicalSpy, workload };
};

it('keeps ordinary physical evidence bytes exact', () => {
  const f = fixture(false), frame = f.frame('BATTING_CONTACT', 'batter');
  const expected = { exercise: 'BATTING_CONTACT', actorHash: hash(frame.actor), bindingHash: hash(frame.binding), personHash: hash(frame.person),
    physicalPitchReference: { sourceId: 'pitch', sourceHash: hash(f.pitch.source), snapshotHash: hash(f.pitch) },
    physicalEndReference: f.ordinary.proposal.physicalEndReference, physicalPrefixReference: f.ordinaryPair.end.physicalPrefixReference,
    wholeHistoryReference: f.ordinary.proposal.wholeHistoryReference, selected: { events: f.pitch.result.pitch.resolution.timeline.events } };
  const result = f.complete('BATTING_CONTACT', 'batter');
  expect(json(result.evidence)).toBe(json(expected)); expect(result.physicalProofHash).toBe(hash(expected));
  expect(result.closureProofHash).toBe(hash(f.ordinary)); expect(result.workload).toEqual(f.workload('batter'));
});
it('reads reserved batting, glove contact and executed batter motion from the sealed original owners', () => {
  const f = fixture();
  for (const [exercise, player] of [['BATTING_CONTACT', 'batter'], ['FIELDING_GLOVE_CONTACT', 'defender'], ['RUNNING_MOTION', 'batter']] as const) {
    const result = f.complete(exercise, player);
    expect(result.evidence).toMatchObject({ kind: 'reserved_same_pa_repetition_v1', exercise });
    expect(result.workload).toEqual(f.workload(player));
    expect(f.db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  }
});
it('requires complete released TOTAL effects before reserved learning evidence', () => {
  const f = fixture(); f.releaseSpy.mockReturnValue(null);
  expect(() => f.complete('BATTING_CONTACT', 'batter')).toThrow(/complete|release/);
  f.releaseSpy.mockReturnValue(f.release as never); f.settlement.participants[0].applied = false;
  expect(() => f.complete('BATTING_CONTACT', 'batter')).toThrow(/workload|TOTAL/);
});
it('rejects a terminal name aliased by an ordinary closure owner', () => {
  const f = fixture(); f.db.exec('CREATE TABLE actual_live_play_closures(source_id TEXT,source_json TEXT)');
  f.db.prepare('INSERT INTO actual_live_play_closures VALUES(?,?)').run('terminal', json({ sourceId: 'terminal' }));
  expect(() => f.complete('BATTING_CONTACT', 'batter')).toThrow(/ambiguous|alias/);
});
it.each(['proposal_json', 'result_json'] as const)('rejects a moved ordinary closure identity retained in %s', mirror => {
  const f = fixture();
  f.db.exec('CREATE TABLE actual_live_play_closures(source_id TEXT,source_json TEXT,proposal_json TEXT,result_json TEXT)');
  f.db.prepare('INSERT INTO actual_live_play_closures VALUES(?,?,?,?)').run('moved', json({ sourceId: 'moved' }),
    json({ source: { sourceId: mirror === 'proposal_json' ? 'terminal' : 'moved' } }),
    json({ sourceId: mirror === 'result_json' ? 'terminal' : 'moved' }));
  expect(() => f.complete('BATTING_CONTACT', 'batter')).toThrow('closure owner identity is ambiguous');
});
it('binds reserved contact to the exact endpoint field generation and actual swing', () => {
  const f = fixture(); f.commitment.commitment.action = 'TAKE';
  expect(() => f.complete('BATTING_CONTACT', 'batter')).toThrow(/contact|swing/);
  f.commitment.commitment.action = 'SWING'; f.pair.value.physicalOperationReference = ref('pa_physical_v1_field_steps', 'foreign');
  expect(() => f.complete('BATTING_CONTACT', 'batter')).toThrow(/differs/);
});
it('authenticates occupied originals but does not turn a stationary runner into motion', () => {
  const f = fixture(true, true);
  expect(f.frame('RUNNING_MOTION', 'runner')).toMatchObject({ playerId: 'runner', person: { personId: 'person-runner' } });
  expect(() => f.frame('BATTING_CONTACT', 'runner')).toThrow(/participant/);
  expect(() => f.complete('RUNNING_MOTION', 'runner')).toThrow(/positive-duration/);
  // This is an adapter input control, not a claim that the current occupied
  // fair-catch endpoint producer admits a moving occupied runner.
  f.physical.segments[0].actors.find(a => a.playerId === 'runner')!.primitive.startVelocity.x = 2;
  expect(f.complete('RUNNING_MOTION', 'runner').workload).toEqual(f.workload('runner'));
});
it('rejects zero-duration or non-finite running windows and foreign defender contacts', () => {
  const f = fixture(); f.physical.segments[0].endElapsedSeconds = 0;
  expect(() => f.complete('RUNNING_MOTION', 'batter')).toThrow(/positive-duration/);
  f.physical.segments[0].endElapsedSeconds = 1; f.physical.segments[0].actors[0].primitive.startVelocity.x = Infinity;
  expect(() => f.complete('RUNNING_MOTION', 'batter')).toThrow(/non-finite|inert|finite/);
  f.physical.field.evidence.contacts[0].contacts[0].playerId = 'batter';
  expect(() => f.complete('FIELDING_GLOVE_CONTACT', 'defender')).toThrow(/glove contact/);
});
it('authenticates episode-bound ordinary roots through their original binding owner', () => {
  const f = fixture(false), binding = { source: { sourceId: 'episode-binding', version: 'batted_episode_field_binding_v2', physicalActorSourceId: 'actor' },
    gameId: 'game', playId: 7, physicalPitchSourceId: 'pitch' };
  Object.assign(f.ordinaryPair.prefix.baseField, { rootKind: 'episode_field_binding_v2', episodeFieldBinding: binding });
  const owned = vi.spyOn(bindings, 'battedEpisodeFieldBindingEvidenceFromSqlite').mockReturnValue({ read: () => binding } as never);
  expect(f.complete('BATTING_CONTACT', 'batter').evidence).toHaveProperty('episodeFieldBindingReference');
  owned.mockReturnValue({ read: () => ({ ...binding, physicalPitchSourceId: 'foreign' }) } as never);
  expect(() => f.complete('BATTING_CONTACT', 'batter')).toThrow(/differs/);
});
