import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';
import type { TraitScope, TraitTime } from '../../core/world/traits/TraitTypes';
import type { ContactObservation } from '../../core/world/traits/classifiers/MeasuredTraitTypes';
import type { TraitSourceSnapshot } from '../../core/world/traits/sources/SourceTraitTypes';
import { worldCalendarDateAtDay } from '../../core/world/competition/WorldCalendarDate';
import { readNativeBattingContactInventoryV188FromSqlite, hashNativeBattingContactInventoryV188, type NativeBattingContactInventoryV188 } from './NativeBattingContactInventoryV188';
import { readNativeMeasuredContactCalendarV186FromSqlite, type NativeContactCalendarBindingV186 } from './NativeMeasuredContactCalendarV186';
import type { NativeMeasuredBattingContactCollectionV185, NativeMeasuredContactReferenceV185 } from './NativeMeasuredBattingContactCollectionV185';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaHash, samePaReferenceValid, samePaText } from './SamePlateAppearanceWorkPrefix';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';

const VERSION = 'native-batting-contact-observation-v188', GENESIS = '0'.repeat(64);
export const nativeBattingContactObservationTablesV188 = Object.freeze({
  journal: 'world_native_batting_contact_observations_v188', head: 'world_native_batting_contact_observation_heads_v188',
});
const { journal, head } = nativeBattingContactObservationTablesV188;
const schemas = {
  [journal]: `CREATE TABLE ${journal}(career_id TEXT NOT NULL,player_id TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>=1),owner TEXT NOT NULL,source_id TEXT NOT NULL,receipt_json TEXT NOT NULL,receipt_hash TEXT NOT NULL,PRIMARY KEY(career_id,player_id,revision),UNIQUE(owner,source_id))`,
  [head]: `CREATE TABLE ${head}(career_id TEXT NOT NULL,player_id TEXT NOT NULL,career_day_one TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>=1),last_receipt_hash TEXT NOT NULL,capture_json TEXT,capture_hash TEXT,PRIMARY KEY(career_id,player_id),CHECK((capture_json IS NULL)=(capture_hash IS NULL)))`,
};
type EpisodeScope = Readonly<{ gameId: string; playId: number }>;
export type NativeBattingContactObservationReceiptV188 = Readonly<{
  kind: 'native_batting_contact_observation_v188'; version: typeof VERSION; scope: TraitScope; reference: NativeMeasuredContactReferenceV185;
  careerCalendarEditionId: string; careerDayOne: string; calendarDateISO: string; episodeScope: EpisodeScope;
  eventId: string; episodeId: string; revision: number; time: TraitTime; calendarHash: string; measurementBitHash: string;
  previousHash: string; receiptHash: string;
}>;
export type NativeBattingContactCaptureCoverageV188 = Readonly<{
  kind: 'supported_native_contact_inventory_capture_v188'; scope: TraitScope; inventoryHash: string;
  references: readonly NativeMeasuredContactReferenceV185[]; producerAvailability: NativeBattingContactInventoryV188['producerAvailability'];
  capturedAtRevision: number; receiptHashAtCapture: string;
}>;
type Contact = NativeMeasuredBattingContactCollectionV185['contacts'][number];
type ResolvedCalendar = Extract<NativeContactCalendarBindingV186, { status: 'RESOLVED_DATE' }>;
export type NativeBattingContactObservationSnapshotV188 = Readonly<{
  boundary: 'NATIVE_REGISTERED_CONTACT_SNAPSHOT_ONLY'; populationCoverage: 'REGISTERED_NATIVE_CONTACTS_ONLY' | 'SUPPORTED_NATIVE_INVENTORY_AT_CAPTURE';
  scope: TraitScope; receipts: readonly NativeBattingContactObservationReceiptV188[];
  measurements: readonly (Contact & Readonly<{ calendar: ResolvedCalendar; receiptHash: string }>)[];
  observations: readonly ContactObservation[]; source: TraitSourceSnapshot; time: TraitTime;
  captureCoverage: NativeBattingContactCaptureCoverageV188 | null;
  sequenceSemantics: 'OWNER_ACCEPTANCE_ORDER_WITHIN_CAREER_DAY'; timeSemantics: 'LATEST_REGISTERED_CONTACT_NOT_CURRENT_TIME';
  inventoryFreshness: 'NOT_RECHECKED_SINCE_CAPTURE'; classification: null;
}>;
export type NativeBattingContactObserveInputV188 = Readonly<{ scope: TraitScope; reference: NativeMeasuredContactReferenceV185; careerCalendarEditionId?: string }>;
export type NativeBattingContactObservationStoreV188 = Readonly<{
  observe(input: NativeBattingContactObserveInputV188): NativeBattingContactObservationReceiptV188;
  capture(scope: TraitScope, options?: Readonly<{ careerCalendarEditionId?: string }>): NativeBattingContactObservationSnapshotV188 | null;
  readSnapshot(scope: TraitScope): NativeBattingContactObservationSnapshotV188 | null; close(): void;
}>;
type HeadRow = { career_id: string; player_id: string; career_day_one: string; revision: number; last_receipt_hash: string; capture_json: string | null; capture_hash: string | null };
type JournalRow = { career_id: string; player_id: string; revision: number; owner: string; source_id: string; receipt_json: string; receipt_hash: string };
type Metadata = { head: HeadRow | null; receipts: NativeBattingContactObservationReceiptV188[]; coverage: NativeBattingContactCaptureCoverageV188 | null };
type Fact = { contact: Contact; calendar: ResolvedCalendar; editionId: string; dayOne: string; date: string; year: number; day: number;
  calendarHash: string; bitHash: string; episodeScope: EpisodeScope; eventId: string; episodeId: string };
