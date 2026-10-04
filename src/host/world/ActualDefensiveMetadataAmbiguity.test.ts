import { expect, it } from 'vitest';
import { actualDefensiveDecisionFixture as fixture } from './ActualDefensiveDecisionFixtures.test-support';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** Deliberately noncanonical persisted JSON: SQLite selects first keys, JSON.parse selects last keys. */
const duplicate = (first: Record<string, unknown>, last: unknown) => `${JSON.stringify(first).slice(0, -1)},${JSON.stringify(last).slice(1)}`;
const insert = (db: ReturnType<typeof fixture>['f']['db'], table: string, row: Record<string, unknown>) =>
  db.prepare(`INSERT INTO ${table} (${Object.keys(row).join(',')}) VALUES (${Object.keys(row).map(() => '?').join(',')})`).run(...Object.values(row) as never[]);
const foreign = { sourceId: 'hidden', physicalPitchSourceId: 'foreign-pitch', playerId: 'foreign-player', observationSourceId: 'foreign-observation' };

it('rejects hidden plan and decision metadata whose duplicate container keys disagree between SQLite and JavaScript', () => {
  const x = fixture();
  try {
    const plan = x.plans.accept(x.planSource.sourceId), decision = x.decisions.accept(x.decisionSource.sourceId);
    for (const [table, original, store] of [
      ['actual_defensive_plans', plan, x.plans], ['actual_defensive_decisions', decision, x.decisions],
    ] as const) {
      const row = x.f.db.prepare(`SELECT * FROM ${table} WHERE source_id=?`).get(original.source.sourceId)!;
      const originalSnapshot = JSON.parse(row.snapshot_json as string);
      const shadowSnapshot = { ...originalSnapshot, source: foreign, history: [foreign],
        receipt: { self: { playerId: 'foreign-player' }, originObservationSourceId: 'foreign-observation' } };
      const sourceJson = duplicate(foreign, original.source), snapshotJson = duplicate(shadowSnapshot, originalSnapshot);
      expect(JSON.parse(sourceJson).physicalPitchSourceId).toBe(original.source.physicalPitchSourceId);
      const query = x.f.db.prepare("SELECT json_extract(?,'$.physicalPitchSourceId') AS pitch").get(sourceJson)!;
      expect(query.pitch).toBe('foreign-pitch');
      insert(x.f.db, table, { ...row, source_id: 'hidden', physical_pitch_source_id: 'foreign-pitch', player_id: 'foreign-player',
        observation_source_id: 'foreign-observation', source_json: sourceJson, source_hash: hash(JSON.parse(sourceJson)),
        snapshot_json: snapshotJson, snapshot_hash: hash(JSON.parse(snapshotJson)) });
      expect.soft(() => store.read(original.source.sourceId), table).toThrow();
      expect.soft(() => store.accept(original.source.sourceId), table).toThrow();
      x.f.db.prepare(`DELETE FROM ${table} WHERE source_id='hidden'`).run();
    }
  } finally { x.f.close(); }
});

it('rejects first-foreign last-original observation history metadata at the new context boundary', () => {
  const x = fixture();
  try {
    const row = x.f.db.prepare('SELECT * FROM actual_field_observations WHERE source_id=?').get(x.observation.source.sourceId)!;
    const source = { ...x.observation.source, ...foreign }, snapshot = JSON.parse(row.snapshot_json as string);
    const history = duplicate(foreign, x.observation.source);
    const snapshotJson = JSON.stringify({ ...snapshot, source, history: '__HISTORY__' }).replace('"__HISTORY__"', `[${history}]`);
    insert(x.f.db, 'actual_field_observations', { ...row, source_id: 'hidden', physical_pitch_source_id: 'foreign-pitch', player_id: 'foreign-player',
      source_json: JSON.stringify(source), source_hash: hash(source), snapshot_json: snapshotJson, snapshot_hash: hash(JSON.parse(snapshotJson)) });
    expect(JSON.parse(snapshotJson).history[0].playerId).toBe(x.observation.source.playerId);
    expect(() => x.plans.accept(x.planSource.sourceId)).toThrow();
  } finally { x.f.close(); }
});

