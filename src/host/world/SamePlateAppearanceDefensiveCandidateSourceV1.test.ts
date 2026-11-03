import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { samePaDefensiveCandidateSourceV1Input } from './SamePlateAppearanceDefensiveCandidateSourceV1';
import { deriveSamePaDefensiveTeamFromSqliteV1 } from './SamePlateAppearanceDefensiveTeamFromSqliteV1';
import { actorJson } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

const ref = (sourceId: string) => ({ owner: 'pa_physical_v1_field_steps', sourceId, sourceHash: 'a'.repeat(64), snapshotHash: 'b'.repeat(64) });
const member = { playerId: 'original-defender', bindingHash: 'a'.repeat(64), personHash: 'b'.repeat(64), baselineSourceId: 'baseline',
  reservedRevision: 1, reservedStateHash: 'c'.repeat(64), projectedStateHash: 'd'.repeat(64) };
it('parses the three reference-only contracts without issuing movement authority', () => {
  const sources = [ { kind: 'defender_candidate_set_v1', originalDecisionReference: ref('decision') },
    { kind: 'defender_team_selection_v1', candidateReferences: Array.from({ length: 9 }, (_, i) => ref('candidate-' + i)), requireBallHandler: true },
    { kind: 'defender_actor_selection_v1', teamSelectionReference: ref('team'), member } ];
  for (const source of sources) { const parsed = samePaDefensiveCandidateSourceV1Input(source);
    expect(actorJson(parsed)).toBe(actorJson(source)); expect(Object.isFrozen(parsed)).toBe(true); expect(Object.isFrozen(source)).toBe(false); }
});
it('rejects caller target/candidates/calibration, duplicate refs and foreign namespaces', () => {
  const original = { kind: 'defender_candidate_set_v1', originalDecisionReference: ref('decision') };
  for (const extra of [{ target: { x: 5, z: 5 } }, { calibration: {} }, { candidates: [] }, { priorities: {} }, { observedAtTick: 100 }]) {
    expect(() => samePaDefensiveCandidateSourceV1Input({ ...original, ...extra })).toThrow(); }
  expect(() => samePaDefensiveCandidateSourceV1Input({ ...original, originalDecisionReference: { ...ref('decision'), owner: 'actual_defensive_decisions' } })).toThrow();
  expect(() => samePaDefensiveCandidateSourceV1Input({ kind: 'defender_team_selection_v1', candidateReferences: Array(9).fill(ref('one')), requireBallHandler: true })).toThrow();
  expect(() => samePaDefensiveCandidateSourceV1Input({ kind: 'defender_actor_selection_v1', teamSelectionReference: ref('team'), member: { ...member, bindingHash: 'bad' } })).toThrow();
});
it('rejects owner rederivation outside a readonly transaction before looking up any source', () => {
  const db = new DatabaseSync(':memory:');
  try {
    expect(() => (deriveSamePaDefensiveTeamFromSqliteV1 as (...args: any[]) => unknown)(db, null, null, null, null, null, [], false)).toThrow(/read-only/);
    db.exec('BEGIN');
    expect(() => (deriveSamePaDefensiveTeamFromSqliteV1 as (...args: any[]) => unknown)(db, null, null, null, null, null, [], false)).toThrow(/read-only/);
    db.exec('ROLLBACK');
  } finally { db.close(); }
});
