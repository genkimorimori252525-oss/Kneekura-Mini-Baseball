import { expect, it } from 'vitest';
import { effectiveDefenderSourceFixture } from './SamePlateAppearanceEffectiveDefender.test-support';
const modules = import.meta.glob('./SamePlateAppearanceEffectiveDefenderSource.ts');
const api = async () => { const load = modules['./SamePlateAppearanceEffectiveDefenderSource.ts'];
  expect(load, 'EFFECTIVE_DEFENDER_SOURCE_UNION_MISSING').toBeTypeOf('function'); return await load() as any; };
it('ES01 exact decision and command Sources retain their distinct original and effective reference unions', async () => {
  const { samePaEffectiveDefenderSourceInput: input } = await api(), f = effectiveDefenderSourceFixture();
  for (const source of [f.decision, f.command]) expect(input(source, { sourceId: source.sourceId, actionOrdinal: source.actionOrdinal })).toEqual(source);
});
it('ES02 Source union rejects extra state clocks commands mixed routes and wrong reference owners', async () => {
  const { samePaEffectiveDefenderSourceInput: input } = await api(), f = effectiveDefenderSourceFixture();
  const changes = [(s: any) => s.clock = 0, (s: any) => s.state = {}, (s: any) => s.command = {},
    (s: any) => s.originalInputReferences.observationReference.owner = 'actual_defensive_decisions',
    (s: any) => s.calibrationReferences[0].route = 'defender_locomotion', (s: any) => s.calibrationReferences.push(s.calibrationReferences[0]),
    (s: any) => s.operation.kind = 'command_from_effective_issued_decision_v1', (s: any) => s.physicalSourceReference.snapshotHash = 'future'];
  for (const change of changes) { const s = structuredClone(f.decision); change(s); expect(() => input(s)).toThrow(); }
  expect(() => input({ ...f.command, operation: { ...f.command.operation, effectiveDecisionReference: f.ref('actual_defensive_decisions') } })).toThrow();
  expect(() => input({ ...f.command, operation: { ...f.command.operation, effectiveDecisionReference: { ...f.ref('pa_dispatch_v1_consumer_actions'), sourceId: f.command.sourceId } } })).toThrow();
});
it('ES03 Source union rejects canonical identity and ordinal substitutions and executable data', async () => {
  const { samePaEffectiveDefenderSourceInput: input } = await api(), { decision } = effectiveDefenderSourceFixture();
  expect(() => input({ ...decision, sourceId: 'alias' }, { sourceId: decision.sourceId, actionOrdinal: 0 })).toThrow();
  expect(() => input({ ...decision, actionOrdinal: 1 }, { sourceId: decision.sourceId, actionOrdinal: 0 })).toThrow();
  expect(() => input({ ...decision, actionOrdinal: -1 })).toThrow();
  const s = structuredClone(decision); Object.defineProperty(s, 'member', { enumerable: true, get() { throw new Error('getter must never run'); } });
  expect(() => input(s)).toThrow(/accessor|inert|data/);
});
