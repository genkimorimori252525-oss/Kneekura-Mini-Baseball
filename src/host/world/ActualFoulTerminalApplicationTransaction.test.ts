import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setImmediate as yieldForReporter } from 'node:timers/promises';
import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import { expect, it } from 'vitest';
import type { AcceptedFoulOfficialEvent } from './ActualFoulOfficial';
import type { FoulOfficialScope } from './ActualFoulOfficialOwnership';
import type { AcceptedFoulTerminalApplication, FoulTerminalApplicationPending,
  FoulTerminalApplicationProposal } from './ActualFoulTerminalApplication';
import { genuineTerminalFixture, terminalFixtureCompatibility, type GenuineTerminalFixture }
  from './ActualFoulTerminalApplicationFixtures.test-support';

type Queue = Readonly<{ source: AcceptedFoulTerminalApplication; proposal: FoulTerminalApplicationProposal;
  status: 'QUEUED'; officialApplied: false; result: null }>;
type QueueStore = Readonly<{ enqueue(sourceId: string): Queue | FoulTerminalApplicationPending;
  read(sourceId: string): Queue | null; close(): void }>;
type OpenQueue = (path: string, authority?: Readonly<{ readAcceptedApplication(sourceId: string): unknown }>) => QueueStore;
type Claims = (db: DatabaseSync, scope: Readonly<{ official: FoulOfficialScope }>) => readonly unknown[];
const requireQueue = async (): Promise<OpenQueue> => {
  const moduleId = './SqliteActualFoulTerminalApplicationStore';
  const module: { openSqliteActualFoulTerminalApplicationStore?: OpenQueue } =
    existsSync(new URL('./SqliteActualFoulTerminalApplicationStore.ts', import.meta.url))
      ? await import(/* @vite-ignore */ moduleId) : {};
  expect(typeof module.openSqliteActualFoulTerminalApplicationStore,
    'Q11B_QUEUE_PRODUCER_PREREQUISITE_MISSING').toBe('function');
  return module.openSqliteActualFoulTerminalApplicationStore!;
};
const requireClaims = async (): Promise<Claims> => {
  const moduleId = './ActualFoulTerminalApplicationOwnership';
  const module: { foulTerminalApplicationClaims?: Claims } =
    existsSync(new URL('./ActualFoulTerminalApplicationOwnership.ts', import.meta.url))
      ? await import(/* @vite-ignore */ moduleId) : {};
  expect(typeof module.foulTerminalApplicationClaims, 'Q11B_RAW_CENSUS_PREREQUISITE_MISSING').toBe('function');
  return module.foulTerminalApplicationClaims!;
};
const sqlText = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const foreign = (value: unknown, key = ''): unknown => {
  if (typeof value === 'string') return 'unrelated:' + value;
  if (typeof value === 'number' && ['playId', 'previousPlayId'].includes(key)) return value + 10_000;
  if (Array.isArray(value)) return value.map(item => foreign(item, key));
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, foreign(item, name)]));
  return value;
};
const schemaState = (db: DatabaseSync) => ({
  userVersion: db.prepare('PRAGMA main.user_version').get()!.user_version,
  mainVersion: db.prepare('PRAGMA main.schema_version').get()!.schema_version,
  tempVersion: db.prepare('PRAGMA temp.schema_version').get()!.schema_version,
  main: db.prepare('SELECT type,name,tbl_name,rootpage,sql FROM main.sqlite_master ORDER BY type,name').all(),
  temp: db.prepare('SELECT type,name,tbl_name,rootpage,sql FROM temp.sqlite_master ORDER BY type,name').all(),
  queryOnly: db.prepare('PRAGMA query_only').get()!.query_only,
  transaction: db.isTransaction,
});
const queueColumns = ['source_id', 'game_id', 'play_id', 'application_id', 'physical_pitch_source_id', 'physical_end_source_id',
  'official_obligation_key', 'status', 'source_json', 'source_hash', 'proposal_json', 'proposal_hash', 'result_json'] as const;
const restoreRow = (db: DatabaseSync, row: Record<string, SQLOutputValue>, currentId: string) => {
  const result = db.prepare('UPDATE main.actual_foul_terminal_applications SET ' + queueColumns.map(key => key + '=?').join(',') + ' WHERE source_id=?')
    .run(...queueColumns.map(key => row[key]), currentId);
  expect(result.changes).toBe(1);
};

