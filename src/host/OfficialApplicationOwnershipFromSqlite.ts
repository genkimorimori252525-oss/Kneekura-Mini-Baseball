import type { FoulOfficialDb, FoulOfficialRow } from './world/ActualFoulOfficialOwnership';
import { originalFoulMetadataValues as values, originalFoulReferenceIds as references } from './world/OriginalFoulOwnershipMetadata';
import { foulApplicationOwnershipRows, foulApplicationOwnershipRowKey, foulTerminalApplicationClaims,
  foulTerminalApplicationRawIdentities, foulTerminalApplicationRows, foulTerminalApplicationOriginalScopeClaim, sortFoulApplicationOwnershipRows, type FoulTerminalApplicationScope } from './world/ActualFoulTerminalApplicationOwnership';

import { foulTerminalCompletionRawIdentities, emptyFoulTerminalCompletionIdentitySets,
  matchesFoulTerminalCompletionIdentities, growFoulTerminalCompletionIdentities, combineFoulTerminalCompletionIdentities,
  foulTerminalCompletionPreviousPlayClaim, foulTerminalCompletionPhysicalEndClaim,
  type FoulTerminalCompletionIdentities, type FoulTerminalCompletionIdentitySets } from './world/ActualFoulTerminalCompletionMetadata';

type Db = FoulOfficialDb;
type Row = FoulOfficialRow;
type Path = readonly string[];
type Table = 'applications' | 'matches' | 'physical_play_closures' | 'actual_live_play_closures';
export type OfficialApplicationOwnershipClaim = Readonly<{ table: Table; row: Row }>;
const terminalOwner = 'actual_foul_terminal_applications';
const columns = {
  applications: { application_id: 'TEXT', match_id: 'TEXT', closure_id: 'TEXT', request_hash: 'TEXT', result_json: 'TEXT' },
  matches: { match_id: 'TEXT', durable_revision: 'INTEGER', state_json: 'TEXT', activation_json: 'TEXT' },
  physical_play_closures: { source_id: 'TEXT', source_version: 'TEXT', game_id: 'TEXT', play_id: 'INTEGER', application_id: 'TEXT',
    scoring_application_id: 'TEXT', status: 'TEXT', source_json: 'TEXT', source_hash: 'TEXT', proposal_json: 'TEXT', proposal_hash: 'TEXT', result_json: 'TEXT' },
  actual_live_play_closures: { source_id: 'TEXT', game_id: 'TEXT', play_id: 'INTEGER', application_id: 'TEXT', status: 'TEXT',
    source_json: 'TEXT', source_hash: 'TEXT', proposal_json: 'TEXT', proposal_hash: 'TEXT', result_json: 'TEXT' },
} as const;
const tables: readonly Table[] = ['applications', 'matches', 'physical_play_closures', 'actual_live_play_closures'];
const strings = (items: readonly unknown[]): string[] => items.filter((value): value is string => typeof value === 'string');
const add = (set: Set<string>, items: readonly unknown[]) => { for (const value of items) if (typeof value === 'string') set.add(value); };
const overlaps = (items: readonly unknown[], ids: ReadonlySet<string>) => items.some(value => typeof value === 'string' && ids.has(value));
const metadata = (db: Db, row: Row) => {
  const cache = new Map<string, ReturnType<typeof values>>();
  const read = (column: string, path: Path, owner?: string) => {
    const key = JSON.stringify([column, path, owner]);
    if (!cache.has(key)) {
      const document = typeof row[column] === 'string' ? row[column] as string : '';
      cache.set(key, owner === undefined ? values(db, document, path) : references(db, document, path, owner));
    }
    return cache.get(key)!;
  };
  return { value: (column: string, path: Path) => read(column, path),
    reference: (column: string, path: Path, owner: string) => read(column, path, owner) };
};
type Metadata = ReturnType<typeof metadata>;
type Identity = FoulTerminalCompletionIdentities & Readonly<{ sourceIds: readonly string[]; applicationIds: readonly string[]; closureIds: readonly string[] }>;
type Known = FoulTerminalCompletionIdentitySets & { sourceIds: Set<string>; applicationIds: Set<string>; closureIds: Set<string> };
const grow = (known: Known, found: Identity) => {
  growFoulTerminalCompletionIdentities(known,found);
  add(known.sourceIds, found.sourceIds); add(known.applicationIds, found.applicationIds); add(known.closureIds, found.closureIds);
};
const identityClaim = (found: Identity, known: Known) => overlaps(found.sourceIds, known.sourceIds)
  || overlaps(found.applicationIds, known.applicationIds) || overlaps(found.closureIds, known.closureIds)
  || matchesFoulTerminalCompletionIdentities(found,known);
