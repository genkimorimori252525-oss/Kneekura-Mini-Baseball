import { expect, it } from 'vitest';
import { playerLocomotionModelFixture as fixture } from './PlayerLocomotionModelFixtures.test-support';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

it.each(['source', 'snapshot-source', 'snapshot-fielding', 'snapshot-person'] as const)(
  'rejects a hidden baseline whose %s has first-foreign / last-original duplicate ownership keys', (remaining) => {
    const f = fixture();
    try {
      const value = f.models.accept(f.source.sourceId), foreign = { careerId: 'foreign-career', playerId: 'foreign-player' };
      const movedSource = { ...value.source, ...foreign, sourceId: 'moved-id' };
      const source = remaining === 'source' ? { ...value.source, sourceId: 'moved-id' } : movedSource;
      const snapshot = { source: movedSource, fieldingModel: { source: { ...value.fieldingModel.source, ...foreign },
        person: { ...value.fieldingModel.person, ...foreign } } };
      const duplicate = (original: unknown) => `{"careerId":"foreign-career","playerId":"foreign-player",${json(original).slice(1)}`;
      const sourceJson = remaining === 'source' ? duplicate(source) : json(source);
      let snapshotJson = json(snapshot);
      if (remaining === 'snapshot-source') snapshotJson = snapshotJson.replace(json(movedSource), duplicate({ ...value.source, sourceId: 'moved-id' }));
      if (remaining === 'snapshot-fielding') snapshotJson = snapshotJson.replace(json(snapshot.fieldingModel.source), duplicate(value.fieldingModel.source));
      if (remaining === 'snapshot-person') snapshotJson = snapshotJson.replace(json(snapshot.fieldingModel.person), duplicate(value.fieldingModel.person));
      f.db.prepare('UPDATE world_player_locomotion_models SET source_id=?,career_id=?,player_id=?,source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?')
        .run('moved-id', foreign.careerId, foreign.playerId, sourceJson, hash(JSON.parse(sourceJson)), snapshotJson, hash(JSON.parse(snapshotJson)));
      const replacement = { ...f.source, sourceId: 'replacement' }; f.sources.set(replacement.sourceId, replacement);
      expect(() => f.models.accept(replacement.sourceId)).toThrow();
      expect(f.db.prepare('SELECT count(*) AS n FROM world_player_locomotion_models').get()).toEqual({ n: 1 });
    } finally { f.close(); }
  },
);
it.each(['source', 'snapshot'] as const)('rejects a hidden Source ID in the %s mirror despite first-key SQL projection', (remaining) => {
  const f = fixture();
  try {
    const value = f.models.accept(f.source.sourceId), foreign = { careerId: 'foreign-career', playerId: 'foreign-player' };
    const moved = { ...value.source, ...foreign, sourceId: 'moved-id' }, originalId = { ...moved, sourceId: value.source.sourceId };
    const duplicate = `{"sourceId":"moved-id",${json(originalId).slice(1)}`;
    const sourceJson = remaining === 'source' ? duplicate : json(moved);
    const snapshot = { source: moved, fieldingModel: { source: { ...value.fieldingModel.source, ...foreign },
      person: { ...value.fieldingModel.person, ...foreign } } };
    const snapshotJson = remaining === 'snapshot' ? json(snapshot).replace(json(moved), duplicate) : json(snapshot);
    f.db.prepare('UPDATE world_player_locomotion_models SET source_id=?,career_id=?,player_id=?,source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?')
      .run('moved-id', foreign.careerId, foreign.playerId, sourceJson, hash(JSON.parse(sourceJson)), snapshotJson, hash(JSON.parse(snapshotJson)));
    expect(() => f.models.read(f.source.sourceId)).toThrow();
  } finally { f.close(); }
});
it.each(['source', 'fieldingModel', 'fielding-source', 'fielding-person'] as const)(
  'rejects hidden original ownership inside a duplicate snapshot %s container', (container) => {
    const f = fixture();
    try {
      const value = f.models.accept(f.source.sourceId), foreign = { careerId: 'foreign-career', playerId: 'foreign-player' };
      const moved = { ...value.source, ...foreign, sourceId: 'moved-id' };
      const movedFielding = { source: { ...value.fieldingModel.source, ...foreign }, person: { ...value.fieldingModel.person, ...foreign } };
      let snapshotJson: string;
      if (container === 'source') snapshotJson = `{"source":${json(moved)},${json({ source: { ...value.source, sourceId: 'moved-id' }, fieldingModel: movedFielding }).slice(1)}`;
      else if (container === 'fieldingModel') snapshotJson = `{"fieldingModel":${json(movedFielding)},${json({ source: moved, fieldingModel: value.fieldingModel }).slice(1)}`;
      else {
        const key = container === 'fielding-source' ? 'source' : 'person';
        const original = container === 'fielding-source' ? { ...movedFielding, source: value.fieldingModel.source }
          : { ...movedFielding, person: value.fieldingModel.person };
        snapshotJson = json({ source: moved, fieldingModel: movedFielding }).replace(json(movedFielding),
          `{"${key}":${json(movedFielding[key])},${json(original).slice(1)}`);
      }
      f.db.prepare('UPDATE world_player_locomotion_models SET source_id=?,career_id=?,player_id=?,source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?')
        .run('moved-id', foreign.careerId, foreign.playerId, json(moved), hash(moved), snapshotJson, hash(JSON.parse(snapshotJson)));
      const replacement = { ...f.source, sourceId: 'replacement' }; f.sources.set(replacement.sourceId, replacement);
      expect(() => f.models.accept(replacement.sourceId)).toThrow();
    } finally { f.close(); }
  },
);
it('recognizes escaped duplicate identity keys instead of only matching their raw spelling', () => {
  const f = fixture();
  try {
    const value = f.models.accept(f.source.sourceId), moved = { ...value.source, sourceId: 'moved-id' };
    const sourceJson = `{"sourceId":"moved-id",${json(value.source).slice(1).replace('"sourceId"', '"source\\u0049d"')}`;
    f.db.prepare('UPDATE world_player_locomotion_models SET source_id=?,source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?')
      .run('moved-id', sourceJson, hash(value.source), json({ ...value, source: moved }), hash({ ...value, source: moved }));
    expect(() => f.models.read(value.source.sourceId)).toThrow();
  } finally { f.close(); }
});
it('keeps unrelated domain payloads opaque and preserves every archive byte on read/retry', () => {
  const f = fixture();
  try {
    const value = f.models.accept(f.source.sourceId), foreign = { careerId: 'foreign-career', playerId: 'foreign-player' };
    const moved = { ...value.source, ...foreign, sourceId: 'foreign-id' };
    const sourceJson = json(moved).replace(json(moved.calibration), '{"opaque":"not-a-calibration","opaque":[null]}');
    const snapshotJson = json({ source: moved, fieldingModel: { source: { ...value.fieldingModel.source, ...foreign },
      person: { ...value.fieldingModel.person, ...foreign } } }).replace(json(moved.calibration), '"unconsumed-calibration"');
    f.db.prepare(`INSERT INTO world_player_locomotion_models VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run('foreign-id', moved.sourceVersion, moved.capability, foreign.careerId, foreign.playerId,
        moved.personLinkSourceId, moved.fieldingModelSourceId, moved.acceptedAtDay, sourceJson, 'opaque-hash', snapshotJson, 'opaque-hash');
    const original = f.db.prepare('SELECT * FROM world_player_locomotion_models ORDER BY source_id').all();
    expect(f.models.read(f.source.sourceId)).toEqual(value);
    expect(f.models.accept(f.source.sourceId)).toEqual(value);
    expect(f.models.selectAtDay('career-a', 'player-a', 11)).toEqual(value);
    expect(f.db.prepare('SELECT * FROM world_player_locomotion_models ORDER BY source_id').all()).toEqual(original);
  } finally { f.close(); }
});
