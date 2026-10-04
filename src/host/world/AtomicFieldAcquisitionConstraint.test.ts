import { expect, it } from 'vitest';
import { scheduledConstraintGroundFixture } from './ScheduledFieldAcquisitionConstraint.test-support';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { wholePlayPhysicalHistoryFromPrefix } from './WholePlayPhysicalHistoryFromPrefix';
import { actualBattedWorldObservationMoment } from './ActualFieldObservation';
import { installSyntheticObservation } from './ActualFieldObservationFixtures.test-support';
import { battedWorldBaseSurfaceId } from '../../core/sim/ball/BattedWorldFieldMotion';
import { actorHash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { openSqliteBattedWorldFieldExecutionStore } from './SqliteBattedWorldFieldExecutionStore';
import { openSqliteActualFieldObservationStore } from './SqliteActualFieldObservationStore';

it('retains the real atomic same-time constraint interruption as raw history without control or a sampleable ball', () => {
  const x = scheduledConstraintGroundFixture();
  try {
    const input = () => ({ baseField: x.baseField, fields: x.ownFields, executions: x.prefix });
    const before = battedWorldFieldPhysicalPrefix(input()), incoming = before.field.evidence.horizon;
    expect(incoming.ball.velocity.y).toBe(0);
    expect(before.field.evidence.contacts[0].contacts).toEqual([{ kind: 'ground' }]);
    expect(before.field.evidence.contacts[0].moment.elapsedSeconds).toBeLessThan(incoming.elapsedSeconds);
    const stopped = x.accept('atomic-constraint-ground', { kind: 'acquisition' });
    if (stopped.execution.kind !== 'acquisition' || stopped.execution.acquisition.kind !== 'interrupted') throw new Error('atomic interruption fixture');
    const capture = stopped.execution.acquisition, archive = JSON.stringify(stopped);
    // This exact atomic result was accepted by d5b7d2c before history admission worked.
    expect(actorHash(stopped)).toBe('a1303781f863f60a6d428eeafe5381e7ebe95fd5f164da7b915a279bba5704ef');
    expect(capture.reason).toBe('contact');
    expect(capture.contactMoment).toEqual(incoming);
    expect(capture.world.moment.elapsedSeconds).toBe(incoming.elapsedSeconds);
    expect(capture.world.moment.ball.velocity.y).toBe(-1);
    expect(capture.world.contacts.some((contact) => contact.kind === 'ground')).toBe(true);
    expect(capture.world.contacts.some((contact) => contact.kind === 'actor' && contact.role === 'glove' && contact.continuing)).toBe(true);
    let physical: ReturnType<typeof battedWorldFieldPhysicalPrefix> | undefined;
    expect(() => { physical = battedWorldFieldPhysicalPrefix(input()); }).not.toThrow();
    expect(physical?.field.evidence.contacts.at(-1)?.moment).toEqual(incoming);
    expect(physical?.field.evidence.contacts.at(-1)?.contacts).toEqual(expect.arrayContaining([
      { kind: 'ground' }, { kind: 'actor', playerId: capture.acquirerPlayerId, role: 'glove' },
    ]));
    expect(physical?.field.evidence.acquisitions).toEqual([capture]);
    expect(physical?.field.evidence.horizon).toEqual(capture.world.moment);
    expect(physical?.controlWindows).toEqual([]);
    expect(physical?.segments.at(-1)).toMatchObject({ startElapsedSeconds: incoming.elapsedSeconds, endElapsedSeconds: incoming.elapsedSeconds });
    expect(physical?.possessionEvidence).toBeUndefined();
    const changedMoment = { ...capture.world.moment, ball: { ...capture.world.moment.ball,
      velocity: { ...capture.world.moment.ball.velocity, y: -2 } } };
    const forgedBase = { kind: 'base' as const, baseId: 'first' as const, moment: capture.world.moment,
      point: capture.world.moment.ball.position, normal: { x: 0, y: 1, z: 0 } };
    const forgedSurface = { kind: 'surface' as const, surfaceId: battedWorldBaseSurfaceId(forgedBase.baseId),
      moment: forgedBase.moment, point: forgedBase.point, normal: forgedBase.normal };
    for (const forgedCapture of [
      { ...capture, world: { ...capture.world, moment: changedMoment, contacts: capture.world.contacts.map((contact) => ({ ...contact, moment: changedMoment })) } },
      { ...capture, reason: 'same_tick_competition' },
      { ...capture, transport: { ...capture.transport, remainingEnergyJ: 0 } },
      { ...capture, world: { ...capture.world, contacts: capture.world.contacts.map((contact) => contact.kind === 'actor' ? { ...contact, continuing: false } : contact) } },
      { ...capture, baseContacts: [forgedBase] },
      // Matching raw/companion metadata alone does not establish a real contact.
      { ...capture, baseContacts: [forgedBase], world: { ...capture.world, contacts: [...capture.world.contacts, forgedSurface] } },
    ]) {
      const forged = { ...stopped, execution: { ...stopped.execution, acquisition: forgedCapture } } as typeof stopped;
      expect(() => battedWorldFieldPhysicalPrefix({ ...input(), executions: [forged] })).toThrow();
    }
    const observer = installSyntheticObservation(x, capture.acquirerPlayerId, stopped.source.sourceId);
    const perceived = observer.observations.accept(observer.observationSource.sourceId), receiptBytes = JSON.stringify(perceived);
    expect(perceived.receipt.results.find((result) => result.target.kind === 'ball')?.status).toBe('physical_state_unavailable');
    expect(perceived.receipt.samples.ball).toBeNull();
    const view = x.accept('atomic-constraint-history', { kind: 'whole_play_history' });
    if (view.execution.kind !== 'whole_play_history') throw new Error('atomic history fixture');
    const history = wholePlayPhysicalHistoryFromPrefix(input());
    expect(actualBattedWorldObservationMoment(history)).toBeNull();
    expect(view.execution.physicalHistory.physicalSteps.at(-1)).toMatchObject({ kind: 'acquisition', acquisition: capture });
    expect(history.end.kind).toBe('unestablished');
    expect(history.cursor).toBeNull();
    expect(history.horizon).toEqual(capture.world.moment);
    expect(view.execution.physicalHistory.physicalSteps.at(-2)).toMatchObject({ kind: 'motion', field: { motion: { world: { moment: incoming } } } });
    const base = x.accept('atomic-constraint-base', { kind: 'base_touch_history', playerId: capture.acquirerPlayerId, base: 'first' });
    expect(base.execution).toMatchObject({ kind: 'base_touch_history', controlledContacts: [], physicalRuleFacts: [] });
    const race = x.accept('atomic-constraint-race', { kind: 'first_base_race' });
    expect(race.execution).toMatchObject({ kind: 'first_base_race', groundRule: null,
      pendingContacts: [{ elapsedSeconds: incoming.elapsedSeconds, reason: 'simultaneous_contact' }] });
    expect(JSON.stringify(x.executions.read(stopped.source.sourceId))).toBe(archive);
    expect(JSON.stringify(observer.observations.read(observer.observationSource.sourceId))).toBe(receiptBytes);
    const rows = () => x.f.db.prepare('SELECT source_json,source_hash,snapshot_json,snapshot_hash FROM batted_world_field_executions ORDER BY revision').all();
    const saved = rows(), reopened = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields));
    const reopenedObserver = x.f.track(openSqliteActualFieldObservationStore(x.f.path));
    for (const value of x.prefix) {
      expect(reopened.read(value.source.sourceId)).toEqual(value);
      expect(reopened.accept(value.source.sourceId)).toEqual(value);
    }
    expect(JSON.stringify(reopenedObserver.read(perceived.source.sourceId))).toBe(receiptBytes);
    expect(JSON.stringify(reopenedObserver.accept(perceived.source.sourceId))).toBe(receiptBytes);
    expect(rows()).toEqual(saved);
  } finally { x.f.close(); }
}, 120_000);
