/** A later actual motion owner supersedes fresh execution of the original unchanged commands. Historical reads remain valid. */
export const assertNoBattedWorldMotionOwner = (db: Pick<import('node:sqlite').DatabaseSync, 'prepare'>, physicalPitchSourceId: string): void => {
  for (const table of ['batted_world_motions', 'batted_world_motion_heads']) {
    if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)
      && db.prepare(`SELECT source_id FROM ${table} WHERE physical_pitch_source_id=? LIMIT 1`).get(physicalPitchSourceId)) {
      throw new Error('actual batted motion owner already executes the future');
    }
  }
};