const owners = ['physical_pitch_progress_actions', 'pa_physical_v1_resolutions', 'pa_initial_joint_v1_executions'] as const;
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error('Native contact observation: ' + message); }
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const validRef = (value: unknown): value is NativeMeasuredContactReferenceV185 => owners.some(owner => samePaReferenceValid(value, owner));
const identity = (ref: NativeMeasuredContactReferenceV185) => JSON.stringify([ref.owner, ref.sourceId]);
const sameRef = (a: NativeMeasuredContactReferenceV185, b: NativeMeasuredContactReferenceV185) =>
  a.owner === b.owner && a.sourceId === b.sourceId && a.sourceHash === b.sourceHash && a.snapshotHash === b.snapshotHash;
const eventId = (ref: NativeMeasuredContactReferenceV185) => JSON.stringify([VERSION, 'event', ref.owner, ref.sourceId]);
const episodeId = (scope: TraitScope, episode: EpisodeScope) => JSON.stringify([VERSION, 'plate-appearance', scope.careerId, scope.playerId, episode.gameId, episode.playId]);
const readScope = (raw: TraitScope): TraitScope => {
  const scope = cloneInert(raw); assert(fields(scope, ['careerId', 'playerId']) && samePaText(scope.careerId) && samePaText(scope.playerId), 'invalid subject scope'); return scope;
};
const bitHash = (velocity: Vec3, spin: Vec3): string => {
  const values = [velocity.x, velocity.y, velocity.z, spin.x, spin.y, spin.z], bytes = Buffer.alloc(48);
  values.forEach((value, index) => { assert(Number.isFinite(value), 'nonfinite Native measurement'); bytes.writeDoubleBE(value, index * 8); });
  return createHash('sha256').update(bytes).digest('hex');
};
const schemaRows = (db: DatabaseSync) => db.prepare('SELECT type,name,tbl_name,sql FROM main.sqlite_master WHERE tbl_name IN (?,?) OR name IN (?,?)').all(journal, head, journal, head);
const assertStorage = (db: DatabaseSync): void => {
  const rows = schemaRows(db), expected = new Set([journal, head, `sqlite_autoindex_${journal}_1`, `sqlite_autoindex_${journal}_2`, `sqlite_autoindex_${head}_1`]);
  assert(rows.length === expected.size && rows.every(row => expected.has(String(row.name))), 'partial or extended journal schema');
  for (const [name, sql] of Object.entries(schemas)) assert(rows.some(row => row.name === name && row.type === 'table' && row.sql === sql), 'journal schema differs');
  assert(rows.filter(row => row.type === 'index').every(row => row.sql === null), 'journal index differs');
};
const loadMetadata = (db: DatabaseSync, scope: TraitScope): Metadata => {
  assertStorage(db);
  const rows = db.prepare(`SELECT * FROM main.${journal} WHERE career_id=? AND player_id=? ORDER BY revision`).all(scope.careerId, scope.playerId) as JournalRow[];
  const current = db.prepare(`SELECT * FROM main.${head} WHERE career_id=? AND player_id=?`).get(scope.careerId, scope.playerId) as HeadRow | undefined;
  assert(Boolean(rows.length) === Boolean(current), 'journal/head history is missing');
  if (!current) return { head: null, receipts: [], coverage: null };
  assert(current.career_id === scope.careerId && current.player_id === scope.playerId && current.revision === rows.length, 'journal head revision differs');
  const receipts: NativeBattingContactObservationReceiptV188[] = [], counts = new Map<number, number>(), references = new Map<string, NativeBattingContactObservationReceiptV188>();
  let previousHash = GENESIS;
  for (const [index, row] of rows.entries()) {
    const receipt = JSON.parse(row.receipt_json) as NativeBattingContactObservationReceiptV188;
    assert(fields(receipt, ['kind', 'version', 'scope', 'reference', 'careerCalendarEditionId', 'careerDayOne', 'calendarDateISO', 'episodeScope', 'eventId',
      'episodeId', 'revision', 'time', 'calendarHash', 'measurementBitHash', 'previousHash', 'receiptHash']), 'invalid receipt metadata');
    assert(receipt.kind === 'native_batting_contact_observation_v188' && receipt.version === VERSION && fields(receipt.scope, ['careerId', 'playerId'])
      && receipt.scope.careerId === scope.careerId && receipt.scope.playerId === scope.playerId && validRef(receipt.reference)
      && samePaText(receipt.careerCalendarEditionId) && samePaText(receipt.careerDayOne) && receipt.careerDayOne === current.career_day_one, 'receipt subject/reference/epoch differs');
    assert(fields(receipt.time, ['season', 'day', 'sequence']) && integer(receipt.time.day) && integer(receipt.time.sequence) && integer(receipt.time.season)
      && fields(receipt.episodeScope, ['gameId', 'playId']) && samePaText(receipt.episodeScope.gameId) && integer(receipt.episodeScope.playId), 'invalid receipt time or episode');
    assert(receipt.calendarDateISO === worldCalendarDateAtDay(receipt.careerDayOne, receipt.time.day)
      && receipt.time.season === Number(receipt.calendarDateISO.slice(0, 4)) && receipt.time.sequence === (counts.get(receipt.time.day) ?? 0), 'receipt calendar/acceptance sequence differs');
    assert(row.career_id === scope.careerId && row.player_id === scope.playerId && row.revision === index + 1 && receipt.revision === index + 1
      && row.owner === receipt.reference.owner && row.source_id === receipt.reference.sourceId && receipt.previousHash === previousHash
      && receipt.eventId === eventId(receipt.reference) && receipt.episodeId === episodeId(scope, receipt.episodeScope), 'receipt chain/scope differs');
    const { receiptHash, ...body } = receipt;
    assert([receiptHash, receipt.calendarHash, receipt.measurementBitHash].every(samePaHash) && receiptHash === hash(body)
      && row.receipt_hash === receiptHash && row.receipt_json === json(receipt) && !references.has(identity(receipt.reference)), 'receipt hash or uniqueness differs');
    counts.set(receipt.time.day, receipt.time.sequence + 1); references.set(identity(receipt.reference), receipt); receipts.push(receipt); previousHash = receiptHash;
  }
  assert(current.last_receipt_hash === previousHash, 'journal tail hash differs');
  assert((current.capture_json === null) === (current.capture_hash === null), 'partial inventory capture');
  let coverage: NativeBattingContactCaptureCoverageV188 | null = null;
  if (current.capture_json !== null) {
    coverage = JSON.parse(current.capture_json) as NativeBattingContactCaptureCoverageV188;
    assert(fields(coverage, ['kind', 'scope', 'inventoryHash', 'references', 'producerAvailability', 'capturedAtRevision', 'receiptHashAtCapture'])
      && coverage.kind === 'supported_native_contact_inventory_capture_v188' && hash(coverage.scope) === hash(scope)
      && samePaHash(coverage.inventoryHash) && integer(coverage.capturedAtRevision) && coverage.capturedAtRevision > 0 && coverage.capturedAtRevision <= receipts.length
      && coverage.receiptHashAtCapture === receipts[coverage.capturedAtRevision - 1].receiptHash && Array.isArray(coverage.references)
      && fields(coverage.producerAvailability, [...owners]) && Object.values(coverage.producerAvailability).every(value => value === 'PRESENT' || value === 'ABSENT')
      && current.capture_json === json(coverage) && current.capture_hash === hash(coverage), 'inventory capture metadata differs');
    const seen = new Set<string>();
    for (const ref of coverage.references) {
      assert(validRef(ref), 'invalid captured reference'); const key = identity(ref), receipt = references.get(key);
      assert(coverage.producerAvailability[ref.owner] === 'PRESENT', 'capture reference producer is absent');
      assert(!seen.has(key) && receipt && sameRef(receipt.reference, ref) && receipt.revision <= coverage.capturedAtRevision, 'capture reference history differs'); seen.add(key);
    }
    const capturedAtRevision = coverage.capturedAtRevision, capturedReceipts = receipts.filter(receipt => receipt.revision <= capturedAtRevision);
    assert(seen.size === capturedReceipts.length && capturedReceipts.every(receipt => seen.has(identity(receipt.reference))), 'capture reference population omits registered history');
    assert(coverage.inventoryHash === hashNativeBattingContactInventoryV188(scope, coverage.producerAvailability, coverage.references), 'capture inventory hash differs');
  }
  return { head: current, receipts, coverage };
};
const readFacts = (db: DatabaseSync, scope: TraitScope, refs: readonly NativeMeasuredContactReferenceV185[], editionId?: string): Map<string, Fact> => {
  const references: NativeMeasuredContactReferenceV185[] = refs.map(ref => ({ owner: ref.owner, sourceId: ref.sourceId, sourceHash: ref.sourceHash, snapshotHash: ref.snapshotHash }));
  const result = readNativeMeasuredContactCalendarV186FromSqlite(db, { contacts: { scope, references }, ...(editionId === undefined ? {} : { careerCalendarEditionId: editionId }) });
  const facts = new Map<string, Fact>();
  for (const contact of result.collection.contacts) {
    const matched = result.calendars.filter(item => sameRef(item.reference, contact.reference)); assert(matched.length === 1, 'contact calendar binding missing');
    const calendar = matched[0].calendar; assert(calendar.status === 'RESOLVED_DATE', 'formal career calendar is unavailable');
    const dayOne = calendar.careerDayOne, day = calendar.careerDay;
    const actualEdition = calendar.kind === 'NATIONAL' ? calendar.selection.editionId : calendar.careerCalendarSelection?.editionId;
    assert(samePaText(dayOne) && integer(day) && samePaText(actualEdition), 'formal career day/origin/edition is unavailable');
    const binding = contact.evidence.actor.binding, physical = contact.evidence.scope;
    assert(binding.careerId === scope.careerId && binding.playerId === scope.playerId && result.collection.scope.careerId === scope.careerId
      && result.collection.scope.playerId === scope.playerId, 'Native contact subject differs');
    assert(calendar.gameId === binding.gameId && calendar.fixtureEventId === binding.fixtureEventId && physical.gameId === binding.gameId
      && samePaText(physical.gameId) && integer(physical.playId), 'Native contact physical/calendar scope differs');
    assert(worldCalendarDateAtDay(dayOne, day) === calendar.calendarDateISO && calendar.calendarYear === Number(calendar.calendarDateISO.slice(0, 4)), 'formal career date differs');
    const measurementBitHash = bitHash(contact.evidence.contact.exitVelocity, contact.evidence.contact.exitSpin);
    assert(measurementBitHash === bitHash(contact.measurement.exitVelocityMps, contact.measurement.exitSpinRadPerSecond), 'measurement differs from raw Native bits');
    const episodeScope = { gameId: physical.gameId, playId: physical.playId };
    facts.set(identity(contact.reference), { contact, calendar, editionId: actualEdition, dayOne, day, date: calendar.calendarDateISO,
      year: calendar.calendarYear, calendarHash: hash(calendar), bitHash: measurementBitHash, episodeScope, eventId: eventId(contact.reference), episodeId: episodeId(scope, episodeScope) });
  }
  for (const ref of refs) assert(facts.has(identity(ref)) && sameRef(facts.get(identity(ref))!.contact.reference, ref), 'actual Native contact is unavailable or reference differs');
  return facts;
};
const verifyFact = (receipt: NativeBattingContactObservationReceiptV188, fact: Fact, strict: boolean): void => {
  assert(sameRef(receipt.reference, fact.contact.reference) && receipt.eventId === fact.eventId && receipt.episodeId === fact.episodeId
    && receipt.careerDayOne === fact.dayOne && receipt.calendarDateISO === fact.date && receipt.time.day === fact.day && receipt.time.season === fact.year
    && receipt.measurementBitHash === fact.bitHash, 'original contact measurement bits/date/epoch differ');
  if (strict) assert(receipt.careerCalendarEditionId === fact.editionId && receipt.calendarHash === fact.calendarHash, 'original calendar proof hash differs');
};
const snapshot = (scope: TraitScope, meta: Metadata, facts: Map<string, Fact>): NativeBattingContactObservationSnapshotV188 | null => {
  if (!meta.head) return null;
  const measurements: NativeBattingContactObservationSnapshotV188['measurements'][number][] = [], observations: ContactObservation[] = [];
  let time = meta.receipts[0].time;
  for (const receipt of meta.receipts) {
    const fact = facts.get(identity(receipt.reference)); assert(fact, 'registered contact was not reauthenticated'); verifyFact(receipt, fact, true);
    measurements.push({ reference: cloneInert(receipt.reference), evidence: cloneInert(fact.contact.evidence), measurement: cloneInert(fact.contact.measurement), calendar: cloneInert(fact.calendar), receiptHash: receipt.receiptHash });
    observations.push({ scope: cloneInert(scope), episodeId: receipt.episodeId, eventId: receipt.eventId, time: cloneInert(receipt.time), exitVelocityMps: cloneInert(fact.contact.evidence.contact.exitVelocity) });
    if (receipt.time.day > time.day || receipt.time.day === time.day && receipt.time.sequence > time.sequence) time = receipt.time;
  }
  const sourceKey = JSON.stringify([VERSION, scope.careerId, scope.playerId]), source: TraitSourceSnapshot = { careerId: scope.careerId, owner: 'BATTING_CONTACT',
    subjectId: scope.playerId, sourceKey, revision: meta.head.revision,
    snapshotId: JSON.stringify([VERSION, sourceKey, meta.head.revision, meta.head.last_receipt_hash, hash(meta.receipts.map(receipt => receipt.measurementBitHash)), meta.head.capture_hash]), time: cloneInert(time) };
  return freeze({ boundary: 'NATIVE_REGISTERED_CONTACT_SNAPSHOT_ONLY' as const,
    populationCoverage: meta.coverage?.capturedAtRevision === meta.head.revision ? 'SUPPORTED_NATIVE_INVENTORY_AT_CAPTURE' as const : 'REGISTERED_NATIVE_CONTACTS_ONLY' as const,
    scope: cloneInert(scope), receipts: meta.receipts.map(receipt => cloneInert(receipt)), measurements, observations, source, time: cloneInert(time),
    captureCoverage: meta.coverage && cloneInert(meta.coverage), sequenceSemantics: 'OWNER_ACCEPTANCE_ORDER_WITHIN_CAREER_DAY' as const,
    timeSemantics: 'LATEST_REGISTERED_CONTACT_NOT_CURRENT_TIME' as const, inventoryFreshness: 'NOT_RECHECKED_SINCE_CAPTURE' as const, classification: null });
};

