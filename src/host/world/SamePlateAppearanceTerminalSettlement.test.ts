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
import { samePaSettlementSchema } from './SamePlateAppearanceTerminalSettlementStorage';
import { assertNoSamePaWorkReservation } from './SamePlateAppearanceReservationGuard';
import { reservedPaSchema } from './SamePlateAppearanceExecutionStorage';
import { readReservedPaClaimRows } from './SamePlateAppearanceProvisionalClaimGuard';
import { boundaryFixture } from './ActualFoulTerminalBoundaryFixtures.test-support';

// Isolated structural Native tests: original actor and physical/official
// terminal readers are mocked. All ten workload activities, CAS, transactions,
// reservation guards and release archives use their real Native owners.
const owners: { close(): void }[] = [], fixtures: ReturnType<typeof enrollmentFixture>[] = [];
afterEach(() => { owners.splice(0).reverse().forEach(owner => owner.close()); fixtures.splice(0).reverse().forEach(f => f.close()); vi.restoreAllMocks(); });
const reference = <T extends string>(owner: T, value: { source: { sourceId: string } }) => ({ owner, sourceId: value.source.sourceId, sourceHash: hash(value.source), snapshotHash: hash(value) });
const setup = () => {
  const f = enrollmentFixture(); fixtures.push(f);
  const enroll = openSqliteSamePlateAppearanceEnrollmentStore(f.path, { readAcceptedEnrollment: () => f.source }); owners.push(enroll);
  const enrollment = enroll.accept(f.source.sourceId);
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
