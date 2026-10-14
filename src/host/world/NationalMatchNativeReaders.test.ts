import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { nationalCallupFixture } from './NationalCallupFixtures.test-support';
import { worldCompetitionCycleEvidenceFromSqlite } from './SqliteWorldCompetitionCycleStore';
import { nationalCompetitionSelectionEvidenceFromSqlite } from './SqliteNationalCompetitionSelectionStore';
import { nationCompetitionRegionEvidenceFromSqlite } from './SqliteNationCompetitionRegionStore';
import { nationalEligibilityFactEvidenceFromSqlite } from './SqliteNationalEligibilityFactStore';
import { playerPersonLinkEvidenceFromSqlite } from './SqlitePlayerPersonLinkStore';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
it('reuses original National source replay on the consuming Native connection without DDL or peer reads', () => {
  const f = nationalCallupFixture(), db = new DatabaseSync(f.path);
  try {
    const schema = db.prepare('SELECT * FROM sqlite_master ORDER BY name').all();
    db.exec('BEGIN');
    const cycle = worldCompetitionCycleEvidenceFromSqlite(db);
    const selections = nationalCompetitionSelectionEvidenceFromSqlite(db, { cycle });
    const nations = nationCompetitionRegionEvidenceFromSqlite(db);
    const facts = nationalEligibilityFactEvidenceFromSqlite(db, { nations, personLinks: playerPersonLinkEvidenceFromSqlite(db) });
    expect(selections.readSelection('career-a', 'wbc-2032')).toEqual(f.selections.readSelection('career-a', 'wbc-2032'));
    expect(nations.readRegion('career-a', 'JP', 10)).toBe('ASIA_PACIFIC');
    expect(facts.readFacts('career-a', 'p0', 420)).toEqual(f.facts.readFacts('career-a', 'p0', 420));
    db.prepare("UPDATE world_nation_competition_regions SET chain_hash='changed' WHERE nation_id='JP'").run();
    expect(() => facts.readFacts('career-a', 'p0', 420)).toThrow('corrupt national eligibility');
    db.exec('ROLLBACK');
    expect(db.prepare('SELECT * FROM sqlite_master ORDER BY name').all()).toEqual(schema);
  } finally { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); f.close(); }
});