const readRegisteredSnapshot = (db: DatabaseSync, scope: TraitScope): NativeBattingContactObservationSnapshotV188 | null => {
  const meta = loadMetadata(db, scope); if (!meta.head) return null;
  const byEdition = new Map<string, NativeMeasuredContactReferenceV185[]>(), facts = new Map<string, Fact>();
  for (const receipt of meta.receipts) { const refs = byEdition.get(receipt.careerCalendarEditionId) ?? []; refs.push(receipt.reference); byEdition.set(receipt.careerCalendarEditionId, refs); }
  for (const [edition, refs] of byEdition) for (const [key, fact] of readFacts(db, scope, refs, edition)) facts.set(key, fact);
  return snapshot(scope, meta, facts);
};

/** Borrow an existing immutable Native snapshot without installing observation
 * storage or taking ownership of the caller's transaction or connection. */
export const readNativeBattingContactObservationSnapshotV189FromSqlite = (
  db: DatabaseSync, rawScope: TraitScope,
): NativeBattingContactObservationSnapshotV188 | null => {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  assert(db instanceof Native, 'borrowed snapshot requires an actual Native connection');
  assert(db.isTransaction && db.prepare('PRAGMA query_only').get()!.query_only === 1, 'borrowed snapshot requires a query-only Native snapshot');
  const scope = readScope(rawScope);
  return withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, () => {
    if (!schemaRows(db).length) return null;
    return readRegisteredSnapshot(db, scope);
  }));
};

