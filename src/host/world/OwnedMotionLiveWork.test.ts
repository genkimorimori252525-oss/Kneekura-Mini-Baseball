import { afterAll, beforeAll, expect, it } from 'vitest';
import { ownedBattedWorldMotionFixture as fixture } from './OwnedBattedWorldMotionFixtures.test-support';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { ownedMotionLiveWork } from './OwnedMotionLiveWork';
import type { OwnedMotionAdoption, OwnedMotionComposition } from './OwnedBattedWorldMotion';

let x: ReturnType<typeof fixture>, original: OwnedMotionComposition, adoption: OwnedMotionAdoption;
beforeAll(() => {
  x = fixture();
  const source = x.retain(x.first.source.sourceId, x.at + 200);
  x.sources.set(source.sourceId, source);
  const value = x.executions.accept(source.sourceId);
  if (value.execution.kind !== 'owned_motion_v1') throw new Error('missing owned projection fixture');
  original = value.execution.composition; adoption = value.execution.adoption;
});
afterAll(() => x?.f.close());

// The physical/role evidence comes from a real owner. These pure projection cases
// vary only the pinned decision phase and the exact endpoint; Native lifecycle
// tests separately prove those phases are admitted by their real owners.
const pending = (phase: 'pending_decision' | 'pending_first_step') => {
  const dueTick = adoption.executedThrough.tick;
  const composition: OwnedMotionComposition = { ...original, knownWork: original.knownWork.map(w => w.playerId === 'p2'
    ? { ...w, phase, decisionSourceId: 'projection-pending-decision', decisionHash: 'synthetic-projection-hash', dueTick } : w) };
  return { composition, end: { ...adoption, compositionHash: hash(composition) }, dueTick };
};

it.each(['pending_decision', 'pending_first_step'] as const)('keeps a reached %s owner revision visibly pending', phase => {
  const { composition, end, dueTick } = pending(phase), work = ownedMotionLiveWork(composition, end);
  expect(work).toMatchObject({ unresolvedSuccessor: 'actual_defensive_decision_owner', pendingDecisionHandoffs: [{
    owner: 'actual_defensive_decisions', playerId: 'p2', decisionSourceId: 'projection-pending-decision',
    kind: phase === 'pending_decision' ? 'decision_revision' : 'first_step_revision', status: 'pending',
    dueAt: { originTick: composition.at.originTick, elapsedSeconds: (dueTick - composition.at.originTick) / composition.ticksPerSecond, tick: dueTick },
  }] });
  expect(work.contributors.find(c => c.playerId === 'p2')?.status).toBe('decision_revision_handoff');
  expect(work.contributors.filter(c => c.playerId !== 'p2').every(c => c.status === 'admitted_physical_coverage')).toBe(true);
});

it('keeps contact and due-decision handoffs together without interpreting a same quantized tick as reached', () => {
  const { composition, end } = pending('pending_decision');
  const before = ownedMotionLiveWork(composition, { ...end, executedThrough: { ...end.executedThrough,
    elapsedSeconds: end.executedThrough.elapsedSeconds - 0.25 / composition.ticksPerSecond } });
  expect(before).toMatchObject({ pendingDecisionHandoffs: [], unresolvedSuccessor: null });
  const contact = ownedMotionLiveWork(composition, { ...end, status: 'physical_boundary',
    physicalBoundary: { responseKind: 'unresolved', cursorAvailable: false } });
  expect(contact).toMatchObject({ unresolvedSuccessor: 'physical_contact_owner', pendingDecisionHandoffs: [{ playerId: 'p2', status: 'pending' }] });
  expect(contact.contributors.every(c => c.status === 'physical_contact_handoff')).toBe(true);
  expect(contact.contributors.find(c => c.playerId === 'p2')?.unexecutedTail).not.toBeNull();
  const resolved = ownedMotionLiveWork(composition, { ...end, status: 'physical_boundary',
    physicalBoundary: { responseKind: 'ground', cursorAvailable: true } });
  expect(resolved).toMatchObject({ unresolvedSuccessor: 'actual_defensive_decision_owner', pendingDecisionHandoffs: [{ playerId: 'p2', status: 'pending' }] });
  expect(resolved.contributors.find(c => c.playerId === 'p2')?.status).toBe('decision_revision_handoff');
});
