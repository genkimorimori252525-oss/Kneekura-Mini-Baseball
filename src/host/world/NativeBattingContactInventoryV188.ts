import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { TraitScope } from '../../core/world/traits/TraitTypes';
import { readNativeMeasuredBattingContactV182FromSqlite } from './NativeMeasuredBattingContactV182';
import { readNativeMeasuredOriginalPitchContactV183FromSqlite } from './NativeMeasuredOriginalPitchContactV183';
import { readNativeMeasuredInitialJointContactV184FromSqlite } from './NativeMeasuredInitialJointContactV184';
import type { NativeMeasuredContactReferenceV185 } from './NativeMeasuredBattingContactCollectionV185';
import { actorFreeze as freeze, readPhysicalPlateAppearanceActorFromSqlite } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields, samePaText } from './SamePlateAppearanceWorkPrefix';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';

const owners = ['physical_pitch_progress_actions', 'pa_physical_v1_resolutions', 'pa_initial_joint_v1_executions'] as const;
export type NativeBattingContactInventoryV188 = Readonly<{
  boundary: 'NATIVE_CONTACT_INVENTORY_ONLY'; scope: TraitScope; references: readonly NativeMeasuredContactReferenceV185[];
  inventoryHash: string; producerAvailability: Readonly<Record<typeof owners[number], 'PRESENT' | 'ABSENT'>>;
}>;

/** Canonical metadata-set hash only; synthetic arguments confer no authority. */
export const hashNativeBattingContactInventoryV188 = (scope: TraitScope,
  availability: NativeBattingContactInventoryV188['producerAvailability'], references: readonly NativeMeasuredContactReferenceV185[]): string =>
  createHash('sha256').update(JSON.stringify(['native-contact-inventory-v188', [scope.careerId, scope.playerId],
    owners.map(owner => [owner, availability[owner]]), references.map(ref => JSON.stringify([ref.owner, ref.sourceId, ref.sourceHash, ref.snapshotHash])).sort()])).digest('hex');

/** Discovers accepted contacts from the supported Native producers. Actor and
 * producer rows are authenticated by their normal owners on one snapshot.
 * Enumeration/processing order is not a physical occurrence time. */