const initialIdentities = (db: Db, scope: FoulTerminalApplicationScope): Known => {
  const known = { ...emptyFoulTerminalCompletionIdentitySets(), sourceIds: new Set(strings([scope.applicationSourceId])), applicationIds: new Set(strings([scope.applicationId])),
    closureIds: new Set(strings([scope.applicationSourceId, scope.closureId])) };
  for (const row of foulTerminalApplicationClaims(db, scope)) grow(known, foulTerminalApplicationRawIdentities(db, row));
  return known;
};
const officialContainers = [['receipt'], ['pendingPostPlay'], ['activation'], ['result'], ['finalResult']] as const;
const emptyCompletionIdentities = () => combineFoulTerminalCompletionIdentities([]);
const officialIdentities = (m: Metadata, column: string, prefix: Path): Identity => {
  const completion = foulTerminalCompletionRawIdentities(m,column,prefix);
  return { ...completion,
    sourceIds: [...completion.sourceIds,...strings(m.reference(column, [...prefix, 'pendingPostPlay', 'origin'], terminalOwner))],
    applicationIds: [...completion.applicationIds,...strings(officialContainers.flatMap(path => m.value(column, [...prefix, ...path, 'applicationId'])))],
    closureIds: [...completion.closureIds,...strings(officialContainers.flatMap(path => m.value(column, [...prefix, ...path, 'closureId'])))],
  };
};
const combine = (...identities: Identity[]): Identity => ({
  ...combineFoulTerminalCompletionIdentities(identities),
  sourceIds: identities.flatMap(x => x.sourceIds), applicationIds: identities.flatMap(x => x.applicationIds),
  closureIds: identities.flatMap(x => x.closureIds),
});
// getMatch also supports a bare legacy activation. Keep these root mirrors
// specific to Match activation storage; other owners retain their own layouts.
const matchActivationIdentities = (m: Metadata): Identity => combine(officialIdentities(m, 'activation_json', []), { ...emptyCompletionIdentities(),
  sourceIds: [], applicationIds: strings(m.value('activation_json', ['applicationId'])),
  closureIds: strings(m.value('activation_json', ['closureId'])),
});
const rowIdentities = (table: Table, row: Row, m: Metadata): Identity => {
  if (table === 'matches') return matchActivationIdentities(m);
  if (table === 'applications') return combine({ ...emptyCompletionIdentities(), sourceIds: [], applicationIds: strings([row.application_id]),
    closureIds: strings([row.closure_id]) }, officialIdentities(m, 'result_json', []));
  const sourceIds = strings([row.source_id, ...m.value('source_json', ['sourceId']), ...m.value('proposal_json', ['source', 'sourceId']),
    ...m.value('result_json', ['sourceId'])]);
  return combine({ ...emptyCompletionIdentities(), sourceIds,
    applicationIds: strings([row.application_id, ...m.value('source_json', ['applicationId']),
      ...m.value('proposal_json', ['source', 'applicationId']), ...m.value('proposal_json', ['application', 'applicationId'])]),
    closureIds: strings([...sourceIds, ...m.value('proposal_json', ['application', 'adjudication', 'events', 'closureId']),
      ...m.value('source_json', ['finalScoring', 'closureSourceId']), ...m.value('proposal_json', ['source', 'finalScoring', 'closureSourceId'])]) },
  officialIdentities(m, 'proposal_json', ['expectedOfficial']), officialIdentities(m, 'result_json', ['official']));
};
/** Previous-play fields identify the consumed PA. Neither an applied Match
 * playId nor a next-play activation number is an original-PA ownership claim. */
const previousPlay = (m: Metadata, column: string, prefix: Path, playId: number) =>
  m.value(column, [...prefix, 'receipt', 'previousPlayId']).includes(playId)
  || m.value(column, [...prefix, 'activation', 'previousPlayId']).includes(playId)
  || m.value(column, [...prefix, 'pendingPostPlay', 'previousPlayId']).includes(playId)
  || foulTerminalCompletionPreviousPlayClaim(m,column,prefix,playId);
