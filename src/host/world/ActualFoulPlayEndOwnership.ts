import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { originalLiveOwnerDomains } from './ActualLiveRuntimeRegistration';
import { originalFoulMetadataValues as values, originalFoulSourceValues as sourceValues,
  originalFoulSourceIds as sourceIds, originalFoulReferenceIds as references, type FoulMetadataRow } from './OriginalFoulOwnershipMetadata';
import { sqliteJsonMetadataNodes as nodes } from './SqliteOwnershipMetadata';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { FoulOwnerCensusEntry, FoulOwnerReference } from './ActualFoulPlayEnd';
import type { DurableActualLivePlayRuntime } from './ActualLivePlayRuntime';

const domains = originalLiveOwnerDomains();
type Db = Pick<DatabaseSync, 'prepare'>;
type Row = FoulMetadataRow & Record<string, unknown>;
export type OriginalFoulTerminalScope = Readonly<{ gameId: string; playId: number;
  physicalPitchSourceId: string; runtimeSourceId?: string; physicalObligationKey?: string; originalSuccessorKey?: string }>;
export const actualFoulEndTable = 'actual_foul_play_ends';
const fail = (): never => { throw new Error('actual foul terminal original ownership metadata differs'); };
const installed = (db: Db, owner: string) => {
  const schema = db.prepare('SELECT type FROM main.sqlite_master WHERE name=?').all(owner);
  if (!schema.length) return false;
  if (schema.length !== 1 || schema[0].type !== 'table') return fail();
  return true;
};
const rows = (db: Db, owner: string): Row[] => installed(db, owner)
  ? db.prepare('SELECT * FROM main.' + owner).all() as Row[] : [];
const scopes = [[], ['recipient'], ['receipt', 'self'], ['receipt', 'self', 'cut'], ['setup'], ['observation'],
  ['observation', 'setup'], ['baseField'], ['scope'], ['execution', 'physicalHistory', 'scope'],
  ['dispositionObligations', 'physical', 'scope'], ['dispositionObligations', 'official', 'scope'],
  ['physicalAcknowledgement', 'scope'], ['preCorePhysicalProof', 'closureScope']] as const;
const flights = [[], ['flight'], ['worldContact', 'flight'], ['touch', 'worldContact', 'flight'],
  ['response', 'touch', 'worldContact', 'flight'], ['baseMotion', 'response', 'touch', 'worldContact', 'flight'],
  ['baseField', 'response', 'touch', 'worldContact', 'flight']] as const;
const embedded: Readonly<Record<string, readonly (readonly string[])[]>> = {
  flightSourceId: [['flight', 'source', 'sourceId']], worldContactSourceId: [['worldContact', 'source', 'sourceId']],
  firstFielderTouchSourceId: [['touch', 'source', 'sourceId']], responseSourceId: [['response', 'source', 'sourceId']],
  contactResponseSourceId: [['response', 'source', 'sourceId']], baseMotionSourceId: [['baseMotion', 'source', 'sourceId']],
  baseFieldSourceId: [['baseField', 'source', 'sourceId']], observationSourceId: [['observation', 'source', 'sourceId']],
  stopProductionSourceId: [['producerReference', 'sourceId']], setupSourceId: [['setup', 'sourceId'], ['setup', 'source', 'sourceId']],
  callSourceId: [['call', 'source', 'sourceId']],
};
const directClaim = (db: Db, row: Row, scope: OriginalFoulTerminalScope) => {
  if (row.physical_pitch_source_id === scope.physicalPitchSourceId
    || row.game_id === scope.gameId && row.play_id === scope.playId) return true;
  const source = (key: string) => sourceValues(db, row, key);
  if (source('physicalPitchSourceId').includes(scope.physicalPitchSourceId)
    || source('gameId').includes(scope.gameId) && (source('playId').includes(scope.playId)
      || values(db, row.snapshot_json, ['match', 'playId']).includes(scope.playId))) return true;
  for (const path of scopes) {
    if (values(db, row.snapshot_json, [...path, 'physicalPitchSourceId']).includes(scope.physicalPitchSourceId)
      || values(db, row.snapshot_json, [...path, 'gameId']).includes(scope.gameId)
        && values(db, row.snapshot_json, [...path, 'playId']).includes(scope.playId)) return true;
  }
  return flights.some(path => values(db, row.snapshot_json, [...path, 'physicalPitch', 'source', 'sourceId']).includes(scope.physicalPitchSourceId)
    || values(db, row.snapshot_json, [...path, 'source', 'physicalPitchSourceId']).includes(scope.physicalPitchSourceId)
    || values(db, row.snapshot_json, [...path, 'physicalPitch', 'frame', 'gameId']).includes(scope.gameId)
      && values(db, row.snapshot_json, [...path, 'physicalPitch', 'frame', 'match', 'playId']).includes(scope.playId));
};
const identity = (db: Db, row: Row, scope: OriginalFoulTerminalScope) => {
  if (typeof row.source_id !== 'string' || !row.source_id || typeof row.source_json !== 'string' || typeof row.snapshot_json !== 'string'
    || typeof row.source_hash !== 'string' || typeof row.snapshot_hash !== 'string'
    || createHash('sha256').update(row.source_json).digest('hex') !== row.source_hash
    || createHash('sha256').update(row.snapshot_json).digest('hex') !== row.snapshot_hash) fail();
  for (const [document, path] of [[row.source_json, []], [row.snapshot_json, ['source']]] as const) {
    const found = db.prepare(`SELECT type,atom FROM (${nodes('$document', [...path, 'sourceId'])})`).all({ document });
    if (found.length !== 1 || found[0].type !== 'text' || found[0].atom !== row.source_id) fail();
  }
  if (row.physical_pitch_source_id !== undefined && row.physical_pitch_source_id !== scope.physicalPitchSourceId
    || row.game_id !== undefined && row.game_id !== scope.gameId || row.play_id !== undefined && row.play_id !== scope.playId) fail();
};

