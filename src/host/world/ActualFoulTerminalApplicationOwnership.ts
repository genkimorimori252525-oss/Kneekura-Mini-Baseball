import type { FoulOfficialDb, FoulOfficialRow, FoulOfficialScope } from './ActualFoulOfficialOwnership';
import { foulOfficialClaims, foulOfficialHeads, foulOfficialIntentClaims } from './ActualFoulOfficialOwnership';
import { originalFoulMetadataValues as values, originalFoulReferenceIds as references } from './OriginalFoulOwnershipMetadata';
import { actualLivePlayId as id } from './ActualLivePlayScope';

export type FoulTerminalApplicationScope = Readonly<{
  official: FoulOfficialScope;
  applicationSourceId?: string; applicationId?: string; closureId?: string;
  firstPhysicalPitchSourceId?: string; runtimeSourceId?: string; scopeId?: string;
  selectedHeadSourceId?: string; intentSourceId?: string;
}>;
export const foulTerminalApplicationTable = 'actual_foul_terminal_applications';
const terminalOwner = foulTerminalApplicationTable;
type Path = readonly string[];
type Row = FoulOfficialRow;
type Db = FoulOfficialDb;

/** Raw rows stay raw, including wrong scalar types. Ordering does not parse an
 * archive or turn a discovered claim into evidence of an accepted producer. */
export const foulApplicationOwnershipRowKey = (row: Row): string => JSON.stringify(Object.keys(row).sort().map(key => {
  const value = row[key];
  return [key, value instanceof Uint8Array ? ['blob', Array.from(value)]
    : typeof value === 'bigint' ? ['bigint', value.toString()] : [typeof value, value]];
}));
export const sortFoulApplicationOwnershipRows = (rows: Row[]): Row[] => rows.sort((a, b) => {
  const left = foulApplicationOwnershipRowKey(a), right = foulApplicationOwnershipRowKey(b);
  return left < right ? -1 : left > right ? 1 : 0;
});

/** Optional owners may be absent. Once installed, every declared discovery
 * column must exist with its native type; a missing mirror cannot prove absence.
 * The owner, not this rejection-only reader, authenticates its constraints. */
export const foulApplicationOwnershipRows = (db: Db, table: string, columns: Readonly<Record<string, 'TEXT' | 'INTEGER'>>): Row[] => {
  if (!/^[a-z_]+$/.test(table)) throw new Error('invalid foul application ownership table');
  const schema = db.prepare('SELECT type FROM main.sqlite_master WHERE name=?').all(table);
  if (!schema.length) return [];
  if (schema.length !== 1 || schema[0].type !== 'table') throw new Error('foul application ownership schema differs: ' + table);
  const info = db.prepare('PRAGMA main.table_info(' + table + ')').all();
  if (Object.entries(columns).some(([name, type]) => info.filter(c => c.name === name && c.type === type).length !== 1)) {
    throw new Error('foul application ownership columns differ: ' + table);
  }
  return db.prepare('SELECT * FROM main.' + table).all();
};
const terminalColumns = {
  source_id: 'TEXT', game_id: 'TEXT', play_id: 'INTEGER', application_id: 'TEXT', physical_pitch_source_id: 'TEXT',
  physical_end_source_id: 'TEXT', official_obligation_key: 'TEXT', status: 'TEXT', source_json: 'TEXT', source_hash: 'TEXT',
  proposal_json: 'TEXT', proposal_hash: 'TEXT', result_json: 'TEXT',
} as const;
const rows = (db: Db) => foulApplicationOwnershipRows(db, terminalOwner, terminalColumns);
// A fresh journal guard may prove this validated owner is empty before paying
// for another Native session reconstruction. No result is cached across reads.
export { rows as foulTerminalApplicationRows };
const strings = (items: readonly unknown[]): string[] => items.filter((value): value is string => typeof value === 'string');
const overlaps = (items: readonly unknown[], expected: ReadonlySet<string>): boolean => items.some(value => typeof value === 'string' && expected.has(value));
const add = (target: Set<string>, items: readonly unknown[]): void => { for (const value of items) if (typeof value === 'string') target.add(value); };

/** These are per-census caches of raw metadata only. No cached result survives
 * this ownership read or replaces a new census after a callback or write. */
