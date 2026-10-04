import { expect, it } from 'vitest';
import * as ready from './ActualLivePlayReadiness';
import { createPlayerWorkloadRecovery, advancePlayerWorkloadRecovery } from '../../core/world/development/PlayerWorkloadRecovery';
const fixture = () => {
  const physicalEndReference = { owner: 'actual_first_base_play_ends' as const, sourceId: 'end', sourceVersion: 'v1', sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) };
  const wholeHistoryReference = { hash: 'c'.repeat(64), convention: 'owned_scheduled_whole_history_manifest_v1' as const };
  const scope = { closureSourceId: 'close', closureApplicationId: 'apply', closureProposalHash: 'd'.repeat(64),
    careerId: 'career', gameId: 'game', playId: 1, gameDay: 2, physicalEndReference, wholeHistoryReference,
    actors: Array.from({ length: 10 }, (_, i) => ({ playerId: `p${i}`, personId: `person${i}`, clubId: i ? 'home' : 'away', personLinkSourceId: `link${i}` })) };
  const participants = scope.actors.map(p => {
    const before = createPlayerWorkloadRecovery({ careerId: 'career', playerId: p.playerId, createdAtDay: 1, fatigue: 0.1, recoveryCapacity: 0.5,
      policy: { policyId: 'fixture', version: 'v1', availableAtDay: 0, workloadFatiguePerUnit: 0.1, travelFatiguePerKm: 0.01, recoveryPerHour: 0.1 } });
    const activity = { sourceEventId: `activity-${p.playerId}`, sourceVersion: 'v1', evidenceId: 'end', careerId: 'career', playerId: p.playerId,
      kind: 'MATCH' as const, atDay: 2, effortUnits: 1 };
    return { assessmentSourceId: `assessment-${p.playerId}`, ...p, activity, before, after: advancePlayerWorkloadRecovery(before, 0, activity), applied: true };
  });
  const { actors: _actors, ...reference } = scope;
  const settlement = { ...reference, kind: 'complete' as const, participants };
  return { scope, settlement, current: participants.map(p => p.after) };
};
it('requires every original Player/Person/Club effect and its currently authenticated workload head', () => {
  const f = fixture(); expect(() => ready.assertActualLiveReadyEffects(f.scope, f.settlement, f.current)).not.toThrow();
  expect(() => ready.assertActualLiveReadyEffects(f.scope, { ...f.settlement, participants: f.settlement.participants.slice(1) }, f.current)).toThrow(/participants/);
  expect(() => ready.assertActualLiveReadyEffects(f.scope, f.settlement, f.current.slice(1))).toThrow(/head/);
  const earlier = [...f.current]; earlier[0] = f.settlement.participants[0].before;
  expect(() => ready.assertActualLiveReadyEffects(f.scope, f.settlement, earlier)).toThrow(/head/);
});
it('rejects wrong-play, forged person or unapplied role even when a completion flag says complete', () => {
  const f = fixture();
  expect(() => ready.assertActualLiveReadyEffects(f.scope, { ...f.settlement, playId: 2 }, f.current)).toThrow(/scope/);
  for (const patch of [{ personId: 'other' }, { applied: false }, { clubId: 'other' }]) {
    const participants = f.settlement.participants.map((p, i) => i ? p : { ...p, ...patch });
    expect(() => ready.assertActualLiveReadyEffects(f.scope, { ...f.settlement, participants }, f.current)).toThrow(/participants/);
  }
});
it('permits later separately accepted recovery after the required AFTER without inventing a fatigue threshold', () => {
  const f = fixture(), current = f.current.map(s => advancePlayerWorkloadRecovery(s, s.revision, {
    sourceEventId: `later-${s.playerId}`, sourceVersion: 'v1', evidenceId: 'later', careerId: s.careerId, playerId: s.playerId,
    kind: 'RECOVERY', atDay: 2, durationHours: 1, quality: 0.5, medicalAvailability: 1 }));
  expect(() => ready.assertActualLiveReadyEffects(f.scope, f.settlement, current)).not.toThrow();
});
it('does not use a future-day workload head to make this original-game activation ready', () => {
  const f = fixture(), current = f.current.map(s => advancePlayerWorkloadRecovery(s, s.revision, {
    sourceEventId: `future-${s.playerId}`, sourceVersion: 'v1', evidenceId: 'future', careerId: s.careerId, playerId: s.playerId,
    kind: 'RECOVERY', atDay: 3, durationHours: 1, quality: 0.5, medicalAvailability: 1 }));
  expect(() => ready.assertActualLiveReadyEffects(f.scope, f.settlement, current)).toThrow(/head/);
});
