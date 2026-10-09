import { assertSamePaTerminalApplicationCompleted } from './SamePlateAppearanceTerminalActivation';
import { assertNationalMatchBindings } from './NationalMatchOriginFromSqlite';
import { createRequire } from 'node:module';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { foulTerminalPostPlayCompletionEvidenceFromSqlite } from './ActualFoulTerminalPostPlayCompletionEvidenceFromSqlite';
import { foulTerminalPendingInput } from './ActualFoulTerminalApplicationEvidenceFromSqlite';
import { foulTerminalCompletedOfficial } from '../OfficialTerminalPostPlayCompletion';
import { assertPriorActualLiveClosureCompleted } from './ActualLivePlayClosureEvidenceFromSqlite';
import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { derivePhysicalNonLiveClosure } from '../../core/adjudication/PhysicalNonLiveClosure';
import { classifyClosedPlayForOfficialScoring, type OfficialFairBallScoringEvidence, type SupportedOfficialScoringRecord } from '../../core/adjudication/OfficialScoring';
import { prepareBetweenPlayWorld, type BetweenPlayWorldSetup } from '../../core/adjudication/BetweenPlayWorldReset';
import { confirmDurableClosedNonLiveStateApplication } from '../../core/adjudication/NonLiveOfficialApplication';
import { resolveOfficialGameBoundary, type GameCompletionPolicy, type OfficialGameVenueBinding } from '../../core/world/competition/OfficialGameCompletion';
import { createCanonicalLineScoreSnapshot, type CanonicalInningLineScore } from '../../core/model/CanonicalLineScoreSnapshot';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import { deriveOfficialPlayResult, deriveOfficialFinalResult, type PersistOfficialPlayInput, type PersistOfficialFinalInput } from '../SqliteOfficialStateStore';
import type { PersistedOfficialScoring, PersistOfficialScoringInput } from '../SqliteOfficialScoringStore';
import type { DurablePhysicalPitch } from './SqlitePhysicalPitchProgressStore';
import { capturePhysicalPitchEvidence, readPhysicalPitchProgressFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
import { assertInitialOfficialWorldEvidence, readOfficialActorPersonLink } from './SqliteOfficialInitialWorldStore';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import type { OfficialStandingsSchedule } from '../../core/world/competition/OfficialStandings';
import type { OfficialPhysicalPitchActivity } from './SqliteOfficialPitchWorkloadStore';
import { advancePlayerWorkloadRecovery } from '../../core/world/development/PlayerWorkloadRecovery';
import { assessOfficialPhysicalPitchWorkload } from '../../core/world/development/OfficialPhysicalPitchWorkload';
import { assertArchivedPlayerWorkloadActivity, type DurablePlayerWorkloadActivity } from './SqlitePlayerWorkloadRecoveryStore';

export type PhysicalClosureDb = Pick<DatabaseSync, 'prepare'>;
export type AcceptedPhysicalPlayClosure = Readonly<{
  sourceId: string; sourceVersion: string; physicalPitchSourceId: string; applicationId: string; scoringApplicationId: string;
  snapshotId: string; ruleTick: number; closureTick: number; nextStartedAtTick: number; batterRunnerId: string | null;
  worldSetup: BetweenPlayWorldSetup;
  game: Readonly<{ seasonId: string; homeClubId: string; awayClubId: string; policy: GameCompletionPolicy }>;
}>;
type OfficialInput = PersistOfficialPlayInput | PersistOfficialFinalInput;
export const closureJson = (v: unknown): string => JSON.stringify(cloneInert(v), (_key, item: unknown) => item !== null && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
export const closureHash = (v: unknown): string => createHash('sha256').update(closureJson(v)).digest('hex');
export const closureFreeze = <T>(v: T): T => { if (v && typeof v === 'object') { Object.values(v).forEach(closureFreeze); Object.freeze(v); } return v; };
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
const tick = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const fields = (v: unknown, names: readonly string[]): boolean => v !== null && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).sort().join('|') === [...names].sort().join('|');
export const physicalClosureInput = (raw: AcceptedPhysicalPlayClosure, sourceId: string): AcceptedPhysicalPlayClosure => {
  const s = cloneInert(raw);
  if (!fields(s, ['sourceId', 'sourceVersion', 'physicalPitchSourceId', 'applicationId', 'scoringApplicationId', 'snapshotId', 'ruleTick', 'closureTick',
    'nextStartedAtTick', 'batterRunnerId', 'worldSetup', 'game']) || s.sourceId !== sourceId
    || ![sourceId, s.sourceVersion, s.physicalPitchSourceId, s.applicationId, s.scoringApplicationId, s.snapshotId].every(id)
    || ![s.ruleTick, s.closureTick, s.nextStartedAtTick].every(tick) || s.batterRunnerId !== null && !id(s.batterRunnerId)
    || !fields(s.game, ['seasonId', 'homeClubId', 'awayClubId', 'policy']) || ![s.game.seasonId, s.game.homeClubId, s.game.awayClubId].every(id)
    || s.game.homeClubId === s.game.awayClubId || !fields(s.game.policy, ['version', 'minimumInnings', 'tiesAllowed',
      ...(Object.hasOwn(s.game.policy, 'maximumInnings') ? ['maximumInnings'] : [])])
    || !fields(s.worldSetup, ['baseCenters', 'defenders', 'activePreviousPlayControllerIds']) || !Array.isArray(s.worldSetup.defenders)
    || s.worldSetup.defenders.some((d) => !fields(d, ['playerId', 'registeredPosition', 'position']) || !id(d.playerId)
      || !fields(d.position, ['x', 'z']) || !Number.isFinite(d.position.x) || !Number.isFinite(d.position.z))) {
    throw new Error('invalid accepted physical play closure Source');
  }
  return s;
};
const fixture = (db: PhysicalClosureDb, pitch: DurablePhysicalPitch): OfficialGameVenueBinding => {
  const row = db.prepare('SELECT * FROM official_fixtures WHERE game_id=?').get(pitch.frame.gameId) as {
    game_id: string; venue_id: string; fixture_event_id: string; fixture_revision: number;
  } | undefined;
  if (!row || row.fixture_event_id !== pitch.frame.bindings[0].fixtureEventId) throw new Error('physical closure fixture differs');
  return { gameId: row.game_id, venueId: row.venue_id, fixtureEventId: row.fixture_event_id, fixtureRevision: row.fixture_revision };
};
const worldFixture = (db: PhysicalClosureDb, s: AcceptedPhysicalPlayClosure, pitch: DurablePhysicalPitch) => {
  const national = assertNationalMatchBindings(db, pitch.frame.bindings);
  if (national) {
    const f = national.fixture;
    if (f.competitionEditionId !== s.game.seasonId || f.homeClubId !== s.game.homeClubId || f.awayClubId !== s.game.awayClubId
      || f.careerId !== pitch.frame.workload.careerId) throw new Error('actual physical closure National fixture differs');
    return { careerId: f.careerId, seasonId: f.competitionEditionId,
      game: { gameId: pitch.frame.gameId, homeClubId: f.homeClubId, awayClubId: f.awayClubId } };
  }

  const row = db.prepare('SELECT schedule_json FROM world_season_heads WHERE career_id=? AND season_id=?')
    .get(pitch.frame.workload.careerId, s.game.seasonId) as { schedule_json: string } | undefined;
  const schedule = row ? JSON.parse(row.schedule_json) as OfficialStandingsSchedule : null;
  const matches = schedule?.games.filter((game) => game.gameId === pitch.frame.gameId);
  if (!schedule || schedule.seasonId !== s.game.seasonId || !matches || matches.length !== 1
    || matches[0].homeClubId !== s.game.homeClubId || matches[0].awayClubId !== s.game.awayClubId) throw new Error('actual physical closure World fixture differs');
  return { careerId: pitch.frame.workload.careerId, seasonId: s.game.seasonId, game: matches[0] };
};
const actor = (db: PhysicalClosureDb, s: AcceptedPhysicalPlayClosure, pitch: DurablePhysicalPitch, playerId: string, side: 'HOME' | 'AWAY') => {
  const row = db.prepare('SELECT binding_json FROM official_participant_bindings WHERE game_id=? AND player_id=?')
    .get(pitch.frame.gameId, playerId) as { binding_json: string } | undefined;
  const b = row ? JSON.parse(row.binding_json) as OfficialParticipantBinding : null;
  if (!b || JSON.stringify(b) !== row!.binding_json || b.playerId !== playerId || b.gameId !== pitch.frame.gameId
    || b.careerId !== pitch.frame.workload.careerId || b.side !== side || b.competitionEditionId !== s.game.seasonId
    || b.gameDay !== pitch.frame.bindings[0].gameDay || b.fixtureEventId !== pitch.frame.bindings[0].fixtureEventId
    || b.clubId !== (side === 'HOME' ? s.game.homeClubId : s.game.awayClubId)) throw new Error('actual physical closure actor binding differs');
  assertNationalMatchBindings(db, [b]);
  return { binding: b, person: readOfficialActorPersonLink(db, b) };
};

type EarlierScoring = Readonly<{ applicationId: string; scoringApplicationId: string; before: CanonicalMatchState;
  after: CanonicalMatchState; scoring: PersistedOfficialScoring; closureRowHash: string; scoringRowHash: string }>;
const readPhysicalClosureScoringHistoryRows = (db: PhysicalClosureDb, frame: Readonly<{ gameId: string; officialRevision: number }>): EarlierScoring[] => {
  const rows = db.prepare("SELECT * FROM applications WHERE match_id=? AND json_extract(result_json,'$.receipt.durableRevision')<=? ORDER BY json_extract(result_json,'$.receipt.durableRevision')")
    .all(frame.gameId, frame.officialRevision) as { application_id: string; match_id: string; closure_id: string; request_hash: string; result_json: string }[];
  if (rows.length !== frame.officialRevision) throw new Error('physical closure prior application history is missing');
  return rows.map((row, index) => {
    assertSamePaTerminalApplicationCompleted(db, row.application_id);
    const scored = db.prepare('SELECT * FROM official_scoring_applications WHERE official_application_id=?').get(row.application_id) as {
      scoring_application_id: string; match_id: string; official_application_id: string; closure_id: string; source_event_id: string; request_json: string; result_json: string;
    } | undefined;
    if (!scored) throw new Error('physical closure prior scoring history is missing');
    const saved = JSON.parse(scored.request_json) as { input: PersistOfficialScoringInput; evidence: OfficialFairBallScoringEvidence | null };
    const input = saved.input, a = input.officialApplication;
    if ('mode' in a && a.mode === 'non_live_pending_post_play_v1') {
      // Terminal scoring keeps its immutable pending input forever. Only the
      // independently authenticated completed owner and all original effects
      // may supply a historical record; generic legacy writers stay blocked.
      const completed=foulTerminalPostPlayCompletionEvidenceFromSqlite(db as DatabaseSync).read(row.closure_id);
      if(completed&&('finalResult'in completed.result.completion||completed.status==='POST_PLAY_COMPLETED_FINAL'))throw new Error('terminal final result cannot precede a later play');
      if(!completed)throw new Error('terminal completion scoring history owner is missing');
      const p=completed.proposal,c=completed.result.completion,receipt=completed.result.official.receipt;
      const official=foulTerminalCompletedOfficial(completed.result.official,c),score=JSON.parse(scored.result_json) as PersistedOfficialScoring;
      if(p.gameId!==frame.gameId||p.source.applicationId!==row.application_id||p.originalOfficialRevision!==index
        ||receipt.durableRevision!==index+1||closureJson(a)!==closureJson(foulTerminalPendingInput(p))
        ||row.match_id!==p.gameId||row.closure_id!==p.source.sourceId||row.request_hash!==completed.result.official.pendingPostPlay.requestHash
        ||row.result_json!==closureJson(official)||closureHash(scored)!==c.scoringReference.rowHash
        ||input.scoringApplicationId!==c.scoringReference.scoringApplicationId)throw new Error('terminal completion prior scored Source differs');
      return {applicationId:p.source.applicationId,scoringApplicationId:c.scoringReference.scoringApplicationId,before:p.applicationBody.match,
        after:receipt.appliedMatchState,scoring:score,closureRowHash:closureHash(row),scoringRowHash:closureHash(scored)};
    }
    const official = 'game' in a ? deriveOfficialFinalResult(a, index + 1) : deriveOfficialPlayResult(a, index + 1);
    const classified = classifyClosedPlayForOfficialScoring(a.kind === 'non_live' ? { kind: a.kind, match: a.match, timeline: a.timeline,
      adjudication: a.adjudication, context: a.context } : { kind: a.kind, match: a.match, timeline: a.physicalTimeline,
      adjudication: a.adjudication, ...(saved.evidence ? { scoringEvidence: saved.evidence } : {}) });
    const sourceEventId = a.kind === 'non_live' ? `official-non-live:${a.applicationId}`
      : 'sourceEventId' in input ? input.sourceEventId! : `official-foul-out:${a.applicationId}`;
    if (classified.kind !== 'supported') throw new Error('physical closure prior official score is unsupported');
    const score: PersistedOfficialScoring = { scoringApplicationId: input.scoringApplicationId, matchId: a.matchId,
      officialApplicationId: a.applicationId, closureId: official.receipt.closureId, sourceEventId, record: classified.record };
    if (a.matchId !== frame.gameId || a.applicationId !== row.application_id || a.expectedDurableRevision !== index
      || row.request_hash !== closureHash('game' in a ? { kind: 'game_final', request: a } : a) || row.result_json !== closureJson(official)
      || row.closure_id !== official.receipt.closureId || scored.match_id !== a.matchId || scored.official_application_id !== a.applicationId
      || scored.closure_id !== score.closureId || scored.source_event_id !== sourceEventId || scored.scoring_application_id !== input.scoringApplicationId
      || closureJson(saved) !== scored.request_json || closureJson(score) !== scored.result_json) throw new Error('physical closure prior scored Source differs');
    return { applicationId: a.applicationId, scoringApplicationId: score.scoringApplicationId, before: a.match,
      after: official.receipt.appliedMatchState, scoring: score, closureRowHash: closureHash(row), scoringRowHash: closureHash(scored) };
  });
};
/** Keep initial row selection and all terminal effect/row checks within the
 * same Native read interval. Structural legacy readers retain their narrow
 * prepare-only interface; no proof or snapshot survives this call. */
export const readPhysicalClosureScoringHistory = (db: PhysicalClosureDb, frame: Readonly<{gameId:string;officialRevision:number}>): EarlierScoring[] => {
  const {DatabaseSync:NativeDatabase}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const read=()=>readPhysicalClosureScoringHistoryRows(db,frame);
  return db instanceof NativeDatabase ? withBattedVenueLegalReadSnapshot(db,read) : read();
};
/** The existing contiguous-history fold is shared unchanged with read-only
 * consumer verification; missing earlier scoring is never replaced by zero H/E. */
export const derivePhysicalClosureLineScore = (history: readonly Readonly<{ before: CanonicalMatchState;
  after: CanonicalMatchState; scoring: Readonly<{ record: SupportedOfficialScoringRecord }> }>[]) => {
  const innings: { inning: number; awayRuns: number | null; homeRuns: number | null }[] = [];
  const totals = { away: { runs: 0, hits: 0, errors: 0 }, home: { runs: 0, hits: 0, errors: 0 } };
  let previous: CanonicalMatchState | null = null;
  for (const record of history) {
    if (previous ? closureJson(previous) !== closureJson(record.before) : record.before.inning !== 1 || record.before.half !== 'top'
      || record.before.score.away !== 0 || record.before.score.home !== 0) throw new Error('physical closure actual game history is incomplete');
    const score = record.scoring.record, side = score.battingTeam;
    while (innings.length < record.before.inning) innings.push({ inning: innings.length + 1, awayRuns: null, homeRuns: null });
    const inning = innings[record.before.inning - 1], key: keyof Pick<CanonicalInningLineScore, 'awayRuns' | 'homeRuns'> = side === 'away' ? 'awayRuns' : 'homeRuns';
    inning[key] = (inning[key] ?? 0) + score.runsScored;
    totals[side].runs += score.runsScored; totals[side].hits += score.hitsCredited;
    totals[side === 'away' ? 'home' : 'away'].errors += score.errorsCharged;
    previous = record.after;
  }
  return createCanonicalLineScoreSnapshot({ innings, totals });
};
export const captureClosurePitchRows = (db: PhysicalClosureDb, physicalPitchSourceId: string) => {
  const row = db.prepare('SELECT * FROM physical_pitch_progress_actions WHERE source_id=?').get(physicalPitchSourceId) as {
    game_id: string; play_id: number; snapshot_json: string;
  } | undefined;
  if (!row) throw new Error('actual physical closure pitch Source is missing');
  const pitch = readPhysicalPitchProgressFromSqlite(db, row.game_id, row.play_id).at(-1);
  if (!pitch || row.snapshot_json !== closureJson(pitch)) throw new Error('physical closure actual pitch history differs');
  const head = db.prepare('SELECT * FROM physical_pitch_progress_heads WHERE game_id=? AND play_id=?').get(row.game_id, row.play_id) as {
    revision: number; last_source_id: string;
  } | undefined;
  if (pitch.source.sourceId !== physicalPitchSourceId || pitch.frame.gameId !== row.game_id || pitch.frame.match.playId !== row.play_id
    || !head || head.last_source_id !== physicalPitchSourceId || head.revision !== pitch.progressRevision) throw new Error('physical closure pitch is not the final progress head');
  return { actions: db.prepare('SELECT * FROM physical_pitch_progress_actions WHERE game_id=? AND play_id=? ORDER BY progress_revision')
    .all(row.game_id, row.play_id).map(closureHash), head: closureHash(head), evidence: capturePhysicalPitchEvidence(db, pitch.frame) };
};
export type PhysicalClosureProposal = Readonly<{
  physicalPitch: DurablePhysicalPitch; originalPitchRows: ReturnType<typeof captureClosurePitchRows>;
  application: Extract<OfficialInput, { kind: 'non_live' }>; expectedOfficial: ReturnType<typeof deriveOfficialPlayResult> | ReturnType<typeof deriveOfficialFinalResult>;
  expectedScoring: PersistedOfficialScoring; expectedActivity: OfficialPhysicalPitchActivity;
  earlier: readonly EarlierScoring[]; actors: readonly ReturnType<typeof actor>[]; worldFixture: ReturnType<typeof worldFixture>;
}>;
export const derivePhysicalClosureProposal = (db: PhysicalClosureDb, s: AcceptedPhysicalPlayClosure, pitch: DurablePhysicalPitch,
  originalPitchRows: ReturnType<typeof captureClosurePitchRows>): PhysicalClosureProposal => {
  const own = db.prepare('SELECT snapshot_json FROM physical_pitch_progress_actions WHERE source_id=?').get(s.physicalPitchSourceId) as { snapshot_json: string } | undefined;
  const currentRows = captureClosurePitchRows(db, s.physicalPitchSourceId);
  if (!own || own.snapshot_json !== closureJson(pitch) || currentRows.head !== originalPitchRows.head
    || closureJson(currentRows.actions) !== closureJson(originalPitchRows.actions)) throw new Error('physical closure pitch archive changed');
  for (const [key, values] of Object.entries(originalPitchRows.evidence)) {
    const current = new Set(currentRows.evidence[key]);
    if (values.some((value) => !current.has(value))) throw new Error('physical closure original evidence changed');
  }
  if (pitch.frame.initialWorld) assertInitialOfficialWorldEvidence(db, pitch.frame.initialWorld, true);
  if (pitch.frame.batterActor && pitch.result.pitch.resolution.timeline.status.kind === 'walk'
    && s.batterRunnerId !== pitch.frame.batterActor.binding.playerId) throw new Error('physical closure actual batter differs');
  const effort = pitch.frame.effortPolicy;
  const derived = derivePhysicalNonLiveClosure({ match: pitch.frame.match, timeline: pitch.result.pitch.resolution.timeline,
    batterRunnerId: s.batterRunnerId, gameDay: pitch.frame.bindings[0].gameDay,
    effortPolicy: { policyId: effort.policyId, version: effort.version, availableAtDay: effort.availableAtDay, effortUnitsPerPhysicalPitch: effort.effortUnitsPerPhysicalPitch },
    snapshotId: s.snapshotId, ruleTick: s.ruleTick, closureId: s.applicationId, closureTick: s.closureTick });
  const world = worldFixture(db, s, pitch), venueBinding = fixture(db, pitch), earlier = readPhysicalClosureScoringHistory(db, pitch.frame);
  const lineScore = derivePhysicalClosureLineScore([...earlier, { before: pitch.frame.match, after: derived.nextMatch, scoring: { record: derived.scoring } }]);
  const receipt = confirmDurableClosedNonLiveStateApplication({ match: pitch.frame.match, timeline: pitch.result.pitch.resolution.timeline,
    adjudication: derived.adjudication, context: derived.context, persistedMatchState: derived.nextMatch,
    applicationId: s.applicationId, durableRevision: pitch.frame.officialRevision + 1 });
  const game = { ...s.game, lineScore, venueBinding };
  const boundary = resolveOfficialGameBoundary({ ...game, gameId: pitch.frame.gameId, priorMatch: pitch.frame.match, application: receipt });
  const common = { kind: 'non_live' as const, matchId: pitch.frame.gameId, applicationId: s.applicationId,
    expectedDurableRevision: pitch.frame.officialRevision, match: pitch.frame.match, timeline: pitch.result.pitch.resolution.timeline,
    adjudication: derived.adjudication, context: derived.context };
  const application = boundary.kind === 'GAME_FINAL' ? { ...common, game } : { ...common, nextStartedAtTick: s.nextStartedAtTick, worldSetup: s.worldSetup };
  if (s.nextStartedAtTick < s.closureTick) throw new Error('physical closure next setup precedes closure');
  const nextWorld = prepareBetweenPlayWorld(derived.nextMatch, s.nextStartedAtTick, s.worldSetup);
  const defenderSide = derived.nextMatch.half === 'top' ? 'HOME' : 'AWAY', offensiveSide = defenderSide === 'HOME' ? 'AWAY' : 'HOME';
  const actors = boundary.kind === 'GAME_FINAL' ? [] : [...nextWorld.defenders.map((d) => actor(db, s, pitch, d.playerId, defenderSide)),
    ...nextWorld.runners.map((r) => actor(db, s, pitch, r.playerId, offensiveSide))];
  if (s.batterRunnerId !== null) actors.push(actor(db, s, pitch, s.batterRunnerId, pitch.frame.match.half === 'top' ? 'AWAY' : 'HOME'));
  else if (pitch.frame.batterActor) actors.push(actor(db, s, pitch, pitch.frame.batterActor.binding.playerId,
    pitch.frame.match.half === 'top' ? 'AWAY' : 'HOME'));
  const expectedOfficial = 'game' in application ? deriveOfficialFinalResult(application, receipt.durableRevision) : deriveOfficialPlayResult(application, receipt.durableRevision);
  const expectedScoring: PersistedOfficialScoring = { scoringApplicationId: s.scoringApplicationId, matchId: pitch.frame.gameId,
    officialApplicationId: s.applicationId, closureId: s.applicationId, sourceEventId: `official-non-live:${s.applicationId}`, record: derived.scoring };
  const sourceEventId = `official-physical-pitch-workload:${closureHash([pitch.frame.workload.careerId, pitch.frame.gameId, pitch.frame.match.playId, pitch.frame.workload.playerId])}`;
  const expectedActivity: OfficialPhysicalPitchActivity = { sourceEventId, sourceVersion: 'official-physical-pitch-workload-v1', evidenceId: s.applicationId,
    careerId: pitch.frame.workload.careerId, playerId: pitch.frame.workload.playerId, atDay: pitch.frame.bindings[0].gameDay, kind: 'MATCH', effortUnits: derived.effort.effortUnits };
  return closureFreeze({ physicalPitch: pitch, originalPitchRows, application, expectedOfficial, expectedScoring, expectedActivity,
    earlier, actors, worldFixture: world });
};

export type PhysicalClosureRow = { source_id: string; source_version: string; game_id: string; play_id: number; application_id: string; scoring_application_id: string;
  status: string; source_json: string; source_hash: string; proposal_json: string; proposal_hash: string; result_json: string | null };
export const readPhysicalClosureProposal = (db: PhysicalClosureDb, sourceId: string) => {
  const row = db.prepare('SELECT * FROM physical_play_closures WHERE source_id=?').get(sourceId) as PhysicalClosureRow | undefined;
  if (!row) return null;
  const source = physicalClosureInput(JSON.parse(row.source_json) as AcceptedPhysicalPlayClosure, sourceId), saved = JSON.parse(row.proposal_json) as PhysicalClosureProposal;
  const proposal = derivePhysicalClosureProposal(db, source, saved.physicalPitch, saved.originalPitchRows);
  if (row.source_json !== closureJson(source) || row.source_hash !== closureHash(source) || row.proposal_json !== closureJson(proposal)
    || row.proposal_hash !== closureHash(proposal) || row.source_version !== source.sourceVersion || row.application_id !== source.applicationId
    || row.scoring_application_id !== source.scoringApplicationId || row.game_id !== proposal.application.matchId || row.play_id !== proposal.application.match.playId
    || !['PENDING', 'COMPLETED'].includes(row.status) || (row.status === 'COMPLETED') !== (row.result_json !== null)) throw new Error('corrupt physical play closure archive');
  const policy = db.prepare('SELECT policy_json FROM physical_closure_game_policies WHERE game_id=?').get(row.game_id) as { policy_json: string } | undefined;
  if (policy?.policy_json !== closureJson(source.game)) throw new Error('physical closure game policy changed');
  return { row, source, proposal };
};
export const assertPhysicalClosureStages = (db: PhysicalClosureDb, p: PhysicalClosureProposal, writtenMatch = false, throughStage = 3): void => {
  const a = p.application;
  const official = db.prepare('SELECT * FROM applications WHERE application_id=?').get(a.applicationId) as {
    match_id: string; closure_id: string; request_hash: string; result_json: string;
  } | undefined;
  if (official && (official.match_id !== a.matchId || official.closure_id !== a.applicationId
    || official.request_hash !== closureHash('game' in a ? { kind: 'game_final', request: a } : a)
    || official.result_json !== closureJson(p.expectedOfficial))) throw new Error('physical closure official stage differs');
  if (writtenMatch) {
    const match = db.prepare('SELECT durable_revision, state_json, activation_json FROM matches WHERE match_id=?').get(a.matchId) as {
      durable_revision: number; state_json: string; activation_json: string;
    } | undefined;
    const activation = 'result' in p.expectedOfficial ? { finalResult: p.expectedOfficial.result }
      : { activation: p.expectedOfficial.activation, nextWorld: p.expectedOfficial.nextWorld };
    if (!official || !match || match.durable_revision !== p.expectedOfficial.receipt.durableRevision
      || match.state_json !== closureJson(p.expectedOfficial.receipt.appliedMatchState) || match.activation_json !== closureJson(activation)) throw new Error('physical closure written Match differs');
  }
  if (throughStage === 0) return;
  const scored = db.prepare('SELECT * FROM official_scoring_applications WHERE scoring_application_id=?').get(p.expectedScoring.scoringApplicationId) as {
    match_id: string; official_application_id: string; closure_id: string; source_event_id: string; request_json: string; result_json: string;
  } | undefined;
  if (scored && (!official || scored.match_id !== a.matchId || scored.official_application_id !== a.applicationId || scored.closure_id !== a.applicationId
    || scored.source_event_id !== p.expectedScoring.sourceEventId || scored.request_json !== closureJson({ input: {
      scoringApplicationId: p.expectedScoring.scoringApplicationId, officialApplication: a }, evidence: null })
    || scored.result_json !== closureJson(p.expectedScoring))) throw new Error('physical closure scoring stage differs');
  if (throughStage === 1) return;
  assertPhysicalClosureEffortStage(db, p);
  if (throughStage === 2) return;
  const workload = db.prepare('SELECT source_json FROM world_player_workload_activities WHERE source_id=?').get(p.expectedActivity.sourceEventId) as { source_json: string } | undefined;
  if (workload && (!scored || workload.source_json !== closureJson(p.expectedActivity)
    || !db.prepare('SELECT 1 FROM official_pitch_workload_sources WHERE source_id=?').get(p.expectedActivity.sourceEventId))) throw new Error('physical closure workload stage differs');
};
/** Reconstruct the exact producer archive on this connection; peer Native readers cannot see a checkpoint trigger. */
const assertPhysicalClosureEffortStage = (db: PhysicalClosureDb, p: PhysicalClosureProposal): void => {
  const row = db.prepare('SELECT * FROM official_pitch_workload_sources WHERE source_id=?').get(p.expectedActivity.sourceEventId) as {
    source_id: string; career_id: string; player_id: string; game_id: string; played_play_id: number; scoring_application_id: string;
    policy_source_id: string; request_json: string; source_json: string; proof_json: string;
  } | undefined;
  if (!row) return;
  const f = p.physicalPitch.frame, policy = f.effortPolicy;
  const calibration = { policyId: policy.policyId, version: policy.version, availableAtDay: policy.availableAtDay, effortUnitsPerPhysicalPitch: policy.effortUnitsPerPhysicalPitch };
  const policyRow = db.prepare('SELECT * FROM official_pitch_workload_policies WHERE source_id=?').get(policy.sourceId) as {
    source_id: string; policy_id: string; version: string; source_json: string; policy_json: string;
  } | undefined;
  const closure = db.prepare('SELECT * FROM applications WHERE application_id=?').get(p.application.applicationId);
  const scoring = db.prepare('SELECT * FROM official_scoring_applications WHERE scoring_application_id=?').get(p.expectedScoring.scoringApplicationId);
  const pitcherIds = f.world.defenders.filter((d) => d.registeredPosition === 'P').map((d) => d.playerId);
  const binding = f.bindings.find((b) => b.playerId === pitcherIds[0]);
  if (pitcherIds.length !== 1 || !binding || !closure || !scoring || !policyRow) throw new Error('physical closure actual effort provenance is missing');
  const pitcher = { binding, closureApplicationId: p.application.applicationId, activatedMatchState: f.match,
    playedPlayId: f.match.playId, durableRevision: p.expectedOfficial.receipt.durableRevision,
    ...(f.activationApplicationId === null ? { initialWorldSourceId: f.initialWorld!.source.sourceId, startedAtTick: f.world.tick }
      : { activationApplicationId: f.activationApplicationId }) };
  const request = { scoringApplicationId: p.expectedScoring.scoringApplicationId, policySourceId: policy.sourceId,
    ...(f.activationApplicationId === null ? { initialWorldSourceId: f.initialWorld!.source.sourceId } : { activationApplicationId: f.activationApplicationId }) };
  const assessed = assessOfficialPhysicalPitchWorkload(p.physicalPitch.result.pitch.resolution.timeline, calibration, binding.gameDay);
  const proof = { pitcher, policy, scoring: p.expectedScoring, physicalPitchSequences: assessed.physicalPitchSequences,
    ...(f.initialWorld ? { initialWorld: f.initialWorld, officialEvidence: { closure, scoring } } : {}),
    physicalProgress: p.physicalPitch, progressEvidence: { actions: p.originalPitchRows.actions, head: [p.originalPitchRows.head] } };
  if (policyRow.source_id !== policy.sourceId || policyRow.policy_id !== policy.policyId || policyRow.version !== policy.version
    || policyRow.source_json !== closureJson(policy) || policyRow.policy_json !== closureJson(calibration)
    || row.source_id !== p.expectedActivity.sourceEventId || row.career_id !== f.workload.careerId || row.player_id !== f.workload.playerId
    || row.game_id !== f.gameId || row.played_play_id !== f.match.playId || row.scoring_application_id !== p.expectedScoring.scoringApplicationId
    || row.policy_source_id !== policy.sourceId || row.request_json !== closureJson(request) || row.source_json !== closureJson(p.expectedActivity)
    || row.proof_json !== closureJson(proof)) throw new Error('physical closure actual effort archive differs');
};
export const readPhysicalClosureWorkload = (db: PhysicalClosureDb, p: PhysicalClosureProposal): DurablePlayerWorkloadActivity | null => {
  const row = db.prepare('SELECT source_json,before_json,after_json FROM world_player_workload_activities WHERE source_id=?')
    .get(p.expectedActivity.sourceEventId) as { source_json: string; before_json: string; after_json: string } | undefined;
  if (!row) return null;
  const record = { activity: p.expectedActivity, before: p.physicalPitch.frame.workload, after: expectedClosureWorkloadAfter(p) };
  if (row.source_json !== closureJson(record.activity) || row.before_json !== closureJson(record.before)
    || row.after_json !== closureJson(record.after)) throw new Error('physical closure original workload stage differs');
  assertArchivedPlayerWorkloadActivity(db, record); return closureFreeze(record);
};
export const assertPhysicalClosureOpenFrame = (db: PhysicalClosureDb, p: PhysicalClosureProposal): void => {
  const f = p.physicalPitch.frame;
  const match = db.prepare('SELECT durable_revision, state_json, activation_json FROM matches WHERE match_id=?').get(f.gameId) as {
    durable_revision: number; state_json: string; activation_json: string | null;
  } | undefined;
  const activation = f.activation === null ? null : closureJson({ activation: f.activation, nextWorld: f.world });
  const workload = db.prepare('SELECT revision, state_json FROM world_player_workload_heads WHERE career_id=? AND player_id=?')
    .get(f.workload.careerId, f.workload.playerId) as { revision: number; state_json: string } | undefined;
  if (!match || match.durable_revision !== f.officialRevision || match.state_json !== closureJson(f.match) || match.activation_json !== activation
    || !workload || workload.revision !== f.workload.revision || workload.state_json !== closureJson(f.workload)) throw new Error('physical closure current Match/workload frame changed');
};
export const expectedClosureWorkloadAfter = (p: PhysicalClosureProposal) => advancePlayerWorkloadRecovery(p.physicalPitch.frame.workload,
  p.physicalPitch.frame.workload.revision, p.expectedActivity);

/** A newly activated play must wait for every durable effect of its queued predecessor. */
export const assertPriorPhysicalClosureCompleted = (db: PhysicalClosureDb, applicationId: string | null): void => {
  assertPriorActualLiveClosureCompleted(db, applicationId);
  if (applicationId === null || !db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='physical_play_closures'").get()) return;
  const queued = db.prepare('SELECT source_id FROM physical_play_closures WHERE application_id=?').get(applicationId) as { source_id: string } | undefined;
  if (!queued) return;
  const saved = readPhysicalClosureProposal(db, queued.source_id);
  if (!saved || saved.row.status !== 'COMPLETED') throw new Error('prior physical closure is not completed');
  assertPhysicalClosureStages(db, saved.proposal);
  const workload = readPhysicalClosureWorkload(db, saved.proposal);
  const result = { sourceId: saved.source.sourceId, gameId: saved.row.game_id, playId: saved.row.play_id,
    official: saved.proposal.expectedOfficial, scoring: saved.proposal.expectedScoring, workload };
  if (!workload || saved.row.result_json !== closureJson(result)) throw new Error('prior physical closure completion evidence differs');
};
