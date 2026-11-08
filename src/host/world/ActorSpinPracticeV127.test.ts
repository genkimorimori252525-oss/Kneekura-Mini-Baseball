import { expect, it } from 'vitest';
import { battingModelStanceFixture } from './NativeBattingModelStanceFixtures.test-support';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { prepareActorSpinPracticeV127 } from './ActorSpinPracticeV127.test-support';

// Genuine Actor/model prerequisite only, not the full Direct/9-defender
// dispatch fixture. The root integration owns the successful practice/adoption.
it('ASP127 refuses a missing pre-enrollment batter baseline before creating training Sources or changing the original database', () => {
  const fixture = battingModelStanceFixture({ modelDay: 1 }), db = fixture.x.f.db;
  try {
    const batting = fixture.modelStore.accept(fixture.source.sourceId);
    const snapshot = () => hash({ schema: db.prepare('SELECT * FROM sqlite_master ORDER BY name').all(),
      heads: db.prepare('SELECT * FROM world_player_workload_heads ORDER BY player_id').all() });
    const before = snapshot();
    expect(() => prepareActorSpinPracticeV127({ fixture, batting })).toThrow(/pre-enrollment batter workload baseline/);
    expect(snapshot()).toBe(before);
  } finally { fixture.close(); }
});
