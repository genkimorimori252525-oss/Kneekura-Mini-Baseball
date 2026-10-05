import { expect, it } from 'vitest';
import * as models from './SqlitePlayerDecisionModelStore';
import { requireRunnerDecisionMotionModel, requireRunnerDecisionMotionModelStore, runnerDecisionMotionModelFixture } from './PlayerRunnerDecisionMotionModelContracts.test-support';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

it('keeps one immutable runner baseline instead of selecting a newer caller model', () => {
  const x = runnerDecisionMotionModelFixture();
  try {
    requireRunnerDecisionMotionModel(models, x.db);
    const store = x.track(requireRunnerDecisionMotionModelStore(models)(x.path, x.authority)), first = store.accept(x.source.sourceId);
    const next = { ...x.source, sourceId: 'later-runner-model', acceptedAtDay: x.source.acceptedAtDay + 1 };
    x.sources.set(next.sourceId, next);
    expect(() => store.accept(next.sourceId)).toThrow();
    expect(store.selectAtDay(x.source.careerId, x.source.playerId, next.acceptedAtDay)).toEqual(first);
    expect(x.db.prepare('SELECT count(*) AS n FROM world_player_runner_decision_motion_models').get()!.n).toBe(1);
  } finally { x.close(); }
});

it.each(['source', 'snapshot', 'person', 'index'] as const)('rejects rehashed runner model %s tampering', location => {
  const x = runnerDecisionMotionModelFixture();
  try {
    const own = requireRunnerDecisionMotionModel(models, x.db);
    const store = x.track(requireRunnerDecisionMotionModelStore(models)(x.path, x.authority)), saved = store.accept(x.source.sourceId);
    if (location === 'index') x.db.exec("UPDATE world_player_runner_decision_motion_models SET player_id='foreign'");
    else if (location === 'source') {
      const changed = { ...saved.source, decision: { ...saved.source.decision, coachTrust: 0 } };
      x.db.prepare('UPDATE world_player_runner_decision_motion_models SET source_json=?,source_hash=?').run(json(changed), hash(changed));
    } else {
      const changed = location === 'person' ? { ...saved, person: { ...saved.person, personId: 'foreign' } }
        : { ...saved, source: { ...saved.source, motion: { ...saved.source.motion, topSpeedMps: 100 } } };
      x.db.prepare('UPDATE world_player_runner_decision_motion_models SET snapshot_json=?,snapshot_hash=?').run(json(changed), hash(changed));
    }
    expect(() => own.read(x.source.sourceId)).toThrow();
    expect(() => store.accept(x.source.sourceId)).toThrow();
  } finally { x.close(); }
});

it.each(['source', 'snapshot', 'person'] as const)('detects original ownership after indexed identity moved through %s', mirror => {
  const x = runnerDecisionMotionModelFixture();
  try {
    const own = requireRunnerDecisionMotionModel(models, x.db);
    const store = x.track(requireRunnerDecisionMotionModelStore(models)(x.path, x.authority)), saved = store.accept(x.source.sourceId);
    const source = { ...saved.source, careerId: 'foreign-career', playerId: 'foreign-player' };
    const snapshot = JSON.parse(json(saved)); snapshot.source = { ...source };
    Object.assign(snapshot.person, { careerId: 'foreign-career', playerId: 'foreign-player' });
    if (mirror === 'source') Object.assign(source, { careerId: x.source.careerId, playerId: x.source.playerId });
    else Object.assign(mirror === 'snapshot' ? snapshot.source : snapshot.person, { careerId: x.source.careerId, playerId: x.source.playerId });
    x.db.prepare('UPDATE world_player_runner_decision_motion_models SET career_id=?,player_id=?,source_json=?,source_hash=?,snapshot_json=?,snapshot_hash=?')
      .run('foreign-career', 'foreign-player', json(source), hash(source), json(snapshot), hash(snapshot));
    expect(() => own.selectAtDay(x.source.careerId, x.source.playerId, x.source.acceptedAtDay)).toThrow();
  } finally { x.close(); }
});

it('rejects original Person mutation during a retry callback instead of returning a cached model', () => {
  const x = runnerDecisionMotionModelFixture();
  try {
    requireRunnerDecisionMotionModel(models, x.db);
    const open = requireRunnerDecisionMotionModelStore(models), store = x.track(open(x.path, x.authority)); store.accept(x.source.sourceId);
    const callback = x.track(open(x.path, { readAcceptedModel: () => {
      x.db.exec("UPDATE world_player_person_links SET person_id='changed-during-retry'"); return x.source;
    } }));
    expect(() => callback.accept(x.source.sourceId)).toThrow();
    expect(x.db.prepare('SELECT count(*) AS n FROM world_player_runner_decision_motion_models').get()!.n).toBe(1);
  } finally { x.close(); }
});