const activationClaim = (row: Row, m: Metadata, scope: FoulTerminalApplicationScope, known: Known) =>
  identityClaim(matchActivationIdentities(m), known)
  || foulTerminalCompletionPhysicalEndClaim(m,'activation_json',[],scope.official.physicalEndSourceId)
  || row.match_id === scope.official.gameId && (previousPlay(m, 'activation_json', [], scope.official.playId)
    || m.value('activation_json', ['previousPlayId']).includes(scope.official.playId))
  || m.value('activation_json', ['pendingPostPlay','matchId']).includes(scope.official.gameId)
    && (m.value('activation_json', ['pendingPostPlay','previousPlayId']).includes(scope.official.playId)
      || foulTerminalCompletionPreviousPlayClaim(m,'activation_json',[],scope.official.playId));

/** A matching Match row is baseline evidence, not by itself an application.
 * Its prior-PA activation is legitimate history. This predicate only exposes
 * raw activation claims on the selected terminal identities or original PA. */
export const officialMatchActivationClaims = (db: Db, row: Row, scope: FoulTerminalApplicationScope): boolean =>
  activationClaim(row, metadata(db, row), scope, initialIdentities(db, scope));

export const officialApplicationRawIdentities = (db:Db,table:Table,row:Row) => rowIdentities(table,row,metadata(db,row));
const officialOriginalScopeClaim = (row:Row,m:Metadata,gameId:string,playId:number):boolean => {
  const game = row.match_id === gameId || m.value('result_json',['result','gameId']).includes(gameId)
    || m.value('result_json',['pendingPostPlay','matchId']).includes(gameId);
  return game && previousPlay(m,'result_json',[],playId);
};
export const officialApplicationOriginalScopeClaim = (db:Db,row:Row,gameId:string,playId:number):boolean =>
  officialOriginalScopeClaim(row,metadata(db,row),gameId,playId);

const sharedApplicationScope = (row: Row, m: Metadata, scope: FoulTerminalApplicationScope) => {
  const s = scope.official;
  return officialOriginalScopeClaim(row,m,s.gameId,s.playId)
    || foulTerminalCompletionPhysicalEndClaim(m,'result_json',[],s.physicalEndSourceId);
};
const closureScope = (row: Row, m: Metadata, scope: FoulTerminalApplicationScope) => {
  const s = scope.official;
  if (row.game_id === s.gameId && row.play_id === s.playId || row.physical_pitch_source_id === s.physicalPitchSourceId
    || row.physical_end_source_id === s.physicalEndSourceId || row.official_obligation_key === s.officialObligationKey) return true;
  for (const [column, path] of [['source_json', []], ['proposal_json', []], ['proposal_json', ['source']],
    ['result_json', []]] as const) {
    if (m.value(column, [...path, 'physicalPitchSourceId']).includes(s.physicalPitchSourceId)
      || scope.firstPhysicalPitchSourceId !== undefined && m.value(column, [...path, 'firstPhysicalPitchSourceId']).includes(scope.firstPhysicalPitchSourceId)
      || scope.runtimeSourceId !== undefined && m.value(column, [...path, 'runtimeSourceId']).includes(scope.runtimeSourceId)
      || scope.scopeId !== undefined && m.value(column, [...path, 'scopeId']).includes(scope.scopeId)
      || m.value(column, [...path, 'gameId']).includes(s.gameId) && m.value(column, [...path, 'playId']).includes(s.playId)
      || m.reference(column, [...path, 'physicalEndReference'], 'actual_foul_play_ends').includes(s.physicalEndSourceId)
      || m.reference(column, [...path, 'consumptionReference'], 'actual_foul_rule_consumptions').includes(s.consumptionSourceId)) return true;
  }
  if (m.value('proposal_json', ['application', 'matchId']).includes(s.gameId)
    && m.value('proposal_json', ['application', 'match', 'playId']).includes(s.playId)
    || m.value('proposal_json', ['physicalPitch', 'source', 'sourceId']).includes(s.physicalPitchSourceId)
    || m.value('proposal_json', ['physicalPitch', 'frame', 'gameId']).includes(s.gameId)
      && m.value('proposal_json', ['physicalPitch', 'frame', 'match', 'playId']).includes(s.playId)) return true;
  // Existing live final-scoring Source mirrors remain metadata, never a grant
  // of final-game authority. Original readers retain their own full discovery.
  for (const [column, path] of [['source_json', ['finalScoring']], ['proposal_json', ['source', 'finalScoring']]] as const) {
    if (m.value(column, [...path, 'gameId']).includes(s.gameId) && m.value(column, [...path, 'playId']).includes(s.playId)) return true;
  }
  const game = row.game_id === s.gameId || m.value('proposal_json', ['gameId']).includes(s.gameId)
    || m.value('proposal_json', ['application', 'matchId']).includes(s.gameId)
    || m.value('result_json', ['gameId']).includes(s.gameId)
    || m.value('result_json', ['official','pendingPostPlay','matchId']).includes(s.gameId);
  if (foulTerminalCompletionPhysicalEndClaim(m,'proposal_json',['expectedOfficial'],s.physicalEndSourceId)
    || foulTerminalCompletionPhysicalEndClaim(m,'result_json',['official'],s.physicalEndSourceId)) return true;
  return game && (previousPlay(m, 'proposal_json', ['expectedOfficial'], s.playId)
    || previousPlay(m, 'result_json', ['official'], s.playId));
};

