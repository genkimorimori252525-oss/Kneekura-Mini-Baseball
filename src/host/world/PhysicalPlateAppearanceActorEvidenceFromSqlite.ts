import { assertNationalMatchBindings } from './NationalMatchOriginFromSqlite';
import type { FoulTerminalReadinessReference } from './ActualFoulTerminalPostPlayCompletion';
import { readFoulTerminalPhysicalActivation, assertFoulTerminalPhysicalActivationCurrent } from './FoulTerminalNextPlayReadiness';
import { assertFoulTerminalPriorActivation } from './FoulTerminalCompletionAncestryGuard';
import type { ActualLiveReadinessReference } from './ActualLivePlayReadiness';
import { readActualLivePhysicalActivation, assertActualLivePhysicalActivationCurrent } from './ActualLivePhysicalActivation';
import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import type { CanonicalWorldSnapshot } from '../../core/model/CanonicalWorldSnapshot';
import { deriveOfficialPlayResult, type PersistOfficialPlayInput } from '../SqliteOfficialStateStore';
import type { PersistOfficialScoringInput, PersistedOfficialScoring } from '../SqliteOfficialScoringStore';
import { classifyClosedPlayForOfficialScoring, type OfficialFairBallScoringEvidence } from '../../core/adjudication/OfficialScoring';
import { assertInitialOfficialWorldEvidence, readOfficialActorPersonLink, type DurableInitialOfficialWorld } from './SqliteOfficialInitialWorldStore';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';

export type ActorDb = Pick<DatabaseSync, 'prepare'>;
export type AcceptedPhysicalPlateAppearanceActor = Readonly<{
  sourceId: string; sourceVersion: string; gameId: string; playerId: string;
}> & (Readonly<{ initialWorldSourceId: string }> | Readonly<{ activationApplicationId: string }>);
export type DurablePhysicalPlateAppearanceActor = Readonly<{
  source: AcceptedPhysicalPlateAppearanceActor; binding: OfficialParticipantBinding; person: ReturnType<typeof readOfficialActorPersonLink>;
  match: CanonicalMatchState; world: CanonicalWorldSnapshot; officialRevision: number;
  origin: Readonly<{ initialWorldHash: string | null; applicationHash: string | null; scoringHash: string | null;
    actualLiveReadiness?: ActualLiveReadinessReference; foulTerminalReadiness?: FoulTerminalReadinessReference }>;
  fixtureHash: string; defenderBindings: readonly OfficialParticipantBinding[];
  defenderPersons: readonly ReturnType<typeof readOfficialActorPersonLink>[];
  worldFixture: Readonly<{ careerId: string; competitionEditionId: string;
    game: Readonly<{ gameId: string; homeClubId: string; awayClubId: string }> }>;
}>;
type ActorRow = { source_id: string; source_version: string; game_id: string; play_id: number; player_id: string;
  source_json: string; source_hash: string; snapshot_json: string; snapshot_hash: string };
