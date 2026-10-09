import { afterEach, expect, it, vi } from 'vitest';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { enrollmentFixture, count } from './SamePlateAppearanceEnrollment.test-support';
import { boundaryFixture } from './ActualFoulTerminalBoundaryFixtures.test-support';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { openSqliteOfficialScoringStore } from '../SqliteOfficialScoringStore';
import { openSqliteSamePlateAppearanceEnrollmentStore } from './SqliteSamePlateAppearanceEnrollmentStore';
import { openSqliteSamePlateAppearanceTerminalTransitionStore } from './SqliteSamePlateAppearanceTerminalTransitionStore';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaTerminalSchema } from './SamePlateAppearanceTerminalStorage';
import { samePaTerminalTransitionInput, type AcceptedSamePaTerminalTransition } from './SamePlateAppearanceTerminalTransition';
import { readSamePaTerminalTransitionFromSqlite } from './SamePlateAppearanceTerminalTransitionFromSqlite';
import { assertSamePaTerminalApplicationCompleted } from './SamePlateAppearanceTerminalActivation';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import type { SamePaTerminalEndpoint } from './SamePlateAppearanceTerminalEndpoint';
import type { SamePaTerminalSettlement } from './SamePlateAppearanceTerminalSettlement';
import * as endpointReader from './SamePlateAppearanceTerminalEndpointFromSqlite';
import { advancePlayerWorkloadRecovery } from '../../core/world/development/PlayerWorkloadRecovery';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import * as workloadReader from './ActualRoleWorkloadState';
import * as history from './PhysicalPlayClosureEvidenceFromSqlite';
import * as settlementReader from './SamePlateAppearanceTerminalSettlementFromSqlite';

