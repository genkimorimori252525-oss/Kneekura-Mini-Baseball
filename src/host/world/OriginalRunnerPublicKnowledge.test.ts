import { beforeAll, afterAll, expect, it } from 'vitest';
import * as knowledge from './SqliteActualFieldObservationStore';
import { originalRunnerPublicKnowledgeFixture, requireOriginalRunnerPublicKnowledge,
  type OriginalRunnerPublicKnowledgeSource } from './OriginalRunnerPublicKnowledgeContracts.test-support';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

let x: ReturnType<typeof originalRunnerPublicKnowledgeFixture>;
beforeAll(() => { x = originalRunnerPublicKnowledgeFixture(); }, 120_000);
afterAll(() => { x?.close(); });

it('derives the complete known pre-pitch subset from the original legal activation and runner recipient', () => {
  const own = requireOriginalRunnerPublicKnowledge(knowledge, x.f.db), value = own.derive(x.knowledgeSource);
  expect(value.version).toBe('original_runner_public_knowledge_v1'); expect(value.source).toEqual(x.knowledgeSource);
  expect(value.recipient).toEqual({ careerId: x.originalRunner.binding.careerId, gameId: x.actor.source.gameId,
    playId: x.actor.match.playId, playerId: x.originalRunner.binding.playerId, personId: x.originalRunner.person.personId });
  expect(value.availableAtTick).toBe(x.actor.world.tick);
  expect(value.original).toEqual({ physicalActorSourceId: x.actor.source.sourceId, prePitchRunnerSourceId: x.originalRunner.source.sourceId,
    officialRevision: x.actor.officialRevision, matchHash: hash(x.actor.match), actorHash: hash(x.actor),
    runnerHash: hash(x.originalRunner), physicalPitchHash: hash(x.pitch) });
  expect(value.known).toEqual({ inning: 1, half: 'top', battingSide: 'AWAY', outs: 0,
    score: { home: 0, away: 0 }, battingRuns: 0, defendingRuns: 0, startingBase: 1, normalNextBase: 2 });
  expect(value.liveContext).toEqual({ status: 'pending', knownContext: null, force: 'unavailable', tagUp: 'unavailable', consumedSignals: [] });
});

it.each(['physicalPitchSourceId', 'playerId', 'physicalActorSourceId', 'prePitchRunnerSourceId'] as const)
('rejects a foreign %s instead of borrowing the original runner public baseline', key => {
  const own = requireOriginalRunnerPublicKnowledge(knowledge, x.f.db); expect(own.derive(x.knowledgeSource).source).toEqual(x.knowledgeSource);
  expect(() => own.derive({ ...x.knowledgeSource, [key]: 'foreign' })).toThrow();
});

it.each(['outs', 'score', 'currentBase', 'knownContext', 'forcedToAdvance', 'tagUp', 'communicationSourceId', 'result'] as const)
('rejects supplied %s facts after authenticating the actual original inputs', key => {
  const own = requireOriginalRunnerPublicKnowledge(knowledge, x.f.db); expect(own.derive(x.knowledgeSource).source).toEqual(x.knowledgeSource);
  expect(() => own.derive({ ...x.knowledgeSource, [key]: key === 'forcedToAdvance' ? false : { supplied: true } } as OriginalRunnerPublicKnowledgeSource)).toThrow();
});

it('rejects a Source accessor before invoking it', () => {
  const own = requireOriginalRunnerPublicKnowledge(knowledge, x.f.db), source = { ...x.knowledgeSource }; let calls = 0;
  Object.defineProperty(source, 'physicalActorSourceId', { enumerable: true, get() { calls += 1; return x.actor.source.sourceId; } });
  expect(() => own.derive(source)).toThrow(/accessor|inert/); expect(calls).toBe(0);
});

it('retains known original facts without issuing a decision, inventing live force/tag-up or changing original rows', () => {
  const own = requireOriginalRunnerPublicKnowledge(knowledge, x.f.db);
  const rows = () => ({ matches: x.f.db.prepare('SELECT * FROM matches ORDER BY match_id').all(),
    actors: x.f.db.prepare('SELECT * FROM physical_plate_appearance_actors ORDER BY source_id').all(),
    pitches: x.f.db.prepare('SELECT * FROM physical_pitch_progress_actions ORDER BY source_id').all(),
    people: x.f.db.prepare('SELECT * FROM world_player_person_links ORDER BY source_id').all() });
  const before = rows(), first = own.derive(x.knowledgeSource);
  expect(own.derive(x.knowledgeSource)).toEqual(first); expect(rows()).toEqual(before);
  expect(first.liveContext.knownContext).toBeNull(); expect(first.liveContext.consumedSignals).toEqual([]);
  for (const key of ['motionIntent', 'decisionInput', 'decision', 'controller', 'currentPosition', 'correctRuleResult']) expect(first).not.toHaveProperty(key);
});