/** Complete declared-owner discovery for this bounded end policy. The reference
 * map contains only independently rederived original inputs and supported live
 * outputs. Discovery is raw/duplicate-aware before any unsupported payload is
 * interpreted; a present unsupported owner remains pending, never completed. */
export const actualFoulGovernedOwnerCensus = (db: Db, runtime: DurableActualLivePlayRuntime,
  owners: readonly string[], expected: ReadonlyMap<string, readonly FoulOwnerReference[]>,
  admissions: readonly Readonly<{ owner: string; sourceId: string; sourceHash: string; snapshotHash: string }>[]) => {
  const scope = { gameId: runtime.gameId, playId: runtime.playId, physicalPitchSourceId: runtime.source.physicalPitchSourceId };
  const data = new Map(owners.map(owner => [owner, rows(db, owner)]));
  const related = new Map(owners.map(owner => [owner, new Set((expected.get(owner) ?? []).map(r => r.sourceId))]));
  for (const a of admissions) related.get(a.owner)?.add(a.sourceId);
  const selected = new Map(owners.map(owner => [owner, new Set<Row>()]));
  const selectedHeads = new Map<string, Record<string, unknown>[]>();
  const specialHeads: Readonly<Record<string, string>> = { physical_pitch_progress_actions: 'physical_pitch_progress_heads' };
  const headFor = (owner: string) => domains.find(d => d.owner === owner)?.head?.owner ?? specialHeads[owner];
  const linkClaims = (row: Row, links: readonly (readonly [string, string, string])[], sourceMetadata = true) => links.some(([field, column, parent]) => {
    const ids = related.get(parent); if (!ids?.size) return false;
    return ids.has(String(row[column])) || sourceMetadata && ([...sourceValues(db, row, field),
      ...values(db, row.snapshot_json, ['receipt', 'self', 'cut', field]),
      ...(embedded[field] ?? []).flatMap(path => values(db, row.snapshot_json, path))].some(v => typeof v === 'string' && ids.has(v)));
  });
  for (;;) {
    let changed = false;
    for (const owner of owners) {
      const spec = domains.find(d => d.owner === owner), ids = related.get(owner)!;
      const links = [...(spec?.links ?? []), ...(spec?.previous ? [[spec.previous, 'previous_source_id', owner] as const] : [])];
      for (const row of data.get(owner)!) {
        if (!selected.get(owner)!.has(row) && (sourceIds(db, row).some(v => ids.has(v))
          || directClaim(db, row, scope) || linkClaims(row, links))) {
          selected.get(owner)!.add(row); changed = true;
          for (const name of sourceIds(db, row)) ids.add(name);
        }
      }
      const head = headFor(owner);
      if (!head) continue;
      const chosen = rows(db, head).filter(row => row.physical_pitch_source_id === scope.physicalPitchSourceId
        || row.game_id === scope.gameId && row.play_id === scope.playId || ids.has(row.source_id)
        || head === 'physical_pitch_progress_heads' && typeof row.last_source_id === 'string' && ids.has(row.last_source_id)
        || linkClaims(row, spec?.head?.links ?? links, false));
      selectedHeads.set(head, chosen);
      for (const row of chosen) {
        // The physical-pitch head uses last_source_id rather than source_id.
        const sourceId = row.source_id ?? row.last_source_id;
        if (typeof sourceId !== 'string') fail();
        if (!ids.has(sourceId)) { ids.add(sourceId); changed = true; }
      }
    }
    if (!changed) break;
  }
  const unsupported: string[] = [], census: FoulOwnerCensusEntry[] = [];
  for (const owner of owners) {
    const original = expected.get(owner), chosen = [...selected.get(owner)!].sort((a, b) => a.source_id.localeCompare(b.source_id));
    if (original) {
      if (original.some(ref => !chosen.some(row => row.source_id === ref.sourceId
        && row.source_hash === ref.sourceHash && row.snapshot_hash === ref.snapshotHash))) fail();
      if (chosen.length !== original.length) {
        for (const row of chosen.filter(r => !original.some(ref => ref.sourceId === r.source_id))) identity(db, row, scope);
        unsupported.push('additional_original_owner:' + owner);
      }
      // Original input/pitch-prefix rows can legitimately predate the current
      // pitch. Their exact independently rederived references remain authority.
      for (const row of chosen) {
        if (createHash('sha256').update(row.source_json).digest('hex') !== row.source_hash
          || createHash('sha256').update(row.snapshot_json).digest('hex') !== row.snapshot_hash) fail();
      }
    } else if (chosen.length) {
      for (const row of chosen) identity(db, row, scope);
      unsupported.push('unsupported_live_owner:' + owner);
    }
    const head = headFor(owner), headRows = head ? selectedHeads.get(head) ?? [] : [];
    for (const row of headRows) {
      const sourceId = row.source_id ?? row.last_source_id;
      if (!chosen.some(r => r.source_id === sourceId)
        || row.physical_pitch_source_id !== undefined && row.physical_pitch_source_id !== scope.physicalPitchSourceId
        || row.game_id !== undefined && row.game_id !== scope.gameId || row.play_id !== undefined && row.play_id !== scope.playId) fail();
    }
    const references = chosen.map(row => ({ owner, sourceId: row.source_id, sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) }));
    // Global empty-table installation is not a causal physical fact. Every
    // declared owner/head remains represented and every scoped claim is fresh.
    census.push({ owner, references,
      heads: head ? [{ owner: head, rows: headRows.sort((a, b) => json(a).localeCompare(json(b))) }] : [] });
  }
  const roots = new Set(['physical_plate_appearance_actors', 'physical_pitch_progress_actions', 'batted_ball_flights',
    'batted_world_contacts', 'batted_first_fielder_touches', 'batted_contact_responses', 'actual_communication_models']);
  for (const [owner, refs] of expected) if (!roots.has(owner)) for (const ref of refs) {
    if (!admissions.some(a => a.owner === owner && a.sourceId === ref.sourceId
      && a.sourceHash === ref.sourceHash && a.snapshotHash === ref.snapshotHash)) {
      throw new Error('actual foul physical producer bypassed runtime admission');
    }
  }
  for (const a of admissions) if (!census.some(c => c.owner === a.owner && c.references.some(r => r.sourceId === a.sourceId
    && r.sourceHash === a.sourceHash && r.snapshotHash === a.snapshotHash))) throw new Error('actual foul admission lacks its original owner');
  // The journal's runtime index cannot hide an admission claiming a selected
  // original owner identity. This inverse check is separate from row replay.
  for (const row of db.prepare('SELECT * FROM main.actual_live_play_admissions').all()) {
    const claimed = row.runtime_source_id === runtime.source.sourceId || census.some(c => c.owner === row.owner
      && c.references.some(r => r.sourceId === row.source_id));
    if (claimed && (row.runtime_source_id !== runtime.source.sourceId || !admissions.some(a => a.owner === row.owner
      && a.sourceId === row.source_id && a.sourceHash === row.source_hash && a.snapshotHash === row.snapshot_hash))) {
      throw new Error('actual foul raw admission ownership claim differs');
    }
  }
  return { census, unsupported };
};