/** Raw terminal peers can bridge two official claims after an official row
 * introduces a previously unknown setup/hash alias. Revisit them in the same
 * fixed point; discovery still cannot authenticate any terminal completion. */
const terminalIdentityLinks = (db: Db) => foulTerminalApplicationRows(db).map(row => ({
  row, ids:foulTerminalApplicationRawIdentities(db,row),
}));
const expandTerminalIdentityLinks = (links: ReturnType<typeof terminalIdentityLinks>, known: Known, expanded: Set<Row>): boolean => {
  let changed = false;
  for (const entry of links) if (!expanded.has(entry.row) && identityClaim(entry.ids,known)) {
    expanded.add(entry.row); grow(known,entry.ids); changed = true;
  }
  return changed;
};

/** A deterministic raw rejection census, with the original Match included as
 * baseline. Every other selected row is a competing owner for the caller to
 * reject; no caller-provided guard or Boolean can bless one as an application.
 * Selected identities grow to a fixed point before uniqueness is decided. */
export const officialApplicationOwnershipClaims = (db: Db, scope: FoulTerminalApplicationScope): OfficialApplicationOwnershipClaim[] => {
  const known = initialIdentities(db, scope), terminalLinks = terminalIdentityLinks(db), expandedTerminals = new Set<Row>();
  const entries = tables.flatMap(table => foulApplicationOwnershipRows(db, table, columns[table]).map(row => {
    const m = metadata(db, row); return { table, row, m, ids: rowIdentities(table, row, m) };
  }));
  const selected = new Set<typeof entries[number]>(), expanded = new Set<typeof entries[number]>();
  for (;;) {
    let changed = expandTerminalIdentityLinks(terminalLinks,known,expandedTerminals);
    for (const entry of entries) {
      const related = entry.table === 'matches' ? activationClaim(entry.row, entry.m, scope, known)
        : identityClaim(entry.ids, known) || (entry.table === 'applications'
          ? sharedApplicationScope(entry.row, entry.m, scope) : closureScope(entry.row, entry.m, scope));
      if (related || entry.table === 'matches' && entry.row.match_id === scope.official.gameId) selected.add(entry);
      // Do not expand an unrelated historical activation in the baseline row.
      if (related && !expanded.has(entry)) { expanded.add(entry); grow(known, entry.ids); changed = true; }
    }
    if (!changed) return [...selected].map(({ table, row }) => ({ table, row })).sort((a, b) => {
      const left = a.table + ':' + foulApplicationOwnershipRowKey(a.row), right = b.table + ':' + foulApplicationOwnershipRowKey(b.row);
      return left < right ? -1 : left > right ? 1 : 0;
    });
  }
};

/** Per-call raw identity fixed point. A seed chooses a domain, never an
 * accepted owner or a canonical Source. No baseline Match is added here. */
const rawOfficialIdentityClaims = (db: Db, known: Known, expandedTerminals = new Set<Row>(),
  terminalLinks = terminalIdentityLinks(db)): OfficialApplicationOwnershipClaim[] => {
  const entries = tables.flatMap(table => foulApplicationOwnershipRows(db,table,columns[table]).map(row => ({
    table,row,ids:rowIdentities(table,row,metadata(db,row)),
  })));
  const selected = new Set<typeof entries[number]>();
  for (;;) {
    let changed = expandTerminalIdentityLinks(terminalLinks,known,expandedTerminals);
    for (const entry of entries) if (!selected.has(entry) && identityClaim(entry.ids,known)) {
      selected.add(entry); grow(known,entry.ids); changed = true;
    }
    if (!changed) return [...selected].map(({ table,row }) => ({ table,row })).sort((a,b) => {
      const left = a.table + ':' + foulApplicationOwnershipRowKey(a.row), right = b.table + ':' + foulApplicationOwnershipRowKey(b.row);
      return left < right ? -1 : left > right ? 1 : 0;
    });
  }
};

