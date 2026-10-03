/** A later actual motion owner supersedes fresh execution of the original unchanged commands. Historical reads remain valid. */
export const assertNoBattedWorldMotionOwner = (db: Pick<import('node:sqlite').DatabaseSync, 'prepare'>, physicalPitchSourceId: string): void => {
  assertNoBattedWorldFieldOwner(db, physicalPitchSourceId);
  for (const table of ['batted_world_motions', 'batted_world_motion_heads']) {
    if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)
      && db.prepare(`SELECT source_id FROM ${table} WHERE physical_pitch_source_id=? LIMIT 1`).get(physicalPitchSourceId)) {
      throw new Error('actual batted motion owner already executes the future');
    }
  }
};

/** Execution adopts a later actual motion/acquisition future; lower fresh motion may no longer replay over it. */
export const assertNoBattedWorldExecutionOwner = (db: Pick<import('node:sqlite').DatabaseSync, 'prepare'>, physicalPitchSourceId: string): void => {
  assertNoBattedWorldFieldOwner(db, physicalPitchSourceId);
  for (const table of ['batted_world_executions', 'batted_world_execution_heads']) {
    if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)
      && db.prepare(`SELECT source_id FROM ${table} WHERE physical_pitch_source_id=? LIMIT 1`).get(physicalPitchSourceId)) {
      throw new Error('actual batted execution owner already executes the future');
    }
  }
};

/** Original field execution owns physical motion from bat contact; historical readers remain unchanged. */
export const assertNoBattedWorldFieldOwner = (db: Pick<import('node:sqlite').DatabaseSync, 'prepare'>, physicalPitchSourceId: string): void => {
  if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='batted_world_field_actions'").get()
    && db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='batted_contact_responses'").get()
    && db.prepare(`SELECT a.source_id FROM batted_world_field_actions a JOIN batted_contact_responses r
      ON r.source_id=CASE WHEN json_valid(a.source_json) THEN json_extract(a.source_json,'$.responseSourceId') END
      WHERE r.physical_pitch_source_id=? LIMIT 1`).get(physicalPitchSourceId)) {
    throw new Error('actual batted field owner already executes the physical prefix');
  }
  if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='batted_world_field_actions'").get()
    && db.prepare(`SELECT source_id FROM batted_world_field_actions WHERE physical_pitch_source_id=?
      OR CASE WHEN json_valid(snapshot_json) THEN json_extract(snapshot_json,'$.response.touch.worldContact.flight.source.physicalPitchSourceId') END=?`)
      .get(physicalPitchSourceId, physicalPitchSourceId)) throw new Error('actual batted field owner already executes the physical prefix');
  for (const table of ['batted_world_field_actions', 'batted_world_field_heads']) {
    if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)
      && db.prepare(`SELECT source_id FROM ${table} WHERE physical_pitch_source_id=? LIMIT 1`).get(physicalPitchSourceId)) {
      throw new Error('actual batted field owner already executes the physical prefix');
    }
  }
};

/** A field-execution prefix owns the future of its original field action; metadata cannot hide that ownership. */
export const assertNoBattedWorldFieldExecutionOwner = (db: Pick<import('node:sqlite').DatabaseSync, 'prepare'>, physicalPitchSourceId: string): void => {
  for (const table of ['batted_world_field_executions', 'batted_world_field_execution_heads']) {
    if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)) continue;
    const clauses = ['physical_pitch_source_id=?', 'base_field_source_id IN (SELECT source_id FROM batted_world_field_actions WHERE physical_pitch_source_id=?)'];
    const values = [physicalPitchSourceId, physicalPitchSourceId];
    if (table === 'batted_world_field_executions') {
      clauses.push(`CASE WHEN json_valid(source_json) THEN json_extract(source_json,'$.baseFieldSourceId') END
        IN (SELECT source_id FROM batted_world_field_actions WHERE physical_pitch_source_id=?)`);
      clauses.push(`CASE WHEN json_valid(snapshot_json) THEN json_extract(snapshot_json,'$.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId') END=?`);
      values.push(physicalPitchSourceId, physicalPitchSourceId);
    }
    if (db.prepare(`SELECT source_id FROM ${table} WHERE ${clauses.join(' OR ')} LIMIT 1`).get(...values)) {
      throw new Error('actual field execution owner already executes the future');
    }
  }
};
