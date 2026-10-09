import { createRequire } from 'node:module';
import { lstatSync, realpathSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { SqliteOfficialStateWriter } from '../SqliteOfficialStateWriter';
import { createSqliteOfficialScoringWriter } from '../SqliteOfficialScoringWriter';
import { physicalStoreTransactionBoundary } from './PhysicalStoreTransactionBoundary';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaText } from './SamePlateAppearanceWorkPrefix';
import { assertSamePaTerminalEndpointStorage } from './SamePlateAppearanceTerminalStorage';
import { samePaTerminalTransitionInput, type SamePaTerminalTransitionRecord } from './SamePlateAppearanceTerminalTransition';
import { deriveSamePaTerminalTransition, readSamePaTransitionArchive, readSamePaTerminalTransitionFromSqlite,
  assertSamePaTransitionEffects, samePaTransitionRow } from './SamePlateAppearanceTerminalTransitionFromSqlite';
import { foulApplicationOwnershipRows } from './ActualFoulTerminalApplicationOwnership';

const same = (a: unknown, b: unknown, detail: string) => { if (json(a) !== json(b)) throw new Error('same-PA transition ' + detail); };
/** One atomic completed transition, using the existing connection-bound
 * official and scoring writers. Storage must already belong to the endpoint. */
export const openSqliteSamePlateAppearanceTerminalTransitionStore = (path: string,
  authority?: Readonly<{ readAcceptedTransition(sourceId: string): unknown }>) => {
  if (!samePaText(path) || !isAbsolute(path) || realpathSync(path) !== path || !lstatSync(path).isFile()
    || authority && typeof authority.readAcceptedTransition !== 'function') throw new Error('invalid same-PA transition owner');
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new Native(path), tx = physicalStoreTransactionBoundary(db, 'same-PA terminal transition');
  const proof = <T>(body: () => T) => withBattedWorldPhysicalReadTraversal(db, body);
  const storage = () => {
    if (!assertSamePaTerminalEndpointStorage(db)) throw new Error('same-PA terminal endpoint storage missing');
    for (const table of ['matches', 'applications', 'official_fixtures', 'official_scoring_applications']) {
      foulApplicationOwnershipRows(db, table, {});
      if (!db.prepare("SELECT 1 FROM main.sqlite_master WHERE type='table' AND name=?").get(table)) throw new Error('same-PA transition existing official storage missing');
    }
  };
  const { official, scoring } = (() => {
    try {
      db.exec('PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
      tx.read(storage);
      return { official: new SqliteOfficialStateWriter(db), scoring: createSqliteOfficialScoringWriter(db) };
    } catch (error) { tx.close(); throw error; }
  })();
  const check = (id: string) => { tx.check(); if (!samePaText(id)) throw new Error('invalid same-PA transition Source identity'); };
  const read = (id: string): SamePaTerminalTransitionRecord | null => {
    check(id); return tx.read(() => {
      storage(); const value = readSamePaTransitionArchive(db, id);
      if (value) readSamePaTerminalTransitionFromSqlite(db, value.source.terminalReference, 'historical');
      return value;
    });
  };
  const counters = () => [db.prepare('SELECT total_changes() n').get()!.n, db.prepare('PRAGMA main.schema_version').get()!.schema_version,
    db.prepare('PRAGMA temp.schema_version').get()!.schema_version, db.prepare('PRAGMA main.user_version').get()!.user_version];
  const complete = (id: string): SamePaTerminalTransitionRecord => {
    check(id); const raw = authority?.readAcceptedTransition(id) ?? null;
    const source = raw === null ? null : samePaTerminalTransitionInput(raw, id), prior = read(id);
    if (prior) { if (source) same(source, prior.source, 'Source frozen differently'); return prior; }
    if (!source) throw new Error('accepted same-PA transition Source missing');
    const candidate = tx.read(() => deriveSamePaTerminalTransition(db, source));
    const before = counters();
    const result = tx.write(() => {
      same(counters(), before, 'transaction acquisition changed rows/schema');
      proof(() => {
        storage(); if (readSamePaTransitionArchive(db, id)) throw new Error('same-PA transition changed before write');
        same(deriveSamePaTerminalTransition(db, source), candidate, 'terminal or settled basis changed before write');
        if (db.prepare('SELECT 1 FROM main.applications WHERE application_id=? OR (match_id=? AND closure_id=?)')
          .get(source.applicationId, candidate.lineage.gameId, candidate.official.receipt.closureId)
          || db.prepare('SELECT 1 FROM main.official_scoring_applications WHERE scoring_application_id=? OR official_application_id=?')
            .get(source.scoringApplicationId, source.applicationId)) throw new Error('same-PA transition has an unowned preexisting official effect');
      });
      const application = candidate.officialApplication;
      // This endpoint family owns closed walk/strikeout outcomes. A live-ball
      // application needs its own scoring evidence and cannot use this arm.
      if (application.kind !== 'non_live') throw new Error('same-PA terminal transition requires its owned non-live scoring arm');
      if ('game' in application) same(official.prepareFinalization(application).write().readResult(), candidate.official, 'normal final result differs');
      else {
        const prepared = official.prepareActivation(application);
        if (prepared.kind !== 'write') throw new Error('same-PA transition unexpected official retry');
        same(prepared.write().readResult(), candidate.official, 'normal activation result differs');
      }
      same(scoring.apply({ scoringApplicationId: source.scoringApplicationId, officialApplication: application }), candidate.scoring, 'normal scoring result differs');
      db.prepare('INSERT INTO main.pa_terminal_v1_transitions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(...Object.values(samePaTransitionRow(candidate)));
      proof(() => {
        same(deriveSamePaTerminalTransition(db, source, candidate, 'current'), candidate, 'basis changed after effects');
        assertSamePaTransitionEffects(db, candidate, 'current');
        if (readSamePaTerminalTransitionFromSqlite(db, source.terminalReference, 'current').kind !== 'completed') throw new Error('same-PA transition completed proof missing');
      });
      same(counters(), [Number(before[0]) + 4, ...before.slice(1)], 'exact four-row write/schema accounting differs');
      return candidate;
    });
    try {
      tx.read(() => { readSamePaTerminalTransitionFromSqlite(db, source.terminalReference, 'current'); same(readSamePaTransitionArchive(db, id), result, 'committed archive differs'); });
      return result;
    }
    catch (error) { tx.close(); throw new Error('same-PA transition committed result unverifiable; owner retired without compensating repair', { cause: error }); }
  };
  return Object.freeze({ complete, read, close: () => tx.close() });
};