it('Q11b rejects an event-INSERT sole raw terminal-session claim and rolls back event head and trigger mutation', async () => {
  terminalFixtureCompatibility();
  const directory = mkdtempSync(join(tmpdir(), 'terminal-queue-q11b-')), path = join(directory, 'original.sqlite');
  let f: GenuineTerminalFixture | undefined;
  try {
    f = await genuineTerminalFixture(path, 'bunt');
    const { actualFoulTerminalApplicationInput } = await import('./ActualFoulTerminalApplication');
    const { deriveFoulTerminalApplicationProposal } = await import('./ActualFoulTerminalApplicationEvidenceFromSqlite');
    const { foulOfficialEvidenceFromSqlite } = await import('./ActualFoulOfficialEvidenceFromSqlite');
    const { foulEndLogicalBytes } = await import('./ActualFoulPlayEndFixtures.test-support');
    const { witnessSqliteWrite } = await import('./SqliteWriteWitness.test-support');
    const db = f.x.f.db, source = actualFoulTerminalApplicationInput(f.terminalSource(), f.terminalSource().sourceId);
    const proposal = deriveFoulTerminalApplicationProposal(db, source, 'current');
    expect(proposal.kind).toBe('terminal_non_live_projected');
    expect(f.fenced.value.handoff).toBeNull();
    const open = await requireQueue(), store = f.x.f.track(open(path, { readAcceptedApplication: id => id === source.sourceId ? source : null }));
    const original = foulEndLogicalBytes(db, ['actual_foul_terminal_applications']), version = schemaState(db).userVersion;
    const queued = store.enqueue(source.sourceId);
    expect(queued).toEqual({ source, proposal, status: 'QUEUED', officialApplied: false, result: null });
    expect(foulEndLogicalBytes(db, ['actual_foul_terminal_applications'])).toBe(original);
    expect(schemaState(db).userVersion).toBe(version);
    const root = foulOfficialEvidenceFromSqlite(db).session(f.session.sourceId);
    expect(root).not.toBeNull();
    const claims = await requireClaims(), scope = { official: root!.scope };
    expect(claims(db, scope)).toHaveLength(1);
    const saved = db.prepare('SELECT * FROM main.actual_foul_terminal_applications WHERE source_id=?').get(source.sourceId)!;
    expect(Object.keys(saved).sort()).toEqual([...queueColumns].sort());
    const unrelated = { ...saved };
    for (const key of ['source_id', 'game_id', 'application_id', 'physical_pitch_source_id', 'physical_end_source_id', 'official_obligation_key'] as const) {
      unrelated[key] = 'unrelated:' + String(saved[key]);
    }
    unrelated.play_id = Number(saved.play_id) + 10_000;
    const unrelatedSource = foreign(JSON.parse(String(saved.source_json))) as Record<string, unknown>;
    const unrelatedProposal = foreign(JSON.parse(String(saved.proposal_json)));
    unrelated.source_json = f.json(unrelatedSource); unrelated.source_hash = f.hash(unrelatedSource);
    unrelated.proposal_json = f.json(unrelatedProposal); unrelated.proposal_hash = f.hash(unrelatedProposal);
    expect(unrelated.status).toBe('QUEUED'); expect(unrelated.result_json).toBeNull();
    const foreignId = String(unrelated.source_id);
    let changed = false, triggerInstalled = false;
    try {
      // UPDATE the one genuine row in an autocommit corruption setup. A fixture
      // SAVEPOINT here would prevent the separate official writer from reaching
      // its INSERT and would turn this into a lock test.
      expect(db.isTransaction).toBe(false);
      restoreRow(db, unrelated, source.sourceId); changed = true;
      expect(db.isTransaction).toBe(false); expect(claims(db, scope)).toEqual([]);
      expect(db.prepare('SELECT * FROM main.actual_foul_terminal_applications').all()).toEqual([unrelated]);
      const probe: AcceptedFoulOfficialEvent = { sourceId: 'terminal-event-trigger-probe', sourceVersion: 'contract-v1',
        capability: 'actual_post_play_foul_official_event_v1', sessionSourceId: f.session.sourceId,
        expectedRevision: f.fenced.value.revision, parent: { sourceId: f.fenced.value.headSourceId, snapshotHash: f.fenced.value.headHash },
        action: { kind: 'advance_tick', schedulerId: f.session.assignment.schedulerId } };
      f.sources.events.set(probe.sourceId, probe);
      const injectedSource = { ...unrelatedSource,
        officialReference: { ...(unrelatedSource.officialReference as Record<string, unknown>), sessionSourceId: f.session.sourceId } };
      const injectedJson = f.json(injectedSource), injectedHash = f.hash(injectedSource);
      db.exec('CREATE TRIGGER main.terminal_event_raw_queue_claim AFTER INSERT ON actual_foul_official_events WHEN NEW.source_id=' + sqlText(probe.sourceId)
        + ' BEGIN UPDATE actual_foul_terminal_applications SET source_json=' + sqlText(injectedJson) + ',source_hash=' + sqlText(injectedHash)
        + ' WHERE source_id=' + sqlText(foreignId) + '; END');
      triggerInstalled = true;
      const before = f.bytes(), schema = schemaState(db);
      const originalHead = db.prepare('SELECT * FROM main.actual_foul_official_heads WHERE session_source_id=?').get(f.session.sourceId);
      let writer: DatabaseSync | undefined;
      const witness = witnessSqliteWrite(/^(?:INSERT INTO main\.actual_foul_official_events\b|UPDATE main\.actual_foul_official_heads\b)/, connection => {
        writer = connection;
        const event = connection.prepare('SELECT * FROM main.actual_foul_official_events WHERE source_id=?').get(probe.sourceId);
        const head = connection.prepare('SELECT * FROM main.actual_foul_official_heads WHERE session_source_id=?').get(probe.sessionSourceId);
        const row = connection.prepare('SELECT * FROM main.actual_foul_terminal_applications WHERE source_id=?').get(foreignId);
        return event !== undefined && row !== undefined && head?.head_source_id === probe.sourceId && head.revision === probe.expectedRevision + 1
          && f!.json(row) === f!.json({ ...unrelated, source_json: injectedJson, source_hash: injectedHash });
      });
      try {
        // The exact census error discriminates against the pre-existing generic
        // total_changes guard, which also notices the extra trigger UPDATE.
        let rejection: unknown;
        try { f.official.acceptEvent(probe.sourceId); }
        catch (error) { rejection = error; }
        expect(witness.wasReached()).toBe(true);
        expect(rejection).toBeInstanceOf(Error);
        expect((rejection as Error).message).toBe('foul official terminal ownership changed during write');
        expect(writer!.isTransaction).toBe(false);
        expect(writer!.prepare('PRAGMA query_only').get()!.query_only).toBe(0);
        expect(f.bytes()).toBe(before); expect(schemaState(db)).toEqual(schema);
        expect(db.prepare('SELECT * FROM main.actual_foul_official_events WHERE source_id=?').get(probe.sourceId)).toBeUndefined();
        expect(db.prepare('SELECT * FROM main.actual_foul_official_heads WHERE session_source_id=?').get(f.session.sourceId)).toEqual(originalHead);
        expect(db.prepare('SELECT * FROM main.actual_foul_terminal_applications').all()).toEqual([unrelated]);
        expect(db.prepare('SELECT * FROM main.actual_foul_official_handoffs').all()).toEqual([]);
        expect(claims(db, scope)).toEqual([]);
      } finally { witness.close(); }
      await yieldForReporter();
    } finally {
      try { if (triggerInstalled) db.exec('DROP TRIGGER main.terminal_event_raw_queue_claim'); }
      finally { if (changed) restoreRow(db, saved, foreignId); }
    }
    // Cleanup restores only our corrupted queue row; the trigger transaction
    // itself must have restored the foreign pre-attempt row, as asserted above.
    expect(store.read(source.sourceId)).toEqual(queued);
    expect(f.official.acceptEvent(f.fenced.source.sourceId)).toEqual(f.fenced.value);
    const restored = f.bytes();
    expect(() => f!.official.acceptEvent('terminal-event-trigger-probe')).toThrow(/terminal.*ownership|terminal.*claim|queued/i);
    expect(f.bytes()).toBe(restored);
    expect(foulEndLogicalBytes(db, ['actual_foul_terminal_applications'])).toBe(original);
    await yieldForReporter();
  } finally {
    try { f?.x.f.close(); }
    finally { rmSync(directory, { recursive: true, force: true }); }
  }
}, 1_200_000);

