import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../core/adjudication/OfficialWindowPolicy';
import { deriveClosedNonLiveMatchState, confirmDurableClosedNonLiveStateApplication } from '../core/adjudication/NonLiveOfficialApplication';
import type { OfficialStateApplicationReceipt } from '../core/adjudication/NextPlayActivation';
import { resolveOfficialGameProgression, type OfficialGameProgression } from '../core/world/competition/OfficialGameCompletion';
import type { FoulTerminalApplicationBody } from './world/ActualFoulTerminalApplication';
import { officialStateSerialized as json, officialStateHash as hash } from './OfficialStateEncoding';

export type OfficialPendingOrigin = Readonly<{ owner: 'actual_foul_terminal_applications'; sourceId: string;
  sourceVersion: string; sourceHash: string; snapshotHash: string }>;
export type PersistOfficialPendingNonLiveInput = FoulTerminalApplicationBody & Readonly<{ origin: OfficialPendingOrigin }>;
export type OfficialPendingPostPlay = Readonly<{
  version: 'official_pending_post_play_v1'; matchId: string; applicationId: string; closureId: string;
  previousPlayId: number; durableRevision: number; requestHash: string; origin: OfficialPendingOrigin;
  gameProgression: OfficialGameProgression | Readonly<{ kind: 'same_half_no_game_boundary' }>;
}>;
export type PersistOfficialPendingNonLiveResult = Readonly<{
  receipt: OfficialStateApplicationReceipt; pendingPostPlay: OfficialPendingPostPlay;
}>;
const fields = (value: unknown, keys: readonly string[]): value is Record<string, unknown> => value !== null
  && typeof value === 'object' && !Array.isArray(value) && json(Object.keys(value).sort()) === json([...keys].sort());
const id = (value: unknown): value is string => typeof value === 'string' && !!value && value === value.trim();
const revision = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const digest = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const originValid = (o: unknown): o is OfficialPendingOrigin => fields(o, ['owner','sourceId','sourceVersion','sourceHash','snapshotHash'])
  && o.owner === 'actual_foul_terminal_applications' && id(o.sourceId) && id(o.sourceVersion) && digest(o.sourceHash) && digest(o.snapshotHash);
const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
/** Strict inert input. The Source owner, not a supplied origin object, proves
 * that the physical/journal proposal and its queue are genuine. */
export const officialPendingNonLiveInput = (raw: unknown): PersistOfficialPendingNonLiveInput => {
  const value = cloneInert(raw);
  if (!fields(value, ['mode','kind','matchId','applicationId','expectedDurableRevision','match','timeline','adjudication','context','game','origin'])
    || value.mode !== 'non_live_pending_post_play_v1' || value.kind !== 'non_live' || !id(value.matchId)
    || !id(value.applicationId) || !revision(value.expectedDurableRevision) || !originValid(value.origin)) {
    throw new Error('invalid pending official input fields or origin');
  }
  const game = value.game;
  if (game !== null && (!fields(game, ['seasonId','homeClubId','awayClubId','policy','venueBinding'])
    || !id(game.seasonId) || !id(game.homeClubId) || !id(game.awayClubId))) throw new Error('invalid pending official game input');
  return freeze(value as unknown as PersistOfficialPendingNonLiveInput);
};

export const deriveOfficialPendingNonLiveResult = (raw: PersistOfficialPendingNonLiveInput,
  durableRevision: number): PersistOfficialPendingNonLiveResult => {
  const request = officialPendingNonLiveInput(raw);
  if (!revision(durableRevision) || durableRevision !== request.expectedDurableRevision + 1) throw new Error('pending official durable revision differs');
  const shared = { match: request.match, timeline: request.timeline, adjudication: request.adjudication, context: request.context };
  const appliedMatchState = deriveClosedNonLiveMatchState(shared);
  const receipt = confirmDurableClosedNonLiveStateApplication({ ...shared, persistedMatchState: appliedMatchState,
    applicationId: request.applicationId, durableRevision });
  if (receipt.closureId !== request.origin.sourceId) throw new Error('pending official closure and origin identity differ');
  if (request.game === null && (appliedMatchState.inning !== request.match.inning || appliedMatchState.half !== request.match.half
    || json(appliedMatchState.score) !== json(request.match.score))) throw new Error('pending official game policy is required');
  const gameProgression = request.game === null ? { kind: 'same_half_no_game_boundary' as const }
    : resolveOfficialGameProgression({ ...request.game, gameId: request.matchId, priorMatch: request.match, application: receipt });
  return freeze({ receipt, pendingPostPlay: { version: 'official_pending_post_play_v1', matchId: request.matchId,
    applicationId: receipt.applicationId, closureId: receipt.closureId, previousPlayId: receipt.previousPlayId,
    durableRevision, requestHash: hash(request), origin: request.origin, gameProgression } });
};

