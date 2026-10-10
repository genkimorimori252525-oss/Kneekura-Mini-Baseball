import { afterAll, expect, it } from 'vitest';
import { directNativeDispatchFixture } from './SamePlateAppearanceDirectNative.test-support';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { deriveSamePaDispatchRoles } from './SamePlateAppearanceDispatchRoles';
import { policy } from '../../core/world/psychology/EmotionFixtures.test-support';
import { createEmotionState } from '../../core/world/psychology/EmotionState';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const modules = import.meta.glob('./SqliteBattingEmotionStore.ts');
let fixture: ReturnType<typeof directNativeDispatchFixture> | undefined;
const setup = async () => {
  const load = modules['./SqliteBattingEmotionStore.ts']; expect(load, 'OWNED_BATTING_EMOTION_GENESIS_MISSING').toBeTypeOf('function');
  const api = await load() as typeof import('./SqliteBattingEmotionStore');
  const f = fixture ??= directNativeDispatchFixture();
  const source = { sourceId: 'explicit-native-emotion-genesis', sourceVersion: 'fixture-only-v1', capability: 'owned_batting_emotion_genesis_v1' as const,
    viewReference: reference('reserved_pa_execution_views', f.view), member: deriveSamePaDispatchRoles(f.actor, f.view)[0].member, policy: policy(),
    provenance: { assessmentSourceId: 'fixture-explicit-emotion-policy', assessmentVersion: 'fixture-only-v1', calibrationSourceId: 'existing-Core-emotion-fixture', calibrationVersion: 'fixture-only-v1' } };
  return { api, f, source };
};
afterAll(() => fixture?.close());
it('EG01 explicit policy owns exactly one initial emotion state and exact retries survive ordinary reopen', async () => {
  const { api, f, source } = await setup(), store = api.openSqliteBattingEmotionStore(f.path, { readAcceptedGenesis: id => id === source.sourceId ? source : null });
  try {
    const result = store.acceptGenesis(source.sourceId); expect(result.kind).toBe('batting_emotion_genesis');
    if (result.kind !== 'batting_emotion_genesis') throw new Error('fixture missing accepted Source');
    expect(result.scope).toEqual({ careerId: f.actor.binding.careerId, matchId: f.actor.source.gameId, playerId: f.actor.binding.playerId });
    const expected = createEmotionState({ scope: result.scope, policy: source.policy });
    if (!expected.ok) throw new Error('invalid explicit fixture policy');
    expect(result.state).toEqual(expected.value); expect(result.source.policy).toEqual(source.policy);
    expect(store.acceptGenesis(source.sourceId)).toEqual(result); store.close();
    const reopened = api.openSqliteBattingEmotionStore(f.path);
    try { expect(reopened.readGenesis(source.sourceId)).toEqual(result); expect(reopened.acceptGenesis(source.sourceId)).toEqual(result); }
    finally { reopened.close(); }
    expect(f.db.prepare('SELECT count(*) n FROM batting_emotion_v1_geneses').get()!.n).toBe(1);
  } finally { store.close(); }
});
it('EG02 alternate identity and changed Person or policy reject without replacing the accepted genesis', async () => {
  const { api, f, source } = await setup();
  for (const changed of [{ ...source, sourceId: 'other-emotion-genesis' }, { ...source, member: { ...source.member, personHash: hash('other-person') } },
    { ...source, policy: { ...source.policy, clearAfterCalmEvents: 99 } }]) {
    const store = api.openSqliteBattingEmotionStore(f.path, { readAcceptedGenesis: () => changed });
    try { expect(() => store.acceptGenesis(changed.sourceId)).toThrow(); } finally { store.close(); }
  }
  expect(f.db.prepare('SELECT count(*) n FROM batting_emotion_v1_geneses').get()!.n).toBe(1);
});
it('EG03 moved indexed identity cannot turn the original emotion Source into a missing prerequisite', async () => {
  const { api, f, source } = await setup();
  f.db.prepare('UPDATE batting_emotion_v1_geneses SET source_id=? WHERE source_id=?').run('moved-index', source.sourceId);
  const store = api.openSqliteBattingEmotionStore(f.path);
  try { expect(() => store.readGenesis(source.sourceId)).toThrow(/identity|claim|row/); }
  finally { store.close(); f.db.prepare('UPDATE batting_emotion_v1_geneses SET source_id=? WHERE source_id=?').run(source.sourceId, 'moved-index'); }
});