const metadata = (db: Db, row: Row) => {
  const cache = new Map<string, ReturnType<typeof values>>();
  const document = (column: string) => typeof row[column] === 'string' ? row[column] as string : '';
  const read = (column: string, path: Path, owner?: string) => {
    const key = JSON.stringify([column, path, owner]);
    if (!cache.has(key)) cache.set(key, owner === undefined ? values(db, document(column), path) : references(db, document(column), path, owner));
    return cache.get(key)!;
  };
  return { value: (column: string, path: Path) => read(column, path),
    reference: (column: string, path: Path, owner: string) => read(column, path, owner) };
};
type Metadata = ReturnType<typeof metadata>;
const terminalIds = (row: Row, m: Metadata) => {
  const sourceIds = strings([row.source_id, ...m.value('source_json', ['sourceId']), ...m.value('proposal_json', ['source', 'sourceId']),
    ...m.value('result_json', ['sourceId']), ...m.reference('result_json', ['official', 'pendingPostPlay', 'origin'], terminalOwner),
    ...m.reference('result_json', ['acknowledgement', 'consumer'], terminalOwner)]);
  const applicationIds = strings([row.application_id, ...m.value('source_json', ['applicationId']),
    ...m.value('proposal_json', ['source', 'applicationId']), ...m.value('proposal_json', ['applicationBody', 'applicationId']),
    ...m.value('result_json', ['official', 'receipt', 'applicationId']), ...m.value('result_json', ['official', 'pendingPostPlay', 'applicationId']),
    ...m.value('result_json', ['acknowledgement', 'applicationReference', 'applicationId'])]);
  // This owner's adapted closure ID equals its Source ID. It is deliberately
  // never inferred from applicationId, which belongs to a different domain.
  const closureIds = strings([...sourceIds, ...m.value('proposal_json', ['applicationBody', 'adjudication', 'events', 'closureId']),
    ...m.value('result_json', ['official', 'receipt', 'closureId']), ...m.value('result_json', ['official', 'pendingPostPlay', 'closureId']),
    ...m.value('result_json', ['acknowledgement', 'applicationReference', 'closureId'])]);
  return { sourceIds, applicationIds, closureIds };
};
export const foulTerminalApplicationRawIdentities = (db: Db, row: Row) => terminalIds(row, metadata(db, row));
type Ids = ReturnType<typeof terminalIds>;
const identitySets = (sourceId?: string, applicationId?: string, closureId?: string) => ({
  sourceIds: new Set(sourceId === undefined ? [] : [sourceId]),
  applicationIds: new Set(applicationId === undefined ? [] : [applicationId]),
  closureIds: new Set(strings([sourceId, closureId])),
});
const matchesIds = (found: Ids, known: ReturnType<typeof identitySets>) => overlaps(found.sourceIds, known.sourceIds)
  || overlaps(found.applicationIds, known.applicationIds) || overlaps(found.closureIds, known.closureIds);
const growIds = (known: ReturnType<typeof identitySets>, found: Ids) => {
  add(known.sourceIds, found.sourceIds); add(known.applicationIds, found.applicationIds); add(known.closureIds, found.closureIds);
};

/** Identity discovery precedes parsing. A selected intact row supplies the
 * application/closure edges needed to expose a second raw-only claimant. */
export const foulTerminalApplicationIdentityRows = (db: Db, sourceId: string): Row[] => {
  if (!id(sourceId)) throw new Error('invalid foul terminal application Source identity');
  const all = rows(db).map(row => ({ row, ids: terminalIds(row, metadata(db, row)) }));
  const known = identitySets(sourceId), selected = new Set<Row>();
  for (;;) {
    let changed = false;
    for (const entry of all) if (!selected.has(entry.row) && matchesIds(entry.ids, known)) {
      selected.add(entry.row); growIds(known, entry.ids); changed = true;
    }
    if (!changed) return sortFoulApplicationOwnershipRows([...selected]);
  }
};

/** Original journal ancestors and retained intent mirrors are linkage, not
 * competing applications. Keep their discovery in the existing owner APIs. */
const journalLinks = (db: Db, scope: FoulTerminalApplicationScope) => {
  const journal = new Set(strings([scope.official.sourceId, scope.selectedHeadSourceId]));
  const intents = new Set(strings([scope.intentSourceId]));
  const selected = [...foulOfficialClaims(db, 'actual_foul_official_sessions', scope.official),
    ...foulOfficialClaims(db, 'actual_foul_official_events', scope.official),
    ...foulOfficialClaims(db, 'actual_foul_official_handoffs', scope.official)];
  const absorb = (row: Row) => {
    const m = metadata(db, row);
    add(journal, [row.source_id, row.parent_source_id, row.head_source_id, ...m.value('source_json', ['sourceId']),
      ...m.value('source_json', ['parent', 'sourceId']), ...m.value('snapshot_json', ['headSourceId'])]);
    add(intents, [...m.value('source_json', ['action', 'intentSourceId']), ...m.value('intent_json', ['sourceId']),
      ...m.value('snapshot_json', ['callIntent', 'sourceId'])]);
  };
  selected.forEach(absorb);
  for (;;) {
    const before = journal.size + intents.size;
    for (const intent of intents) foulOfficialIntentClaims(db, intent).forEach(absorb);
    foulOfficialHeads(db, scope.official, [...journal]).forEach(absorb);
    if (before === journal.size + intents.size) return { journal, intents };
  }
};