/** Rejection-only identity census when the terminal Source row is missing.
 * Source and closure share this owner's ID; application IDs remain a distinct
 * domain. A wholly unlinked orphan cannot be inferred from an unknown Source. */
export const officialApplicationIdentityClaims = (db: Db, sourceId: string): OfficialApplicationOwnershipClaim[] => {
  if (typeof sourceId !== 'string' || !sourceId || sourceId !== sourceId.trim()) throw new Error('invalid official application Source identity');
  return rawOfficialIdentityClaims(db,{ ...emptyFoulTerminalCompletionIdentitySets(),
    sourceIds:new Set([sourceId]),applicationIds:new Set(),closureIds:new Set([sourceId]) });
};

/** Activation admission is seeded in the application-ID domain. This is raw
 * rejection-only discovery, including untagged transitive bridges; the single
 * terminal inventory preserves distinct physical rows during expansion. */
export const officialActivationApplicationOwnershipClaims = (db:Db,applicationId:string) => {
  if(typeof applicationId!=='string'||!applicationId||applicationId!==applicationId.trim())throw new Error('invalid activation application identity');
  const known:Known={...emptyFoulTerminalCompletionIdentitySets(),sourceIds:new Set(),applicationIds:new Set([applicationId]),closureIds:new Set()};
  const terminal=new Set<Row>(),links=terminalIdentityLinks(db);
  const official=rawOfficialIdentityClaims(db,known,terminal,links);
  return {terminal:sortFoulApplicationOwnershipRows([...terminal]),official};
};

/** Global setup-seeded rejection census, including wholly orphan compact
 * application/Match completion references. The table+row results stay raw;
 * neither uniqueness nor an empty census authenticates a completed archive. */
export const officialApplicationPostPlaySetupIdentityClaims = (db: Db, setupSourceId: string): OfficialApplicationOwnershipClaim[] => {
  if (typeof setupSourceId !== 'string' || !setupSourceId || setupSourceId !== setupSourceId.trim()) {
    throw new Error('invalid official application post-play setup identity');
  }
  const known: Known = { ...emptyFoulTerminalCompletionIdentitySets(), sourceIds:new Set(),applicationIds:new Set(),closureIds:new Set() };
  known.setupSourceIds.add(setupSourceId);
  return rawOfficialIdentityClaims(db,known);
};

/** Local Match rejection census, seeded by its activation and original scope.
 * Untagged legacy rows still carry identity edges. The shared finite fixed
 * point revisits terminal and official rows before any legacy fallback; raw
 * linkage is never proof that any selected completion is valid. */
export const officialMatchTerminalOwnershipClaims = (db: Db, matchId: string, match: Row, previousPlayId: number | null) => {
  const known: Known = { ...emptyFoulTerminalCompletionIdentitySets(), sourceIds:new Set(),applicationIds:new Set(),closureIds:new Set() };
  grow(known,matchActivationIdentities(metadata(db,match)));
  const terminal = new Set<Row>(), links=terminalIdentityLinks(db);
  if (previousPlayId !== null) {
    for (const {row,ids} of links) if (foulTerminalApplicationOriginalScopeClaim(db,row,matchId,previousPlayId)) {
      terminal.add(row); grow(known,ids);
    }
    for (const row of foulApplicationOwnershipRows(db,'applications',columns.applications)) {
      const m=metadata(db,row);
      if (officialOriginalScopeClaim(row,m,matchId,previousPlayId)) grow(known,rowIdentities('applications',row,m));
    }
  }
  // One physical row inventory spans scope seeding and expansion. Distinct SQL
  // rows stay distinct even when their raw bytes are equal.
  const official=rawOfficialIdentityClaims(db,known,terminal,links);
  return { terminal:sortFoulApplicationOwnershipRows([...terminal]),official };
};

/** Selected official owners may retain a terminal marker in any declared JSON
 * storage column. This is rejection metadata only, shared across every table
 * returned by the census rather than another consumer-specific path list. */
export const officialApplicationHasTerminalStageClaim = (db: Db, claim: OfficialApplicationOwnershipClaim): boolean =>
  Object.keys(columns[claim.table]).filter(column=>column.endsWith('_json')).some(column=>{
    const document=claim.row[column];
    return typeof document==='string' && !!db.prepare(`SELECT 1 FROM json_tree(CASE WHEN json_valid(?) THEN ? ELSE 'null' END)
      WHERE key IN ('completion','pendingPostPlay') LIMIT 1`).get(document,document);
  });
