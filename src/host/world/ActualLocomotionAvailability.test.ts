import { expect, it } from 'vitest';
import { actualLocomotionFixture as fixture } from './ActualLocomotionFixtures.test-support';
import { actualLocomotionPhysicalAvailabilityFromSqlite } from './ActualLocomotionPhysicalAvailability';
import { actualPlayerKinematicsEvidenceFromSqlite } from './SqliteActualPlayerKinematicsReader';

it('rejects a scheduled transfer at the same exact integer self cut, even behind observer-only rows', () => {
  const x = fixture();
  try {
    const own = actualPlayerKinematicsEvidenceFromSqlite(x.f.db);
    const cut = { physicalPitchSourceId: x.locomotionSource.physicalPitchSourceId, playerId: 'p2',
      baseFieldSourceId: x.baseField.source.sourceId, executionSourceId: null, mode: 'original' as const };
    const candidate = own.read(cut);
    expect(() => actualLocomotionPhysicalAvailabilityFromSqlite(x.f.db, cut, candidate)).toThrow(/unresolved physical contact/);
    const captureCut = { ...cut, executionSourceId: 'locomotion-capture-plan' };
    expect(() => actualLocomotionPhysicalAvailabilityFromSqlite(x.f.db, captureCut, candidate)).toThrow(/pending scheduled acquisition/);
    const at = x.decision.receipt.observedThrough.tick;
    const plan = { ...x.source, sourceId: 'motor-blocking-transfer', previousExecutionSourceId: x.executed.source.sourceId,
      action: { kind: 'throw_plan' as const, availableAtTick: at, throughTick: at + 1000, commands: x.fieldSource.commands,
        modelSourceId: x.model.source.fieldingModelSourceId, receiverPlayerId: x.baseField.response.touch.worldContact.flight.physicalPitch.frame.batterActor!.defenderBindings.find(b => b.playerId !== 'p2')!.playerId } };
    x.sources.set(plan.sourceId, plan); x.executions.accept(plan.sourceId);
    const observer = { ...plan, sourceId: 'motor-blocker-observer', previousExecutionSourceId: plan.sourceId, action: { kind: 'whole_play_history' as const } };
    x.sources.set(observer.sourceId, observer); x.executions.accept(observer.sourceId);
    x.locomotionSources.set(x.locomotionSource.sourceId, { ...x.locomotionSource, executionSourceId: observer.sourceId });
    expect(() => x.locomotion.accept(x.locomotionSource.sourceId)).toThrow(/pending.*transfer|blocked/);
    expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_locomotion_receipts').get()).toEqual({ n: 0 });
  } finally { x.f.close(); }
});