/** Claim discovery for both terminal families. This grants no end authority:
 * any original raw claim blocks a new writer, even after a deleted cached seal. */
export const actualFoulTerminalClaims = (db: Db, scope: OriginalFoulTerminalScope) => {
  const ends = rows(db, actualFoulEndTable);
  if (!ends.length) return [];
  const runtimeIds = new Set<string>(scope.runtimeSourceId ? [scope.runtimeSourceId] : []);
  for (const row of rows(db, 'actual_live_play_runtimes')) if (directClaim(db, row, scope)) for (const value of sourceIds(db, row)) runtimeIds.add(value);
  const known = new Map<string, Set<string>>([['physical_pitch_progress_actions', new Set([scope.physicalPitchSourceId])],
    ['actual_live_play_runtimes', runtimeIds]]);
  // Follow the existing explicit dependency links. This includes a count whose
  // indexed pitch is foreign but whose original stop/runtime Source still claims
  // the episode. No actor/person/first-pitch alias is treated as current pitch.
  for (const domain of domains) {
    const ids = new Set<string>(); known.set(domain.owner, ids);
    const candidates = rows(db, domain.owner);
    for (;;) {
      const before = ids.size;
      const fieldIds = known.get('batted_world_field_actions') ?? new Set<string>();
      const policyIds = new Set(rows(db, 'batted_venue_legal_policies').filter(row => directClaim(db, row, scope)
        || sourceValues(db, row, 'baseFieldSourceId').some(v => typeof v === 'string' && fieldIds.has(v)))
        .flatMap(row => sourceIds(db, row)));
      const extra = (row: Row) => {
        if (domain.owner !== 'actual_foul_rule_consumptions' && domain.owner !== 'actual_settled_foul_stop_productions') return false;
        const basis = domain.owner === 'actual_foul_rule_consumptions' ? ['countEvidence', 'basis'] : ['basis'];
        return row.runtime_source_id !== undefined && runtimeIds.has(String(row.runtime_source_id))
          || row.policy_source_id !== undefined && policyIds.has(String(row.policy_source_id))
          || sourceValues(db, row, 'policySourceId').some(v => typeof v === 'string' && policyIds.has(v))
          || values(db, row.snapshot_json, [...basis, 'physicalPitchSourceId']).includes(scope.physicalPitchSourceId)
          || values(db, row.snapshot_json, [...basis, 'originalCount', 'physicalPitchSourceId']).includes(scope.physicalPitchSourceId)
          || values(db, row.snapshot_json, ['countEvidence', 'battingIntent', 'physicalPitch', 'sourceId']).includes(scope.physicalPitchSourceId)
          || values(db, row.snapshot_json, ['runtimeReference', 'sourceId']).some(v => typeof v === 'string' && runtimeIds.has(v))
          || values(db, row.snapshot_json, [...basis, 'policyReference', 'sourceId']).some(v => typeof v === 'string' && policyIds.has(v))
          || [...values(db, row.snapshot_json, [...basis, 'physicalCut', 'baseFieldSourceId']),
            ...references(db, row.snapshot_json, [...basis, 'physicalPrefixReferences'], 'batted_world_field_actions')]
            .some(v => typeof v === 'string' && fieldIds.has(v));
      };
      for (const row of candidates) if (directClaim(db, row, scope) || extra(row)
        || sourceValues(db, row, 'runtimeSourceId').some(v => typeof v === 'string' && runtimeIds.has(v))
        || sourceIds(db, row).some(v => ids.has(v))
        || domain.links.some(([field, column, parent]) => known.get(parent)?.has(String(row[column]))
          || [...sourceValues(db, row, field), ...(embedded[field] ?? []).flatMap(path => values(db, row.snapshot_json, path))]
            .some(v => typeof v === 'string' && known.get(parent)?.has(v)))) {
        for (const value of sourceIds(db, row)) ids.add(value);
      }
      if (ids.size === before) break;
    }
  }
  const counts = known.get('actual_foul_rule_consumptions') ?? new Set<string>();
  const fields = known.get('batted_world_field_actions') ?? new Set<string>();
  const executions = known.get('batted_world_field_executions') ?? new Set<string>();
  // Child identity is deterministic from the original count successor, not a
  // terminal's cached episode columns. A writer also supplies its independently
  // rederived child/parent so competing claims cannot hide behind moved mirrors.
  const parents = new Set<string>(scope.originalSuccessorKey ? [scope.originalSuccessorKey] : []);
  for (const row of rows(db, 'actual_foul_rule_consumptions')) {
    if (sourceIds(db, row).some(id => counts.has(id))) {
      for (const key of values(db, row.snapshot_json, ['successor', 'successorKey'])) if (typeof key === 'string') parents.add(key);
    }
  }
  const physicalKeys = new Set([...parents].map(parent => json(['actual_foul_disposition_obligation_v1', parent, 'physical_end'])));
  if (scope.physicalObligationKey) physicalKeys.add(scope.physicalObligationKey);
  const childClaim = (row: Row) => [
    ['dispositionObligations', 'physical', 'obligationKey'], ['physicalAcknowledgement', 'obligationKey'],
    ['generation', 'physicalRuleProjection', 'physicalObligationKey'], ['generation', 'consumed', 'cause'],
    ['preCorePhysicalProof', 'domainProofs', 'premises', 'pendingPhysicalChildKey'],
  ].some(path => values(db, row.snapshot_json, path).some(v => typeof v === 'string' && physicalKeys.has(v))) || [
    ['dispositionObligations', 'original', 'successorKey'], ['dispositionObligations', 'physical', 'originalSuccessorKey'],
    ['dispositionObligations', 'official', 'originalSuccessorKey'], ['physicalAcknowledgement', 'originalSuccessorKey'],
    ['preCorePhysicalProof', 'domainProofs', 'premises', 'originalDispositionSuccessor', 'successorKey'],
  ].some(path => values(db, row.snapshot_json, path).some(v => typeof v === 'string' && parents.has(v)));
  const selected = new Set<Row>();
  const referencedClaim = (row: Row) => {
    const paths = [
      ['preCorePhysicalProof', 'runtimeReference'], ['preCorePhysicalProof', 'stopReference'], ['preCorePhysicalProof', 'consumptionReference'],
      ['dispositionObligations', 'consumptionReference'], ['dispositionObligations', 'official', 'scope', 'consumptionReference'],
      ['preCorePhysicalProof', 'ownerCensus', 'references'],
      ['preCorePhysicalProof', 'domainProofs', 'premises', 'runtimeReference'],
      ['preCorePhysicalProof', 'domainProofs', 'premises', 'pitchReference'],
      ['preCorePhysicalProof', 'domainProofs', 'premises', 'stopReference'],
      ['preCorePhysicalProof', 'domainProofs', 'premises', 'consumptionReference'],
      ['preCorePhysicalProof', 'domainProofs', 'premises', 'physicalOwners'],
      ['preCorePhysicalProof', 'domainProofs', 'premises', 'ingressCut', 'runtimeReference'],
    ];
    return paths.some(path => [...known].some(([owner, ids]) => ids.size > 0
      && references(db, row.snapshot_json, path, owner).some(v => typeof v === 'string' && ids.has(v))));
  };
  for (const row of ends) {
    if (directClaim(db, row, scope) || childClaim(row) || referencedClaim(row)
      || [['preCorePhysicalProof', 'physicalCut'], ['preCorePhysicalProof', 'domainProofs', 'premises', 'physicalCut'],
        ['preCorePhysicalProof', 'domainProofs', 'premises', 'ingressCut', 'physicalCut']].some(path =>
          values(db, row.snapshot_json, [...path, 'baseFieldSourceId']).some(v => typeof v === 'string' && fields.has(v))
          || values(db, row.snapshot_json, [...path, 'executionSourceId']).some(v => typeof v === 'string' && executions.has(v)))
      || sourceValues(db, row, 'ruleConsumptionSourceId').some(v => typeof v === 'string' && counts.has(v))
      || sourceValues(db, row, 'baseFieldSourceId').some(v => typeof v === 'string' && fields.has(v))
      || sourceValues(db, row, 'executionSourceId').some(v => typeof v === 'string' && executions.has(v))
      || [['preCorePhysicalProof', 'runtimeReference', 'sourceId'], ['dispositionObligations', 'physical', 'scope', 'runtimeSourceId']]
        .some(path => values(db, row.snapshot_json, path).some(v => typeof v === 'string' && runtimeIds.has(v)))
      || [['preCorePhysicalProof', 'consumptionReference', 'sourceId'], ['dispositionObligations', 'consumptionReference', 'sourceId']]
        .some(path => values(db, row.snapshot_json, path).some(v => typeof v === 'string' && counts.has(v)))) selected.add(row);
  }
  for (;;) {
    const names = new Set([...selected].flatMap(row => sourceIds(db, row))), before = selected.size;
    for (const row of ends) if (sourceIds(db, row).some(v => names.has(v))) selected.add(row);
    if (selected.size === before) break;
  }
  return [...selected];
};
export const actualFoulEndIdentityRows = (db: Db, sourceId: string) => rows(db, actualFoulEndTable)
  .filter(row => sourceIds(db, row).includes(sourceId));
export const actualFoulOtherTerminalClaims = (db: Db, scope: OriginalFoulTerminalScope) => rows(db, 'actual_first_base_play_ends')
  .filter(row => directClaim(db, row, scope) || sourceValues(db, row, 'runtimeSourceId').includes(scope.runtimeSourceId ?? ''));
export const actualFoulOwnerReference = (owner: string, value: { source: { sourceId: string } }, snapshotHash = hash(value)): FoulOwnerReference =>
  ({ owner, sourceId: value.source.sourceId, sourceHash: hash(value.source), snapshotHash });
