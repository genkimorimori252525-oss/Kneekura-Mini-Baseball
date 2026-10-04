import { actualLivePlayReadinessFromSqlite } from './ActualLivePlayReadinessFromSqlite';
import { defensiveMetadataId as metadataId } from './ActualDefensiveMetadata';
import { sqliteJsonMetadataNodes as metadataNodes } from './SqliteOwnershipMetadata';
import { closeOfficialPlay, deriveClosedLiveBallMatchState } from '../../core/adjudication/PlayAdjudicationLedger';
import { classifyClosedPlayForOfficialScoring } from '../../core/adjudication/OfficialScoring';
import { deriveOfficialPlayResult, type PersistOfficialPlayInput } from '../SqliteOfficialStateStore';
import { actualLiveAdjudicationEvidenceFromSqlite, type ActualAdjudicationDb } from './ActualLiveAdjudicationFromSqlite';
import { actualFirstBaseClosedEvidenceFromSqlite } from './SqliteActualFirstBasePlayEndStore';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite } from './SqliteBattedWorldFieldExecutionStore';
import { actualPlayersKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { readOfficialActorPersonLink } from './SqliteOfficialInitialWorldStore';
import type { OfficialStandingsSchedule } from '../../core/world/competition/OfficialStandings';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import { actualLiveAdjudicationIdentityRow } from './ActualLiveAdjudicationMetadata';
import { actualLivePlayClosureInput as input, type AcceptedActualLivePlayClosure } from './ActualLivePlayClosureSource';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
export const deriveActualLivePlayClosureProposal = (db: ActualAdjudicationDb, raw: AcceptedActualLivePlayClosure) => {
  const source = input(raw, raw.sourceId);
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='actual_live_adjudications'").get()) throw new Error('accepted actual live adjudication missing');
  const adjudication = actualLiveAdjudicationEvidenceFromSqlite(db).read(source.adjudicationSourceId);
  if (!adjudication) throw new Error('accepted actual live adjudication missing');
  if (adjudication.kind !== 'official_ready' || adjudication.timeline.kind !== 'projected') throw new Error(`actual official closure pending: ${adjudication.pendingReasons.join(', ')}`);
  const end = actualFirstBaseClosedEvidenceFromSqlite(db).read(adjudication.source.physicalEndSourceId)!;
  if (source.closureTick < end.playEnd.tick) throw new Error('actual official closure precedes physical end');
  const ledger = closeOfficialPlay(adjudication.ledger, adjudication.ledger.revision,
    { eventId: `${source.sourceId}:closed`, closureId: source.sourceId, tick: source.closureTick });
  const next = deriveClosedLiveBallMatchState(adjudication.originalMatch, adjudication.timeline.timeline, ledger);
  // Game-final and inning-transition setup need their own profile/participant handoff.
  if (next.inning !== adjudication.originalMatch.inning || next.half !== adjudication.originalMatch.half) throw new Error('actual live closure inning transition setup unsupported');
  const fieldOwner = battedWorldFieldEvidenceFromSqlite(db), executionOwner = battedWorldFieldExecutionEvidenceFromSqlite(db);
  const baseField = fieldOwner.read(end.source.baseFieldSourceId)!;
  const pitch = baseField.response.touch.worldContact.flight.physicalPitch, frame = pitch.frame, batter = frame.batterActor!;
  const bindings = [batter.binding, ...frame.bindings];
  const fixture = db.prepare('SELECT * FROM official_fixtures WHERE game_id=?').get(end.gameId);
  if (!fixture || fixture.fixture_event_id !== bindings[0].fixtureEventId) throw new Error('actual live closure original fixture differs');
  const scheduleRow = db.prepare('SELECT schedule_json FROM world_season_heads WHERE career_id=? AND season_id=?')
    .get(bindings[0].careerId, bindings[0].competitionEditionId);
  const schedule = scheduleRow && JSON.parse(String(scheduleRow.schedule_json)) as OfficialStandingsSchedule | undefined;
  const games = schedule?.games.filter(g => g.gameId === end.gameId);
  if (!schedule || schedule.seasonId !== bindings[0].competitionEditionId || !games || games.length !== 1) throw new Error('actual live closure original season fixture missing');
  const game = games[0], actors = bindings.map(binding => {
    const row = db.prepare('SELECT binding_json FROM official_participant_bindings WHERE game_id=? AND player_id=?').get(end.gameId, binding.playerId);
    const saved = row && JSON.parse(String(row.binding_json)) as OfficialParticipantBinding | undefined;
    if (!saved || json(saved) !== json(binding) || saved.gameId !== end.gameId || saved.careerId !== bindings[0].careerId
      || saved.competitionEditionId !== schedule.seasonId || saved.fixtureEventId !== fixture.fixture_event_id || saved.gameDay !== bindings[0].gameDay
      || saved.clubId !== (saved.side === 'HOME' ? game.homeClubId : game.awayClubId)) throw new Error('actual live closure original Player/Club binding differs');
    return { binding: saved, person: readOfficialActorPersonLink(db, saved) };
  });
  if (new Set(actors.map(a => a.person.personId)).size !== 10) throw new Error('actual live closure original Person membership differs');
  const side = next.half === 'top' ? 'HOME' : 'AWAY';
  if (source.worldSetup.defenders.length !== 9 || source.worldSetup.defenders.some(d =>
    !actors.some(a => a.binding.playerId === d.playerId && a.binding.side === side)
    || !frame.world.defenders.some(original => original.playerId === d.playerId && original.registeredPosition === d.registeredPosition))) {
    throw new Error('actual live closure next defender roles differ from original participants');
  }
  for (const base of ['first', 'second', 'third'] as const) {
    if (json(source.worldSetup.baseCenters[base]) !== json(baseField.geometry.geometry.baseGeometry.bases[base].region.center)) throw new Error('actual live closure next base geometry differs');
    const playerId = next.bases[base];
    if (playerId !== null && !actors.some(a => a.binding.playerId === playerId && a.binding.side !== side)) throw new Error('actual live closure next runner lacks original Person/Club binding');
  }
  const prefix = { baseField, fields: fieldOwner.scope(baseField, end.source.baseFieldSourceId), executions: executionOwner.scope(baseField, end.source.executionSourceId) };
  const players = actualPlayersKinematicsFromPrefix(bindings.map(b => b.playerId), prefix);
  // The accepted rule-system command retires these exact old-play authorities only
  // for the new setup. It does not cancel/relabel their original physical history.
  const controllerReset = { kind: source.controllerReset, sourceId: source.sourceId, previousPlayId: end.playId, nextPlayId: next.playId,
    atTick: source.nextStartedAtTick, physicalEndReference: adjudication.endReference,
    retired: players.map(p => ({ playerId: p.playerId, personId: p.personId, activeCommand: p.activeCommand,
      ownedMotionCoverage: p.ownedMotionCoverage ?? null })), retainedOriginalFutureWork: end.futureWork };
  const application: Extract<PersistOfficialPlayInput, { kind: 'live_ball' }> = { kind: 'live_ball', matchId: end.gameId,
    applicationId: source.applicationId, expectedDurableRevision: frame.officialRevision, match: frame.match,
    adjudication: ledger, physicalTimeline: adjudication.timeline.timeline, nextStartedAtTick: source.nextStartedAtTick, worldSetup: source.worldSetup };
  const expectedOfficial = deriveOfficialPlayResult(application, frame.officialRevision + 1);
  const scoring = classifyClosedPlayForOfficialScoring({ kind: 'live_ball', match: frame.match, timeline: application.physicalTimeline, adjudication: ledger });
  const workload = { kind: 'pending' as const, reason: 'actual_role_effort_policy_and_application_unconnected' as const,
    participants: actors.map(a => ({ playerId: a.binding.playerId, personId: a.binding.personId, clubId: a.binding.clubId,
      role: a.binding.playerId === batter.binding.playerId ? 'BATTER_RUNNER' as const : 'DEFENDER' as const })) };
  const originalActivation = frame.activation === null ? null : { activation: frame.activation, nextWorld: frame.world };
  return freeze({ source, gameId: end.gameId, playId: end.playId, physicalEndReference: adjudication.endReference,
    wholeHistoryReference: adjudication.wholeHistoryReference, adjudicationReference: { sourceId: adjudication.source.sourceId, snapshotHash: hash(adjudication) },
    application, expectedOfficial, scoring, workload, controllerReset, actors,
    fixture, seasonFixture: { careerId: bindings[0].careerId, seasonId: schedule.seasonId, game }, originalActivation });
};
export type ActualLivePlayClosureProposal = ReturnType<typeof deriveActualLivePlayClosureProposal>;
export const assertActualLiveClosureStage = (db: ActualAdjudicationDb, p: ActualLivePlayClosureProposal, requireApplied = false, requireCurrentWrite = false) => {
  const a = p.application, row = db.prepare('SELECT * FROM applications WHERE application_id=?').get(a.applicationId);
  if (!row) { if (requireApplied) throw new Error('actual live closure official application missing'); return false; }
  if (row.match_id !== a.matchId || row.closure_id !== p.source.sourceId || row.request_hash !== hash(a) || row.result_json !== json(p.expectedOfficial)) {
    throw new Error('actual live closure official application archive differs');
  }
  const match = db.prepare('SELECT * FROM matches WHERE match_id=?').get(a.matchId);
  if (!match || typeof match.durable_revision !== 'number' || match.durable_revision < p.expectedOfficial.receipt.durableRevision
    || requireCurrentWrite && match.durable_revision !== p.expectedOfficial.receipt.durableRevision
    || match.durable_revision === p.expectedOfficial.receipt.durableRevision && (match.state_json !== json(p.expectedOfficial.activation.nextMatchState)
      || match.activation_json !== json({ activation: p.expectedOfficial.activation, nextWorld: p.expectedOfficial.nextWorld }))) throw new Error('actual live closure written Match differs');
  return true;
};
export const assertActualLiveClosureOpenMatch = (db: ActualAdjudicationDb, p: ActualLivePlayClosureProposal) => {
  const row = db.prepare('SELECT * FROM matches WHERE match_id=?').get(p.gameId);
  if (!row || row.durable_revision !== p.application.expectedDurableRevision || row.state_json !== json(p.application.match)
    || row.activation_json !== (p.originalActivation === null ? null : json(p.originalActivation))) throw new Error('actual live closure original Match changed');
};
export const actualLivePlayClosureEvidenceFromSqlite = (db: ActualAdjudicationDb) => ({
  read(sourceId: string) {
    const row = actualLiveAdjudicationIdentityRow(db, 'actual_live_play_closures', sourceId);
    if (!row) return null;
    const source = input(JSON.parse(String(row.source_json)), sourceId), proposal = deriveActualLivePlayClosureProposal(db, source);
    const peers = db.prepare('SELECT source_id FROM actual_live_play_closures WHERE application_id=? OR (game_id=? AND play_id=?)').all(source.applicationId, proposal.gameId, proposal.playId);
    if (peers.length !== 1 || peers[0].source_id !== sourceId || row.game_id !== proposal.gameId || row.play_id !== proposal.playId
      || row.application_id !== source.applicationId || row.source_json !== json(source) || row.source_hash !== hash(source)
      || row.proposal_json !== json(proposal) || row.proposal_hash !== hash(proposal)
      || !['QUEUED', 'OFFICIAL_APPLIED'].includes(String(row.status))) throw new Error('actual live closure archive differs');
    const applied = assertActualLiveClosureStage(db, proposal, row.status === 'OFFICIAL_APPLIED');
    const result = row.status === 'OFFICIAL_APPLIED' ? freeze({ sourceId, official: proposal.expectedOfficial, scoring: proposal.scoring,
      workload: proposal.workload, nextPhysicalPlay: { kind: 'blocked' as const, reason: 'actual_role_workload_pending' as const }, controllerReset: proposal.controllerReset }) : null;
    if (row.result_json !== (result === null ? null : json(result))) throw new Error('actual live closure stage receipt differs');
    return freeze({ source, proposal, status: row.status as 'QUEUED' | 'OFFICIAL_APPLIED', officialApplied: applied, result });
  },
});
/** Discover every actual owner of this activation, including raw identity mirrors. */
export const actualLiveClosureApplicationRows = (db: ActualAdjudicationDb, applicationId: string) => {
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='actual_live_play_closures'").get()) return [];
  const columns = new Set(db.prepare('PRAGMA table_info(actual_live_play_closures)').all().map(r => r.name));
  const aliases = [columns.has('source_json') ? metadataId('source_json', ['applicationId'], '$id') : '0',
    ...(columns.has('proposal_json') ? [['source', 'applicationId'], ['application', 'applicationId'],
      ['expectedOfficial', 'receipt', 'applicationId'], ['expectedOfficial', 'activation', 'applicationId']]
      .map(path => metadataId('proposal_json', path, '$id')) : []),
    ...(columns.has('result_json') ? [['official', 'receipt', 'applicationId'], ['official', 'activation', 'applicationId']]
      .map(path => metadataId('result_json', path, '$id')) : [])];
  const rows = db.prepare(`SELECT * FROM actual_live_play_closures WHERE application_id=$id OR ${aliases.join(' OR ')}`).all({ id: applicationId });
  if (rows.length > 1 || rows.length === 1 && rows[0].application_id !== applicationId) throw new Error('prior actual live closure ownership differs');
  return rows;
};
/** Additive admission fence: an applied Match is not complete actual-role readiness. */
export const assertPriorActualLiveClosureCompleted = (db: ActualAdjudicationDb, applicationId: string | null, historical = false): void => {
  if (applicationId === null) return;
  const installed = (name: string) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
  const columns = (name: string) => new Set(db.prepare(`PRAGMA table_info(${name})`).all().map(r => r.name));
  const hasOwner = installed('actual_live_play_closures'), rows = actualLiveClosureApplicationRows(db, applicationId);
  const liveTables = ['actual_live_play_runtimes', 'actual_first_base_play_ends', 'actual_live_play_fences'].filter(installed);
  if (!hasOwner && !liveTables.length) return;
  const scopedPlays = new Set<number>(); let gameId: string | null = null;
  if (liveTables.length && installed('applications')) {
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
        const games = ['game_id=$game', ...(pitchColumns.has('source_json') ? [metadataId('source_json', ['gameId'], '$game')] : []),
          ...(pitchColumns.has('snapshot_json') ? [['frame', 'gameId'], ['source', 'gameId']]
            .map(path => metadataId('snapshot_json', path, '$game')) : [])];
        const plays = [`play_id<=${receipt.previousPlayId}`, ...(pitchColumns.has('snapshot_json') ?
          [['frame', 'match', 'playId'], ['beforeTimeline', 'playId'], ['result', 'pitch', 'resolution', 'timeline', 'playId']]
            .map(path => `EXISTS(SELECT 1 FROM (${metadataNodes('snapshot_json', path)}) p WHERE p.type='integer' AND p.atom<=${receipt.previousPlayId})`) : [])];
        const pitchRows = db.prepare(`SELECT * FROM physical_pitch_progress_actions WHERE (${games.join(' OR ')}) AND (${plays.join(' OR ')})`).all({ game: application.match_id });
        for (const pitch of pitchRows) {
          if (typeof pitch.source_id === 'string') originalPitchIds.add(pitch.source_id);
          for (const [column, path] of [['source_json', ['sourceId']], ['snapshot_json', ['source', 'sourceId']]] as const) {
            if (!pitchColumns.has(column)) continue;
            const mirrors = db.prepare(`SELECT type,atom FROM (${metadataNodes('$document', path)})`).all({ document: String(pitch[column]) });
            for (const mirror of mirrors) if (mirror.type === 'text') originalPitchIds.add(String(mirror.atom));
          }
        }
      }
      for (const table of liveTables) {
        const tableColumns = columns(table), hasSnapshot = tableColumns.has('snapshot_json');
        const hasReferences = tableColumns.has('physical_pitch_source_id') || tableColumns.has('source_json') || hasSnapshot;
        const pitchIds = 'SELECT value FROM json_each($pitchIds)';
        const referenceMirrors = [
          ...(tableColumns.has('source_json') ? [['source_json', ['physicalPitchSourceId']]] as const : []),
          ...(hasSnapshot ? [['snapshot_json', ['physicalPitchSourceId']], ['snapshot_json', ['source', 'physicalPitchSourceId']],
            ['snapshot_json', ['history', { array: 'all' }, 'physicalPitchSourceId']], ['snapshot_json', ['history', 'physicalPitchSourceId']]] as const : []),
        ];
        const scopeClaims = ['game_id=$game', ...(hasSnapshot ? [metadataId('snapshot_json', ['gameId'], '$game')] : []),
          ...(tableColumns.has('physical_pitch_source_id') ? [`physical_pitch_source_id IN (${pitchIds})`] : []),
          ...referenceMirrors.map(([column, path]) =>
            `EXISTS(SELECT 1 FROM (${metadataNodes(column, path)}) p WHERE p.type='text' AND p.atom IN (${pitchIds}))`)];
        const claims: Record<string, import('node:sqlite').SQLOutputValue>[] = db.prepare(`SELECT * FROM ${table} WHERE ${scopeClaims.join(' OR ')}`)
          .all({ game: application.match_id, ...(hasReferences ? { pitchIds: JSON.stringify([...originalPitchIds]) } : {}) });
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
          if ((claim.play_id as number) <= receipt.previousPlayId) scopedPlays.add(claim.play_id as number);
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
    checked.add(sourceId); return ready;
  };
  for (const playId of scopedPlays) {
    if (!hasOwner) throw new Error('prior actual live closure staged owner is missing');
    const ownerColumns = columns('actual_live_play_closures');
    if (!['source_id', 'game_id', 'play_id'].every(key => ownerColumns.has(key))) throw new Error('prior actual live closure staged owner is missing or corrupt');
    const gameClaim = ownerColumns.has('proposal_json') ? metadataId('proposal_json', ['gameId'], '$game') : '0';
    const playClaim = ownerColumns.has('proposal_json') ? `EXISTS(SELECT 1 FROM (${metadataNodes('proposal_json', ['playId'])}) p WHERE p.atom=$play)` : '0';
    const owners = db.prepare(`SELECT source_id FROM actual_live_play_closures WHERE (game_id=$game OR ${gameClaim}) AND (play_id=$play OR ${playClaim})`)
      .all({ game: gameId, play: playId });
    if (owners.length !== 1) throw new Error('prior actual live closure staged owner is missing or ambiguous');
    requireReady(String(owners[0].source_id), playId);
  }
  if (rows.length && !checked.has(String(rows[0].source_id))) {
    const ready = requireReady(String(rows[0].source_id));
    if (ready.closure.proposal.application.applicationId !== applicationId) throw new Error('prior actual live closure activation differs');
  }
};