// Structural Native author fixture. Physical endpoint/final TOTAL settlement
// are explicit mocks. Match, scoring, transaction, schema and retry are real.
const close: (() => void)[] = [];
afterEach(() => { close.splice(0).reverse().forEach(f => f()); vi.restoreAllMocks(); });
const reference = <T extends string>(owner: T, value: { source: { sourceId: string } }) => ({ owner, sourceId: value.source.sourceId, sourceHash: hash(value.source), snapshotHash: hash(value) });
const setup = (outs = 1, final = false) => {
  const f = enrollmentFixture(); close.push(f.close);
  const core = boundaryFixture('half_change_continuing', { playId: 1, outs, ...(final ? { inning: 9, half: 'bottom' as const } : {}) });
  const game = { seasonId: 'season', homeClubId: 'home', awayClubId: 'away', policy: { version: 'fixture-nine-innings', minimumInnings: 9, maximumInnings: 9, tiesAllowed: true } };
  const worldSetup = { baseCenters: { first: { x: 27, z: 0 }, second: { x: 27, z: 27 }, third: { x: 0, z: 27 } },
    defenders: (['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const).map((registeredPosition, i) => ({ playerId: f.players[i + 1], registeredPosition, position: { x: i, z: i } })),
    activePreviousPlayControllerIds: [] };
  const fixture = { gameId: 'game', venueId: 'venue', fixtureEventId: 'fixture', fixtureRevision: 0 };
  const official = new SqliteOfficialStateStore(f.path); official.registerOfficialFixture(fixture); official.initializeMatch('game', core.proposal.applicationBody.match); official.close();
  const scoring = openSqliteOfficialScoringStore(f.path); scoring.close();
  Object.assign(f.actor, { match: core.proposal.applicationBody.match, fixtureHash: hash({ game_id: 'game', venue_id: 'venue', fixture_event_id: 'fixture', fixture_revision: 0 }),
    world: { tick: 0, runners: [], ball: null, defenders: worldSetup.defenders.map(d => ({ ...d, velocity: { x: 0, z: 0 }, assignment: { kind: 'hold' } })) } });
  f.persistActor();
  const enrollmentSource = { ...f.source, actorReference: reference('physical_plate_appearance_actors', f.actor) };
  const enrollmentOwner = openSqliteSamePlateAppearanceEnrollmentStore(f.path, { readAcceptedEnrollment: () => enrollmentSource }); close.push(() => enrollmentOwner.close());
  const enrollment = enrollmentOwner.accept(enrollmentSource.sourceId);
  if (enrollment.kind !== 'reserved') throw new Error('structural enrollment missing');
  f.db.exec('CREATE TABLE official_participant_bindings(game_id TEXT,player_id TEXT,binding_json TEXT,PRIMARY KEY(game_id,player_id))');
  for (const binding of [f.actor.binding, ...f.actor.defenderBindings]) f.db.prepare('INSERT INTO official_participant_bindings VALUES(?,?,?)').run('game', binding.playerId, JSON.stringify(binding));
  for (const ddl of Object.values(samePaTerminalSchema)) f.db.exec(ddl);
  const enrollmentReference = reference('same_pa_enrollments', enrollment), lineage = { enrollmentReference,
    actorReference: enrollmentSource.actorReference, careerId: 'career-a', gameId: 'game', playId: 1, firstPhysicalPitchSourceId: enrollmentSource.firstPhysicalPitchSourceId,
    participantReferences: enrollment.participants.map(p => ({ playerId: p.binding.playerId, bindingHash: hash(p.binding), personHash: p.personHash,
      baselineSourceId: p.baselineSourceId, revision: p.state.revision, stateHash: hash(p.state) })) };
  const outcomeReference = { owner: 'pa_lifecycle_v1_outcomes' as const, sourceId: 'outcome', sourceHash: hash('outcome-source'), snapshotHash: hash('outcome') };
  const finalViewReference = { owner: 'pa_lifecycle_v1_execution_views' as const, sourceId: 'final-view', sourceHash: hash('final-view-source'), snapshotHash: hash('final-view') };
  const endpoint: SamePaTerminalEndpoint = { kind: 'same_pa_terminal_endpoint_v1', source: { sourceId: 'terminal', sourceVersion: 'structural-v1',
    capability: 'same_pa_terminal_endpoint_v1', enrollmentReference, outcomeReference, finalViewReference }, lineage, enrollmentReference, outcomeReference, finalViewReference,
    gameDay: 2, coverageHash: hash('complete-final-coverage'), timeline: core.proposal.applicationBody.timeline, actor: f.actor,
    officialLedger: core.proposal.applicationBody.adjudication, context: core.proposal.applicationBody.context,
    physicalCompletedAtTick: core.proposal.clock.ruleTick, baseCenters: worldSetup.baseCenters,
    participants: enrollment.participants.map((p, i) => {
      const activity = { sourceEventId: 'actual-total-play-workload:' + hash(['career-a', 'game', 1, p.binding.playerId]), sourceVersion: 'structural-v1', evidenceId: 'final-view', careerId: 'career-a', playerId: p.binding.playerId, atDay: 2, kind: 'MATCH' as const, effortUnits: i + 1 };
      const projectedState = advancePlayerWorkloadRecovery(p.state, p.state.revision, activity);
      return { playerId: p.binding.playerId, totalReference: { owner: 'pa_lifecycle_v1_total_assessments' as const, sourceId: 'total-' + p.binding.playerId, sourceHash: hash(['source', i]), snapshotHash: hash(['total', i]) }, reservedState: p.state, activity, projectedState, projectedStateHash: hash(projectedState) };
    }), controllerRetirementBasis: { kind: 'same_pa_original_controller_retirement_basis_v1',
      physicalPitchReference: { owner: 'pa_take_successor_v1_pitch_actions', sourceId: 'pitch-3', sourceHash: hash('p-source'), snapshotHash: hash('p') },
      physicalOperationReference: { owner: 'pa_take_successor_v1_pitch_actions', sourceId: 'pitch-3', sourceHash: hash('p-source'), snapshotHash: hash('p') },
      completedAtTick: core.proposal.clock.ruleTick, completeCoverageHash: hash('commands'),
      participants: enrollment.participants.map(p => ({ playerId: p.binding.playerId, personId: p.binding.personId, ownedCommands: [] })) } };
  // The settlement proof is a structural mock of the separately tested owner.
  const settlementSource = { sourceId: 'settlement', sourceVersion: 'structural-v1', capability: 'same_pa_terminal_settlement_v1' as const,
    terminalReference: reference('pa_terminal_v1_endpoints', endpoint) };
  const plan = { kind: 'terminal_settlement_plan' as const, source: settlementSource, lineage, enrollmentReference, finalViewReference, coverageHash: endpoint.coverageHash, participants: endpoint.participants };
  let settled: SamePaTerminalSettlement = { kind: 'settled', reference: reference('pa_settlement_v1_plans', plan), plan, participants: endpoint.participants.map(p => ({ ...p, applied: true })) };
  const originalWorkloadRead = readActualRoleWorkloadState;
  vi.spyOn(workloadReader, 'readActualRoleWorkloadState').mockImplementation((db, career, player, revision, person) => {
    const projected = endpoint.participants.find(p => p.playerId === player)?.projectedState;
    return projected && (revision === undefined || revision === projected.revision) ? projected : originalWorkloadRead(db, career, player, revision, person);
  });
  vi.spyOn(endpointReader, 'readSamePaTerminalEndpointFromSqlite').mockReturnValue(endpoint);
  vi.spyOn(settlementReader, 'readSamePaTerminalSettlementFromSqlite').mockImplementation(() => settled);
  const source = { sourceId: 'transition', sourceVersion: 'structural-v1', capability: 'same_pa_terminal_transition_v1' as const,
    terminalReference: settlementSource.terminalReference, settlementReference: settled.reference, applicationId: 'same-pa-apply', scoringApplicationId: 'same-pa-score',
    controllerReset: 'rule_system_retire_original_play' as const, game, kind: 'continuing' as const, nextStartedAtTick: core.proposal.clock.closureTick + 1, worldSetup };
  const sources = new Map<string, AcceptedSamePaTerminalTransition>([[source.sourceId, source]]);
  const owner = openSqliteSamePlateAppearanceTerminalTransitionStore(f.path, { readAcceptedTransition: id => sources.get(id) ?? null }); close.push(() => owner.close());
  return { f, endpoint, source, sources, owner, incomplete: () => { settled = { ...settled, kind: 'applying' }; } };
};
it('rejects caller-supplied terminal snapshots or ambiguous continuation/final fields', () => {
  const x = setup(); expect(samePaTerminalTransitionInput(x.source)).toEqual(x.source);
  for (const change of [{ result: {} }, { kind: 'game_final' }, { worldSetup: { ...x.source.worldSetup, activePreviousPlayControllerIds: ['old'] } }])
    expect(() => samePaTerminalTransitionInput({ ...x.source, ...change })).toThrow();
});
it('uses normal Match and scoring writers once and archives exact retirement before release', () => {
  const x = setup(), before = Number(x.f.db.prepare('SELECT total_changes() n').get()!.n), saved = x.owner.complete(x.source.sourceId);
  expect(saved.completion).toBe('next_play'); expect(saved.official.receipt.appliedMatchState.outs).toBe(2);
  expect(saved.controllerRetirement.basis).toEqual(x.endpoint.controllerRetirementBasis);
  expect(count(x.f.db, 'applications')).toBe(1); expect(count(x.f.db, 'official_scoring_applications')).toBe(1);
  expect(count(x.f.db, 'same_pa_participant_reservations')).toBe(10); expect(x.owner.complete(x.source.sourceId)).toEqual(saved);
  expect(Number(x.f.db.prepare('SELECT total_changes() n').get()!.n)).toBe(before);
  expect(() => assertSamePaTerminalApplicationCompleted(x.f.db, x.source.applicationId)).toThrow(/release|settlement/);
  const reopened = openSqliteSamePlateAppearanceTerminalTransitionStore(x.f.path); close.push(() => reopened.close()); expect(reopened.read(x.source.sourceId)).toEqual(saved);
});
it('rejects incomplete ten-player settlement before any official mutation', () => {
  const x = setup(); x.incomplete(); expect(() => x.owner.complete(x.source.sourceId)).toThrow('ten settled');
  expect(count(x.f.db, 'applications')).toBe(0); expect(count(x.f.db, 'pa_terminal_v1_transitions')).toBe(0);
});
it('keeps historical completion readable after the current Match advances', () => {
  const x = setup(), saved = x.owner.complete(x.source.sourceId);
  x.f.db.prepare('UPDATE matches SET durable_revision=2,state_json=?,activation_json=NULL').run(json({ ...saved.official.receipt.appliedMatchState, playId: 3 }));
  expect(x.owner.read(x.source.sourceId)).toEqual(saved);
  expect(() => withBattedVenueLegalReadSnapshot(x.f.db, () => readSamePaTerminalTransitionFromSqlite(x.f.db, x.source.terminalReference, 'current'))).toThrow('current Match');
});
it('rolls back normal official and scoring effects when final archive insertion fails', () => {
  const x = setup(); let reached = false;
  const witness = witnessSqliteWrite(/^INSERT INTO main\.pa_terminal_v1_transitions/, () => {
    reached = true; throw new Error('structural final archive write');
  }, 'before');
  try { expect(() => x.owner.complete(x.source.sourceId)).toThrow('structural final archive write'); expect(reached).toBe(true); } finally { witness.close(); }
  expect(count(x.f.db, 'applications')).toBe(0); expect(count(x.f.db, 'official_scoring_applications')).toBe(0);
  expect(x.f.db.prepare('SELECT durable_revision FROM matches').get()!.durable_revision).toBe(0);
  expect(x.owner.complete(x.source.sourceId).completion).toBe('next_play');
});
it('requires accepted opposite-side defender bindings at a structural Core third-out boundary', () => {
  const x = setup(2); expect(() => x.owner.complete(x.source.sourceId)).toThrow('incoming defender binding');
  expect(count(x.f.db, 'applications')).toBe(0);
});
it('activates the opposite defensive side only with explicit accepted Person and workload baselines', () => {
  const x = setup(2), existingRead = x.f.personLinks.readLink, extraLinks = new Map();
  x.f.personLinks.readLink = id => extraLinks.get(id) ?? existingRead(id);
  const original = x.f.actor.binding, template = x.f.baselines.get('baseline-' + original.playerId)!;
  const incoming = [original.playerId, ...Array.from({ length: 8 }, (_, i) => 'away-' + (i + 3))];
  for (const playerId of incoming.slice(1)) {
    const personLinkSourceId = 'intake-' + playerId, person = { ...existingRead(original.personLinkSourceId)!, sourceId: personLinkSourceId, playerId,
      personId: 'person-' + playerId, sourceRecordId: 'record-' + playerId };
    extraLinks.set(personLinkSourceId, person);
    x.f.db.prepare('INSERT INTO world_player_person_links VALUES(?,?,?,?,?,?,?)').run(personLinkSourceId, 'career-a', playerId, person.personId, 0, 1, json(person));
    const baseline = { ...template, sourceId: 'baseline-' + playerId, playerId, personLinkSourceId };
    x.f.baselines.set(baseline.sourceId, baseline); x.f.workload.initialize(baseline.sourceId);
    const binding = { ...original, playerId, personId: person.personId, personLinkSourceId };
    x.f.db.prepare('INSERT INTO official_participant_bindings VALUES(?,?,?)').run('game', playerId, JSON.stringify(binding));
  }
  x.sources.set(x.source.sourceId, { ...x.source, worldSetup: { ...x.source.worldSetup,
    defenders: x.source.worldSetup.defenders.map((d, i) => ({ ...d, playerId: incoming[i] })) } });
  const saved = x.owner.complete(x.source.sourceId);
  expect(saved.completion).toBe('half_inning'); expect(saved.official.receipt.appliedMatchState).toMatchObject({ inning: 1, half: 'bottom', outs: 0 });
  expect(saved.incomingDefenders.map(p => p.playerId)).toEqual([...incoming].sort());
  expect('activation' in saved.official && saved.official.activation.nextMatchState.playId).toBe(2);
});
it('finalizes at the nine-inning boundary without activation using a labeled mocked complete line score', () => {
  const x = setup(2, true), { nextStartedAtTick, worldSetup: _world, ...common } = x.source;
  x.sources.set(x.source.sourceId, { ...common, kind: 'game_final', completedAtTick: nextStartedAtTick });
  // This tests final writer dispatch only. The immutable earlier-history owner
  // is substituted, and no nine-inning physical game or lineage is claimed.
  const prior = vi.spyOn(history, 'readPhysicalClosureScoringHistory').mockReturnValue([]);
  const fold = vi.spyOn(history, 'derivePhysicalClosureLineScore').mockReturnValue({
    innings: Array.from({ length: 9 }, (_, i) => ({ inning: i + 1, awayRuns: 0, homeRuns: 0 })),
    totals: { away: { runs: 0, hits: 0, errors: 0 }, home: { runs: 0, hits: 0, errors: 0 } },
  });
  const saved = x.owner.complete(x.source.sourceId);
  expect(saved.completion).toBe('game_final'); expect('activation' in saved.official).toBe(false);
  expect('result' in saved.official && saved.official.result.completionReason).toBe('TIE_LIMIT');
  expect(saved.incomingDefenders).toEqual([]); expect(saved.earlierHistory).toEqual([]);
  expect(prior.mock.calls.every(([, scope]) => scope.officialRevision === x.endpoint.actor.officialRevision)).toBe(true);
  expect(fold.mock.calls.every(([rows]) => rows.length === 1 && rows[0].scoring.record.classification === saved.scoring.record.classification)).toBe(true);
});
it('rejects a final Source when the unchanged nine-inning policy says continue', () => {
  const x = setup(), { nextStartedAtTick, worldSetup: _world, ...common } = x.source;
  x.sources.set(x.source.sourceId, { ...common, kind: 'game_final', completedAtTick: nextStartedAtTick });
  expect(() => x.owner.complete(x.source.sourceId)).toThrow('official game boundary'); expect(count(x.f.db, 'applications')).toBe(0);
});
it('rejects changed accepted Source and duplicate raw transition identity on retry', () => {
  const x = setup(); x.owner.complete(x.source.sourceId); x.sources.set(x.source.sourceId, { ...x.source, sourceVersion: 'changed' });
  expect(() => x.owner.complete(x.source.sourceId)).toThrow('frozen differently');
  const row = x.f.db.prepare('SELECT snapshot_json FROM pa_terminal_v1_transitions').get()!;
  x.f.db.prepare('UPDATE pa_terminal_v1_transitions SET snapshot_json=?').run('{"kind":"hidden",' + String(row.snapshot_json).slice(1));
  expect(() => x.owner.read(x.source.sourceId)).toThrow('canonical archive');
});