it('rejects ambiguous future decision identity metadata while leaving future domain payload opaque', () => {
  const x = fixture();
  try {
    x.plans.accept(x.planSource.sourceId); const first = x.decisions.accept(x.decisionSource.sourceId);
    const execution = { ...x.source, action: { kind: 'motion' as const, availableAtTick: x.observation.receipt.at.tick,
      throughTick: x.observation.receipt.at.tick + 5, commands: x.fieldSource.commands } };
    x.sources.set(execution.sourceId, execution); x.executions.accept(execution.sourceId);
    const observation = { ...x.observationSource, sourceId: 'future-observation', previousObservationSourceId: x.observation.source.sourceId,
      executionSourceId: execution.sourceId };
    x.observationSources.set(observation.sourceId, observation); x.observations.accept(observation.sourceId);
    const source = { ...x.decisionSource, sourceId: 'future-decision', previousDecisionSourceId: first.source.sourceId, observationSourceId: observation.sourceId };
    x.decisionSources.set(source.sourceId, source); x.decisions.accept(source.sourceId);
    const row = x.f.db.prepare('SELECT * FROM actual_defensive_decisions WHERE source_id=?').get(source.sourceId)!;
    const originalSnapshot = JSON.parse(row.snapshot_json as string);
    const cases = [
      ['source_json', duplicate({ sourceId: source.sourceId }, { ...source, sourceId: 'foreign-last-source' })],
      ['snapshot_json', duplicate({ source: originalSnapshot.source }, { ...originalSnapshot, source: { ...source, playerId: 'foreign-last-player' } })],
      ['snapshot_json', duplicate({ history: originalSnapshot.history }, { ...originalSnapshot, history: [foreign] })],
    ];
    for (const [column, value] of cases) {
      x.f.db.prepare(`UPDATE actual_defensive_decisions SET ${column}=? WHERE source_id=?`).run(value, source.sourceId);
      expect.soft(() => x.decisions.read(first.source.sourceId), column).toThrow();
      x.f.db.prepare(`UPDATE actual_defensive_decisions SET ${column}=? WHERE source_id=?`).run(row[column], source.sourceId);
    }
    // Candidate/timing content is future domain payload; do not parse or validate it while reading the first receipt.
    const opaque = JSON.stringify({ ...originalSnapshot, receipt: { ...originalSnapshot.receipt, scheduling: '__OPAQUE__' } })
      .replace('"__OPAQUE__"', '{"decisionTick":"opaque","decisionTick":{"sourceId":"opaque"}}');
    x.f.db.prepare('UPDATE actual_defensive_decisions SET snapshot_json=? WHERE source_id=?').run(opaque, source.sourceId);
    expect(x.decisions.read(first.source.sourceId)).toEqual(first);
  } finally { x.f.close(); }
});

it('discovers duplicate observation Source/snapshot scope claims even when history and all own IDs are foreign', () => {
  const x = fixture();
  try {
    const row = x.f.db.prepare('SELECT * FROM actual_field_observations WHERE source_id=?').get(x.observation.source.sourceId)!;
    const source = { ...x.observation.source, ...foreign }, originalSnapshot = JSON.parse(row.snapshot_json as string);
    const snapshot = { ...originalSnapshot, source, history: [source] };
    const claim = duplicate(source, { ...source, physicalPitchSourceId: x.observation.source.physicalPitchSourceId, playerId: x.observation.source.playerId });
    for (const target of ['Source', 'snapshot Source']) {
      const sourceJson = target === 'Source' ? claim : JSON.stringify(source);
      const snapshotJson = target === 'Source' ? JSON.stringify(snapshot)
        : JSON.stringify({ ...snapshot, source: '__SOURCE__' }).replace('"__SOURCE__"', claim);
      insert(x.f.db, 'actual_field_observations', { ...row, source_id: 'hidden', physical_pitch_source_id: 'foreign-pitch', player_id: 'foreign-player',
        source_json: sourceJson, source_hash: hash(JSON.parse(sourceJson)), snapshot_json: snapshotJson, snapshot_hash: hash(JSON.parse(snapshotJson)) });
      expect.soft(() => x.plans.accept(x.planSource.sourceId), target).toThrow();
      x.f.db.prepare("DELETE FROM actual_field_observations WHERE source_id='hidden'").run();
      x.f.db.prepare('DELETE FROM actual_defensive_plans').run();
    }
  } finally { x.f.close(); }
});

it('discovers decision scope through duplicated history leaves or original-observation pointers alone', () => {
  const x = fixture();
  try {
    x.plans.accept(x.planSource.sourceId); const original = x.decisions.accept(x.decisionSource.sourceId);
    const row = x.f.db.prepare('SELECT * FROM actual_defensive_decisions').get()!, parsed = JSON.parse(row.snapshot_json as string);
    const source = { ...original.source, ...foreign }, receipt = { ...parsed.receipt, self: { ...parsed.receipt.self, playerId: 'foreign-player' },
      originDecisionSourceId: 'hidden', originObservationSourceId: 'foreign-observation' };
    for (const claim of ['history', 'observation pointer']) {
      const history = duplicate(source, { ...source, physicalPitchSourceId: original.source.physicalPitchSourceId, playerId: original.source.playerId });
      const pointer = duplicate({ originObservationSourceId: 'foreign-observation' }, { ...receipt, originObservationSourceId: original.source.observationSourceId });
      const snapshot = claim === 'history' ? JSON.stringify({ ...parsed, source, receipt, history: '__CLAIM__' }).replace('"__CLAIM__"', `[${history}]`)
        : JSON.stringify({ ...parsed, source, history: [source], receipt: '__CLAIM__' }).replace('"__CLAIM__"', pointer);
      insert(x.f.db, 'actual_defensive_decisions', { ...row, source_id: 'hidden', physical_pitch_source_id: 'foreign-pitch', player_id: 'foreign-player',
        observation_source_id: 'foreign-observation', source_json: JSON.stringify(source), source_hash: hash(source), snapshot_json: snapshot,
        snapshot_hash: hash(JSON.parse(snapshot)) });
      expect(() => x.decisions.read(original.source.sourceId), claim).toThrow();
      expect(() => x.decisions.accept(original.source.sourceId), claim).toThrow();
      x.f.db.prepare("DELETE FROM actual_defensive_decisions WHERE source_id='hidden'").run();
    }
  } finally { x.f.close(); }
});
