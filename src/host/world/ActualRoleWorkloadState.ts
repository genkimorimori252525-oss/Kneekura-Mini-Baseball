import type { DatabaseSync } from 'node:sqlite';
import { createPlayerWorkloadRecovery, advancePlayerWorkloadRecovery, type PlayerWorkloadActivity, type PlayerWorkloadRecoveryState } from '../../core/world/development/PlayerWorkloadRecovery';
import type { AcceptedPlayerWorkloadBaseline } from './SqlitePlayerWorkloadRecoveryStore';
import { isAcceptedPlayerIntakeSource } from './SqlitePlayerPersonLinkStore';
import { actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { defensiveMetadataId as claim } from './ActualDefensiveMetadata';
import { actualLivePlayFields as fields, actualLivePlayId as id } from './ActualLivePlayScope';
type Db = Pick<DatabaseSync, 'prepare'>;
export const actualRoleTableInstalled = (db: Db, name: string) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
/** Verification-only projection on the writer's SQLite connection. The existing
 * workload owner remains the only writer. A historical revision reads no later
 * activity payload; a new settlement freeze checks the complete current head. */
export const readActualRoleWorkloadState = (db: Db, careerId: string, playerId: string, revision?: number, expectedPersonLinkSourceId?: string): PlayerWorkloadRecoveryState | null => {
  if (![careerId, playerId].every(id) || revision !== undefined && (!Number.isSafeInteger(revision) || revision < 0)) throw new Error('invalid actual role workload revision/scope');
  if (!actualRoleTableInstalled(db, 'world_player_workload_baselines')) return null;
  const scope = `(career_id=$career OR ${claim('source_json', ['careerId'], '$career')}) AND (player_id=$player OR ${claim('source_json', ['playerId'], '$player')})`;
  const params = { career: careerId, player: playerId };
  const bases = db.prepare(`SELECT * FROM world_player_workload_baselines WHERE ${scope}`).all(params);
  if (bases.length !== 1) {
    if (bases.length || db.prepare('SELECT 1 FROM world_player_workload_heads WHERE career_id=? AND player_id=?').get(careerId, playerId)
      || db.prepare(`SELECT 1 FROM world_player_workload_activities WHERE ${scope}`).get(params)) throw new Error('actual role workload baseline ownership differs');
    return null;
  }
  const row = bases[0], source = JSON.parse(String(row.source_json)) as AcceptedPlayerWorkloadBaseline;
  if (!fields(source, ['sourceId', 'sourceVersion', 'personLinkSourceId', 'careerId', 'playerId', 'createdAtDay', 'fatigue', 'recoveryCapacity', 'policy'])
    || !id(source.sourceVersion) || source.sourceId !== row.source_id || source.careerId !== careerId || source.playerId !== playerId
    || row.career_id !== careerId || row.player_id !== playerId || row.source_json !== json(source)) throw new Error('actual role workload baseline differs');
  if (expectedPersonLinkSourceId !== undefined && source.personLinkSourceId !== expectedPersonLinkSourceId) throw new Error('actual role workload original Person baseline differs');
  const links = db.prepare(`SELECT * FROM world_player_person_links WHERE source_id=$id OR ${claim('source_json', ['sourceId'], '$id')}`).all({ id: source.personLinkSourceId });
  const linkRow = links[0], link = linkRow && JSON.parse(String(linkRow.source_json));
  if (links.length !== 1 || !isAcceptedPlayerIntakeSource(link, source.personLinkSourceId)
    || link.careerId !== careerId || link.playerId !== playerId || link.acceptedAtDay > source.createdAtDay
    || linkRow.source_id !== source.personLinkSourceId || linkRow.career_id !== careerId || linkRow.player_id !== playerId
    || linkRow.person_id !== link.personId || linkRow.roster_revision !== link.rosterRevision || linkRow.accepted_at_day !== link.acceptedAtDay
    || linkRow.source_json !== json(link)) throw new Error('actual role workload original Person differs');
  let current = createPlayerWorkloadRecovery({ careerId, playerId, createdAtDay: source.createdAtDay, fatigue: source.fatigue,
    recoveryCapacity: source.recoveryCapacity, policy: source.policy });
  const policy = db.prepare('SELECT policy_json FROM world_player_workload_policies WHERE career_id=? AND policy_id=? AND version=?').get(careerId, source.policy.policyId, source.policy.version);
  if (row.initial_json !== json(current) || policy?.policy_json !== json(source.policy)) throw new Error('actual role workload baseline policy differs');
  const rows = db.prepare(`SELECT * FROM world_player_workload_activities WHERE ${scope}${revision === undefined ? '' : ' AND after_revision<=$revision'} ORDER BY after_revision`).all({ ...params, ...(revision === undefined ? {} : { revision }) });
  for (const item of rows) {
    const activity = JSON.parse(String(item.source_json)) as PlayerWorkloadActivity;
    if (item.career_id !== careerId || item.player_id !== playerId || item.source_id !== activity.sourceEventId
      || item.before_revision !== current.revision || item.after_revision !== current.revision + 1
      || item.source_json !== json(activity) || item.before_json !== json(current)) throw new Error('actual role workload historical BEFORE differs');
    current = advancePlayerWorkloadRecovery(current, current.revision, activity);
    if (item.after_json !== json(current)) throw new Error('actual role workload historical AFTER differs');
  }
  if (revision !== undefined) { if (current.revision !== revision) throw new Error('actual role workload historical revision missing'); }
  else {
    const head = db.prepare('SELECT * FROM world_player_workload_heads WHERE career_id=? AND player_id=?').get(careerId, playerId);
    if (!head || head.revision !== current.revision || head.state_json !== json(current)) throw new Error('actual role workload head differs');
  }
  return freeze(current);
};
