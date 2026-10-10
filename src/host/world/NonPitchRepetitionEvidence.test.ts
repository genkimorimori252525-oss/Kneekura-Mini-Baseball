import { afterEach, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { officialPitchWorkloadFixture } from './OfficialPitchWorkloadFixtures.test-support';
import { openSqliteOfficialInitialWorldStore } from './SqliteOfficialInitialWorldStore';
import { openSqlitePhysicalPlateAppearanceActorStore } from './SqlitePhysicalPlateAppearanceActorStore';
import { readNonPitchRepetitionFrame } from './NonPitchRepetitionEvidenceFromSqlite';
import type { NonPitchRepetitionOpportunity } from './NonPitchDevelopmentRepetition';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

// Genuine small original-registration/actor admission; no pitch or closed game
// is constructed. The late raw claim is an explicit corruption control.
const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });
const fixture = () => {
  const path = join(mkdtempSync(join(tmpdir(), 'non-pitch-origin-')), 'small.sqlite');
  const f = officialPitchWorkloadFixture(false, true, path, true, undefined, { ruleProfileId: asRuleProfileId('npb-2026') });
  cleanup.push(f.close);
  const setup = { sourceId: 'initial', sourceVersion: 'fixture-v1', gameId: 'game-1', fixtureEventId: 'fixture-1',
    startedAtTick: 0, worldSetup: f.firstInput.worldSetup };
  const worlds = f.track(openSqliteOfficialInitialWorldStore(path, { matches: f.official, participation: f.participation },
    { readAcceptedSetup: () => setup })); worlds.accept('initial');
  const actorSource = { sourceId: 'actor', sourceVersion: 'fixture-v1', gameId: 'game-1', playerId: 'away-1', initialWorldSourceId: 'initial' };
  const actors = f.track(openSqlitePhysicalPlateAppearanceActorStore(path, { matches: f.official, participation: f.participation, initialWorlds: worlds },
    { readAcceptedActor: () => actorSource })); actors.accept('actor');
  const source: NonPitchRepetitionOpportunity = { sourceId: 'intention', sourceVersion: 'fixture-v1', opportunityId: 'intention',
    actorSourceId: 'actor', playerId: 'p2', personLinkSourceId: 'intake-p2', episodeId: 'learning', episodeRevision: 2,
    domain: 'TECHNICAL', exercise: 'FIELDING_GLOVE_CONTACT' };
  const read = (value = source, fresh = true) => {
    f.db.exec('BEGIN'); try { return readNonPitchRepetitionFrame(f.db, value, fresh); } finally { f.db.exec('ROLLBACK'); }
  };
  return { f, source, read };
};
it('authenticates original fielding and batting membership before any physical pitch', () => {
  const { source, read } = fixture();
  expect(read()).toMatchObject({ playerId: 'p2', person: { personId: 'person-p2' }, gameId: 'game-1', playId: 7 });
  expect(read({ ...source, exercise: 'BATTING_CONTACT', playerId: 'away-1', personLinkSourceId: 'intake-away-1' }))
    .toMatchObject({ playerId: 'away-1' });
  expect(() => read({ ...source, exercise: 'RUNNING_MOTION' })).toThrow('participant');
});
it('rejects a moved pitch index while retaining historical actor evidence', () => {
  const { f, read } = fixture(); const original = read();
  f.db.exec('CREATE TABLE physical_pitch_progress_actions(source_id TEXT,game_id TEXT,play_id INTEGER,source_json TEXT,snapshot_json TEXT)');
  f.db.prepare('INSERT INTO physical_pitch_progress_actions VALUES(?,?,?,?,?)').run('foreign-index', 'moved', 99,
    json({ gameId: 'game-1', initialWorldSourceId: 'initial' }), json({ frame: { match: { playId: 7 } } }));
  expect(read).toThrow('precede');
  f.db.exec('BEGIN');
  try { expect(readNonPitchRepetitionFrame(f.db, { sourceId: 'historical', sourceVersion: 'fixture-v1', opportunityId: 'historical',
    actorSourceId: 'actor', playerId: 'p2', personLinkSourceId: 'intake-p2', episodeId: 'learning', episodeRevision: 2,
    domain: 'TECHNICAL', exercise: 'FIELDING_GLOVE_CONTACT' }, false)).toEqual(original); }
  finally { f.db.exec('ROLLBACK'); }
});
it('rejects prospective admission through the original owner when the reserved physical namespace is partial', () => {
  const { f, read } = fixture();
  expect(read()).toMatchObject({ playerId: 'p2', playId: 7 });
  // Real original actor/reservation readers own namespace integrity. The
  // non-pitch adapter must retain that boundary; no downstream census is
  // substituted and corrupt historical ownership is not claimed readable.
  f.db.exec('CREATE TABLE pa_physical_v1_launches(source_id TEXT)');
  expect(read).toThrow('same-PA physical episode namespace is partial or malformed');
});