export const readNativeBattingContactInventoryV188FromSqlite = (db: DatabaseSync, rawScope: TraitScope): NativeBattingContactInventoryV188 => {
  const scope = cloneInert(rawScope);
  if (!samePaFields(scope, ['careerId', 'playerId']) || !samePaText(scope.careerId) || !samePaText(scope.playerId)) {
    throw new Error('invalid Native contact inventory scope');
  }
  return withBattedVenueLegalReadSnapshot(db, () => {
    const present = (table: string): boolean => {
      const rows = db.prepare('SELECT type FROM main.sqlite_master WHERE name=?').all(table);
      if (rows.length && (rows.length !== 1 || rows[0].type !== 'table')) throw new Error('Native contact inventory producer schema differs');
      return rows.length === 1;
    };
    const claim = (column: string, path: string) => `CASE WHEN json_valid(${column}) THEN json_extract(${column},'${path}') END`,
      registeredGames = new Set<string>();
    if (present('official_participant_bindings')) {
      for (const row of db.prepare(`SELECT game_id FROM main.official_participant_bindings WHERE player_id=? AND ${claim('binding_json', '$.careerId')}=?`)
        .all(scope.playerId, scope.careerId)) registeredGames.add(String(row.game_id));
    }
    const actorIds: string[] = [], gameIds = new Set<string>();
    if (present('physical_plate_appearance_actors')) {
      const rows = db.prepare(`SELECT source_id,game_id,${claim('snapshot_json', '$.binding.careerId')} AS claimed_career_id,
        ${claim('source_json', '$.gameId')} AS source_game_id,${claim('snapshot_json', '$.binding.gameId')} AS snapshot_game_id
        FROM main.physical_plate_appearance_actors WHERE player_id=? OR ${claim('source_json', '$.playerId')}=? OR ${claim('snapshot_json', '$.binding.playerId')}=?`)
        .all(scope.playerId, scope.playerId, scope.playerId);
      for (const row of rows) {
        // Scope first, including any matching original mirror. An unrelated
        // career's corrupt actor cannot invalidate this subject's inventory.
        if (row.claimed_career_id !== scope.careerId
          && ![row.game_id, row.source_game_id, row.snapshot_game_id].some(value => typeof value === 'string' && registeredGames.has(value))) continue;
        const actor = readPhysicalPlateAppearanceActorFromSqlite(db, String(row.source_id));
        if (!actor) throw new Error('Native contact inventory actor disappeared');
        if (actor.binding.careerId === scope.careerId && actor.binding.playerId === scope.playerId) {
          actorIds.push(actor.source.sourceId); gameIds.add(actor.binding.gameId);
        }
      }
    }
    const enrollmentIds: string[] = [];
    if (actorIds.length && present('same_pa_enrollments')) {
      const games = [...gameIds], actorSlots = actorIds.map(() => '?').join(','), gameSlots = games.map(() => '?').join(',');
      const rows = db.prepare(`SELECT source_id FROM main.same_pa_enrollments WHERE actor_source_id IN (${actorSlots}) OR game_id IN (${gameSlots})
        OR ${claim('source_json', '$.actorReference.sourceId')} IN (${actorSlots}) OR ${claim('snapshot_json', '$.source.actorReference.sourceId')} IN (${actorSlots})`)
        .all(...actorIds, ...games, ...actorIds, ...actorIds);
      rows.forEach(row => enrollmentIds.push(String(row.source_id)));
    }
    const producerAvailability = {} as Record<typeof owners[number], 'PRESENT' | 'ABSENT'>,
      references: NativeMeasuredContactReferenceV185[] = [];
    const relevant = (binding: TraitScope): boolean => binding.careerId === scope.careerId && binding.playerId === scope.playerId;
    for (const owner of owners) {
      const exists = present(owner); producerAvailability[owner] = exists ? 'PRESENT' : 'ABSENT';
      if (!exists || !actorIds.length) continue;
      const games = [...gameIds], gameSlots = games.map(() => '?').join(','), actorSlots = actorIds.map(() => '?').join(','),
        gameClaims = owner === 'physical_pitch_progress_actions'
          ? ['game_id', claim('source_json', '$.gameId'), claim('snapshot_json', '$.frame.gameId'), claim('snapshot_json', '$.source.gameId')]
          : [claim('snapshot_json', '$.lineage.gameId')],
        actorClaim = owner === 'physical_pitch_progress_actions' ? claim('snapshot_json', '$.frame.batterActor.source.sourceId')
          : claim('snapshot_json', '$.lineage.actorReference.sourceId'),
        clauses = gameClaims.map(field => `${field} IN (${gameSlots})`), values: string[] = gameClaims.flatMap(() => games);
      // Include an indexed or snapshot/source mirror that claims the subject.
      // Its normal owner, rather than this prefilter, rejects disagreement.
      clauses.push(`${actorClaim} IN (${actorSlots})`); values.push(...actorIds);
      if (owner !== 'physical_pitch_progress_actions' && enrollmentIds.length) {
        clauses.push(`enrollment_source_id IN (${enrollmentIds.map(() => '?').join(',')})`); values.push(...enrollmentIds);
      }
      const rows = db.prepare(`SELECT source_id,source_hash,snapshot_hash FROM main.${owner} WHERE ${clauses.join(' OR ')}`).all(...values);
      for (const row of rows) {
        const reference = { owner, sourceId: String(row.source_id), sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) } as NativeMeasuredContactReferenceV185;
        const contact = reference.owner === 'physical_pitch_progress_actions' ? readNativeMeasuredOriginalPitchContactV183FromSqlite(db, reference)
          : reference.owner === 'pa_physical_v1_resolutions' ? readNativeMeasuredBattingContactV182FromSqlite(db, reference)
            : readNativeMeasuredInitialJointContactV184FromSqlite(db, reference);
        if (contact && relevant(contact.actor.binding)) references.push(reference);
      }
    }
    // Canonical set hashing stabilizes identity, not observation order. A future
    // capture writer allocates its own sequence when it actually accepts a ref.
    const inventoryHash = hashNativeBattingContactInventoryV188(scope, producerAvailability, references);
    return freeze({ boundary: 'NATIVE_CONTACT_INVENTORY_ONLY' as const, scope, references, inventoryHash, producerAvailability });
  });
};
