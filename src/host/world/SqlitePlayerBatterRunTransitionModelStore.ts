import type { DatabaseSync } from 'node:sqlite';
import { sqliteJsonMetadataNodes as nodes } from './SqliteOwnershipMetadata';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { playerRunnerDecisionMotionModelEvidenceFromSqlite } from './SqlitePlayerRunnerDecisionMotionModelStore';
import { playerBatterRunTransitionModelInput as input, type AcceptedPlayerBatterRunTransitionModel as Source,
  type DurablePlayerBatterRunTransitionModel as Value } from './PlayerBatterRunTransitionModel';
import { batterRunArchiveFromSqlite, openBatterRunSourceArchive, assertBatterRunArchiveStorage, type BatterRunArchiveOwner } from './BatterRunSourceArchive';
import { withPhysicalCapabilityReplay } from './AcceptedPhysicalCapabilityDevelopment';
import { withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
const table = 'world_player_batter_run_transition_models' as const;
const key = (s: Source) => json(s.runnerRebinding ? [s.careerId, s.playerId, 'runner_rebinding_v1', s.acceptedAtDay] : [s.careerId, s.playerId]);
const scope = (s: Pick<Source, 'careerId' | 'playerId'>) => {
  const pair = (column: string, path: readonly string[]) => `EXISTS(SELECT 1 FROM (${nodes(column, path)}) o,
    json_each(CASE WHEN o.type='object' THEN o.value ELSE '{}' END) c,json_each(CASE WHEN o.type='object' THEN o.value ELSE '{}' END) p
    WHERE c.key='careerId' AND c.type='text' AND c.atom=? AND p.key='playerId' AND p.type='text' AND p.atom=?)`;
  return { sql: [pair('source_json', []), pair('snapshot_json', ['source']), pair('snapshot_json', ['runnerModel', 'source']),
    pair('snapshot_json', ['runnerModel', 'person'])].join(' OR '), values: [s.careerId, s.playerId, s.careerId, s.playerId,
    s.careerId, s.playerId, s.careerId, s.playerId] };
};
/** Enumerate original claims without making prior frames depend on later proof. */
const history = (db: DatabaseSync, s: Pick<Source, 'careerId' | 'playerId'>) => {
  if (!assertBatterRunArchiveStorage(db, table)) return [];
  const where = scope(s), rows = db.prepare(`SELECT * FROM ${table} WHERE ${where.sql}`).all(...where.values);
  const values = rows.map(row => {
    const source = input(JSON.parse(String(row.source_json)), String(row.source_id)), value = JSON.parse(String(row.snapshot_json)) as Value;
    if (source.careerId !== s.careerId || source.playerId !== s.playerId || row.ownership_key !== key(source)
      || row.source_json !== json(source) || row.source_hash !== hash(source) || json(value.source) !== json(source)
      || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('batter-run model original history claim differs');
    return { source, row };
  }).sort((a, b) => a.source.acceptedAtDay - b.source.acceptedAtDay);
  for (const [index, value] of values.entries()) {
    const prior = values[index - 1], ref = value.source.runnerRebinding?.originalModelReference;
    if (!prior ? !!ref : !ref || value.source.acceptedAtDay <= prior.source.acceptedAtDay || ref.sourceId !== prior.source.sourceId
      || ref.sourceHash !== prior.row.source_hash || ref.snapshotHash !== prior.row.snapshot_hash) throw new Error('batter-run model original predecessor differs');
  }
  return values;
};
const make = (db: DatabaseSync): BatterRunArchiveOwner<Source, Value> => ({
  input,
  derive: source => withPhysicalCapabilityReplay(db, 'batter_run_transition', source.sourceId, () => {
    history(db, source);
    const runnerModel = playerRunnerDecisionMotionModelEvidenceFromSqlite(db).read(source.runnerModelReference.sourceId);
    if (!runnerModel || json(source.runnerModelReference) !== json(reference('world_player_runner_decision_motion_models', runnerModel))
      || source.careerId !== runnerModel.source.careerId || source.playerId !== runnerModel.source.playerId
      || source.personLinkSourceId !== runnerModel.source.personLinkSourceId || source.acceptedAtDay < runnerModel.source.acceptedAtDay
      || source.parameters.ticksPerSecond !== runnerModel.source.motion.ticksPerSecond) throw new Error('batter-run original runner model, Person, day or clock differs');
    if (source.runnerRebinding) {
      const pin = source.runnerRebinding.originalModelReference;
      const original = batterRunArchiveFromSqlite(db, table, make(db)).read(pin.sourceId);
      if (!original || json(reference(table, original)) !== json(pin) || !runnerModel.source.developmentProvenance
        || source.acceptedAtDay <= original.source.acceptedAtDay || runnerModel.source.acceptedAtDay <= original.runnerModel.source.acceptedAtDay
        || json(runnerModel.person) !== json(original.runnerModel.person) || json(source.parameters) !== json(original.source.parameters)) {
        throw new Error('batter-run rebinding original model or explicit recovery calibration differs');
      }
    }
    return freeze({ source, runnerModel });
  }),
  key,
  scope(s) {
    const pair = scope(s);
    return s.runnerRebinding ? { sql: `(${pair.sql}) AND (json_extract(source_json,'$.acceptedAtDay')=? OR json_extract(snapshot_json,'$.source.acceptedAtDay')=?)`,
      values: [...pair.values, s.acceptedAtDay, s.acceptedAtDay] }
      : { sql: `(${pair.sql}) AND (json_type(source_json,'$.runnerRebinding') IS NULL OR json_type(snapshot_json,'$.source.runnerRebinding') IS NULL)`, values: pair.values };
  },
  assertCurrent(value, inserted) {
    const values = history(db, value.source), prior = values.filter(v => v.source.sourceId !== value.source.sourceId).at(-1);
    const ref = value.source.runnerRebinding?.originalModelReference;
    if (ref ? !prior || prior.source.sourceId !== ref.sourceId || prior.source.acceptedAtDay >= value.source.acceptedAtDay : !!prior) {
      throw new Error('batter-run model fresh predecessor differs');
    }
    if (inserted && values.at(-1)?.source.sourceId !== value.source.sourceId
      || json(playerRunnerDecisionMotionModelEvidenceFromSqlite(db).selectAtDay(value.source.careerId, value.source.playerId, value.source.acceptedAtDay)) !== json(value.runnerModel)) {
      throw new Error('batter-run model current runner capability differs');
    }
  },
});
export const playerBatterRunTransitionModelEvidenceFromSqlite = (db: DatabaseSync) => {
  const evidence = batterRunArchiveFromSqlite(db, table, make(db));
  return { ...evidence, selectAtDay(careerId: string, playerId: string, atDay: number): Value {
    if (!careerId || !playerId || !Number.isSafeInteger(atDay) || atDay < 0) throw new Error('invalid batter-run model day');
    return withSamePaLifecycleReadPhase(db, () => {
      const value = history(db, { careerId, playerId }).filter(v => v.source.acceptedAtDay <= atDay).at(-1);
      if (!value) throw new Error('applicable batter-run model is missing');
      return evidence.read(value.source.sourceId)!;
    });
  } };
};
export const openSqlitePlayerBatterRunTransitionModelStore = (path: string, authority?: Readonly<{ readAcceptedModel(id: string): Source | null }>) =>
  openBatterRunSourceArchive(path, table, make, authority?.readAcceptedModel.bind(authority));
