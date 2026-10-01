import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { assertInitialOfficialWorldEvidence, readOfficialActorPersonLink } from './SqliteOfficialInitialWorldStore';
import type { AcceptedPhysicalPitchActionSource, DurablePhysicalPitch } from './SqlitePhysicalPitchProgressStore';

import { createCanonicalPlateAppearanceTimeline, type CanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { resolveContinuousPlayerPitchAgainstBatterFromWorld } from './ContinuousPlayerPitchRuntime';

type Frame = DurablePhysicalPitch['frame'];
type Row = { source_id: string; game_id: string; play_id: number; progress_revision: number; source_json: string;
  source_hash: string; snapshot_json: string; snapshot_hash: string };
type PhysicalPitchDb = Pick<DatabaseSync, 'prepare'>;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const fields = (value: object, names: readonly string[]) => Object.keys(value).sort().join('|') === names.slice().sort().join('|');
const freeze = <T>(value: T): T => { if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
type EvidenceScope = Pick<DurablePhysicalPitch['frame'], 'gameId' | 'workload' | 'bindings' | 'activationApplicationId'> & Readonly<{
  policy: Pick<DurablePhysicalPitch['frame']['policy'], 'sourceId'>;
}>;
const json = (value: unknown): string => JSON.stringify(cloneInert(value), (_key, item: unknown) => item !== null && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const hash = (value: unknown): string => createHash('sha256').update(json(value)).digest('hex');

/** Owns actual pitch progress; independent action Sources contain no authoritative timeline or outcome. */
export const capturePhysicalPitchEvidence = (db: Pick<DatabaseSync, 'prepare'>,
  frame: EvidenceScope, mutable = false): Record<string, readonly string[]> => {
  const result: Record<string, readonly string[]> = {};
  if (frame.bindings.length !== 9 || new Set(frame.bindings.map((binding) => binding.playerId)).size !== 9
    || new Set(frame.bindings.map((binding) => binding.personId)).size !== 9) throw new Error('physical pitch actor evidence is incomplete');
  const fixture = db.prepare('SELECT fixture_event_id FROM official_fixtures WHERE game_id=?')
    .get(frame.gameId) as { fixture_event_id: string } | undefined;
  for (const binding of frame.bindings) {
    const row = db.prepare('SELECT binding_json FROM official_participant_bindings WHERE game_id=? AND player_id=?')
      .get(binding.gameId, binding.playerId) as { binding_json: string } | undefined;
    const first = frame.bindings[0];
    if (!row || json(JSON.parse(row.binding_json)) !== json(binding) || !fixture || binding.gameId !== frame.gameId
      || binding.fixtureEventId !== fixture.fixture_event_id || binding.careerId !== frame.workload.careerId
      || binding.competitionEditionId !== first.competitionEditionId || binding.gameDay !== first.gameDay
      || binding.clubId !== first.clubId || binding.side !== first.side) throw new Error('physical pitch actor binding evidence differs');
    readOfficialActorPersonLink(db, binding);
  }
  const scope = [frame.workload.careerId, frame.workload.playerId];
  for (const table of ['world_pitch_timing_baselines', 'world_pitch_timing_updates', 'world_player_release_baselines',
    'world_player_release_changes', 'world_player_workload_baselines', 'world_player_workload_activities']) {
    result[table] = db.prepare(`SELECT * FROM ${table} WHERE career_id=? AND player_id=?`).all(...scope).map(hash).sort();
  }
  result.policy = db.prepare('SELECT * FROM world_pitch_fatigue_policies WHERE source_id=?').all(frame.policy.sourceId).map(hash);
  result.workloadPolicy = db.prepare('SELECT * FROM world_player_workload_policies WHERE career_id=? AND policy_id=? AND version=?')
    .all(frame.workload.careerId, frame.workload.policy.policyId, frame.workload.policy.version).map(hash);
  result.bindings = frame.bindings.flatMap((binding) => db.prepare('SELECT * FROM official_participant_bindings WHERE game_id=? AND player_id=?')
    .all(binding.gameId, binding.playerId).map(hash));
  result.personLinks = frame.bindings.flatMap((binding) => db.prepare('SELECT * FROM world_player_person_links WHERE source_id=?')
    .all(binding.personLinkSourceId).map(hash));
  result.fixture = db.prepare('SELECT * FROM official_fixtures WHERE game_id=?').all(frame.gameId).map(hash);
  result.activation = frame.activationApplicationId === null ? [] : db.prepare('SELECT * FROM applications WHERE application_id=? AND match_id=?')
    .all(frame.activationApplicationId, frame.gameId).map(hash);
  if (mutable) {
    result.match = db.prepare('SELECT * FROM matches WHERE match_id=?').all(frame.gameId).map(hash);
    for (const table of ['world_pitch_timing_heads', 'world_player_release_heads', 'world_player_workload_heads']) {
      result[table] = db.prepare(`SELECT * FROM ${table} WHERE career_id=? AND player_id=?`).all(...scope).map(hash);
    }
  }
  return result;
};

export const physicalPitchActionInput = (raw: AcceptedPhysicalPitchActionSource, sourceId: string): AcceptedPhysicalPitchActionSource => {
  const source = cloneInert(raw), initial = source && 'initialWorldSourceId' in source;
  if (!source || !fields(source, ['sourceId', 'sourceVersion', 'gameId', 'request', 'effortPolicy', initial ? 'initialWorldSourceId' : 'activationApplicationId'])
    || source.sourceId !== sourceId || !id(sourceId) || !id(source.sourceVersion) || !id(source.gameId)
    || !id(initial ? source.initialWorldSourceId : source.activationApplicationId)
    || !source.request || !fields(source.request, ['delivery', 'flight', 'batter', 'workloadRevision', 'policySourceId'])
    || !integer(source.request.workloadRevision) || !id(source.request.policySourceId) || !source.request.delivery
    || !fields(source.request.delivery, ['careerId', 'playerId', 'gameDay', 'matchSeed', 'moundReference', 'outingId', 'readyAtUs', 'timingIntent', 'physics'])
    || !id(source.request.delivery.careerId) || !id(source.request.delivery.playerId) || !integer(source.request.delivery.gameDay)
    || !source.request.flight || !fields(source.request.flight, ['durationUs', 'acceleration']) || !source.request.batter
    || !fields(source.request.batter, source.request.batter.action?.kind === 'take' ? ['action', 'plateZ', 'strikeZone', 'ballRadiusMeters'] : ['action'])
    || !source.request.batter.action || !fields(source.request.batter.action, source.request.batter.action.kind === 'take' ? ['kind'] : ['kind', 'swing'])) {
    throw new Error('invalid accepted physical pitch action Source');
  }
  return source;
};

export const assertPhysicalPitchOriginalEvidence = (db: PhysicalPitchDb, frame: Frame): void => {
  const current = capturePhysicalPitchEvidence(db, frame);
  if (!fields(frame.immutableEvidence, Object.keys(current))) throw new Error('physical pitch evidence fields differ');
  for (const key of Object.keys(current)) {
    const available = new Set(current[key]);
    if (!Array.isArray(frame.immutableEvidence[key]) || frame.immutableEvidence[key].some((value) => !available.has(value))) {
      throw new Error('original physical pitch evidence changed');
    }
  }
  if (frame.initialWorld) assertInitialOfficialWorldEvidence(db, frame.initialWorld, true);
};

export const executePhysicalPitchAction = (source: AcceptedPhysicalPitchActionSource, frame: Frame, beforeTimeline: CanonicalPlateAppearanceTimeline,
  progressRevision: number): DurablePhysicalPitch => {
  if (source.gameId !== frame.gameId || json(source.effortPolicy) !== json(frame.effortPolicy) || source.request.workloadRevision !== frame.workload.revision
    || source.request.policySourceId !== frame.policy.sourceId || source.request.delivery.careerId !== frame.workload.careerId
    || source.request.delivery.playerId !== frame.workload.playerId || source.request.delivery.gameDay !== frame.bindings[0].gameDay
    || source.request.delivery.matchSeed !== frame.matchSeed || source.request.delivery.outingId !== frame.outingId
    || json(source.request.delivery.moundReference) !== json(frame.moundReference)) throw new Error('physical pitch frame differs');
  const result = resolveContinuousPlayerPitchAgainstBatterFromWorld({ workload: { selectAtRevision: () => frame.workload },
    timing: { selectProfileAtDay: () => frame.timing }, release: { selectAtDay: () => frame.release },
    policies: { readAcceptedPolicy: () => frame.policy }, effortPolicies: { readAcceptedPolicy: () => frame.effortPolicy } },
  { ...source.request, timeline: beforeTimeline, effortPolicySourceId: frame.effortPolicy.sourceId,
    delivery: { ...source.request.delivery, playId: frame.match.playId, pitchIndex: progressRevision - 1 } });
  if (result.pitch.resolution.kind !== 'recorded') throw new Error('physical pitch action is unresolved');
  return freeze({ source, progressRevision, frame, beforeTimeline, result });
};

export const readPhysicalPitchProgressFromSqlite = (db: PhysicalPitchDb, gameId: string, playId: number): DurablePhysicalPitch[] => {
  try {
    const rows = db.prepare('SELECT * FROM physical_pitch_progress_actions WHERE game_id=? AND play_id=? ORDER BY progress_revision').all(gameId, playId) as Row[];
    const head = db.prepare('SELECT revision, last_source_id FROM physical_pitch_progress_heads WHERE game_id=? AND play_id=?').get(gameId, playId) as { revision: number; last_source_id: string } | undefined;
    if (rows.length === 0) { if (head) throw new Error('physical pitch head lacks history'); return []; }
    const first = JSON.parse(rows[0].snapshot_json) as DurablePhysicalPitch, frame = cloneInert(first.frame);
    if (frame.gameId !== gameId || frame.match.playId !== playId) throw new Error('physical pitch frame scope differs');
    assertPhysicalPitchOriginalEvidence(db, frame);
    let timeline = createCanonicalPlateAppearanceTimeline(frame.match, frame.world.tick);
    const accepted: DurablePhysicalPitch[] = [];
    for (const [index, row] of rows.entries()) {
      const source = physicalPitchActionInput(JSON.parse(row.source_json) as AcceptedPhysicalPitchActionSource, row.source_id);
      const value = executePhysicalPitchAction(source, frame, timeline, index + 1);
      if (row.game_id !== gameId || row.play_id !== playId || row.progress_revision !== index + 1 || row.source_json !== json(source)
        || row.source_hash !== hash(source) || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('physical pitch archive differs');
      timeline = value.result.pitch.resolution.timeline; accepted.push(value);
    }
    if (!head || head.revision !== rows.length || head.last_source_id !== rows[rows.length - 1].source_id) throw new Error('physical pitch head diverged');
    return accepted;
  } catch (cause) { throw new Error('corrupt physical pitch progress history', { cause }); }
};