export const actorJson = (v: unknown): string => JSON.stringify(cloneInert(v), (_key, item: unknown) => item !== null && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
export const actorHash = (v: unknown): string => createHash('sha256').update(actorJson(v)).digest('hex');
export const actorFreeze = <T>(v: T): T => { if (v && typeof v === 'object') { Object.values(v).forEach(actorFreeze); Object.freeze(v); } return v; };
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
const fields = (v: unknown, names: readonly string[]) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).sort().join('|') === [...names].sort().join('|');
export const physicalActorInput = (raw: AcceptedPhysicalPlateAppearanceActor, sourceId: string): AcceptedPhysicalPlateAppearanceActor => {
  const s = cloneInert(raw), initial = s && 'initialWorldSourceId' in s;
  if (!s || !fields(s, ['sourceId', 'sourceVersion', 'gameId', 'playerId', initial ? 'initialWorldSourceId' : 'activationApplicationId'])
    || s.sourceId !== sourceId || ![s.sourceId, s.sourceVersion, s.gameId, s.playerId, initial ? s.initialWorldSourceId : s.activationApplicationId].every(id)) {
    throw new Error('invalid accepted physical batter actor Source');
  }
  return s;
};
const readBinding = (db: ActorDb, gameId: string, playerId: string): OfficialParticipantBinding => {
  const row = db.prepare('SELECT binding_json FROM official_participant_bindings WHERE game_id=? AND player_id=?').get(gameId, playerId) as { binding_json: string } | undefined;
  const binding = row ? JSON.parse(row.binding_json) as OfficialParticipantBinding : null;
  if (!binding || JSON.stringify(binding) !== row!.binding_json || binding.gameId !== gameId || binding.playerId !== playerId) throw new Error('physical batter actor binding differs');
  readOfficialActorPersonLink(db, binding); return binding;
};
export const derivePhysicalPlateAppearanceActor = (db: ActorDb, source: AcceptedPhysicalPlateAppearanceActor): DurablePhysicalPlateAppearanceActor => {
  let match: CanonicalMatchState, world: CanonicalWorldSnapshot, officialRevision: number;
  let initialWorldHash: string | null = null, applicationHash: string | null = null, scoringHash: string | null = null;
  let actualLiveReadiness: ActualLiveReadinessReference | undefined;
  let foulTerminalReadiness: FoulTerminalReadinessReference | undefined;
  if ('initialWorldSourceId' in source) {
    const row = db.prepare('SELECT * FROM official_initial_world_sources WHERE source_id=?').get(source.initialWorldSourceId) as { snapshot_json: string } | undefined;
    const initial = row ? JSON.parse(row.snapshot_json) as DurableInitialOfficialWorld : null;
    if (!initial || initial.source.gameId !== source.gameId || initial.source.sourceId !== source.initialWorldSourceId) throw new Error('physical batter initial World differs');
    assertInitialOfficialWorldEvidence(db, initial, true);
    match = initial.match; world = initial.world; officialRevision = 0; initialWorldHash = actorHash(row);
  } else {
    const terminal = readFoulTerminalPhysicalActivation(db,source.gameId,source.activationApplicationId);
    const actual = terminal ? null : readActualLivePhysicalActivation(db, source.gameId, source.activationApplicationId);
    if (terminal) {
      match = terminal.match; world = terminal.world; officialRevision = terminal.officialRevision; applicationHash = terminal.applicationHash;
      foulTerminalReadiness = terminal.readinessReference;
    } else if (actual) {
      match = actual.match; world = actual.world; officialRevision = actual.officialRevision; applicationHash = actual.applicationHash;
      actualLiveReadiness = actual.readinessReference;
    } else {
      const row = db.prepare('SELECT * FROM applications WHERE application_id=? AND match_id=?').get(source.activationApplicationId, source.gameId) as {
        application_id: string; match_id: string; closure_id: string; request_hash: string; result_json: string;
      } | undefined;
      const score = db.prepare('SELECT * FROM official_scoring_applications WHERE official_application_id=?').get(source.activationApplicationId) as {
        scoring_application_id: string; official_application_id: string; match_id: string; closure_id: string; source_event_id: string;
        request_json: string; result_json: string;
      } | undefined;
      const saved = score ? JSON.parse(score.request_json) as { input: PersistOfficialScoringInput; evidence: OfficialFairBallScoringEvidence | null } : null;
      const input = saved?.input.officialApplication;
      if (input && 'mode' in input && input.mode === 'non_live_pending_post_play_v1') {
        throw new Error('terminal pending scoring cannot supply legacy actor activation');
      }
      if (!row || !score || !input || 'game' in input || score.match_id !== source.gameId || input.matchId !== source.gameId
        || input.applicationId !== source.activationApplicationId || actorJson(saved) !== score.request_json) throw new Error('physical batter actual activation Source is missing');
      const result = deriveOfficialPlayResult(input as PersistOfficialPlayInput, input.expectedDurableRevision + 1);
      if (row.result_json !== actorJson(result) || row.request_hash !== actorHash(input) || row.closure_id !== result.receipt.closureId) throw new Error('physical batter activation evidence differs');
      const classified = classifyClosedPlayForOfficialScoring(input.kind === 'non_live'
        ? { kind: input.kind, match: input.match, timeline: input.timeline, adjudication: input.adjudication, context: input.context }
        : { kind: input.kind, match: input.match, timeline: input.physicalTimeline, adjudication: input.adjudication,
          ...(saved!.evidence ? { scoringEvidence: saved!.evidence } : {}) });
      if (classified.kind !== 'supported') throw new Error('physical batter prior scoring is unsupported');
      const sourceEventId = input.kind === 'non_live' ? `official-non-live:${input.applicationId}`
        : 'sourceEventId' in saved!.input ? saved!.input.sourceEventId! : `official-foul-out:${input.applicationId}`;
      const expected: PersistedOfficialScoring = { scoringApplicationId: saved!.input.scoringApplicationId, matchId: input.matchId,
        officialApplicationId: input.applicationId, closureId: result.receipt.closureId, sourceEventId, record: classified.record };
      if (score.scoring_application_id !== expected.scoringApplicationId || score.official_application_id !== expected.officialApplicationId
        || score.closure_id !== expected.closureId || score.source_event_id !== expected.sourceEventId
        || score.result_json !== actorJson(expected)) throw new Error('physical batter prior scoring archive differs');
      assertFoulTerminalPriorActivation(db,source.gameId,result.receipt.previousPlayId,result.activation.nextMatchState.playId);
      match = result.activation.nextMatchState; world = result.nextWorld; officialRevision = result.receipt.durableRevision;
      applicationHash = actorHash(row); scoringHash = actorHash(score);
    }
  }
  const binding = readBinding(db, source.gameId, source.playerId), battingSide = match.half === 'top' ? 'AWAY' : 'HOME';
  const fixture = db.prepare('SELECT * FROM official_fixtures WHERE game_id=?').get(source.gameId) as { fixture_event_id: string } | undefined;
  const defenderBindings = world.defenders.map((d) => readBinding(db, source.gameId, d.playerId));
  const national = assertNationalMatchBindings(db, [binding, ...defenderBindings]);
  const season = national ? null : db.prepare('SELECT schedule_json FROM world_season_heads WHERE career_id=? AND season_id=?')
    .get(binding.careerId, binding.competitionEditionId) as { schedule_json: string } | undefined;
  const schedule = season ? JSON.parse(season.schedule_json) as { seasonId: string; games: { gameId: string; homeClubId: string; awayClubId: string }[] } : null;
  const games = national ? [{ gameId: source.gameId, homeClubId: national.fixture.homeClubId, awayClubId: national.fixture.awayClubId }]
    : schedule?.seasonId === binding.competitionEditionId ? schedule.games?.filter((g) => g.gameId === source.gameId) : undefined;
  if (!games || games.length !== 1 || games[0].homeClubId === games[0].awayClubId
    || binding.clubId !== (battingSide === 'HOME' ? games[0].homeClubId : games[0].awayClubId)) throw new Error('physical batter actor actual World fixture differs');
  const worldFixture = { careerId: binding.careerId, competitionEditionId: binding.competitionEditionId,
    game: { gameId: games[0].gameId, homeClubId: games[0].homeClubId, awayClubId: games[0].awayClubId } };
  if (!fixture || world.defenders.length !== 9 || new Set(world.defenders.map((d) => d.playerId)).size !== 9
    || binding.side !== battingSide || Object.values(match.bases).includes(binding.playerId)
    || defenderBindings.some((d) => d.side !== (battingSide === 'HOME' ? 'AWAY' : 'HOME') || d.clubId !== (d.side === 'HOME' ? games[0].homeClubId : games[0].awayClubId)
      || d.careerId !== binding.careerId || d.gameDay !== binding.gameDay
      || d.competitionEditionId !== binding.competitionEditionId || d.fixtureEventId !== binding.fixtureEventId || d.personId === binding.personId)
    || binding.fixtureEventId !== fixture.fixture_event_id) throw new Error('physical batter actor scope differs');
  return actorFreeze({ source, binding, person: readOfficialActorPersonLink(db, binding), match, world, officialRevision,
    origin: { initialWorldHash, applicationHash, scoringHash, ...(actualLiveReadiness ? { actualLiveReadiness } : {}), ...(foulTerminalReadiness ? { foulTerminalReadiness } : {}) }, fixtureHash: actorHash(fixture), defenderBindings,
    defenderPersons: defenderBindings.map((d) => readOfficialActorPersonLink(db, d)), worldFixture });
};
export const assertPhysicalActorOpenFrame = (db: ActorDb, actor: DurablePhysicalPlateAppearanceActor): void => {
  if (actor.origin.actualLiveReadiness && actor.origin.foulTerminalReadiness) throw new Error('physical batter origin has dual readiness kinds');
  if (actor.origin.actualLiveReadiness) assertActualLivePhysicalActivationCurrent(db, actor.origin.actualLiveReadiness);
  if (actor.origin.foulTerminalReadiness) assertFoulTerminalPhysicalActivationCurrent(db,actor.origin.foulTerminalReadiness,actor.source.gameId,actor.match.playId);
  const row = db.prepare('SELECT durable_revision,state_json,activation_json FROM matches WHERE match_id=?').get(actor.source.gameId) as {
    durable_revision: number; state_json: string; activation_json: string | null;
  } | undefined;
  let activation: string | null = null;
  if ('activationApplicationId' in actor.source) {
    const saved = db.prepare('SELECT result_json FROM applications WHERE application_id=?').get(actor.source.activationApplicationId) as { result_json: string };
    const result = JSON.parse(saved.result_json) as ReturnType<typeof deriveOfficialPlayResult>;
    activation = actorJson({ activation: result.activation, nextWorld: result.nextWorld });
  }
  if (!row || row.durable_revision !== actor.officialRevision || row.state_json !== actorJson(actor.match) || row.activation_json !== activation) throw new Error('physical batter current frame differs');
};
const hasTable = (db: ActorDb) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='physical_plate_appearance_actors'").get());
export const physicalActorGameTracked = (db: ActorDb, gameId: string): boolean => {
  if (!hasTable(db)) return false;
  const first = db.prepare('SELECT source_id FROM physical_plate_appearance_actors WHERE game_id=? ORDER BY rowid LIMIT 1').get(gameId) as { source_id: string } | undefined;
  const game = db.prepare('SELECT first_source_id FROM physical_plate_appearance_actor_games WHERE game_id=?').get(gameId) as { first_source_id: string } | undefined;
  if (Boolean(first) !== Boolean(game) || first && game?.first_source_id !== first.source_id) throw new Error('physical batter game ownership differs');
  return Boolean(game);
};
export const readPhysicalPlateAppearanceActorFromSqlite = (db: ActorDb, sourceId: string): DurablePhysicalPlateAppearanceActor | null => {
  if (!hasTable(db)) return null;
  const row = db.prepare('SELECT * FROM physical_plate_appearance_actors WHERE source_id=?').get(sourceId) as ActorRow | undefined;
  if (!row) return null;
  const source = physicalActorInput(JSON.parse(row.source_json) as AcceptedPhysicalPlateAppearanceActor, sourceId), actor = derivePhysicalPlateAppearanceActor(db, source);
  if (!physicalActorGameTracked(db, row.game_id) || row.game_id !== source.gameId || row.player_id !== source.playerId || row.play_id !== actor.match.playId
    || row.source_version !== source.sourceVersion || row.source_json !== actorJson(source) || row.source_hash !== actorHash(source)
    || row.snapshot_json !== actorJson(actor) || row.snapshot_hash !== actorHash(actor)) throw new Error('corrupt physical batter actor archive');
  return actor;
};
export const readPhysicalActorForPlayFromSqlite = (db: ActorDb, gameId: string, playId: number): DurablePhysicalPlateAppearanceActor | null => {
  if (!physicalActorGameTracked(db, gameId)) return null;
  const row = db.prepare('SELECT source_id FROM physical_plate_appearance_actors WHERE game_id=? AND play_id=?').get(gameId, playId) as { source_id: string } | undefined;
  if (!row) throw new Error('accepted physical batter for this play is missing');
  return readPhysicalPlateAppearanceActorFromSqlite(db, row.source_id);
};
