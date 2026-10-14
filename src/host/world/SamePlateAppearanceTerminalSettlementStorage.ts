import type { DatabaseSync } from 'node:sqlite';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { sqliteJsonMetadataNodes } from './SqliteOwnershipMetadata';
import { samePaTerminalSettlementInput, type SamePaTerminalSettlementPlan } from './SamePlateAppearanceTerminalSettlement';

export const samePaSettlementSchema = Object.freeze({
  pa_settlement_v1_plans: 'CREATE TABLE pa_settlement_v1_plans(source_id TEXT PRIMARY KEY,enrollment_source_id TEXT NOT NULL UNIQUE,terminal_source_id TEXT NOT NULL UNIQUE,career_id TEXT NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(game_id,play_id))',
  pa_settlement_v1_releases: 'CREATE TABLE pa_settlement_v1_releases(settlement_source_id TEXT PRIMARY KEY,enrollment_source_id TEXT NOT NULL UNIQUE,terminal_source_id TEXT NOT NULL UNIQUE,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL)',
});
type Db = Pick<DatabaseSync, 'prepare'>;
const names = Object.keys(samePaSettlementSchema) as (keyof typeof samePaSettlementSchema)[];
export const assertSamePaSettlementStorage = (db: Db): boolean => {
  const predicate = "lower(name) GLOB 'pa_settlement_*' OR lower(tbl_name) GLOB 'pa_settlement_*'";
  if (db.prepare('SELECT 1 FROM temp.sqlite_master WHERE ' + predicate).get()) throw new Error('same-PA settlement temporary owner shadow');
  const rows = db.prepare('SELECT type,name,tbl_name,sql FROM main.sqlite_master WHERE ' + predicate).all();
  if (!rows.length) return false;
  for (const name of names) {
    const found = rows.filter(row => String(row.name).toLowerCase() === name);
    if (found.length !== 1 || found[0].name !== name || found[0].type !== 'table' || found[0].sql !== samePaSettlementSchema[name]) throw new Error('same-PA settlement schema is partial or differs');
  }
  if (rows.some(row => row.type === 'index' ? row.sql !== null || !String(row.name).startsWith('sqlite_autoindex_')
    : row.type !== 'table' || !names.includes(row.name as keyof typeof samePaSettlementSchema))) throw new Error('same-PA settlement unexpected schema object');
  return true;
};
const rawIdentity = (column: string, path: readonly string[], parameter: string) =>
  `EXISTS(SELECT 1 FROM (${sqliteJsonMetadataNodes(column, path)}) identity WHERE identity.type='text' AND identity.atom=${parameter})`;
export const samePaSettlementPlanRow = (plan: SamePaTerminalSettlementPlan) => ({
  source_id: plan.source.sourceId, enrollment_source_id: plan.enrollmentReference.sourceId,
  terminal_source_id: plan.source.terminalReference.sourceId, career_id: plan.lineage.careerId,
  game_id: plan.lineage.gameId, play_id: plan.lineage.playId,
  source_json: json(plan.source), source_hash: hash(plan.source), snapshot_json: json(plan), snapshot_hash: hash(plan),
});
export const readSamePaSettlementPlanRow = (db: Db, sourceId: string): SamePaTerminalSettlementPlan | null => {
  if (!assertSamePaSettlementStorage(db)) return null;
  const rows = db.prepare(`SELECT * FROM main.pa_settlement_v1_plans WHERE source_id=$id OR ${rawIdentity('source_json', ['sourceId'], '$id')}
    OR ${rawIdentity('snapshot_json', ['source', 'sourceId'], '$id')}`).all({ id: sourceId });
  if (!rows.length) {
    if (db.prepare(`SELECT 1 FROM main.pa_settlement_v1_releases WHERE settlement_source_id=$id
      OR ${rawIdentity('snapshot_json', ['settlementReference', 'sourceId'], '$id')}`).get({ id: sourceId })) throw new Error('same-PA settlement missing plan has surviving release');
    return null;
  }
  if (rows.length !== 1 || rows[0].source_id !== sourceId) throw new Error('same-PA settlement Source alias differs');
  const plan = JSON.parse(String(rows[0].snapshot_json)) as SamePaTerminalSettlementPlan;
  samePaTerminalSettlementInput(plan.source, sourceId);
  if (plan.kind !== 'terminal_settlement_plan' || json(rows[0]) !== json(samePaSettlementPlanRow(plan))) throw new Error('same-PA settlement plan archive differs');
  const aliases = db.prepare(`SELECT source_id FROM main.pa_settlement_v1_plans WHERE enrollment_source_id=$enrollment
    OR terminal_source_id=$terminal OR ${rawIdentity('source_json', ['terminalReference', 'sourceId'], '$terminal')}
    OR ${rawIdentity('snapshot_json', ['enrollmentReference', 'sourceId'], '$enrollment')}
    OR ${rawIdentity('snapshot_json', ['lineage', 'enrollmentReference', 'sourceId'], '$enrollment')}
    OR ${rawIdentity('snapshot_json', ['source', 'terminalReference', 'sourceId'], '$terminal')}`).all({ enrollment: plan.enrollmentReference.sourceId, terminal: plan.source.terminalReference.sourceId });
  if (aliases.length !== 1 || aliases[0].source_id !== sourceId) throw new Error('same-PA settlement terminal/enrollment ownership differs');
  return plan;
};
export const samePaSettlementMetadataIdentity = rawIdentity;
