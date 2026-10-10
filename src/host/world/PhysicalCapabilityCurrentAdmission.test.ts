import { expect, it, vi } from 'vitest';
import { actualLocomotionFixture } from './ActualLocomotionFixtures.test-support';
import { actualLocomotionEvidenceFromSqlite } from './SqliteActualLocomotionStore';
import * as models from './SqlitePlayerLocomotionModelStore';
import * as fieldingModels from './SqlitePlayerFieldingModelStore';
import { bodyMaterializationFixture, materialized } from './PlayerBodyCapabilityMaterializationFixtures.test-support';

it('checks dated model selection only for fresh locomotion admission and preserves the original receipt', () => {
  // Real existing decision/self/receipt owners. Only the dated selector seam is
  // substituted; the separate development integration proves its Native rows.
  const f = actualLocomotionFixture(), originalReader = models.playerLocomotionModelEvidenceFromSqlite;
  let replacementDay = f.model.source.acceptedAtDay + 1;
  const selected = { ...f.model, source: { ...f.model.source, sourceId: 'explicit-later-model' } };
  const spy = vi.spyOn(models, 'playerLocomotionModelEvidenceFromSqlite').mockImplementation(db => {
    const original = originalReader(db);
    return { ...original, selectAtDay(career, player, day) {
      const baseline = original.selectAtDay(career, player, day);
      return replacementDay <= day ? { ...selected, source: { ...selected.source, acceptedAtDay: replacementDay } } : baseline;
    } };
  });
  try {
    const owner = actualLocomotionEvidenceFromSqlite(f.f.db), value = owner.derive(f.locomotionSource);
    expect(() => owner.before(value)).not.toThrow();
    replacementDay = f.model.source.acceptedAtDay;
    expect(() => owner.before(value)).toThrow('current accepted model');
    replacementDay--;
    expect(() => owner.before(value)).toThrow('current accepted model');
    expect(owner.derive(f.locomotionSource)).toEqual(value);
    replacementDay = f.model.source.acceptedAtDay + 1;
    const saved = f.locomotion.accept(f.locomotionSource.sourceId);
    replacementDay = f.model.source.acceptedAtDay;
    expect(f.locomotion.read(saved.source.sourceId)).toEqual(saved);
    expect(f.locomotion.accept(saved.source.sourceId)).toEqual(saved);
  } finally { spy.mockRestore(); f.f.close(); }
});

it('keeps an original body and exact retry pinned after a same-day fielding selection changes', () => {
  const f = bodyMaterializationFixture(), originalReader = fieldingModels.playerFieldingModelEvidenceFromSqlite;
  try {
    const saved = materialized(f), before = f.db.prepare('SELECT * FROM world_player_body_materializations').all();
    const selected = { ...f.fielding, source: { ...f.fielding.source, sourceId: 'later-fielding', acceptedAtDay: f.request.atDay } };
    const spy = vi.spyOn(fieldingModels, 'playerFieldingModelEvidenceFromSqlite').mockImplementation(db => ({
      ...originalReader(db), selectAtDay: () => selected,
    }));
    try {
      expect(f.materializations.read(f.request.sourceId)).toEqual(saved);
      expect(f.materializations.accept(f.request.sourceId)).toEqual({ kind: 'materialized', value: saved });
      f.requests.set('stale-new-body', { ...f.request, sourceId: 'stale-new-body' });
      expect(() => f.materializations.accept('stale-new-body')).toThrow('applicable fielding');
      expect(f.db.prepare('SELECT * FROM world_player_body_materializations').all()).toEqual(before);
    } finally { spy.mockRestore(); }
  } finally { f.close(); }
});
