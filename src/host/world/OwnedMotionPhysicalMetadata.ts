import { assertReceivedHandoffPhysicalMetadata } from './ActualReceivedUmpireHandoffPhysicalMetadata';
import { assertReceivedContinuationPhysicalAdmission } from './ActualReceivedUmpireContinuationAdmission';
import { receivedContinuationInput } from './ActualReceivedUmpireContinuation';
import { sqliteMetadataGet, sqliteMetadataAll } from './SqliteMetadataStatementScope';
import { sqliteJsonMetadataNodes as nodes, sqliteJsonMetadataProjection as projection, sqliteJsonMetadataMatches as matches,
  type SqliteJsonMetadataPath } from './SqliteOwnershipMetadata';
import type { DefensiveDb } from './ActualDefensiveContext';
import { ownedScheduledMotionSnapshotFormat,receivedRenewalAdoptionSnapshotFormat,receivedContinuationSnapshotFormat } from './OwnedScheduledMotionArchive';
type Row = Readonly<{ source_id: string; physical_pitch_source_id: string; base_field_source_id: string; previous_source_id: string | null;
  revision: number; game_id: string; source_json: string; snapshot_json: string }>;
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
/** Ownership metadata only; opaque future domain payload remains outside the requested replay. */
export const assertOwnedMotionPhysicalMetadata = (db: DefensiveDb, row: Row, prefix: readonly Row[]) => {
  assertReceivedHandoffPhysicalMetadata(db,row,prefix);
  const valid = (document: string) => !!sqliteMetadataGet(db, 'SELECT json_valid(?) AS valid', document)!.valid;
  const sourceIdentity = (r: Row) => ({ sourceId: r.source_id, baseFieldSourceId: r.base_field_source_id, previousExecutionSourceId: r.previous_source_id });
  const object = (document: string, path: SqliteJsonMetadataPath, expected: Record<string, string | number | null>) => {
    const values = sqliteMetadataAll(db, `SELECT n.type,CASE WHEN n.type='object' THEN ${projection('n.value', Object.keys(expected))} END AS metadata
      FROM (${nodes('$document', path)}) n`, document);
    if (values.length !== 1 || values[0].type !== 'object' || !matches(values[0].metadata as string, expected)) {
      throw new Error('actual field execution ownership metadata mirror differs');
    }
  };
  const version = (document: string, path: SqliteJsonMetadataPath) => {
    const values = sqliteMetadataAll(db, `SELECT type,atom FROM (${nodes('$document', [...path, 'sourceVersion'])})`, document);
    if (values.length !== 1 || values[0].type !== 'text' || !id(values[0].atom)) throw new Error('actual field execution Source version metadata differs');
    return values[0].atom;
  };
  const shape = (document: string, path: SqliteJsonMetadataPath, keys: readonly string[], count = 1) => {
    const values = sqliteMetadataAll(db, `SELECT n.type,CASE WHEN n.type='object' THEN
      (SELECT json_group_array(key) FROM json_each(n.value)) END AS keys FROM (${nodes('$document', path)}) n`, document);
    const wanted = JSON.stringify([...keys].sort());
    if (values.length !== count || values.some(value => value.type !== 'object'
      || JSON.stringify((JSON.parse(value.keys as string) as string[]).sort()) !== wanted)) {
      throw new Error('actual field execution archive format metadata differs');
    }
  };
  const text = (document: string, path: SqliteJsonMetadataPath) => {
    const values = sqliteMetadataAll(db, `SELECT type,atom FROM (${nodes('$document', path)})`, document);
    if (values.length !== 1 || values[0].type !== 'text' || !id(values[0].atom)) {
      throw new Error('actual field execution archive text metadata differs');
    }
  };
  const sourceValid = valid(row.source_json), snapshotValid = valid(row.snapshot_json);
  let sourceVersion: string | null = null;
  if (sourceValid) { object(row.source_json, [], sourceIdentity(row)); sourceVersion = version(row.source_json, []); }
  if (snapshotValid) {
    // Format selects only ownership metadata paths. It does not authorize a saved
    // manifest or require replaying opaque future Source/action payloads. The own
    // bounded reader separately rederives and compares every expected archive byte.
    const formats = sqliteMetadataAll(db, `SELECT type,atom FROM (${nodes('$document', ['snapshotFormat'])})`, row.snapshot_json);
    if (formats.length && (formats.length !== 1 || formats[0].type !== 'text' || ![ownedScheduledMotionSnapshotFormat,receivedRenewalAdoptionSnapshotFormat,receivedContinuationSnapshotFormat].includes(formats[0].atom as typeof ownedScheduledMotionSnapshotFormat))) {
      throw new Error('actual field execution archive format metadata differs');
    }
    const renewalFormat=formats.length===1&&formats[0].atom===receivedRenewalAdoptionSnapshotFormat;
    const continuationFormat=formats.length===1&&formats[0].atom===receivedContinuationSnapshotFormat;
    const kinds=(document:string,path:SqliteJsonMetadataPath)=>sqliteMetadataAll(db,`SELECT type,atom FROM (${nodes('$document',path)})`,document);
    const sourceKinds=sourceValid?kinds(row.source_json,['action','kind']):[],snapshotKinds=kinds(row.snapshot_json,['source','action','kind']);
    const continuationSource=[...sourceKinds,...snapshotKinds].some(k=>k.type==='text'&&k.atom==='received_renewal_continuation_v1');
    if(continuationSource!==continuationFormat||continuationFormat&&(!sourceValid||sourceKinds.length!==1||snapshotKinds.length!==1
      ||sourceKinds[0].type!=='text'||sourceKinds[0].atom!=='received_renewal_continuation_v1'||snapshotKinds[0].type!=='text'||snapshotKinds[0].atom!=='received_renewal_continuation_v1'))throw new Error('received continuation archive kind or format differs');
    if(continuationFormat){
      const source=receivedContinuationInput(JSON.parse(row.source_json),row.source_id);
      shape(row.source_json,['action'],['kind','renewalEnrollmentSourceId','renewalAdoptionSourceId']);
      shape(row.snapshot_json,['source','action'],['kind','renewalEnrollmentSourceId','renewalAdoptionSourceId']);
      object(row.snapshot_json,['source','action'],source.action);
      const prior=prefix.at(-2);if(!prior||prior.source_id!==source.action.renewalAdoptionSourceId||prior.revision!==row.revision-1)throw new Error('received continuation strict physical rank differs');
      assertReceivedContinuationPhysicalAdmission(db,source,row.revision);
    }
    const renewalSource=[...sourceKinds,...snapshotKinds].some(k=>k.type==='text'&&k.atom==='received_renewal_adoption_v1');
    if(renewalSource!==renewalFormat||renewalFormat&&(!sourceValid||sourceKinds.length!==1||snapshotKinds.length!==1
      ||sourceKinds[0].type!=='text'||sourceKinds[0].atom!=='received_renewal_adoption_v1'||snapshotKinds[0].type!=='text'||snapshotKinds[0].atom!=='received_renewal_adoption_v1'))throw new Error('received renewal physical archive format or Source kind differs');
    if(renewalFormat){
      const keys=['kind','renewalEnrollmentSourceId','renewalMotorSourceId'];
      shape(row.source_json,['action'],keys);shape(row.snapshot_json,['source','action'],keys);
      const expected:Record<string,string>={kind:'received_renewal_adoption_v1'};
      for(const key of ['renewalEnrollmentSourceId','renewalMotorSourceId']){
        text(row.source_json,['action',key]);
        expected[key]=String(kinds(row.source_json,['action',key])[0].atom);
      }
      object(row.snapshot_json,['source','action'],expected);
    }
    const manifest = formats.length === 1;
    object(row.snapshot_json, [], { revision: row.revision }); object(row.snapshot_json, ['source'], sourceIdentity(row));
    const snapshotVersion = version(row.snapshot_json, ['source']);
    if (sourceVersion !== null && sourceVersion !== snapshotVersion) throw new Error('actual field execution Source version mirror differs');
    object(row.snapshot_json, ['baseField'], {});
    object(row.snapshot_json, ['baseField', 'source'], { sourceId: row.base_field_source_id });
    if (manifest) {
      shape(row.snapshot_json, [], ['snapshotFormat', 'source', 'baseField', 'revision', 'history', 'execution']);
      shape(row.snapshot_json, ['baseField'], ['source', 'sourceHash', 'snapshotHash', 'physicalPitchSourceId', 'gameId']);
      shape(row.snapshot_json, ['baseField', 'source'], ['sourceId', 'sourceVersion']);
      object(row.snapshot_json, ['baseField'], { physicalPitchSourceId: row.physical_pitch_source_id, gameId: row.game_id });
      version(row.snapshot_json, ['baseField', 'source']);
      text(row.snapshot_json, ['baseField', 'sourceHash']); text(row.snapshot_json, ['baseField', 'snapshotHash']);
      shape(row.snapshot_json, ['history', { array: 'all' }],
        ['sourceId', 'sourceVersion', 'baseFieldSourceId', 'previousExecutionSourceId', 'sourceHash'], row.revision);
    } else {
      for (const path of [['baseField', 'response'], ['baseField', 'response', 'touch'],
        ['baseField', 'response', 'touch', 'worldContact'], ['baseField', 'response', 'touch', 'worldContact', 'flight']] as const) {
        object(row.snapshot_json, path, {});
      }
      object(row.snapshot_json, ['baseField', 'response', 'model'], { gameId: row.game_id });
      object(row.snapshot_json, ['baseField', 'response', 'touch', 'worldContact', 'flight', 'source'], { physicalPitchSourceId: row.physical_pitch_source_id });
    }
    const history = sqliteMetadataAll(db, `SELECT n.type FROM (${nodes('$document', ['history'])}) n`, row.snapshot_json);
    const entries = sqliteMetadataAll(db, `SELECT n.type,${projection("CASE WHEN n.type='object' THEN n.value ELSE 'null' END", Object.keys(sourceIdentity(row)))} AS metadata,
      ${projection("CASE WHEN n.type='object' THEN n.value ELSE 'null' END", ['sourceVersion'])} AS version,
      ${projection("CASE WHEN n.type='object' THEN n.value ELSE 'null' END", ['sourceHash'])} AS hash
      FROM (${nodes('$document', ['history', { array: 'all' }])}) n`, row.snapshot_json);
    if (history.length !== 1 || history[0].type !== 'array' || entries.length !== row.revision
      || entries.some((entry, i) => entry.type !== 'object' || !prefix[i] || !matches(entry.metadata as string, sourceIdentity(prefix[i])))) {
      throw new Error('actual field execution history metadata mirror differs');
    }
    for (const [i, entry] of entries.entries()) {
      const metadata = JSON.parse(entry.version as string) as [string, string, unknown][];
      if (metadata.length !== 1 || metadata[0][1] !== 'text' || !id(metadata[0][2])
        || valid(prefix[i].source_json) && metadata[0][2] !== version(prefix[i].source_json, [])) throw new Error('actual field execution history version metadata differs');
      if (manifest) {
        const hashes = JSON.parse(entry.hash as string) as [string, string, unknown][];
        if (hashes.length !== 1 || hashes[0][1] !== 'text' || !id(hashes[0][2])) throw new Error('actual field execution history digest metadata differs');
      }
    }
  }
};
