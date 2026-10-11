import { afterEach, expect, it, vi } from 'vitest';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';
import { enrollmentFixture, count } from './SamePlateAppearanceEnrollment.test-support';
import { openSqliteSamePlateAppearanceEnrollmentStore } from './SqliteSamePlateAppearanceEnrollmentStore';
import { openSqliteSamePlateAppearanceTerminalSettlementStore } from './SqliteSamePlateAppearanceTerminalSettlementStore';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import * as actorOwner from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { advancePlayerWorkloadRecovery } from '../../core/world/development/PlayerWorkloadRecovery';
import { samePaTerminalSettlementInput, type AcceptedSamePaTerminalSettlement } from './SamePlateAppearanceTerminalSettlement';
import type { SamePaTerminalEndpoint, SamePaTerminalTransitionRead } from './SamePlateAppearanceTerminalEndpoint';
import * as terminal from './SamePlateAppearanceTerminalEndpointFromSqlite';
import * as transitions from './SamePlateAppearanceTerminalTransitionFromSqlite';
import * as settlementEvidence from './SamePlateAppearanceTerminalSettlementFromSqlite';
import { samePaSettlementSchema } from './SamePlateAppearanceTerminalSettlementStorage';
import { assertNoSamePaWorkReservation } from './SamePlateAppearanceReservationGuard';
import * as reservations from './SamePlateAppearanceReservationGuard';
import { reservedPaSchema } from './SamePlateAppearanceExecutionStorage';
import { readReservedPaClaimRows } from './SamePlateAppearanceProvisionalClaimGuard';
import { boundaryFixture } from './ActualFoulTerminalBoundaryFixtures.test-support';
import * as startingGeometry from './SamePlateAppearanceLifecycleStartingGeometry';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import type { AcceptedPlayerIntakeSource } from './SqlitePlayerPersonLinkStore';
import type { DatabaseSync } from 'node:sqlite';
import { readSamePaTerminalReleaseArchive } from './SamePlateAppearanceTerminalReleaseArchive';
import { samePaPlayerClaimCanProceed, withSamePaSettlementActivityWrite, withSamePaSettlementClaimReadPhase } from './SamePlateAppearanceSettlementAdmission';
import { playerWorkloadRecoveryStoreFromSqlite } from './SqlitePlayerWorkloadRecoveryStore';
import { paDispatchSchema } from './SamePlateAppearanceDispatchStorage';
import { withSamePaContinuationReadPhase } from './SamePlateAppearanceContinuationFromSqlite';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';