type MatchRow = { durable_revision: number; state_json: string; activation_json: string | null };
/** Strict local mirror decoding, deliberately not original-source certification.
 * Full P/C/E/journal authentication remains the terminal owner's responsibility. */
export const readOfficialPendingMatch = (db: Pick<DatabaseSync, 'prepare'>, matchId: string,
  row: MatchRow): PersistOfficialPendingNonLiveResult | null => {
  if (row.activation_json === null) return null;
  const envelope = cloneInert(JSON.parse(row.activation_json)) as unknown;
  if (envelope === null || typeof envelope !== 'object' || !Object.hasOwn(envelope, 'pendingPostPlay')) return null;
  if (db.prepare('PRAGMA main.user_version').get()!.user_version !== 3
    || !fields(envelope, ['pendingPostPlay']) || json(envelope) !== row.activation_json) throw new Error('pending official Match envelope differs');
  const marker = envelope.pendingPostPlay;
  if (!fields(marker, ['version','matchId','applicationId','closureId','previousPlayId','durableRevision','requestHash','origin','gameProgression'])
    || marker.version !== 'official_pending_post_play_v1' || marker.matchId !== matchId || !id(marker.applicationId)
    || !id(marker.closureId) || !revision(marker.previousPlayId) || !revision(marker.durableRevision)
    || marker.durableRevision !== row.durable_revision || !digest(marker.requestHash) || !originValid(marker.origin)
    || marker.origin.sourceId !== marker.closureId) throw new Error('pending official Match marker differs');
  const application = db.prepare('SELECT * FROM main.applications WHERE application_id=?').get(marker.applicationId);
  if (!application || application.application_id !== marker.applicationId || application.match_id !== matchId
    || application.closure_id !== marker.closureId || application.request_hash !== marker.requestHash
    || typeof application.result_json !== 'string') throw new Error('pending official application identity or hash differs');
  const result = cloneInert(JSON.parse(application.result_json)) as unknown;
  if (!fields(result, ['receipt','pendingPostPlay']) || json(result) !== application.result_json
    || json(result.pendingPostPlay) !== json(marker)) throw new Error('pending official application result mirror differs');
  const receipt = result.receipt;
  if (!fields(receipt, ['applicationId','closureId','previousPlayId','durableRevision','appliedMatchState'])
    || receipt.applicationId !== marker.applicationId || receipt.closureId !== marker.closureId
    || receipt.previousPlayId !== marker.previousPlayId || receipt.durableRevision !== marker.durableRevision
    || json(receipt.appliedMatchState) !== row.state_json) throw new Error('pending official receipt or Match state differs');
  const state = receipt.appliedMatchState as OfficialStateApplicationReceipt['appliedMatchState'];
  if (state?.playId !== marker.previousPlayId + 1) throw new Error('pending official previous play differs');
  const progression = marker.gameProgression;
  if (!fields(progression, ['kind']) || progression.kind !== 'same_half_no_game_boundary') {
    if (fields(progression, ['kind','nextMatchState']) && progression.kind === 'GAME_CONTINUES') {
      if (json(progression.nextMatchState) !== json(state)) throw new Error('pending official continuation state differs');
    } else if (!fields(progression, ['kind','completionReason']) || progression.kind !== 'GAME_FINAL_PENDING_SCORING'
      || !['HOME_LEADS_AFTER_TOP','WALK_OFF','BOTTOM_COMPLETE','TIE_LIMIT'].includes(String(progression.completionReason))) {
      throw new Error('pending official progression differs');
    }
  }
  return freeze(result as unknown as PersistOfficialPendingNonLiveResult);
};