// This separate group is metadata-only. Its in-memory Match rows are not
// Native queue producers, accepted applications, physical fixtures or receipts.
import { createRequire } from 'node:module';
import { terminalFixtureManifest } from './ActualFoulTerminalApplicationFixtures.test-support';
import { afterEach, beforeEach, describe } from 'vitest';
import { createCanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import type { NextLiveBallPlayActivation } from '../../core/adjudication/NextPlayActivation';
import { officialApplicationOwnershipClaims, officialMatchActivationClaims } from '../OfficialApplicationOwnershipFromSqlite';
import type { FoulTerminalApplicationScope } from './ActualFoulTerminalApplicationOwnership';

const legacyScope: FoulTerminalApplicationScope = {
  official: { sourceId:'legacy-session',gameId:'legacy-original-game',playId:7,physicalPitchSourceId:'legacy-pitch',
    physicalEndSourceId:'legacy-end',consumptionSourceId:'legacy-count',officialObligationKey:'legacy-child',originalSuccessorKey:'legacy-successor' },
  applicationSourceId:'legacy-terminal-source',applicationId:'legacy-independent-application',closureId:'legacy-terminal-source',
};
const legacyActivation = (previousPlayId: number, applicationId = 'unrelated-application', closureId = 'unrelated-closure'): NextLiveBallPlayActivation => {
  const nextMatchState = { ...terminalFixtureManifest.match,playId:previousPlayId+1,outs:1 };
  return { applicationId,closureId,previousPlayId,durableRevision:1,nextMatchState,
    nextTimeline:createCanonicalPlateAppearanceTimeline(nextMatchState,100) };
};
const legacyEncodings = ['plain','escaped_key','duplicate_root','escaped_duplicate_middle'] as const;
type LegacyEncoding = typeof legacyEncodings[number];
const legacyRootDocument = (activation: NextLiveBallPlayActivation, key: 'applicationId'|'closureId', target: string,
  encoding: LegacyEncoding): string => {
  const rest = Object.fromEntries(Object.entries(activation).filter(([name]) => name !== key));
  const plainKey = JSON.stringify(key), escapedKey = '"'+key.replace('I','\\u0049')+'"';
  const field = (name: string, value: string) => name+':'+JSON.stringify(value);
  const claim = encoding === 'plain' ? field(plainKey,target) : encoding === 'escaped_key' ? field(escapedKey,target)
    : field(plainKey,activation[key])+','+field(encoding === 'duplicate_root' ? plainKey : escapedKey,target)+','+field(plainKey,activation[key]);
  return '{'+claim+','+JSON.stringify(rest).slice(1);
};

describe('metadata-only bare legacy Match activation ownership', () => {
  let db: DatabaseSync;
  beforeEach(() => {
    const { DatabaseSync: NativeDatabase } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    db = new NativeDatabase(':memory:');
    db.exec(`CREATE TABLE main.matches(match_id TEXT PRIMARY KEY,durable_revision INTEGER NOT NULL,
      state_json TEXT NOT NULL,activation_json TEXT)`);
    db.prepare('INSERT INTO main.matches VALUES(?,?,?,?)').run(legacyScope.official.gameId,0,JSON.stringify(terminalFixtureManifest.match),null);
  });
  afterEach(() => db?.close());
  const row = (gameId: string) => db.prepare('SELECT * FROM main.matches WHERE match_id=?').get(gameId)!;
  const put = (gameId: string, activation: NextLiveBallPlayActivation, document = JSON.stringify(activation)) => {
    db.prepare('INSERT OR REPLACE INTO main.matches VALUES(?,?,?,?)').run(gameId,activation.durableRevision,
      JSON.stringify(activation.nextMatchState),document);
    expect(row(gameId).activation_json).toBe(document);
  };
  const state = () => ({ rows:db.prepare('SELECT * FROM main.matches ORDER BY match_id').all(),
    schema:db.prepare('SELECT type,name,sql FROM main.sqlite_master ORDER BY type,name').all(),
    mainVersion:db.prepare('PRAGMA main.schema_version').get()!.schema_version,
    tempVersion:db.prepare('PRAGMA temp.schema_version').get()!.schema_version,
    userVersion:db.prepare('PRAGMA main.user_version').get()!.user_version,
    changes:db.prepare('SELECT total_changes() AS n').get()!.n,queryOnly:db.prepare('PRAGMA query_only').get()!.query_only,
    transaction:db.isTransaction });
  const observe = (gameId: string) => {
    const before = state();
    try {
      return { selected:officialApplicationOwnershipClaims(db,legacyScope).map(claim => [claim.table,String(claim.row.match_id)].join(':')).sort(),
        activationClaim:officialMatchActivationClaims(db,row(gameId),legacyScope) };
    } finally { expect(state()).toEqual(before); }
  };
  const baseline = 'matches:'+legacyScope.official.gameId;
  const mirrorCases = (['applicationId','closureId'] as const).flatMap(key => legacyEncodings.map(encoding => ({ key,encoding })));

  it.each(mirrorCases)('discovers sole bare $key through $encoding with foreign cached Match identity', ({ key,encoding }) => {
    const gameId = 'legacy-foreign-game', activation = legacyActivation(40);
    const target = key === 'applicationId' ? legacyScope.applicationId! : legacyScope.closureId!;
    expect(legacyScope.applicationId).not.toBe(legacyScope.applicationSourceId);
    const unrelated = legacyRootDocument(activation,key,activation[key],encoding);
    put(gameId,activation,unrelated);
    // Every hostile encoding first proves an equally structured unrelated row.
    expect(JSON.parse(unrelated)).toEqual(activation);
    expect(observe(gameId)).toEqual({ selected:[baseline],activationClaim:false });
    const related = legacyRootDocument(activation,key,target,encoding);
    put(gameId,activation,related);
    if (encoding === 'duplicate_root' || encoding === 'escaped_duplicate_middle') {
      // Ordinary JSON.parse loses the middle identity; the raw census must not.
      expect(JSON.parse(related)[key]).toBe(activation[key]);
    } else expect(JSON.parse(related)[key]).toBe(target);
    expect(observe(gameId),'BARE_LEGACY_ACTIVATION_IDENTITY_MIRROR_MISSING')
      .toEqual({ selected:[baseline,'matches:'+gameId].sort(),activationClaim:true });
  });

  it('discovers bare previousPlayId only when paired with the original cached Match game', () => {
    const gameId = legacyScope.official.gameId, activation = legacyActivation(legacyScope.official.playId);
    put(gameId,activation);
    expect(activation.applicationId).not.toBe(legacyScope.applicationId);
    expect(activation.closureId).not.toBe(legacyScope.closureId);
    expect(activation.nextMatchState.playId).toBe(8);
    expect(observe(gameId),'BARE_LEGACY_PREVIOUS_PLAY_MIRROR_MISSING').toEqual({ selected:[baseline],activationClaim:true });
  });

  it('ignores the same bare previousPlayId in an unrelated cached Match game', () => {
    const gameId = 'legacy-foreign-game', activation = legacyActivation(legacyScope.official.playId);
    put(gameId,activation);
    expect(observe(gameId)).toEqual({ selected:[baseline],activationClaim:false });
  });

  it('preserves a legitimate bare prior-play activation as original Match baseline', () => {
    const gameId = legacyScope.official.gameId, activation = legacyActivation(legacyScope.official.playId-1);
    put(gameId,activation);
    expect(activation.nextMatchState.playId).toBe(legacyScope.official.playId);
    expect(JSON.parse(String(row(gameId).state_json))).toEqual(activation.nextMatchState);
    expect(row(gameId).durable_revision).toBe(activation.durableRevision);
    expect(activation.nextTimeline.playId).toBe(activation.nextMatchState.playId);
    expect(observe(gameId)).toEqual({ selected:[baseline],activationClaim:false });
  });

  it('does not mistake an unrelated nextMatchState playId for the consumed original play', () => {
    const gameId = 'legacy-foreign-game', activation = legacyActivation(legacyScope.official.playId-1);
    put(gameId,activation);
    expect(activation.nextMatchState.playId).toBe(legacyScope.official.playId);
    expect(observe(gameId)).toEqual({ selected:[baseline],activationClaim:false });
  });
});
