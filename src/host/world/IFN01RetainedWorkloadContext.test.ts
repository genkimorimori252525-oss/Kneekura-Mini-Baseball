import { expect, it } from 'vitest';
import { continuousPitchFixture } from './ContinuousPitchFixtures.test-support';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readIFN01RetainedWorkloadHeads } from './IFN01RetainedWorkloadContext.test-support';

/** Real workload, Person and participation owners; no pitch, enrollment or
 * expensive IFN physical prefix is executed by this finite context regression. */
const fixture = () => {
  const f = continuousPitchFixture(undefined, true);
  const ids = ['away-1', ...f.initial.world.defenders.map(d => d.playerId)];
  const participants = ids.map(playerId => {
    const binding = f.participation.readPregameBinding('game-1', playerId)!;
    const baseline = playerId === 'p2' ? f.baseline : { ...f.baseline, sourceId: 'native-baseline:' + playerId,
      playerId, personLinkSourceId: binding.personLinkSourceId };
    const owner = f.track(openSqlitePlayerWorkloadRecoveryStore(f.path, f.links, {
      readAcceptedBaseline: id => id === baseline.sourceId ? baseline : null, readAcceptedActivity: () => null }));
    const state = owner.initialize(baseline.sourceId);
    return { binding, state, baselineSourceId: baseline.sourceId };
  });
  const enrollment = { careerId: 'career-a', gameId: 'game-1', participants,
    source: { participantBaselineReferences: participants.map(p => ({ playerId: p.binding.playerId,
      baselineSourceId: p.baselineSourceId, revision: p.state.revision, stateHash: hash(p.state) })) } };
  return { f, enrollment, read: () => readIFN01RetainedWorkloadHeads(f.db, enrollment, f.participation) };
};

it('retains all eleven heads while authenticating the ten enrolled participants and independent original away pitcher', () => {
  const { f, enrollment, read } = fixture();
  try {
    const before = f.db.prepare('SELECT * FROM world_player_workload_heads ORDER BY career_id,player_id').all();
    const changes = f.db.prepare('SELECT total_changes() n').get()!.n;
    expect(enrollment.participants).toHaveLength(10);
    expect(read()).toEqual(before); expect(before).toHaveLength(11);
    expect(before.find(h => h.player_id === 'p-away')?.revision).toBe(0);
    expect(f.db.prepare('SELECT total_changes() n').get()!.n).toBe(changes);
  } finally { f.close(); }
});

it.each([
  ['missing enrolled head', "DELETE FROM world_player_workload_heads WHERE player_id='home-1'"],
  ['missing independent head', "DELETE FROM world_player_workload_heads WHERE player_id='p-away'"],
  ['unrelated extra head', "INSERT INTO world_player_workload_heads SELECT career_id,'extra',revision,state_json FROM world_player_workload_heads WHERE player_id='p-away'"],
  ['same-count replacement', "UPDATE world_player_workload_heads SET player_id='away-2' WHERE player_id='p-away'"],
  ['independent Person forgery', "UPDATE world_player_person_links SET person_id='forged' WHERE source_id='intake-p-away'"],
  ['independent workload forgery', "UPDATE world_player_workload_heads SET state_json='{}' WHERE player_id='p-away'"],
  ['enrolled workload forgery', "UPDATE world_player_workload_heads SET state_json='{}' WHERE player_id='home-1'"],
])('refuses %s without treating every workload head as an enrolled participant', (_label, mutation) => {
  const { f, read } = fixture();
  try { f.db.exec(mutation); expect(read).toThrow(); }
  finally { f.close(); }
});