/** Append-only observation ownership. Only metadata/binary measurement hashes
 * are archived. Raw vectors always come back through their normal Native owner.
 * Sequence is this owner's acceptance counter, never a global physical order. */
export const openSqliteNativeBattingContactObservationStoreV188 = (path: string): NativeBattingContactObservationStoreV188 => {
  assert(samePaText(path), 'invalid database path'); const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new Native(path); let closed = false;
  try {
    db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000');
    if (!schemaRows(db).length) {
      db.exec('BEGIN IMMEDIATE'); try { db.exec(Object.values(schemas).join(';')); db.exec('COMMIT'); } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
    }
    assertStorage(db);
  } catch (error) { db.close(); throw error; }
  const check = () => assert(!closed, 'owner is closed');
  const transaction = <T>(work: () => T): T => { check(); db.exec('BEGIN IMMEDIATE'); try { const value = work(); db.exec('COMMIT'); return value; } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; } };
  const proof = <T>(read: () => T): T => withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, read));
  const authenticateExisting = (scope: TraitScope, receipt: NativeBattingContactObservationReceiptV188, candidate?: Fact): Fact => {
    const original = candidate?.editionId === receipt.careerCalendarEditionId ? candidate
      : readFacts(db, scope, [receipt.reference], receipt.careerCalendarEditionId).get(identity(receipt.reference))!;
    verifyFact(receipt, original, true); if (candidate) verifyFact(receipt, candidate, false); return original;
  };
  const append = (scope: TraitScope, fact: Fact, meta: Metadata): NativeBattingContactObservationReceiptV188 => {
    const prior = meta.receipts.find(receipt => identity(receipt.reference) === identity(fact.contact.reference));
    if (prior) return prior;
    assert(!meta.head || meta.head.career_day_one === fact.dayOne, 'subject career epoch differs');
    const revision = meta.receipts.length + 1, sequence = meta.receipts.filter(receipt => receipt.time.day === fact.day).length;
    const body = { kind: 'native_batting_contact_observation_v188' as const, version: VERSION, scope, reference: fact.contact.reference,
      careerCalendarEditionId: fact.editionId, careerDayOne: fact.dayOne, calendarDateISO: fact.date, episodeScope: fact.episodeScope,
      eventId: fact.eventId, episodeId: fact.episodeId, revision, time: { season: fact.year, day: fact.day, sequence },
      calendarHash: fact.calendarHash, measurementBitHash: fact.bitHash, previousHash: meta.head?.last_receipt_hash ?? GENESIS };
    const receipt = { ...body, receiptHash: hash(body) };
    db.prepare(`INSERT INTO main.${journal}(career_id,player_id,revision,owner,source_id,receipt_json,receipt_hash) VALUES(?,?,?,?,?,?,?)`)
      .run(scope.careerId, scope.playerId, revision, receipt.reference.owner, receipt.reference.sourceId, json(receipt), receipt.receiptHash);
    if (!meta.head) db.prepare(`INSERT INTO main.${head}(career_id,player_id,career_day_one,revision,last_receipt_hash,capture_json,capture_hash) VALUES(?,?,?,?,?,NULL,NULL)`)
      .run(scope.careerId, scope.playerId, fact.dayOne, revision, receipt.receiptHash);
    else assert(db.prepare(`UPDATE main.${head} SET revision=?,last_receipt_hash=? WHERE career_id=? AND player_id=? AND revision=? AND last_receipt_hash=?`)
      .run(revision, receipt.receiptHash, scope.careerId, scope.playerId, meta.head.revision, meta.head.last_receipt_hash).changes === 1, 'head append differs');
    const updated = loadMetadata(db, scope); Object.assign(meta, updated); return meta.receipts.at(-1)!;
  };
  return Object.freeze({
    observe(raw: NativeBattingContactObserveInputV188) {
      const input = cloneInert(raw), optional = !!input && Object.hasOwn(input, 'careerCalendarEditionId');
      assert(fields(input, ['scope', 'reference', ...(optional ? ['careerCalendarEditionId'] : [])]) && validRef(input.reference)
        && (!optional || samePaText(input.careerCalendarEditionId)), 'invalid observation input'); const scope = readScope(input.scope);
      return transaction(() => {
        const prepared = proof(() => {
          const meta = loadMetadata(db, scope), existing = meta.receipts.find(receipt => identity(receipt.reference) === identity(input.reference));
          if (existing) {
            assert(sameRef(existing.reference, input.reference), 'registered reference hashes differ'); authenticateExisting(scope, existing);
            if (input.careerCalendarEditionId !== undefined && input.careerCalendarEditionId !== existing.careerCalendarEditionId)
              verifyFact(existing, readFacts(db, scope, [input.reference], input.careerCalendarEditionId).get(identity(input.reference))!, false);
            return { meta, existing, fact: null };
          }
          const fact = readFacts(db, scope, [input.reference], input.careerCalendarEditionId).get(identity(input.reference))!;
          assert(!meta.head || meta.head.career_day_one === fact.dayOne, 'subject career epoch differs'); return { meta, existing: null, fact };
        });
        return freeze(cloneInert(prepared.existing ?? append(scope, prepared.fact!, prepared.meta)));
      });
    },
    capture(rawScope: TraitScope, rawOptions: Readonly<{ careerCalendarEditionId?: string }> = {}) {
      const scope = readScope(rawScope), options = cloneInert(rawOptions), optional = Object.hasOwn(options, 'careerCalendarEditionId');
      assert(fields(options, optional ? ['careerCalendarEditionId'] : []) && (!optional || samePaText(options.careerCalendarEditionId)), 'invalid capture options');
      return transaction(() => {
        const prepared = proof(() => {
          const meta = loadMetadata(db, scope), inventory = readNativeBattingContactInventoryV188FromSqlite(db, scope);
          assert(hash(inventory.scope) === hash(scope) && inventory.inventoryHash === hashNativeBattingContactInventoryV188(scope, inventory.producerAvailability, inventory.references), 'capture inventory scope/hash differs');
          assert(inventory.references.every(ref => inventory.producerAvailability[ref.owner] === 'PRESENT'), 'capture inventory reference producer is absent');
          const chosenEdition = options.careerCalendarEditionId ?? meta.receipts[0]?.careerCalendarEditionId;
          const facts = readFacts(db, scope, inventory.references, chosenEdition), originalFacts = new Map(facts);
          for (const receipt of meta.receipts) {
            const candidate = facts.get(identity(receipt.reference)); assert(candidate && sameRef(candidate.contact.reference, receipt.reference), 'inventory omits or changes a registered reference');
            originalFacts.set(identity(receipt.reference), authenticateExisting(scope, receipt, candidate));
          }
          for (const fact of facts.values()) assert(!meta.head || fact.dayOne === meta.head.career_day_one, 'capture career epoch differs');
          return { meta, inventory, facts, originalFacts };
        });
        for (const ref of prepared.inventory.references) append(scope, prepared.facts.get(identity(ref))!, prepared.meta);
        if (!prepared.meta.head) return null;
        const coverage: NativeBattingContactCaptureCoverageV188 = { kind: 'supported_native_contact_inventory_capture_v188', scope,
          inventoryHash: prepared.inventory.inventoryHash, references: prepared.inventory.references, producerAvailability: prepared.inventory.producerAvailability,
          capturedAtRevision: prepared.meta.head.revision, receiptHashAtCapture: prepared.meta.head.last_receipt_hash };
        if (json(coverage) !== prepared.meta.head.capture_json) db.prepare(`UPDATE main.${head} SET capture_json=?,capture_hash=? WHERE career_id=? AND player_id=?`)
          .run(json(coverage), hash(coverage), scope.careerId, scope.playerId);
        const meta = loadMetadata(db, scope); return snapshot(scope, meta, prepared.originalFacts);
      });
    },
    readSnapshot(rawScope: TraitScope) {
      check(); const scope = readScope(rawScope);
      return proof(() => readRegisteredSnapshot(db, scope));
    },
    close() { if (!closed) { closed = true; db.close(); } },
  });
};
