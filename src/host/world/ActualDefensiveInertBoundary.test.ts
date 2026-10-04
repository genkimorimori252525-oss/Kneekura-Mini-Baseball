import { expect, it } from 'vitest';
import { actualDefensivePlanEvidenceFromSqlite, type AcceptedActualDefensivePlan, type DurableActualDefensivePlan } from './SqliteActualDefensivePlanStore';
import { actualDefensiveDecisionEvidenceFromSqlite, type AcceptedActualDefensiveDecision, type DurableActualDefensiveDecision } from './SqliteActualDefensiveDecisionStore';

it('rejects direct plan derive Source-ID accessors before evaluating them or reading the database', () => {
  let called = false, queries = 0;
  const db = { prepare() { queries++; throw new Error('unexpected query'); } };
  const raw = Object.defineProperty({}, 'sourceId', { enumerable: true, get() { called = true; return 'plan'; } }) as AcceptedActualDefensivePlan;
  expect(() => actualDefensivePlanEvidenceFromSqlite(db).derive(raw)).toThrow();
  expect(called).toBe(false); expect(queries).toBe(0);
});

it('rejects direct decision derive and before/current receipt accessors before dependency queries', () => {
  let called = false, queries = 0;
  const db = { prepare() { queries++; throw new Error('unexpected query'); } };
  const own = actualDefensiveDecisionEvidenceFromSqlite(db);
  const source = Object.defineProperty({}, 'physicalPitchSourceId', { enumerable: true, get() { called = true; return 'pitch'; } }) as AcceptedActualDefensiveDecision;
  expect(() => own.derive(source)).toThrow(); expect(called).toBe(false); expect(queries).toBe(0);
  const receipt = Object.defineProperty({}, 'source', { enumerable: true, get() { called = true; return source; } }) as DurableActualDefensiveDecision;
  for (const method of [own.before, own.current]) {
    expect(() => method(receipt)).toThrow(); expect(called).toBe(false); expect(queries).toBe(0);
  }
  expect(() => actualDefensivePlanEvidenceFromSqlite(db).before(receipt as unknown as DurableActualDefensivePlan)).toThrow();
  expect(called).toBe(false); expect(queries).toBe(0);
});

it('rejects a direct decision Source that names itself as predecessor before reading SQL', () => {
  let queries = 0;
  const db = { prepare() { queries++; throw new Error('unexpected query'); } };
  const source: AcceptedActualDefensiveDecision = { sourceId: 'self', sourceVersion: 'v1', physicalPitchSourceId: 'pitch', playerId: 'player',
    observationSourceId: 'observation', decisionModelSourceId: 'model', planSourceId: 'plan', previousDecisionSourceId: 'self' };
  expect(() => actualDefensiveDecisionEvidenceFromSqlite(db).derive(source)).toThrow(/invalid accepted/);
  expect(queries).toBe(0);
});
