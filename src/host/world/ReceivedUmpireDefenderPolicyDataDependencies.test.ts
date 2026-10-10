import { expect, test } from 'vitest';
import { policyFixture } from './ReceivedUmpireDefenderPolicyDataFixtures.test-support';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const append = (value: Record<string, unknown>, members: Record<string, unknown>) => json(value).slice(0, -1) + ',' + json(members).slice(1);
const escaped = (raw: string) => raw.replaceAll('"sourceId"', '"source\\u0049d"').replaceAll('"careerId"', '"career\\u0049d"')
  .replaceAll('"playerId"', '"player\\u0049d"').replaceAll('"personId"', '"person\\u0049d"');
const originalRows = (f: Awaited<ReturnType<typeof policyFixture>>) => ({
  people: f.db.prepare('SELECT * FROM world_player_person_links ORDER BY source_id').all(),
  rosters: f.db.prepare('SELECT * FROM world_roster_heads ORDER BY career_id').all(), policies: f.rows(),
});

test('RP-DP01 a second indexed Person row cannot hide raw original Source Player or Person ownership', async () => {
  for (const claim of ['source', 'player', 'person']) for (const mode of ['plain', 'escaped', 'duplicate', 'escaped-duplicate']) {
    for (const accepted of [false, true]) {
      const f = await policyFixture();
      try {
        if (accepted) f.store.accept('policy-a');
        const foreign = { ...f.person, sourceId: 'alias-intake', careerId: 'alias-career', playerId: 'alias-player', personId: 'alias-person' };
        const members = claim === 'source' ? { sourceId: f.person.sourceId } : claim === 'player'
          ? { careerId: f.person.careerId, playerId: f.person.playerId } : { careerId: f.person.careerId, personId: f.person.personId };
        let raw = mode.includes('duplicate') ? append(foreign, members) : json({ ...foreign, ...members });
        if (mode.includes('escaped')) raw = escaped(raw);
        f.db.prepare(`INSERT INTO world_player_person_links VALUES ('alias-intake','alias-career','alias-player','alias-person',0,10,?)`).run(raw);
        const before = originalRows(f);
        expect.soft(() => accepted ? f.store.read('policy-a') : f.store.accept('policy-a'), 'HIDDEN_SELECTED_PERSON_CLAIM_ACCEPTED').toThrow(/ownership|scope|claim/);
        expect.soft(() => f.store.accept('policy-a'), 'HIDDEN_SELECTED_PERSON_RETRY_ACCEPTED').toThrow(/ownership|scope|claim/);
        expect.soft(originalRows(f)).toEqual(before);
      } finally { f.close(); }
    }
  }
});

test('RP-DP02 a roster alias cannot hide any decoded raw selected Career claim', async () => {
  for (const mode of ['plain', 'escaped', 'duplicate', 'escaped-duplicate']) for (const accepted of [false, true]) {
    const f = await policyFixture();
    try {
      if (accepted) f.store.accept('policy-a');
      const row = f.db.prepare("SELECT * FROM world_roster_heads WHERE career_id='career-a'").get()!;
      const roster = JSON.parse(String(row.roster_json)), foreign = { ...roster, careerId: 'alias-career' };
      let raw = mode.includes('duplicate') ? append(foreign, { careerId: 'career-a' }) : json(roster);
      if (mode.includes('escaped')) raw = escaped(raw);
      f.db.prepare("INSERT INTO world_roster_heads VALUES ('alias-career',?,?)").run(row.revision, raw);
      const before = originalRows(f);
      expect.soft(() => accepted ? f.store.read('policy-a') : f.store.accept('policy-a'), 'HIDDEN_SELECTED_ROSTER_CLAIM_ACCEPTED').toThrow(/ownership|scope|claim/);
      expect.soft(() => f.store.accept('policy-a'), 'HIDDEN_SELECTED_ROSTER_RETRY_ACCEPTED').toThrow(/ownership|scope|claim/);
      expect.soft(originalRows(f)).toEqual(before);
    } finally { f.close(); }
  }
});

test('RP-DP03 unrelated valid Person and Career owners remain outside selected dependency checks', async () => {
  const f = await policyFixture();
  try {
    const original = f.db.prepare("SELECT * FROM world_roster_heads WHERE career_id='career-a'").get()!;
    const roster = { ...JSON.parse(String(original.roster_json)), careerId: 'other-career' };
    f.db.prepare("INSERT INTO world_roster_heads VALUES ('other-career',?,?)").run(original.revision, json(roster));
    // Same Player/Person IDs in another Career are independent ownership scopes.
    const other = { ...f.person, sourceId: 'other-intake', careerId: 'other-career' };
    f.db.prepare('INSERT INTO world_player_person_links VALUES (?,?,?,?,?,?,?)')
      .run(other.sourceId, other.careerId, other.playerId, other.personId, other.rosterRevision, other.acceptedAtDay, json(other));
    const teammate = { ...f.person, sourceId: 'teammate-intake', playerId: 'player-b', personId: 'person-b' };
    f.db.prepare('INSERT INTO world_player_person_links VALUES (?,?,?,?,?,?,?)')
      .run(teammate.sourceId, teammate.careerId, teammate.playerId, teammate.personId, teammate.rosterRevision, teammate.acceptedAtDay, json(teammate));
    const people = f.db.prepare('SELECT * FROM world_player_person_links ORDER BY source_id').all();
    const rosters = f.db.prepare('SELECT * FROM world_roster_heads ORDER BY career_id').all();
    const value = f.store.accept('policy-a'); expect(f.store.read('policy-a')).toEqual(value); expect(f.store.accept('policy-a')).toEqual(value);
    expect(f.db.prepare('SELECT * FROM world_player_person_links ORDER BY source_id').all()).toEqual(people);
    expect(f.db.prepare('SELECT * FROM world_roster_heads ORDER BY career_id').all()).toEqual(rosters);
    expect(f.rows()).toHaveLength(1);
  } finally { f.close(); }
});
