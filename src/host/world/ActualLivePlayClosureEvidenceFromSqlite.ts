import { originalFoulMetadataValues as rawValues } from './OriginalFoulOwnershipMetadata';
import { assertFoulTerminalPriorActivation, assertFoulTerminalPriorCensusScope, withFoulTerminalPriorLiveScope } from './FoulTerminalCompletionAncestryGuard';
import { foulTerminalNextPlayReadinessFromSqlite } from './FoulTerminalNextPlayReadiness';
import { foulTerminalNextPlayScopeRows, assertNoFoulTerminalNextPlay, readFoulTerminalNextPlayAdmission } from './FoulTerminalNextPlayGuard';
import { battedWorldFieldGeometry } from './BattedWorldFieldRoot';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actualLivePlayReadinessFromSqlite } from './ActualLivePlayReadinessFromSqlite';
import { defensiveMetadataId as metadataId } from './ActualDefensiveMetadata';
import { sqliteJsonMetadataNodes as metadataNodes } from './SqliteOwnershipMetadata';
import { closeOfficialPlay, deriveClosedLiveBallMatchState } from '../../core/adjudication/PlayAdjudicationLedger';
import { confirmDurableClosedLiveBallStateApplication } from '../../core/adjudication/NextPlayActivation';
import { resolveOfficialGameProgression } from '../../core/world/competition/OfficialGameCompletion';
import { classifyClosedPlayForOfficialScoring } from '../../core/adjudication/OfficialScoring';
import { deriveOfficialPlayResult, deriveOfficialFinalResult, type PersistOfficialPlayInput, type PersistOfficialFinalInput } from '../SqliteOfficialStateStore';
import type { ActualAdjudicationDb } from './ActualLiveAdjudicationFromSqlite';
import { actualFirstBaseClosedEvidenceFromSqlite } from './SqliteActualFirstBasePlayEndStore';
import { activeBattedWorldFieldReadFrame, battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite, withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { actualPlayersKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { readOfficialActorPersonLink } from './SqliteOfficialInitialWorldStore';
import { readActualLiveOriginalFixture } from './ActualLiveOriginalFixtureFromSqlite';
import { assertNationalMatchBindings } from './NationalMatchOriginFromSqlite';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import { actualLiveAdjudicationIdentityRow } from './ActualLiveAdjudicationMetadata';
import { deriveActualLiveClosureAdjudicationWithInputs } from './ActualPostPlayReviewClosureFromSqlite';
export { deriveActualLiveClosureAdjudication } from './ActualPostPlayReviewClosureFromSqlite';
import { actualLivePlayClosureInput as input, type AcceptedActualLivePlayClosure } from './ActualLivePlayClosureSource';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
export const deriveActualLivePlayClosureProposal = (db: ActualAdjudicationDb, raw: AcceptedActualLivePlayClosure, historicalApplied = false) => withBattedWorldPhysicalReadTraversal(db, () => {
  const source = input(raw, raw.sourceId);
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='actual_live_adjudications'").get()) throw new Error('accepted actual live adjudication missing');
  const { selected, pair } = deriveActualLiveClosureAdjudicationWithInputs(db, source), { adjudication, ledger: openLedger } = selected;
  if (adjudication.timeline.kind !== 'projected') throw new Error(`actual official closure pending: ${adjudication.pendingReasons.join(', ')}`);
  const end = pair ? pair.end : actualFirstBaseClosedEvidenceFromSqlite(db).read(adjudication.source.physicalEndSourceId)!;
  if (pair && (end.source.sourceId !== adjudication.source.physicalEndSourceId
    || pair.prefix.baseField.source.sourceId !== end.source.baseFieldSourceId
    || pair.prefix.executions.at(-1)?.source.sourceId !== end.source.executionSourceId)) throw new Error('actual closure paired physical Source cut differs');
  if (source.closureTick < end.playEnd.tick) throw new Error('actual official closure precedes physical end');
  const ledger = closeOfficialPlay(openLedger, openLedger.revision,
    { eventId: `${source.sourceId}:closed`, closureId: source.sourceId, tick: source.closureTick });
  const next = deriveClosedLiveBallMatchState(adjudication.originalMatch, adjudication.timeline.timeline, ledger);
  const halfChanged = next.inning !== adjudication.originalMatch.inning || next.half !== adjudication.originalMatch.half;
  const possibleWalkoff = adjudication.originalMatch.half === 'bottom'
    && adjudication.originalMatch.score.home <= adjudication.originalMatch.score.away && next.score.home > next.score.away;
  if (!source.gamePolicy && (halfChanged || possibleWalkoff && !historicalApplied)) throw new Error('actual live closure requires accepted game policy at the legal handoff');
  const fieldOwner = battedWorldFieldEvidenceFromSqlite(db), executionOwner = battedWorldFieldExecutionEvidenceFromSqlite(db);
  const baseField = pair ? pair.prefix.baseField : fieldOwner.read(end.source.baseFieldSourceId)!;
  const pitch = baseField.response.touch.worldContact.flight.physicalPitch, frame = pitch.frame, batter = frame.batterActor!;
  const bindings = [batter.binding, ...frame.bindings];
  const fixture = db.prepare('SELECT * FROM official_fixtures WHERE game_id=?').get(end.gameId);
  if (!fixture || fixture.fixture_event_id !== bindings[0].fixtureEventId) throw new Error('actual live closure original fixture differs');
  const seasonFixture = readActualLiveOriginalFixture(db, end.gameId, bindings), { game, seasonId } = seasonFixture;
  const actors = bindings.map(binding => {
    const row = db.prepare('SELECT binding_json FROM official_participant_bindings WHERE game_id=? AND player_id=?').get(end.gameId, binding.playerId);
    const saved = row && JSON.parse(String(row.binding_json)) as OfficialParticipantBinding | undefined;
    if (!saved || json(saved) !== json(binding) || saved.gameId !== end.gameId || saved.careerId !== bindings[0].careerId
      || saved.competitionEditionId !== seasonId || saved.fixtureEventId !== fixture.fixture_event_id || saved.gameDay !== bindings[0].gameDay
      || saved.clubId !== (saved.side === 'HOME' ? game.homeClubId : game.awayClubId)) throw new Error('actual live closure original Player/Club binding differs');
    return { binding: saved, person: readOfficialActorPersonLink(db, saved) };
  });
  if (new Set(actors.map(a => a.person.personId)).size !== 10) throw new Error('actual live closure original Person membership differs');
  const gamePolicy = source.gamePolicy ? { seasonId, homeClubId: game.homeClubId,
    awayClubId: game.awayClubId, policy: source.gamePolicy } : undefined;
  let finalGame: Extract<PersistOfficialFinalInput, { kind: 'live_ball' }>['game'] | null = null;
  if (gamePolicy) {
    assertActualLiveGamePolicy(db, end.gameId, gamePolicy);
    const receipt = confirmDurableClosedLiveBallStateApplication({ match: frame.match,
      physicalTimeline: adjudication.timeline.timeline, adjudication: ledger, persistedMatchState: next,
      applicationId: source.applicationId, durableRevision: frame.officialRevision + 1 });
    const progression = resolveOfficialGameProgression({ ...gamePolicy, gameId: end.gameId, priorMatch: frame.match, application: receipt });
    if (progression.kind === 'GAME_FINAL_PENDING_SCORING') {
      const scoring = source.finalScoring;
      if (!scoring) throw new Error(`actual live game final pending official scoring: ${progression.completionReason}`);
      if (source.worldSetup !== null || source.nextStartedAtTick !== null) throw new Error('actual live game final cannot prepare another play');
      const venueBinding = { gameId: String(fixture.game_id), venueId: String(fixture.venue_id),
        fixtureEventId: String(fixture.fixture_event_id), fixtureRevision: Number(fixture.fixture_revision) };
      if (scoring.gameId !== end.gameId || scoring.seasonId !== seasonId || scoring.closureSourceId !== source.sourceId
        || scoring.playId !== end.playId || scoring.expectedDurableRevision !== frame.officialRevision || scoring.recordedAtTick < source.closureTick
        || json(scoring.adjudicationReference) !== json({ sourceId: adjudication.source.sourceId, snapshotHash: hash(adjudication) })
        || json(scoring.venueBinding) !== json(venueBinding)) throw new Error('actual live final scoring Source binding differs');
      const side = frame.match.half === 'top' ? 'away' : 'home';
      const inning = scoring.lineScore.innings[frame.match.inning - 1], currentHalfRuns = inning?.[side === 'away' ? 'awayRuns' : 'homeRuns'];
      if (currentHalfRuns == null || currentHalfRuns < next.score[side] - frame.match.score[side]) throw new Error('actual live final scoring current half omits the official run delta');
      // An aggregate Source has one closure owner. Raw mirrors are included so a
      // corrupted cached scope cannot hide an alias with the same accepted ID.
      const claims = [['source_json', ['finalScoring', 'sourceId']], ['proposal_json', ['source', 'finalScoring', 'sourceId']]] as const;
      const aliases = db.prepare(`SELECT source_id FROM actual_live_play_closures WHERE ${claims.map(([column, path]) => metadataId(column, path, '$id')).join(' OR ')}`)
        .all({ id: scoring.sourceId });
      if (aliases.length > 1 || aliases.some(row => row.source_id !== source.sourceId)) throw new Error('actual live final scoring Source ownership differs');
      finalGame = { ...gamePolicy, venueBinding, lineScore: scoring.lineScore };
    } else if (source.finalScoring || source.worldSetup === null) throw new Error('actual live continuing game requires next setup, not final scoring');
  }
  const setup = source.worldSetup;
  const side = next.half === 'top' ? 'HOME' : 'AWAY';
  const nextActors = halfChanged && setup ? setup.defenders.map(d => {
    const row = db.prepare('SELECT binding_json FROM official_participant_bindings WHERE game_id=? AND player_id=?').get(end.gameId, d.playerId);
    const saved = row && JSON.parse(String(row.binding_json)) as OfficialParticipantBinding | undefined;
    if (!saved || JSON.stringify(saved) !== row!.binding_json || !Number.isSafeInteger(saved.rosterRevision) || saved.rosterRevision < 0
      || saved.playerId !== d.playerId || saved.gameId !== end.gameId || saved.careerId !== bindings[0].careerId
      || saved.competitionEditionId !== seasonId || saved.fixtureEventId !== fixture.fixture_event_id
      || saved.gameDay !== bindings[0].gameDay || saved.side !== side || saved.clubId !== (side === 'HOME' ? game.homeClubId : game.awayClubId)) {
      throw new Error('actual live closure next defender participant binding differs');
    }
    return { binding: saved, person: readOfficialActorPersonLink(db, saved) };
  }) : actors;
  if (halfChanged && setup) assertNationalMatchBindings(db, nextActors.map(a => a.binding));
  if (setup && (setup.defenders.length !== 9 || setup.defenders.some(d =>
    !nextActors.some(a => a.binding.playerId === d.playerId && a.binding.side === side)
    || !halfChanged && !frame.world.defenders.some(original => original.playerId === d.playerId && original.registeredPosition === d.registeredPosition)))) {
    throw new Error('actual live closure next defender roles differ from original participants');
  }
  if (setup && halfChanged && (new Set(nextActors.map(a => a.person.personId)).size !== 9
    || nextActors.some(a => actors.some(original => original.person.personId === a.person.personId && original.binding.playerId !== a.binding.playerId)))) {
    throw new Error('actual live closure next defender Person membership differs');
  }
  for (const base of ['first', 'second', 'third'] as const) {
    if (setup && json(setup.baseCenters[base]) !== json(battedWorldFieldGeometry(baseField).baseGeometry.bases[base].region.center)) throw new Error('actual live closure next base geometry differs');
    const playerId = setup ? next.bases[base] : null;
    if (playerId !== null && !actors.some(a => a.binding.playerId === playerId && a.binding.side !== side)) throw new Error('actual live closure next runner lacks original Person/Club binding');
  }
  const prefix = pair ? pair.prefix : { baseField, fields: fieldOwner.scope(baseField, end.source.baseFieldSourceId), executions: executionOwner.scope(baseField, end.source.executionSourceId) };
  const players = actualPlayersKinematicsFromPrefix(bindings.map(b => b.playerId), prefix);
  // The accepted rule-system command retires these exact old-play authorities only
  // for the new setup. It does not cancel/relabel their original physical history.
  const controllerReset = { kind: source.controllerReset, sourceId: source.sourceId, previousPlayId: end.playId, nextPlayId: finalGame ? null : next.playId,
    atTick: finalGame ? source.closureTick : source.nextStartedAtTick, physicalEndReference: adjudication.endReference,
    retired: players.map(p => ({ playerId: p.playerId, personId: p.personId, activeCommand: p.activeCommand,
      ownedMotionCoverage: p.ownedMotionCoverage ?? null })), retainedOriginalFutureWork: end.futureWork };
  const common = { kind: 'live_ball' as const, matchId: end.gameId,
    applicationId: source.applicationId, expectedDurableRevision: frame.officialRevision, match: frame.match,
    adjudication: ledger, physicalTimeline: adjudication.timeline.timeline };
  let application: Extract<PersistOfficialPlayInput | PersistOfficialFinalInput, { kind: 'live_ball' }>;
  if (finalGame) application = { ...common, game: finalGame };
  else {
    if (source.worldSetup === null) throw new Error('actual live continuing game next setup is missing');
    application = { ...common, nextStartedAtTick: source.nextStartedAtTick, worldSetup: source.worldSetup };
  }
  const expectedOfficial = 'game' in application ? deriveOfficialFinalResult(application, frame.officialRevision + 1)
    : deriveOfficialPlayResult(application, frame.officialRevision + 1);
  const scoring = classifyClosedPlayForOfficialScoring({ kind: 'live_ball', match: frame.match, timeline: application.physicalTimeline, adjudication: ledger });
  const workload = { kind: 'pending' as const, reason: 'actual_role_effort_policy_and_application_unconnected' as const,
    participants: actors.map(a => ({ playerId: a.binding.playerId, personId: a.binding.personId, clubId: a.binding.clubId,
      role: a.binding.playerId === batter.binding.playerId ? 'BATTER_RUNNER' as const : 'DEFENDER' as const })) };
  const originalActivation = frame.activation === null ? null : { activation: frame.activation, nextWorld: frame.world };
  return freeze({ source, gameId: end.gameId, playId: end.playId, physicalEndReference: adjudication.endReference,
    wholeHistoryReference: adjudication.wholeHistoryReference, adjudicationReference: { sourceId: adjudication.source.sourceId, snapshotHash: hash(adjudication) },
    application, expectedOfficial, scoring, workload, controllerReset, actors,
    ...(gamePolicy ? { gamePolicy, ...(finalGame ? {} : { nextActors }) } : {}),
    fixture, seasonFixture, originalActivation,
    ...(selected.postPlayReviewReference ? { postPlayReviewReference: selected.postPlayReviewReference } : {}) });
});
/** Live and non-live closures pin the same per-game completion policy. */
export function assertActualLiveGamePolicy(db: ActualAdjudicationDb, gameId: string, policy: unknown, required = false): void {
  const installed = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='physical_closure_game_policies'").get();
  const row = installed && db.prepare('SELECT policy_json FROM physical_closure_game_policies WHERE game_id=?').get(gameId);
  if (row ? row.policy_json !== json(policy) : required) throw new Error('actual live closure accepted game policy differs or is missing');
}
export type ActualLivePlayClosureProposal = ReturnType<typeof deriveActualLivePlayClosureProposal>;
export const assertActualLiveClosureStage = (db: ActualAdjudicationDb, p: ActualLivePlayClosureProposal, requireApplied = false, requireCurrentWrite = false) => {
  const a = p.application, row = db.prepare('SELECT * FROM applications WHERE application_id=?').get(a.applicationId);
  if (!row) { if (requireApplied) throw new Error('actual live closure official application missing'); return false; }
  if (row.match_id !== a.matchId || row.closure_id !== p.source.sourceId || row.request_hash !== hash('game' in a ? { kind: 'game_final', request: a } : a) || row.result_json !== json(p.expectedOfficial)) {
    throw new Error('actual live closure official application archive differs');
  }
  const match = db.prepare('SELECT * FROM matches WHERE match_id=?').get(a.matchId);
  if (!match || typeof match.durable_revision !== 'number' || match.durable_revision < p.expectedOfficial.receipt.durableRevision
    || (requireCurrentWrite || 'result' in p.expectedOfficial) && match.durable_revision !== p.expectedOfficial.receipt.durableRevision
    || match.durable_revision === p.expectedOfficial.receipt.durableRevision && (match.state_json !== json(p.expectedOfficial.receipt.appliedMatchState)
      || match.activation_json !== json('result' in p.expectedOfficial ? { finalResult: p.expectedOfficial.result }
        : { activation: p.expectedOfficial.activation, nextWorld: p.expectedOfficial.nextWorld }))) throw new Error('actual live closure written Match differs');
  return true;
};
export const assertActualLiveClosureOpenMatch = (db: ActualAdjudicationDb, p: ActualLivePlayClosureProposal) => {
  const row = db.prepare('SELECT * FROM matches WHERE match_id=?').get(p.gameId);
  if (!row || row.durable_revision !== p.application.expectedDurableRevision || row.state_json !== json(p.application.match)
    || row.activation_json !== (p.originalActivation === null ? null : json(p.originalActivation))) throw new Error('actual live closure original Match changed');
};
export const actualLiveClosureResult = (sourceId: string, proposal: ActualLivePlayClosureProposal) => freeze({
  sourceId, official: proposal.expectedOfficial, scoring: proposal.scoring, workload: proposal.workload,
  nextPhysicalPlay: 'result' in proposal.expectedOfficial ? { kind: 'not_applicable' as const, reason: 'game_final' as const }
    : { kind: 'blocked' as const, reason: 'actual_role_workload_pending' as const }, controllerReset: proposal.controllerReset,
});
export const actualLivePlayClosureEvidenceFromSqlite = (db: ActualAdjudicationDb) => ({
  read(sourceId: string) {
    const row = actualLiveAdjudicationIdentityRow(db, 'actual_live_play_closures', sourceId);
    if (!row) return null;
    return withFoulTerminalPriorLiveScope(db,sourceId,row.game_id as string,row.play_id as number,()=>{
    const source = input(JSON.parse(String(row.source_json)), sourceId);
    const historicalApplied = !!db.prepare('SELECT 1 FROM applications WHERE application_id=?').get(source.applicationId);
    const proposal = deriveActualLivePlayClosureProposal(db, source, historicalApplied);
    if (proposal.gamePolicy) assertActualLiveGamePolicy(db, proposal.gameId, proposal.gamePolicy, true);
    const peers = db.prepare('SELECT source_id FROM actual_live_play_closures WHERE application_id=? OR (game_id=? AND play_id=?)').all(source.applicationId, proposal.gameId, proposal.playId);
    if (peers.length !== 1 || peers[0].source_id !== sourceId || row.game_id !== proposal.gameId || row.play_id !== proposal.playId
      || row.application_id !== source.applicationId || row.source_json !== json(source) || row.source_hash !== hash(source)
      || row.proposal_json !== json(proposal) || row.proposal_hash !== hash(proposal)
      || !['QUEUED', 'OFFICIAL_APPLIED'].includes(String(row.status))) throw new Error('actual live closure archive differs');
    const applied = assertActualLiveClosureStage(db, proposal, row.status === 'OFFICIAL_APPLIED');
    const result = row.status === 'OFFICIAL_APPLIED' ? actualLiveClosureResult(sourceId, proposal) : null;
    if (row.result_json !== (result === null ? null : json(result))) throw new Error('actual live closure stage receipt differs');
    return freeze({ source, proposal, status: row.status as 'QUEUED' | 'OFFICIAL_APPLIED', officialApplied: applied, result });
    });
  },
});
/** Discover every actual owner of this activation, including raw identity mirrors. */
export const actualLiveClosureApplicationRows = (db: ActualAdjudicationDb, applicationId: string) => {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='actual_live_play_closures'").get()) return [];
  const columns = new Set(db.prepare('PRAGMA table_info(actual_live_play_closures)').all().map(r => r.name));
  const aliases = [
    ...(columns.has('source_json') ? [['source_json',['applicationId']]] as const : []),
    ...(columns.has('proposal_json') ? [['source','applicationId'],['application','applicationId'],
      ['expectedOfficial','receipt','applicationId'],['expectedOfficial','activation','applicationId'],['expectedOfficial','result','applicationId']]
      .map(path => ['proposal_json',path] as const) : []),
    ...(columns.has('result_json') ? [['official','receipt','applicationId'],['official','activation','applicationId'],['official','result','applicationId']]
      .map(path => ['result_json',path] as const) : []),
  ];
  // Preserve the original scoped statement boundary: actor read brackets
  // detach its returned rows before later metadata callbacks. The additional
  // raw census only widens discovery to array-wrapped identity mirrors.
  const rawIds = db.prepare('SELECT * FROM actual_live_play_closures').all().filter(row =>
    aliases.some(([column,path]) => rawValues(db,String(row[column]),path).includes(applicationId))).map(row => {
      if (typeof row.source_id !== 'string') throw new Error('prior actual live closure ownership differs');
      return row.source_id;
    });
  const predicates = aliases.map(([column,path]) => metadataId(column,path,'$id'));
  const rows = db.prepare(`SELECT * FROM actual_live_play_closures WHERE application_id=$id OR ${[...predicates,
    'source_id IN (SELECT value FROM json_each($rawIds))'].join(' OR ')}`).all({id:applicationId,rawIds:JSON.stringify(rawIds)});
  if (rows.length > 1 || rows.length === 1 && rows[0].application_id !== applicationId) throw new Error('prior actual live closure ownership differs');
  return rows;
};
/** Additive admission fence: an applied Match is not complete actual-role readiness. */
export const assertPriorActualLiveClosureCompleted = (db: ActualAdjudicationDb, applicationId: string | null, historical = false): void => {
  checkPriorActualLiveClosureCompleted(db, applicationId, historical);
};
type ActualLiveActivationReadiness = Extract<ReturnType<ReturnType<typeof actualLivePlayReadinessFromSqlite>['readHistorical']>, { kind: 'ready' }>;
/** Hand off only this operation's completed target, inside the activation's owned read bracket. */
export const readPriorActualLiveActivationReadiness = (db: ActualAdjudicationDb, applicationId: string): ActualLiveActivationReadiness | null => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const frame = activeBattedWorldFieldReadFrame(db);
  if (!(db instanceof DatabaseSync) || !db.isTransaction || frame === null) {
    throw new Error('actual live activation readiness requires an owned Native transaction');
  }
  const ready = checkPriorActualLiveClosureCompleted(db, applicationId, true, true);
  if (!db.isTransaction || activeBattedWorldFieldReadFrame(db) !== frame) {
    throw new Error('actual live activation readiness owned frame changed');
  }
  return ready?.kind === 'ready' ? ready : null;
};
type FoulTerminalActivationReadiness = ReturnType<ReturnType<typeof foulTerminalNextPlayReadinessFromSqlite>['readHistorical']>;
export const readPriorFoulTerminalActivationReadiness = (db: ActualAdjudicationDb, applicationId: string): FoulTerminalActivationReadiness | null => {
  const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const frame=activeBattedWorldFieldReadFrame(db), paired=db instanceof DatabaseSync&&db.isTransaction&&frame!==null;
  const ready = checkPriorActualLiveClosureCompleted(db,applicationId,true,false,true,paired);
  if(paired&&(!(db as import('node:sqlite').DatabaseSync).isTransaction||activeBattedWorldFieldReadFrame(db)!==frame
    ||db.prepare('PRAGMA query_only').get()!.query_only!==1))throw new Error('terminal activation readiness owned frame changed');
  return ready?.kind === 'foul_terminal_ready' ? ready : null;
};
const checkPriorActualLiveClosureCompleted = (db: ActualAdjudicationDb, applicationId: string | null, historical: boolean,
  paired = false, terminalWanted = false, terminalPaired = false): ActualLiveActivationReadiness | FoulTerminalActivationReadiness | null => {
  if (applicationId !== null && db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='applications'").get()) {
    const row = db.prepare('SELECT * FROM applications WHERE application_id=?').get(applicationId);
    if (row) { const result = JSON.parse(String(row.result_json));
      assertFoulTerminalPriorActivation(db,String(row.match_id),result?.receipt?.previousPlayId,result?.activation?.nextMatchState?.playId); }
  }
  const terminalAdmission=terminalPaired&&applicationId!==null?readFoulTerminalNextPlayAdmission(db,applicationId):null;
  const terminal = terminalAdmission?terminalAdmission.archive:assertNoFoulTerminalNextPlay(db, applicationId);
  if (applicationId === null || terminalWanted && terminal === null) return null;
  const installed = (name: string) => {
    const schema = db.prepare('SELECT type FROM main.sqlite_master WHERE name=?').all(name);
    if (schema.length && (schema.length !== 1 || schema[0].type !== 'table')) throw new Error('prior actual live or terminal scope owner schema differs');
    return schema.length === 1;
  };
  const columns = (name: string) => new Set(db.prepare(`PRAGMA table_info(${name})`).all().map(r => r.name));
  const hasOwner = installed('actual_live_play_closures'), discoveredRows = actualLiveClosureApplicationRows(db, applicationId);
  // Detach all fields before metadata or readiness reads can touch statement aliases.
  const rows = paired ? freeze(cloneInert(discoveredRows)) : discoveredRows;
  const ownerBytes = paired ? json(rows) : null;
  const targetSourceId = paired && rows.length ? String(rows[0].source_id) : null;
  const target = { ready: null as ActualLiveActivationReadiness | null };
  if (terminal && rows.length) throw new Error('prior activation has dual terminal and actual live closure owners');
  const terminalTarget = { ready:null as FoulTerminalActivationReadiness | null };
  const physicalEnds = new Map<number, Set<string>>();
  const liveTables = ['actual_live_play_runtimes', 'actual_first_base_play_ends', 'actual_foul_play_ends', 'actual_live_play_fences'].filter(installed);
  if (!terminal && !hasOwner && !liveTables.length && !paired) return null;
  const scopedPlays = new Set<number>(); let gameId: string | null = null;
  if ((terminal || liveTables.length) && installed('applications')) {
    const applications = db.prepare('SELECT * FROM applications WHERE application_id=?').all(applicationId);
    if (applications.length > 1) throw new Error('actual live prior activation identity differs');
    const application = applications[0];
    if (application) {
      const result = JSON.parse(String(application.result_json)), receipt = result?.receipt;
      if (!receipt || receipt.applicationId !== applicationId || !Number.isSafeInteger(receipt.previousPlayId)
        || receipt.previousPlayId < 0 || typeof application.match_id !== 'string') throw new Error('actual live prior activation identity differs');
      gameId = application.match_id;
      for (const [key, value] of [['applicationId', applicationId], ['previousPlayId', receipt.previousPlayId]] as const) {
        const metadata = db.prepare(`SELECT count(*) AS n,sum(o.atom=$value) AS matched FROM (${metadataNodes('$document', ['receipt', key])}) o`)
          .get({ document: String(application.result_json), value });
        if (!metadata || metadata.n !== 1 || metadata.matched !== 1) throw new Error('actual live prior activation metadata differs');
      }
      const originalPitchIds = new Set<string>();
      if (installed('physical_pitch_progress_actions')) {
        const pitchColumns = columns('physical_pitch_progress_actions');
        const pitchRows = db.prepare('SELECT * FROM physical_pitch_progress_actions').all().filter(row => {
          const games = [row.game_id,
            ...(pitchColumns.has('source_json') ? rawValues(db,String(row.source_json),['gameId']) : []),
            ...(pitchColumns.has('snapshot_json') ? [['frame','gameId'],['source','gameId']].flatMap(path => rawValues(db,String(row.snapshot_json),path)) : [])];
          const plays = [row.play_id,...(pitchColumns.has('snapshot_json') ? [['frame','match','playId'],['beforeTimeline','playId'],
            ['result','pitch','resolution','timeline','playId']].flatMap(path => rawValues(db,String(row.snapshot_json),path)) : [])];
          return games.includes(application.match_id) && plays.some(play => typeof play === 'number' && Number.isSafeInteger(play) && play <= receipt.previousPlayId);
        });
        for (const pitch of pitchRows) {
          if (typeof pitch.source_id === 'string') originalPitchIds.add(pitch.source_id);
          for (const [column, path] of [['source_json', ['sourceId']], ['snapshot_json', ['source', 'sourceId']]] as const) {
            if (!pitchColumns.has(column)) continue;
            for (const mirror of rawValues(db,String(pitch[column]),path)) if (typeof mirror === 'string') originalPitchIds.add(mirror);
          }
        }
      }
      for (const table of liveTables) {
        const tableColumns = columns(table), hasSnapshot = tableColumns.has('snapshot_json');
        const referenceMirrors = [
          ...(tableColumns.has('source_json') ? [['source_json',['physicalPitchSourceId']]] as const : []),
          ...(hasSnapshot ? [['snapshot_json',['physicalPitchSourceId']],['snapshot_json',['source','physicalPitchSourceId']],
            ['snapshot_json',['history','physicalPitchSourceId']]] as const : []),
        ];
        const claims = db.prepare(`SELECT * FROM ${table}`).all().filter(row => row.game_id === application.match_id
          || hasSnapshot && rawValues(db,String(row.snapshot_json),['gameId']).includes(String(application.match_id))
          || tableColumns.has('physical_pitch_source_id') && originalPitchIds.has(String(row.physical_pitch_source_id))
          || referenceMirrors.some(([column,path]) => rawValues(db,String(row[column]),path).some(id => typeof id === 'string' && originalPitchIds.has(id))));
        for (const claim of claims) {
          if (typeof claim.game_id !== 'string' || !Number.isSafeInteger(claim.play_id) || (claim.play_id as number) < 0) throw new Error('actual live prior scope metadata differs');
          if (hasSnapshot) {
            for (const [key, value] of [['gameId', claim.game_id], ['playId', claim.play_id]] as const) {
              const metadata = db.prepare(`SELECT count(*) AS n,sum(o.atom=$value) AS matched FROM (${metadataNodes('$document', [key])}) o`)
                .get({ document: String(claim.snapshot_json), value });
              if (!metadata || metadata.n !== 1 || metadata.matched !== 1) throw new Error('actual live prior scope identity differs');
            }
          }
          if (claim.game_id !== application.match_id) throw new Error('actual live prior scope identity differs');
          if ((claim.play_id as number) <= receipt.previousPlayId) {
            scopedPlays.add(claim.play_id as number);
            if (table === 'actual_foul_play_ends' || table === 'actual_first_base_play_ends') {
              const ids = physicalEnds.get(claim.play_id as number) ?? new Set<string>();
              if (typeof claim.source_id === 'string') ids.add(claim.source_id);
              if (tableColumns.has('source_json')) for (const row of db.prepare(`SELECT atom FROM (${metadataNodes('$document',['sourceId'])})`).all({document:String(claim.source_json)})) {
                if (typeof row.atom === 'string') ids.add(row.atom);
              }
              physicalEnds.set(claim.play_id as number,ids);
            }
          }
        }
      }
    }
  }
  const checked = new Set<string>();
  const requireReady = (sourceId: string, expectedPlay?: number) => {
    const readiness = actualLivePlayReadinessFromSqlite(db);
    const ready = historical ? readiness.readHistorical(sourceId) : readiness.read(sourceId);
    if (ready.kind !== 'ready') throw new Error(`prior actual live closure is pending: ${ready.reason}`);
    if (expectedPlay !== undefined && (ready.closure.proposal.gameId !== gameId || ready.closure.proposal.playId !== expectedPlay)) {
      throw new Error('prior actual live closure scope differs');
    }
    checked.add(sourceId);
    if (paired && sourceId === targetSourceId) target.ready = ready;
    return ready;
  };
  const requireTerminalReady = (sourceId: string, expectedGame: string, expectedPlay: number) => {
    assertFoulTerminalPriorCensusScope(db,expectedGame,expectedPlay);
    const readiness = foulTerminalNextPlayReadinessFromSqlite(db);
    const pairedTarget=historical&&terminalAdmission?.readiness?.reference.terminalSourceId===sourceId?terminalAdmission.readiness:null;
    const ready = pairedTarget ?? (!historical && terminal?.source.sourceId === sourceId ? readiness.read(sourceId) : readiness.readHistorical(sourceId));
    if (ready.archive.proposal.gameId !== expectedGame || ready.archive.proposal.playId !== expectedPlay) throw new Error('prior terminal completion scope differs');
    if (terminal?.source.sourceId === sourceId) terminalTarget.ready = ready;
    return ready;
  };
  for (const playId of scopedPlays) {
    assertFoulTerminalPriorCensusScope(db,gameId!,playId);
    const terminals = foulTerminalNextPlayScopeRows(db,gameId!,playId,[...(physicalEnds.get(playId) ?? [])]);
    const scopeApplicationIds = new Set(terminals.map(row => String(row.application_id)));
    if (installed('applications')) for (const row of db.prepare('SELECT * FROM applications').all()) {
      const result = String(row.result_json);
      const games = [row.match_id,...rawValues(db,result,['pendingPostPlay','matchId'])];
      const plays = [...rawValues(db,result,['receipt','previousPlayId']),...rawValues(db,result,['pendingPostPlay','previousPlayId'])];
      if (games.includes(gameId) && plays.includes(playId)) for (const id of [row.application_id,...rawValues(db,result,['receipt','applicationId'])]) {
        if (typeof id === 'string') scopeApplicationIds.add(id);
      }
    }
    let owners: ReturnType<ReturnType<ActualAdjudicationDb['prepare']>['all']> = [];
    if (hasOwner) {
      const ownerColumns = columns('actual_live_play_closures');
      if (!['source_id','game_id','play_id'].every(key => ownerColumns.has(key))) throw new Error('prior actual live closure staged owner is missing or corrupt');
      owners = db.prepare('SELECT * FROM actual_live_play_closures').all().filter(row => {
        const proposal = String(row.proposal_json), result = String(row.result_json);
        const games = [row.game_id,...(ownerColumns.has('proposal_json') ? [['gameId'],['application','matchId']]
          .flatMap(path => rawValues(db,proposal,path)) : [])];
        const plays = [row.play_id,...(ownerColumns.has('proposal_json') ? [['playId'],['application','match','playId'],['expectedOfficial','receipt','previousPlayId']]
          .flatMap(path => rawValues(db,proposal,path)) : []),...(ownerColumns.has('result_json') ? rawValues(db,result,['official','receipt','previousPlayId']) : [])];
        const applications = [row.application_id,
          ...(ownerColumns.has('source_json') ? rawValues(db,String(row.source_json),['applicationId']) : []),
          ...(ownerColumns.has('proposal_json') ? [['source','applicationId'],['application','applicationId'],['expectedOfficial','receipt','applicationId'],
            ['expectedOfficial','activation','applicationId'],['expectedOfficial','result','applicationId']].flatMap(path => rawValues(db,proposal,path)) : []),
          ...(ownerColumns.has('result_json') ? [['official','receipt','applicationId'],['official','activation','applicationId'],['official','result','applicationId']]
            .flatMap(path => rawValues(db,result,path)) : [])];
        return applications.some(id => typeof id === 'string' && scopeApplicationIds.has(id))
          || games.includes(gameId) && plays.includes(playId)
          || ownerColumns.has('proposal_json') && rawValues(db,proposal,['physicalEndReference','sourceId'])
            .some(id => typeof id === 'string' && physicalEnds.get(playId)?.has(id));
      });
    }
    if (terminals.length + owners.length !== 1) throw new Error('prior actual live closure staged owner or terminal completion is missing or ambiguous');
    if (terminals.length) requireTerminalReady(String(terminals[0].source_id),gameId!,playId);
    else requireReady(String(owners[0].source_id),playId);
  }
  if (terminal && terminalTarget.ready === null) requireTerminalReady(terminal.source.sourceId,terminal.proposal.gameId,terminal.proposal.playId);
  if (terminalWanted) return terminalTarget.ready;
  if (rows.length && !checked.has(String(rows[0].source_id))) {
    const ready = requireReady(String(rows[0].source_id));
    if (ready.closure.proposal.application.applicationId !== applicationId) throw new Error('prior actual live closure activation differs');
  }
  if (!paired) return null;
  // Repeat raw alias discovery only after every retained prior scope has passed.
  const currentRows = freeze(cloneInert(actualLiveClosureApplicationRows(db, applicationId)));
  if (json(currentRows) !== ownerBytes) throw new Error('prior actual live closure activation owner changed');
  if (!rows.length) return null;
  if (target.ready === null || target.ready.closure.proposal.application.applicationId !== applicationId) {
    throw new Error('prior actual live closure activation differs');
  }
  return target.ready;
};