// Isolated structural Native tests: original actor and physical/official
// terminal readers are mocked. All ten workload activities, CAS, transactions,
// reservation guards and release archives use their real Native owners.
const owners: { close(): void }[] = [], fixtures: ReturnType<typeof enrollmentFixture>[] = [];
afterEach(() => { owners.splice(0).reverse().forEach(owner => owner.close()); fixtures.splice(0).reverse().forEach(f => f.close()); vi.restoreAllMocks(); });
const reference = <T extends string>(owner: T, value: { source: { sourceId: string } }) => ({ owner, sourceId: value.source.sourceId, sourceHash: hash(value.source), snapshotHash: hash(value) });
const setup = (runnerCount = 0) => {
  const f = enrollmentFixture(); fixtures.push(f);
  const enrollmentSource = structuredClone(f.source);
  if (runnerCount) {
    // Original actor/geometry remain explicitly substituted for this isolated
    // transaction test. Runner Person rows, baselines, reservation, release SQL
    // and its total_changes guard use the real owners.
    const actor = f.actor as any, centers = { first: { x: 27, z: 0 }, second: { x: 27, z: 27 }, third: { x: 0, z: 27 } };
    actor.match.half = 'top'; actor.match.balls = 0; actor.match.strikes = 0; actor.world.tick = 100;
    f.db.exec('CREATE TABLE official_participant_bindings(game_id TEXT,player_id TEXT,binding_json TEXT)');
    const originalRead = f.personLinks.readLink, runnerPersons = new Map<string, AcceptedPlayerIntakeSource>();
    vi.spyOn(f.personLinks, 'readLink').mockImplementation(id => runnerPersons.get(id) ?? originalRead(id));
    vi.spyOn(startingGeometry, 'samePaStartingBaseCenters').mockReturnValue(centers);
    const runnerBaselines = Array.from({ length: runnerCount }, (_, i) => {
      const playerId = 'runner-' + (i + 1), base = (['first', 'second', 'third'] as const)[i];
      const person: AcceptedPlayerIntakeSource = { ...actor.person, sourceId: 'intake-' + playerId, playerId, personId: 'person-' + playerId, sourceRecordId: 'record-' + playerId };
      runnerPersons.set(person.sourceId, person);
      f.db.prepare('INSERT INTO world_player_person_links VALUES(?,?,?,?,?,?,?)').run(person.sourceId, person.careerId, playerId, person.personId, person.rosterRevision, person.acceptedAtDay, json(person));
      const binding = { ...actor.binding, playerId, personId: person.personId, personLinkSourceId: person.sourceId };
      f.db.prepare('INSERT INTO official_participant_bindings VALUES(?,?,?)').run(binding.gameId, playerId, json(binding));
      const baseline = { ...f.baselines.values().next().value!, sourceId: 'baseline-' + playerId, playerId, personLinkSourceId: person.sourceId };
      f.baselines.set(baseline.sourceId, baseline); f.workload.initialize(baseline.sourceId);
      actor.match.bases[base] = playerId; actor.world.runners.push({ playerId, position: centers[base], velocity: { x: 0, z: 0 } });
      return { playerId, baselineSourceId: baseline.sourceId, revision: 0, stateHash: hash(readActualRoleWorkloadState(f.db, binding.careerId, playerId)) };
    });
    f.persistActor();
    Object.assign(enrollmentSource, { capability: 'reserved_same_pa_enrollment_v2', actorReference: reference('physical_plate_appearance_actors', actor),
      participantBaselineReferences: [...enrollmentSource.participantBaselineReferences, ...runnerBaselines] });
  }
  const enroll = openSqliteSamePlateAppearanceEnrollmentStore(f.path, { readAcceptedEnrollment: () => enrollmentSource }); owners.push(enroll);
  const enrollment = enroll.accept(enrollmentSource.sourceId);
  if (enrollment.kind !== 'reserved') throw new Error('test reservation missing');
  const enrollmentReference = reference('same_pa_enrollments', enrollment);
  const lineage = { enrollmentReference, actorReference: enrollment.source.actorReference, careerId: enrollment.careerId,
    gameId: enrollment.gameId, playId: enrollment.playId, firstPhysicalPitchSourceId: enrollment.source.firstPhysicalPitchSourceId,
    participantReferences: enrollment.participants.map(p => ({ playerId: p.binding.playerId, bindingHash: hash(p.binding), personHash: p.personHash,
      baselineSourceId: p.baselineSourceId, revision: p.state.revision, stateHash: hash(p.state) })) };
  const structuralTerminal = boundaryFixture('half_change_continuing', { playId: enrollment.playId, outs: 1 });
  const endpoint: SamePaTerminalEndpoint = { kind: 'same_pa_terminal_endpoint_v1',
    source: { sourceId: 'terminal', sourceVersion: 'structural-v1', capability: 'same_pa_terminal_endpoint_v1', enrollmentReference,
      finalViewReference: { owner: 'pa_lifecycle_v1_execution_views', sourceId: 'final-view', sourceHash: hash('view-source'), snapshotHash: hash('view') },
      outcomeReference: { owner: 'pa_lifecycle_v1_outcomes', sourceId: 'outcome', sourceHash: hash('outcome-source'), snapshotHash: hash('outcome') } },
    lineage, enrollmentReference, finalViewReference: { owner: 'pa_lifecycle_v1_execution_views', sourceId: 'final-view', sourceHash: hash('view-source'), snapshotHash: hash('view') },
    outcomeReference: { owner: 'pa_lifecycle_v1_outcomes', sourceId: 'outcome', sourceHash: hash('outcome-source'), snapshotHash: hash('outcome') },
    gameDay: 2, coverageHash: hash('complete-final-coverage'), timeline: structuralTerminal.proposal.applicationBody.timeline,
    actor: f.actor, officialLedger: structuralTerminal.proposal.applicationBody.adjudication, context: structuralTerminal.proposal.applicationBody.context,
    physicalCompletedAtTick: structuralTerminal.proposal.clock.ruleTick,
    baseCenters: { first: { x: 27, z: 0 }, second: { x: 27, z: 27 }, third: { x: 0, z: 27 } },
    controllerRetirementBasis: { kind: 'same_pa_original_controller_retirement_basis_v1',
      physicalPitchReference: { owner: 'pa_take_successor_v1_pitch_actions', sourceId: 'structural-last-pitch', sourceHash: hash('last-pitch-source'), snapshotHash: hash('last-pitch') },
      physicalOperationReference: { owner: 'pa_take_successor_v1_pitch_actions', sourceId: 'structural-last-pitch', sourceHash: hash('last-pitch-source'), snapshotHash: hash('last-pitch') },
      completedAtTick: structuralTerminal.proposal.clock.ruleTick, completeCoverageHash: hash('structural-retirement'),
      participants: enrollment.participants.map(p => ({ playerId: p.binding.playerId, personId: p.binding.personId, ownedCommands: [] })) },
    participants: enrollment.participants.map((p, i) => {
      const activity = { sourceEventId: 'actual-total-play-workload:' + hash([enrollment.careerId, enrollment.gameId, enrollment.playId, p.binding.playerId]),
        sourceVersion: 'reserved-same-pa-total-workload-v1', evidenceId: 'final-prefix', careerId: enrollment.careerId, playerId: p.binding.playerId,
        atDay: 2, kind: 'MATCH' as const, effortUnits: i + 1 };
      const projectedState = advancePlayerWorkloadRecovery(p.state, p.state.revision, activity);
      return { playerId: p.binding.playerId, totalReference: { owner: 'pa_lifecycle_v1_total_assessments', sourceId: 'total-' + p.binding.playerId,
        sourceHash: hash('source-' + p.binding.playerId), snapshotHash: hash('total-' + p.binding.playerId) },
        reservedState: p.state, activity, projectedState, projectedStateHash: hash(projectedState) };
    }) };
  const source: AcceptedSamePaTerminalSettlement = { sourceId: 'settlement', sourceVersion: 'structural-v1', capability: 'same_pa_terminal_settlement_v1', terminalReference: reference('pa_terminal_v1_endpoints', endpoint) };
  vi.spyOn(terminal, 'readSamePaTerminalEndpointFromSqlite').mockImplementation((_db, ref) => {
    expect(ref).toEqual(source.terminalReference); return endpoint;
  });
  let transition: SamePaTerminalTransitionRead = { kind: 'pending', reason: 'terminal_transition_missing', terminalReference: source.terminalReference };
  vi.spyOn(transitions, 'readSamePaTerminalTransitionFromSqlite').mockImplementation(() => transition);
  const sources = new Map([[source.sourceId, source]]);
  const owner = openSqliteSamePlateAppearanceTerminalSettlementStore(f.path, f.personLinks, { readAcceptedSettlement: id => sources.get(id) ?? null }); owners.push(owner);
  const complete = () => {
    const settled = owner.read(source.sourceId)!;
    transition = { kind: 'completed', reference: { owner: 'pa_terminal_v1_transitions', sourceId: 'transition', sourceHash: hash('transition-source'), snapshotHash: hash('transition') },
      terminalReference: source.terminalReference, settlementReference: settled.reference, gameId: enrollment.gameId, playId: enrollment.playId,
      durableRevision: 1, resultingMatch: {} as any, officialReceipt: {} as any, completion: 'next_play' };
  };
  const fresh = () => {
    f.activities.set('later', { sourceEventId: 'later', sourceVersion: 'structural-v1', evidenceId: 'next-day-recovery', careerId: 'career-a', playerId: f.players[0],
      atDay: 3, kind: 'RECOVERY', durationHours: 1, quality: 1, medicalAvailability: 1 });
    return f.workload.apply('later', 1);
  };
  return { f, enroll, enrollment, endpoint, source, sources, owner, complete, fresh };
};
// Metadata-only future dispatch claims. The existing endpoint/transition stubs
// remain explicit; these rows qualify neither physical work nor a real PA.
const releasedClaims = () => {
  const x = setup(), db = x.f.db;
  for (const sql of Object.values(paDispatchSchema)) db.exec(sql);
  for (let i = 0; i < 2; i++) {
    const source = { sourceId: 'historical-consumer-' + i, member: x.endpoint.lineage.participantReferences[0] };
    const snapshot = { source, lineage: x.endpoint.lineage };
    db.prepare('INSERT INTO pa_dispatch_v1_consumer_actions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
      source.sourceId, 'structural-v1', x.enrollment.careerId, x.enrollment.gameId, x.enrollment.playId,
      x.enrollment.source.sourceId, x.enrollment.source.firstPhysicalPitchSourceId, 'structural-view',
      'structural-right', x.enrollment.source.firstPhysicalPitchSourceId, x.f.players[0], 'structural-route', i,
      json(source), hash(source), json(snapshot), hash(snapshot));
  }
  x.owner.settle(x.source.sourceId); x.complete(); x.owner.release(x.source.sourceId);
  return x;
};
const newBaseline = (x: ReturnType<typeof setup>) => {
  const original = x.f.baselines.values().next().value!, playerId = 'ordinary-new-batter';
  const person = { ...x.f.personLinks.readLink(original.personLinkSourceId)!, sourceId: 'intake-' + playerId,
    playerId, personId: 'person-' + playerId, sourceRecordId: 'record-' + playerId };
  x.f.db.prepare('INSERT INTO world_player_person_links VALUES(?,?,?,?,?,?,?)').run(person.sourceId, person.careerId,
    playerId, person.personId, person.rosterRevision, person.acceptedAtDay, json(person));
  const readLink = x.f.personLinks.readLink;
  vi.spyOn(x.f.personLinks, 'readLink').mockImplementation(id => id === person.sourceId ? person : readLink(id));
  return { ...original, sourceId: 'baseline-' + playerId, playerId, personLinkSourceId: person.sourceId };
};
it('requires a reference-only terminal settlement Source without caller totals or release flags', () => {
  const source = { sourceId: 'settlement', sourceVersion: 'v1', capability: 'same_pa_terminal_settlement_v1',
    terminalReference: { owner: 'pa_terminal_v1_endpoints', sourceId: 'end', sourceHash: hash('source'), snapshotHash: hash('end') } };
  expect(samePaTerminalSettlementInput(source)).toEqual(source);
  for (const change of [{ participants: [] }, { released: true }, { capability: 'same_pa_terminal_settlement_v2' }, { terminalReference: { ...source.terminalReference, owner: 'pa_continuation_v1_execution_views' } }])
    expect(() => samePaTerminalSettlementInput({ ...source, ...change })).toThrow();
});
it('freezes final coverage without charging and keeps all participant leases active', () => {
  const x = setup(); const plan = x.owner.freeze(x.source.sourceId);
  expect(plan.kind).toBe('applying'); expect(plan.participants.every(p => !p.applied)).toBe(true);
  expect(count(x.f.db, 'world_player_workload_activities')).toBe(0); expect(count(x.f.db, 'same_pa_participant_reservations')).toBe(10);
  expect(() => x.owner.release(x.source.sourceId)).toThrow('ten durable effects');
});
it('applies exactly ten normal effects once and retains the fence until transition and release', () => {
  const x = setup(), settled = x.owner.settle(x.source.sourceId);
  expect(settled.kind).toBe('settled'); expect(count(x.f.db, 'world_player_workload_activities')).toBe(10);
  for (const p of settled.participants) expect(x.f.workload.readHead('career-a', p.playerId)).toEqual(p.projectedState);
  expect(x.owner.settle(x.source.sourceId)).toEqual(settled); expect(count(x.f.db, 'world_player_workload_activities')).toBe(10);
  expect(() => x.fresh()).toThrow(/same-PA/); expect(() => x.owner.release(x.source.sourceId)).toThrow('completed PA transition');
  x.complete(); const released = x.owner.release(x.source.sourceId);
  expect(released.memberRows).toHaveLength(10); expect(count(x.f.db, 'same_pa_participant_reservations')).toBe(0);
  expect(x.owner.release(x.source.sourceId)).toEqual(released); expect(x.enroll.readHistorical(x.f.source.sourceId)).toEqual(x.enrollment);
  expect(x.fresh().revision).toBe(2); expect(x.owner.readRelease(x.source.sourceId)).toEqual(released);
  const reopened = openSqliteSamePlateAppearanceTerminalSettlementStore(x.f.path, x.f.personLinks); owners.push(reopened);
  expect(reopened.readRelease(x.source.sourceId)).toEqual(released);
  expect(() => assertNoSamePaWorkReservation(x.f.db, { gameId: x.enrollment.gameId, playId: x.enrollment.playId,
    physicalPitchSourceId: x.enrollment.source.firstPhysicalPitchSourceId })).toThrow(/same-PA/);
});
it('resumes a partially committed ten-player settlement without repeating earlier activities', () => {
  const x = setup(), target = x.endpoint.participants[4].playerId;
  x.f.db.exec(`CREATE TRIGGER stop_fifth BEFORE INSERT ON world_player_workload_activities WHEN NEW.player_id='${target}' BEGIN SELECT RAISE(ABORT,'structural fifth write'); END`);
  expect(() => x.owner.settle(x.source.sourceId)).toThrow('structural fifth write');
  expect(count(x.f.db, 'world_player_workload_activities')).toBe(4); expect(count(x.f.db, 'same_pa_participant_reservations')).toBe(10);
  expect(() => x.fresh()).toThrow(/same-PA/); x.f.db.exec('DROP TRIGGER stop_fifth');
  expect(x.owner.settle(x.source.sourceId).kind).toBe('settled'); expect(count(x.f.db, 'world_player_workload_activities')).toBe(10);
});
it('reconstructs one terminal per reservation assertion and starts fresh after every workload boundary', () => {
  const x = setup(); x.owner.freeze(x.source.sourceId);
  for (const ddl of Object.values(reservedPaSchema)) x.f.db.exec(ddl);
  const source = { sourceId: 'claim-prefix', sourceVersion: 'structural-v1', capability: 'reserved_same_pa_empty_prefix_v1', enrollmentReference: x.endpoint.enrollmentReference };
  const value = { kind: 'empty_prefix', source, lineage: x.endpoint.lineage, physicalRevision: 0 };
  x.f.db.prepare('INSERT INTO reserved_pa_work_prefixes VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(source.sourceId, x.enrollment.source.sourceId,
    x.enrollment.careerId, x.enrollment.gameId, x.enrollment.playId, x.enrollment.source.actorReference.sourceId, x.enrollment.source.firstPhysicalPitchSourceId,
    0, json(source), hash(source), json(value), hash(value));
  const assertReservation = reservations.assertNoSamePaPlayerReservation;
  const endpoint = vi.mocked(terminal.readSamePaTerminalEndpointFromSqlite);
  const phases: { reads: number; activities: number }[] = [];
  vi.spyOn(reservations, 'assertNoSamePaPlayerReservation').mockImplementation((db, scope, own) => {
    const before = endpoint.mock.calls.length, activities = Number(count(db, 'world_player_workload_activities'));
    assertReservation(db, scope, own);
    phases.push({ reads: endpoint.mock.calls.length - before, activities });
  });
  expect(x.owner.settle(x.source.sourceId).kind).toBe('settled');
  // Preparation, enrollment-root and member-lease claims authenticate the same
  // real settlement. Each of the four callback/write-separated assertions owns a
  // fresh proof, including when neither row counters nor query_only changed.
  expect(phases).toEqual(Array.from({ length: 10 }, (_, i) => [i, i, i + 1, i + 1]
    .map(activities => ({ reads: 1, activities }))).flat());
  const completed = endpoint.mock.calls.length;
  expect(x.owner.settle(x.source.sourceId).kind).toBe('settled');
  expect(endpoint.mock.calls.length).toBeGreaterThan(completed);
  expect(phases).toHaveLength(40);
  const reopened = openSqliteSamePlateAppearanceTerminalSettlementStore(x.f.path, x.f.personLinks); owners.push(reopened);
  const retried = endpoint.mock.calls.length;
  expect(reopened.read(x.source.sourceId)!.kind).toBe('settled');
  expect(endpoint.mock.calls.length).toBeGreaterThan(retried);
});
it.each(['accepted', 'write', 'written'] as const)('rechecks reservation evidence after the %s callback', boundary => {
  const x = setup(), frozen = x.owner.freeze(x.source.sourceId), participant = frozen.participants[0], db = x.f.db;
  const corrupt = () => db.prepare('UPDATE same_pa_participant_reservations SET member_json=? WHERE player_id=?').run('{}', participant.playerId);
  const workload = playerWorkloadRecoveryStoreFromSqlite(db, x.f.personLinks, {
    readAcceptedBaseline: () => null,
    readAcceptedActivity: () => { if (boundary === 'accepted') corrupt(); return participant.activity; },
  }, {
    transaction: body => body(),
    activity: (_db, _activity, phase) => { if (boundary === phase) corrupt(); },
  });
  db.exec('BEGIN');
  try {
    expect(() => withSamePaSettlementActivityWrite(db, frozen.reference, participant.playerId,
      () => workload.apply(participant.activity.sourceEventId, participant.reservedState.revision))).toThrow(/member ownership/);
  } finally { db.exec('ROLLBACK'); }
  expect(count(db, 'world_player_workload_activities')).toBe(0);
  expect(x.owner.read(x.source.sourceId)!.participants.every(p => !p.applied)).toBe(true);
});
it.each(['reservation', 'standalone'] as const)('rejects replaced admission transactions on the %s path', path => {
  const x = setup(), frozen = x.owner.freeze(x.source.sourceId), participant = frozen.participants[0], db = x.f.db;
  const claim = () => path === 'reservation'
    ? reservations.assertNoSamePaPlayerReservation(db, participant.activity)
    : expect(samePaPlayerClaimCanProceed(db, x.enrollment.source.sourceId, participant.activity)).toBe(true);
  db.exec('BEGIN');
  try {
    expect(() => withSamePaSettlementActivityWrite(db, frozen.reference, participant.playerId, () => {
      claim(); db.exec('ROLLBACK; BEGIN'); claim();
    })).toThrow(/savepoint/);
  } finally { if (db.isTransaction) db.exec('ROLLBACK'); }
  // The rejected scope leaves no reusable admission or completed claim proof.
  db.exec('BEGIN');
  try { withSamePaSettlementActivityWrite(db, frozen.reference, participant.playerId, claim); }
  finally { db.exec('ROLLBACK'); }
});
it('rejects admission-marker replacement inside an immutable reservation assertion', () => {
  const x = setup(), frozen = x.owner.freeze(x.source.sourceId), participant = frozen.participants[0], db = x.f.db;
  let marker = '';
  const exec = db.exec;
  vi.spyOn(db, 'exec').mockImplementation(function(sql) {
    if (sql.startsWith('SAVEPOINT pa_settlement_activity_')) marker = sql.slice('SAVEPOINT '.length);
    return exec.call(db, sql);
  });
  db.exec('BEGIN');
  try {
    expect(() => withSamePaSettlementActivityWrite(db, frozen.reference, participant.playerId, () => {
      vi.mocked(terminal.readSamePaTerminalEndpointFromSqlite).mockImplementation(() => {
        expect(marker).not.toBe('');
        // Preserve transaction and counters while removing the child proof
        // savepoints. Their final validation must reject even a completed memo.
        db.exec('RELEASE ' + marker); db.exec('SAVEPOINT ' + marker);
        return x.endpoint;
      });
      reservations.assertNoSamePaPlayerReservation(db, participant.activity);
    })).toThrow();
  } finally { if (db.isTransaction) db.exec('ROLLBACK'); }
  expect(count(db, 'world_player_workload_activities')).toBe(0);
});
it('shares only the settlement proof while checking each enrollment, Player and exact activity', () => {
  const x = setup(), frozen = x.owner.freeze(x.source.sourceId), participant = frozen.participants[0], db = x.f.db;
  db.exec('BEGIN');
  try {
    withSamePaSettlementActivityWrite(db, frozen.reference, participant.playerId, () =>
      withSamePaSettlementClaimReadPhase(db, participant.activity, () => {
        const before = vi.mocked(terminal.readSamePaTerminalEndpointFromSqlite).mock.calls.length;
        const claim = (enrollment: string, activity: typeof participant.activity) => samePaPlayerClaimCanProceed(db, enrollment, activity);
        expect(claim(x.enrollment.source.sourceId, participant.activity)).toBe(true);
        expect(claim('other-enrollment', participant.activity)).toBe(false);
        expect(claim(x.enrollment.source.sourceId, { ...participant.activity, careerId: 'other-career' })).toBe(false);
        expect(claim(x.enrollment.source.sourceId, { ...participant.activity, playerId: 'other-player' })).toBe(false);
        expect(claim(x.enrollment.source.sourceId, { ...participant.activity, evidenceId: 'other-evidence' })).toBe(false);
        expect(vi.mocked(terminal.readSamePaTerminalEndpointFromSqlite).mock.calls.length - before).toBe(1);
      }));
  } finally { db.exec('ROLLBACK'); }
});
it('reuses the complete released proof only within one ordinary reservation assertion', () => {
  const x = releasedClaims(), db = x.f.db, scope = { careerId: x.enrollment.careerId, playerId: x.f.players[0] };
  const release = vi.spyOn(settlementEvidence, 'readSamePaTerminalReleaseFromSqlite');
  const claim = (enrollment = x.enrollment.source.sourceId, member = scope) => samePaPlayerClaimCanProceed(db, enrollment, member);
  db.exec('BEGIN');
  try {
    // Even an enclosing owner read must not extend one assertion's memo into
    // another assertion after its own wrapper returns.
    withBattedWorldPhysicalReadTraversal(db, () => withSamePaContinuationReadPhase(db, () => {
      withSamePaSettlementClaimReadPhase(db, scope, () => {
        expect(claim()).toBe(true); expect(claim()).toBe(true);
        expect(claim('other-enrollment')).toBe(false);
        expect(claim(undefined, { ...scope, careerId: 'other-career' })).toBe(false);
        expect(claim(undefined, { ...scope, playerId: 'other-player' })).toBe(false);
        expect(release).toHaveBeenCalledTimes(1);
      });
      withSamePaSettlementClaimReadPhase(db, scope, () => expect(claim()).toBe(true));
      expect(release).toHaveBeenCalledTimes(2);
    }));
    expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    expect(() => withSamePaSettlementClaimReadPhase(db, scope, () => {
      expect(claim()).toBe(true);
      db.exec('PRAGMA query_only=0; UPDATE pa_dispatch_v1_consumer_actions SET source_version=\'changed\'; PRAGMA query_only=1');
      expect(claim).toThrow(); expect(claim).toThrow(/expired/);
    })).toThrow();
  } finally { if (db.isTransaction) db.exec('ROLLBACK'); }
  expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
  db.exec('BEGIN');
  try { withSamePaSettlementClaimReadPhase(db, scope, () => expect(claim()).toBe(true)); }
  finally { db.exec('ROLLBACK'); }
});
it('keeps unrelated retained baselines separate across all four initialize claims and an exact retry', () => {
  const x = releasedClaims(), db = x.f.db, baseline = newBaseline(x);
  const release = vi.spyOn(settlementEvidence, 'readSamePaTerminalReleaseFromSqlite');
  const assertReservation = reservations.assertNoSamePaPlayerReservation;
  const phases: { reads: number; baselines: number }[] = [], callbacks: string[] = [];
  vi.spyOn(reservations, 'assertNoSamePaPlayerReservation').mockImplementation((connection, scope, own) => {
    const before = release.mock.calls.length;
    assertReservation(connection, scope, own);
    expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    phases.push({ reads: release.mock.calls.length - before, baselines: Number(count(db, 'world_player_workload_baselines')) });
  });
  const workload = playerWorkloadRecoveryStoreFromSqlite(db, x.f.personLinks, {
    readAcceptedBaseline: () => { expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0); return baseline; },
    readAcceptedActivity: () => null,
  }, { baseline: (_db, _input, phase) => { callbacks.push(phase); expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0); } });
  const initial = workload.initialize(baseline.sourceId);
  expect(phases).toEqual([10, 10, 11, 11].map(baselines => ({ reads: 1, baselines })));
  expect(callbacks).toEqual(['write', 'written']);
  expect(workload.initialize(baseline.sourceId)).toEqual(initial);
  expect(callbacks).toEqual(['write', 'written', 'retry']); expect(phases).toHaveLength(4);
  // A later assertion must authenticate new raw census contents even if it
  // follows an exact initialization retry.
  db.prepare('UPDATE pa_dispatch_v1_consumer_actions SET source_version=?').run('changed');
  db.exec('BEGIN');
  try { expect(() => reservations.assertNoSamePaPlayerReservation(db, baseline)).toThrow(/claim census changed/); }
  finally { db.exec('ROLLBACK'); }
});
it.each(['accepted', 'write', 'written'] as const)('ordinary initialize rechecks release census after the %s callback', boundary => {
  const x = releasedClaims(), db = x.f.db, baseline = newBaseline(x);
  const corrupt = () => {
    expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
    db.prepare('UPDATE pa_dispatch_v1_consumer_actions SET source_version=?').run('changed');
  };
  const workload = playerWorkloadRecoveryStoreFromSqlite(db, x.f.personLinks, {
    readAcceptedBaseline: () => { if (boundary === 'accepted') corrupt(); return baseline; }, readAcceptedActivity: () => null,
  }, { baseline: (_db, _input, phase) => { if (boundary === phase) corrupt(); } });
  expect(() => workload.initialize(baseline.sourceId)).toThrow(/claim census changed/);
  expect(count(db, 'world_player_workload_baselines')).toBe(10);
  expect(workload.readHead(baseline.careerId, baseline.playerId)).toBeNull();
  expect(db.isTransaction).toBe(false); expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
});
it('keeps mismatched settlement admission fenced and minimal non-Native claim callers compatible', () => {
  const x = setup(), frozen = x.owner.freeze(x.source.sourceId), db = x.f.db;
  const [admitted, other] = frozen.participants;
  db.exec('BEGIN');
  try {
    withSamePaSettlementActivityWrite(db, frozen.reference, admitted.playerId, () => {
      expect(() => reservations.assertNoSamePaPlayerReservation(db, other.activity)).toThrow(/blocks new global Player workload/);
      expect(db.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
      expect(() => reservations.assertNoSamePaPlayerReservation(db, admitted.activity)).not.toThrow();
    });
  } finally { db.exec('ROLLBACK'); }
  const fake = { prepare: () => { throw new Error('unused fake prepare'); } };
  expect(withSamePaSettlementClaimReadPhase(fake, admitted.activity, () => 'unscoped')).toBe('unscoped');
});
it('keeps the admitted reference immutable and invalidates cached proofs after a mutation', () => {
  const x = setup(), frozen = x.owner.freeze(x.source.sourceId), participant = frozen.participants[0], db = x.f.db;
  const ref = { ...frozen.reference };
  const claim = () => samePaPlayerClaimCanProceed(db, x.enrollment.source.sourceId, participant.activity);
  db.exec('BEGIN');
  try {
    expect(() => withSamePaSettlementActivityWrite(db, ref, participant.playerId, () =>
      withSamePaSettlementClaimReadPhase(db, participant.activity, () => {
        expect(claim()).toBe(true);
        expect(Object.isFrozen(ref)).toBe(true);
        db.exec('PRAGMA query_only=0');
        db.prepare('UPDATE same_pa_participant_reservations SET member_json=? WHERE player_id=?').run('{}', participant.playerId);
        db.exec('PRAGMA query_only=1');
        expect(claim).toThrow(/ownership|coverage/);
        expect(claim).toThrow(/expired/);
      }))).toThrow();
  } finally { db.exec('ROLLBACK'); }
});
it('rejects changed final TOTAL projection or frozen Source before another activity', () => {
  const x = setup(); x.owner.freeze(x.source.sourceId);
  x.sources.set(x.source.sourceId, { ...x.source, sourceVersion: 'changed' });
  expect(() => x.owner.settle(x.source.sourceId)).toThrow('frozen differently');
  x.sources.set(x.source.sourceId, x.source);
  const changed=structuredClone(x.endpoint);(changed.participants[0].projectedState as any).revision=9;
  vi.mocked(terminal.readSamePaTerminalEndpointFromSqlite).mockReturnValue(changed);
  expect(() => x.owner.settle(x.source.sourceId)).toThrow(/terminal reference|projected AFTER|basis changed/);
  expect(count(x.f.db, 'world_player_workload_activities')).toBe(0);
});
it('rolls back release and all active lease retirements after reaching the fourth delete', () => {
  const x = setup(); x.owner.settle(x.source.sourceId); x.complete();
  let deletes=0;
  const witness=witnessSqliteWrite(/^DELETE FROM main\.same_pa_participant_reservations/,()=>{
    deletes++;if(deletes===4)throw new Error('structural fourth lease delete');return true;
  },'before');
  try{expect(() => x.owner.release(x.source.sourceId)).toThrow('structural fourth lease delete');expect(deletes).toBe(4);}finally{witness.close();}
  expect(count(x.f.db, 'same_pa_participant_reservations')).toBe(10); expect(count(x.f.db, 'pa_settlement_v1_releases')).toBe(0);
  expect(x.owner.release(x.source.sourceId).memberRows).toHaveLength(10);
});
it('occupied release with three runners accounts for every original lease and rolls back partial deletion', () => {
  const runnerCount = 3, x = setup(runnerCount), frozen = x.owner.freeze(x.source.sourceId);
  // Substitute already-settled lower evidence and its replay with the real
  // structural release archive reader. This qualifies the public transaction,
  // not a genuine physical/official/workload chain.
  const settled = { ...frozen, kind: 'settled' as const, participants: frozen.participants.map(p => ({ ...p, applied: true })) };
  vi.spyOn(settlementEvidence, 'readSamePaTerminalSettlementFromSqlite').mockImplementation((_db, ref) => {
    expect(ref).toEqual(settled.reference); return settled;
  });
  vi.spyOn(settlementEvidence, 'readSamePaTerminalReleaseFromSqlite').mockImplementation(readSamePaTerminalReleaseArchive);
  x.complete();
  const rows = () => ['pa_settlement_v1_releases', 'same_pa_participant_reservations'].map(table => x.f.db.prepare('SELECT rowid,* FROM main.' + table + ' ORDER BY rowid').all());
  const before = json(rows()); let deleted = 0;
  const fault = witnessSqliteWrite(/^DELETE FROM main\.same_pa_participant_reservations/, () => {
    if (++deleted === 4) throw new Error('occupied fourth lease effect'); return true;
  });
  try { expect(() => x.owner.release(x.source.sourceId)).toThrow('occupied fourth lease effect'); expect(deleted).toBe(4); }
  finally { fault.close(); }
  expect(json(rows())).toBe(before);
  let connection: DatabaseSync | undefined, beforeChanges: number | undefined, writes = 0;
  const witness = witnessSqliteWrite(/^(?:INSERT INTO main\.pa_settlement_v1_releases|DELETE FROM main\.same_pa_participant_reservations)/, db => {
    if (!connection) { connection = db; beforeChanges = Number(db.prepare('SELECT total_changes() n').get()!.n); }
    expect(db).toBe(connection); writes++; return true;
  }, 'before');
  try {
    // This invokes the real public writer and its unchanged transaction guard.
    // A constant11 accounting value fails here for every occupied membership.
    const released = x.owner.release(x.source.sourceId);
    expect(released.memberRows).toHaveLength(10 + runnerCount);
    expect(connection).toBeDefined();
    expect(Number(connection!.prepare('SELECT total_changes() n').get()!.n) - beforeChanges!).toBe(11 + runnerCount);
    expect(writes).toBe(11 + runnerCount); expect(connection!.isTransaction).toBe(false);
    expect(count(x.f.db, 'pa_settlement_v1_releases')).toBe(1); expect(count(x.f.db, 'same_pa_participant_reservations')).toBe(0);
    const saved = json(rows()); expect(x.owner.release(x.source.sourceId)).toEqual(released); expect(json(rows())).toBe(saved);
    expect(writes).toBe(11 + runnerCount);
    expect(Number(connection!.prepare('SELECT total_changes() n').get()!.n) - beforeChanges!).toBe(11 + runnerCount);
  } finally { witness.close(); }
});
it('rejects malformed partial settlement storage without upgrading it on open', () => {
  const f = enrollmentFixture(); fixtures.push(f); f.db.exec(samePaSettlementSchema.pa_settlement_v1_plans);
  expect(() => openSqliteSamePlateAppearanceTerminalSettlementStore(f.path, f.personLinks)).toThrow('partial');
  expect(f.db.prepare("SELECT 1 FROM sqlite_master WHERE name='pa_settlement_v1_releases'").get()).toBeUndefined();
});
it('rejects a changed historical baseline Source even when its workload values are identical', () => {
  const x=setup(),id=x.enrollment.participants[0].baselineSourceId;
  const row=x.f.db.prepare('SELECT source_json FROM world_player_workload_baselines WHERE source_id=?').get(id)!;
  const changed={...JSON.parse(String(row.source_json)),sourceVersion:'changed'};
  x.f.db.prepare('UPDATE world_player_workload_baselines SET source_json=? WHERE source_id=?').run(json(changed),id);
  expect(()=>x.enroll.readHistorical(x.f.source.sourceId)).toThrow('baseline Source differs');
});
it('rejects duplicate raw release identities before allowing later workload or historical member recovery', () => {
  const x = setup(); x.owner.settle(x.source.sourceId); x.complete(); x.owner.release(x.source.sourceId);
  const saved = x.f.db.prepare('SELECT snapshot_json FROM pa_settlement_v1_releases').get()!;
  const corrupt = '{"kind":"hidden-alias",' + String(saved.snapshot_json).slice(1);
  x.f.db.prepare('UPDATE pa_settlement_v1_releases SET snapshot_json=?').run(corrupt);
  expect(() => x.fresh()).toThrow(/same-PA release/);
  expect(() => x.enroll.readHistorical(x.f.source.sourceId)).toThrow(/same-PA release/);
  expect(count(x.f.db, 'world_player_workload_activities')).toBe(10);
});
it('keeps historical enrollment readable and allows a distinct next PA reservation after release', () => {
  const x = setup(); x.owner.settle(x.source.sourceId); x.complete(); x.owner.release(x.source.sourceId);
  const old = structuredClone(x.f.actor), next = { ...old,
    source: { ...old.source, sourceId: 'next-actor' }, match: { ...old.match, playId: 2 } };
  x.f.db.prepare('INSERT INTO physical_plate_appearance_actors VALUES(?,?,?,?,?,?,?,?,?)').run(next.source.sourceId, next.source.sourceVersion,
    next.source.gameId, next.match.playId, next.source.playerId, json(next.source), hash(next.source), json(next), hash(next));
  vi.mocked(actorOwner.readPhysicalPlateAppearanceActorFromSqlite).mockImplementation((_db, id) => id === old.source.sourceId ? old : id === next.source.sourceId ? next : null);
  const source = { ...x.f.source, sourceId: 'next-enrollment', actorReference: reference('physical_plate_appearance_actors', next), firstPhysicalPitchSourceId: 'next-pitch',
    participantBaselineReferences: x.f.source.participantBaselineReferences.map(p => {
      const state = x.f.workload.readHead('career-a', p.playerId)!; return { ...p, revision: state.revision, stateHash: hash(state) };
    }) };
  const owner = openSqliteSamePlateAppearanceEnrollmentStore(x.f.path, { readAcceptedEnrollment: () => source }); owners.push(owner);
  expect(owner.accept(source.sourceId).kind).toBe('reserved'); expect(count(x.f.db, 'same_pa_participant_reservations')).toBe(10);
  expect(x.enroll.readHistorical(x.f.source.sourceId)).toEqual(x.enrollment);
});
it('pins abandoned preparation bytes and rejects a changed valid claim after release', () => {
  const x = setup(); x.owner.settle(x.source.sourceId); x.complete();
  // Structural metadata fixture, not a physical owner qualification. It is a
  // valid scoped preparation claim for the existing metadata collector.
  for (const ddl of Object.values(reservedPaSchema)) x.f.db.exec(ddl);
  const source = { sourceId: 'abandoned-prefix', sourceVersion: 'structural-v1', capability: 'reserved_same_pa_empty_prefix_v1', enrollmentReference: x.endpoint.enrollmentReference };
  const value = { kind: 'empty_prefix', source, lineage: x.endpoint.lineage, physicalRevision: 0 };
  x.f.db.prepare('INSERT INTO reserved_pa_work_prefixes VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(source.sourceId, x.enrollment.source.sourceId,
    x.enrollment.careerId, x.enrollment.gameId, x.enrollment.playId, x.enrollment.source.actorReference.sourceId, x.enrollment.source.firstPhysicalPitchSourceId,
    0, json(source), hash(source), json(value), hash(value));
  expect(readReservedPaClaimRows(x.f.db, x.enrollment.source.sourceId)).toHaveLength(1);
  expect(x.owner.release(x.source.sourceId).claimCensus).toHaveLength(1);
  const changedSource = { ...source, sourceVersion: 'later-preparation' }, changedValue = { ...value, source: changedSource };
  x.f.db.prepare('UPDATE reserved_pa_work_prefixes SET source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?')
    .run(json(changedSource), hash(changedSource), json(changedValue), hash(changedValue));
  expect(readReservedPaClaimRows(x.f.db, x.enrollment.source.sourceId)).toHaveLength(1);
  expect(() => x.fresh()).toThrow('released preparation/work claim census changed');
  expect(count(x.f.db, 'world_player_workload_activities')).toBe(10);
});
it('rechecks current terminal coverage for each resumed normal settlement write', () => {
  const x = setup(); x.owner.freeze(x.source.sourceId);
  vi.mocked(terminal.readSamePaTerminalEndpointFromSqlite).mockImplementation((_db, _ref, mode) => {
    if (mode === 'current') throw new Error('structural later physical work');
    return x.endpoint;
  });
  expect(() => x.owner.settle(x.source.sourceId)).toThrow('structural later physical work');
  expect(count(x.f.db, 'world_player_workload_activities')).toBe(0);
  vi.mocked(terminal.readSamePaTerminalEndpointFromSqlite).mockReturnValue(x.endpoint);
  expect(x.owner.settle(x.source.sourceId).kind).toBe('settled');
  expect(count(x.f.db, 'world_player_workload_activities')).toBe(10);
});
