import { expect, it } from 'vitest';
import * as models from './SqlitePlayerDecisionModelStore';
import { createRosterState } from '../../core/world/roster/RosterState';
import { canonicalRosterEvidenceJson } from './RosterEvidenceJson';
import { requireRunnerDecisionMotionModel, requireRunnerDecisionMotionModelStore,
  runnerDecisionMotionModelFixture } from './PlayerRunnerDecisionMotionModelContracts.test-support';

it.each((['missing_head', 'earlier_revision', 'earlier_day', 'removed_player'] as const)
  .flatMap(mutation => (['derive', 'read'] as const).map(operation => [mutation, operation] as const)))
('rejects intake with %s through model %s after the original intake owner rejects it', (mutation, operation) => {
  const x = runnerDecisionMotionModelFixture({ initialRosterRevision: 1 });
  try {
    const own = requireRunnerDecisionMotionModel(models, x.db);
    expect(x.links.readLink(x.person.sourceId)).toEqual(x.person); expect(x.person.rosterRevision).toBe(1);
    expect(own.derive(x.source)).toEqual({ source: x.source, person: x.person });
    if (operation === 'read') {
      const store = x.track(requireRunnerDecisionMotionModelStore(models)(x.path, x.authority));
      expect(store.accept(x.source.sourceId)).toEqual({ source: x.source, person: x.person });
      expect(own.read(x.source.sourceId)).toEqual({ source: x.source, person: x.person });
    }
    if (mutation === 'missing_head') x.db.prepare('DELETE FROM world_roster_heads WHERE career_id=?').run(x.source.careerId);
    else {
      const row = x.db.prepare('SELECT roster_json FROM world_roster_heads WHERE career_id=?').get(x.source.careerId)!;
      const original = createRosterState(JSON.parse(String(row.roster_json)));
      const roster = createRosterState({ ...original,
        ...(mutation === 'earlier_revision' ? { revision: x.person.rosterRevision - 1 } : {}),
        ...(mutation === 'earlier_day' ? { effectiveDay: x.person.acceptedAtDay - 1 } : {}),
        ...(mutation === 'removed_player' ? { players: original.players.filter(player => player.playerId !== x.source.playerId) } : {}),
      });
      x.db.prepare('UPDATE world_roster_heads SET revision=?,roster_json=? WHERE career_id=?')
        .run(roster.revision, canonicalRosterEvidenceJson(roster), x.source.careerId);
    }
    // This witnesses the original owner's support check, not malformed roster JSON.
    expect(() => x.links.readLink(x.person.sourceId)).toThrow('global roster head no longer supports player link');
    let rejected = false;
    try { if (operation === 'derive') own.derive(x.source); else own.read(x.source.sourceId); }
    catch { rejected = true; }
    if (!rejected) throw new Error('runner model accepted an intake link unsupported by its original roster owner');
  } finally { x.close(); }
});