const scoped = (row: Row, m: Metadata, scope: FoulTerminalApplicationScope,
  links: ReturnType<typeof journalLinks>, pitches: ReadonlySet<string>) => {
  const s = scope.official;
  if (row.game_id === s.gameId && row.play_id === s.playId || row.physical_pitch_source_id === s.physicalPitchSourceId
    || row.physical_end_source_id === s.physicalEndSourceId || row.official_obligation_key === s.officialObligationKey) return true;
  for (const [column, prefix] of [['source_json', []], ['proposal_json', ['source']], ['proposal_json', []],
    ['result_json', ['acknowledgement']]] as const) {
    if (m.reference(column, [...prefix, 'physicalEndReference'], 'actual_foul_play_ends').includes(s.physicalEndSourceId)
      || m.reference(column, [...prefix, 'consumptionReference'], 'actual_foul_rule_consumptions').includes(s.consumptionSourceId)
      || m.value(column, [...prefix, 'officialReference', 'sessionSourceId']).includes(s.sourceId)
      || overlaps(m.value(column, [...prefix, 'officialReference', 'headSourceId']), links.journal)) return true;
  }
  for (const [column, prefix] of [['proposal_json', []], ['proposal_json', ['officialObligation']],
    ['proposal_json', ['officialObligation', 'scope']], ['proposal_json', ['sessionSource', 'assignment']],
    ['proposal_json', ['callIntent']], ['result_json', ['acknowledgement']], ['result_json', ['acknowledgement', 'scope']]] as const) {
    if (m.value(column, [...prefix, 'gameId']).includes(s.gameId) && m.value(column, [...prefix, 'playId']).includes(s.playId)
      || m.value(column, [...prefix, 'physicalPitchSourceId']).includes(s.physicalPitchSourceId)
      || scope.firstPhysicalPitchSourceId !== undefined && m.value(column, [...prefix, 'firstPhysicalPitchSourceId']).includes(scope.firstPhysicalPitchSourceId)
      || scope.runtimeSourceId !== undefined && m.value(column, [...prefix, 'runtimeSourceId']).includes(scope.runtimeSourceId)
      || scope.scopeId !== undefined && m.value(column, [...prefix, 'scopeId']).includes(scope.scopeId)
      || m.value(column, [...prefix, 'obligationKey']).includes(s.officialObligationKey)
      || m.value(column, [...prefix, 'originalSuccessorKey']).includes(s.originalSuccessorKey)
      || m.reference(column, [...prefix, 'consumptionReference'], 'actual_foul_rule_consumptions').includes(s.consumptionSourceId)
      || m.reference(column, [...prefix, 'physicalEndReference'], 'actual_foul_play_ends').includes(s.physicalEndSourceId)) return true;
  }
  if (overlaps(m.reference('proposal_json', ['physicalPitchReference'], 'physical_pitch_progress_actions'), pitches)
    || overlaps(m.reference('proposal_json', ['originalPhysicalPitchPrefix'], 'physical_pitch_progress_actions'), pitches)) return true;
  if (m.value('proposal_json', ['sessionSource', 'sourceId']).includes(s.sourceId)
    || m.value('proposal_json', ['callSource', 'sessionSourceId']).includes(s.sourceId)
    || overlaps(m.value('proposal_json', ['callSource', 'sourceId']), links.journal)
    || overlaps(m.value('proposal_json', ['callSource', 'parent', 'sourceId']), links.journal)
    || overlaps(m.value('proposal_json', ['callSource', 'action', 'intentSourceId']), links.intents)
    || overlaps(m.value('proposal_json', ['callIntent', 'sourceId']), links.intents)
    || m.value('proposal_json', ['callIntent', 'sessionSourceId']).includes(s.sourceId)) return true;
  const game = row.game_id === s.gameId || m.value('proposal_json', ['gameId']).includes(s.gameId)
    || m.value('proposal_json', ['applicationBody', 'matchId']).includes(s.gameId);
  return m.value('proposal_json', ['applicationBody', 'matchId']).includes(s.gameId)
      && m.value('proposal_json', ['applicationBody', 'match', 'playId']).includes(s.playId)
    || game && m.value('result_json', ['official', 'receipt', 'previousPlayId']).includes(s.playId);
};

/** Rejection-only scope census. No selected row, including a result-bearing
 * future shape, is accepted here as a valid queue or an applied checkpoint. */
export const foulTerminalApplicationClaims = (db: Db, scope: FoulTerminalApplicationScope): Row[] => {
  const all = rows(db);
  if (!all.length) return [];
  const links = journalLinks(db, scope), known = identitySets(scope.applicationSourceId, scope.applicationId, scope.closureId);
  const pitches = new Set(strings([scope.official.physicalPitchSourceId, scope.firstPhysicalPitchSourceId]));
  const entries = all.map(row => { const m = metadata(db, row); return { row, m, ids: terminalIds(row, m) }; });
  const selected = new Set<Row>();
  for (;;) {
    let changed = false;
    for (const entry of entries) if (!selected.has(entry.row)
      && (matchesIds(entry.ids, known) || scoped(entry.row, entry.m, scope, links, pitches))) {
      selected.add(entry.row); growIds(known, entry.ids);
      add(pitches, entry.m.reference('proposal_json', ['originalPhysicalPitchPrefix'], 'physical_pitch_progress_actions'));
      changed = true;
    }
    if (!changed) return sortFoulApplicationOwnershipRows([...selected]);
  }
};
