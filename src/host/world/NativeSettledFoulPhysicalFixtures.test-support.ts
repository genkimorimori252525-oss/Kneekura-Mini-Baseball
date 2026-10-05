import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { battedWorldFieldFixture } from './BattedWorldFieldFixtures.test-support';
import { battedWorldFieldEvidenceFromSqlite, type DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';

const inputTables = ['physical_pitch_progress_actions', 'batted_ball_flights', 'batted_world_models',
  'batted_world_contacts', 'batted_first_fielder_touches', 'batted_contact_response_models',
  'batted_contact_responses', 'batted_world_base_geometries', 'batted_world_field_geometries'] as const;
export const nativeSettledFoulInputArchiveBytes = (db: Pick<import('node:sqlite').DatabaseSync, 'prepare'>): string =>
  JSON.stringify(inputTables.map(table => ({ table, rows: db.prepare(`SELECT * FROM ${table} ORDER BY source_id`).all() })));

/** Synthetic incoming pitch direction, accepted before pitch execution.
 * Existing fixture bodies, contact response, materials, flight parameters and
 * base geometry remain unchanged. No saved ball state or territory is edited. */
export const nativeSettledFoulPhysicalFixture = (path: string) => {
  const originalPitchPhysics = { velocity: { x: 1, y: 0, z: -30 } };
  const x = battedWorldFieldFixture(path, true, false, undefined, {
    originalProfile: { ruleProfileId: NPB_2026_RULE_PROFILE.id }, pitchPhysics: originalPitchPhysics,
  });
  try {
    const inputArchiveBytes = () => nativeSettledFoulInputArchiveBytes(x.f.db);
    const originalInputArchiveBytes = inputArchiveBytes();
    const originalMatchBytes = JSON.stringify(x.f.official.getMatch('game-1'));
    const fields: DurableBattedWorldFieldAction[] = [x.fields.accept(x.source.sourceId)];
    const first = fields[0], horizonTick = first.field.motion.world.moment.ball.tick + 100_000_000;
    // This is only a bounded fixture search. Its horizon/step limit cannot certify a stop.
    for (let step = 0; step < 32; step++) {
      const previous = fields.at(-1)!, world = previous.field.motion.world;
      if (world.kind === 'boundary' && world.contacts.length === 1 && world.contacts[0].kind === 'rolling_stop') break;
      if (world.kind !== 'boundary' || world.contacts.length !== 1 || world.contacts[0].kind !== 'ground') {
        throw new Error('original foul fixture encountered a non-ground physical boundary before its stop');
      }
      const source = { ...x.source, sourceId: `foul-original-field-${step + 2}`,
        previousFieldSourceId: previous.source.sourceId, throughTick: horizonTick };
      x.sources.set(source.sourceId, source);
      fields.push(x.fields.accept(source.sourceId));
    }
    const last = fields.at(-1)!, stopped = last.field.motion.world;
    if (stopped.kind !== 'boundary' || stopped.contacts.length !== 1 || stopped.contacts[0].kind !== 'rolling_stop') {
      throw new Error('original foul fixture did not produce an actual rolling-stop contact within its bounded search');
    }
    const reader = battedWorldFieldEvidenceFromSqlite(x.f.db);
    const accepted = reader.read(last.source.sourceId);
    if (!accepted) throw new Error('original foul fixture lost its own persisted final field Source');
    const prefix = { baseField: accepted, fields: reader.scope(accepted, accepted.source.sourceId), executions: [] };
    const physical = battedWorldFieldPhysicalPrefix(prefix);
    if (inputArchiveBytes() !== originalInputArchiveBytes) throw new Error('original foul fixture rewrote an accepted input archive');
    return { ...x, originalPitchPhysics, fieldHistory: fields, first, last: accepted, prefix, physical,
      inputArchiveBytes, originalInputArchiveBytes, originalMatchBytes };
  } catch (error) {
    x.f.close();
    throw error;
  }
};
